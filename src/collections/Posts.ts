import type { CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { relationshipID } from '../access/memberships'
import { requiredTenantField, slugField, tenantSlugIndex } from '../content/fields'
import {
  createLocalizedWorkflowHook,
  translationStatesField,
  validateMediaTenant,
} from '../content/localizedWorkflow'
import { hiddenWithoutSection, sectionAccess } from '../content/sectionAccess'
import { createWebsiteRevalidationHook } from '../hooks/websiteRevalidation'

type PostWriteData = {
  _status?: 'draft' | 'published'
  author?: unknown
  body?: unknown
  categories?: unknown
  coverImage?: unknown
  excerpt?: unknown
  publishedAt?: null | string
  publishedBy?: unknown
  publishedDate?: unknown
  seo?: { metaDescription?: unknown; metaTitle?: unknown; ogImage?: unknown } | null
  tenant?: unknown
  title?: unknown
  translationStates?: unknown
}

const localizedPostContent = (data: PostWriteData, originalDoc?: PostWriteData) => ({
  body: data.body ?? originalDoc?.body ?? null,
  excerpt: data.excerpt ?? originalDoc?.excerpt ?? null,
  metaDescription: data.seo?.metaDescription ?? originalDoc?.seo?.metaDescription ?? null,
  metaTitle: data.seo?.metaTitle ?? originalDoc?.seo?.metaTitle ?? null,
  title: data.title ?? originalDoc?.title ?? null,
})

const hasLexicalText = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  if ('text' in value && typeof value.text === 'string' && value.text.trim().length > 0) return true
  if ('type' in value && value.type === 'upload') return true

  const children =
    'root' in value && value.root && typeof value.root === 'object'
      ? (value.root as { children?: unknown }).children
      : 'children' in value
        ? value.children
        : null

  return Array.isArray(children) && children.some(hasLexicalText)
}

const hasRequiredPostContent = (content: unknown): boolean => {
  const data = content as ReturnType<typeof localizedPostContent>
  return typeof data.title === 'string' && data.title.trim().length > 0 && hasLexicalText(data.body)
}

const validatePostWrite = createLocalizedWorkflowHook<PostWriteData>({
  hasRequiredContent: hasRequiredPostContent,
  label: 'post',
  localizedContent: localizedPostContent,
  requiredContentMessage: 'A title and body are required before approving a translation.',
  section: 'marketing',
})

const assertSameTenant = async (
  req: PayloadRequest,
  collection: 'authors' | 'categories',
  value: unknown,
  tenantID: number | string,
): Promise<void> => {
  const ids = (Array.isArray(value) ? value : [value])
    .map(relationshipID)
    .filter((id): id is number | string => id !== null)
  if (ids.length === 0) return

  const result = await req.payload.find({
    collection,
    depth: 0,
    limit: ids.length,
    overrideAccess: false,
    pagination: false,
    req,
    select: { tenant: true },
    user: req.user ?? undefined,
    where: { id: { in: ids } },
  })

  const sameTenant = result.docs.filter(
    (doc) => String(relationshipID(doc.tenant)) === String(tenantID),
  )
  if (sameTenant.length !== new Set(ids.map(String)).size) {
    throw new Error(`Every linked ${collection} entry must belong to the same tenant as the post.`)
  }
}

const validatePostReferences: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
  if (tenantID === null) return data

  await validateMediaTenant(req, data.coverImage, tenantID, 'Post')
  await validateMediaTenant(req, data.seo?.ogImage, tenantID, 'Post')
  await assertSameTenant(req, 'authors', data.author, tenantID)
  await assertSameTenant(req, 'categories', data.categories, tenantID)
  return data
}

const setPublicationAudit: CollectionBeforeChangeHook = ({ context, data, originalDoc, req }) => {
  if (data._status === 'published' && originalDoc?._status !== 'published') {
    // Silent imports keep the article's original date as its publication time.
    data.publishedAt ??=
      context.skipNotifications && typeof data.publishedDate === 'string'
        ? data.publishedDate
        : new Date().toISOString()
    data.publishedBy ??= req.user?.id
  }
  return data
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: sectionAccess('marketing'),
  admin: {
    defaultColumns: ['title', 'slug', 'publishedDate', '_status', 'updatedAt'],
    group: 'Content',
    hidden: hiddenWithoutSection('marketing'),
    useAsTitle: 'title',
  },
  fields: [
    requiredTenantField,
    slugField,
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'excerpt', type: 'textarea', localized: true },
    { name: 'body', type: 'richText', localized: true },
    {
      name: 'publishedDate',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: 'The date readers see. Imported articles keep their original date.',
        position: 'sidebar',
      },
      index: true,
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      admin: { position: 'sidebar' },
      relationTo: 'authors',
    },
    {
      name: 'categories',
      type: 'relationship',
      admin: { position: 'sidebar' },
      hasMany: true,
      relationTo: 'categories',
    },
    { name: 'coverImage', type: 'upload', relationTo: 'media' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', localized: true },
        { name: 'metaDescription', type: 'textarea', localized: true },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
        {
          name: 'canonicalURL',
          type: 'text',
          admin: { description: 'Only set when the canonical copy lives on another URL.' },
        },
        { name: 'noIndex', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'legacyPath',
      type: 'text',
      admin: {
        description: 'Previous public path, used by the website to emit a permanent redirect.',
        position: 'sidebar',
      },
      index: true,
    },
    translationStatesField('post_translations'),
    {
      name: 'publishedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'publishedBy',
      type: 'relationship',
      access: { create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true },
      relationTo: 'users',
    },
  ],
  hooks: {
    afterChange: [createWebsiteRevalidationHook('post')],
    beforeChange: [validatePostReferences, setPublicationAudit],
    beforeValidate: [validatePostWrite],
  },
  indexes: [tenantSlugIndex],
  versions: {
    drafts: {
      autosave: { interval: 1500, showSaveDraftButton: true },
      validate: false,
    },
    maxPerDoc: 50,
  },
}
