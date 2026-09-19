import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'

import {
  assertTenantAssignment,
  isPlatformAdmin,
  relationshipID,
  tenantScopedAccess,
  tenantScopedCreateAccess,
  type Membership,
} from '../access/memberships'
import {
  assertSectionWriteAccess,
  createLocalizedWorkflowHook,
  translationStatesField,
  validateMediaTenant,
} from '../content/localizedWorkflow'
import { requiredTenantField, slugField, tenantSlugIndex } from '../content/fields'
import { revalidateChangelogWebsite } from '../hooks/websiteRevalidation'
import { localizedContentVersion } from '../i18n/translationStates'

type ChangelogWriteData = {
  _status?: 'draft' | 'published'
  coverImage?: unknown
  coverType?: unknown
  features?: unknown
  fixes?: unknown
  flagship?: unknown
  headline?: unknown
  improvements?: unknown
  kicker?: unknown
  notificationOptions?: unknown
  publishedAt?: null | string
  publishedBy?: unknown
  releaseDate?: unknown
  slug?: unknown
  tenant?: unknown
  translationStates?: unknown
}

export const assertChangelogWriteAccess = ({
  data,
  originalDoc,
  req,
  tenantID,
}: {
  data: ChangelogWriteData
  originalDoc?: ChangelogWriteData
  req: PayloadRequest
  tenantID: number | string
}): void => assertSectionWriteAccess({ data, originalDoc, req, section: 'changelog', tenantID })

const localizedReleaseContent = (data: ChangelogWriteData, originalDoc?: ChangelogWriteData) => ({
  features: data.features ?? originalDoc?.features ?? [],
  fixes: data.fixes ?? originalDoc?.fixes ?? [],
  flagship: data.flagship ?? originalDoc?.flagship ?? null,
  headline: data.headline ?? originalDoc?.headline ?? null,
  improvements: data.improvements ?? originalDoc?.improvements ?? [],
  kicker: data.kicker ?? originalDoc?.kicker ?? null,
})

const hasRequiredLocalizedContent = (content: unknown): boolean => {
  const data = content as ReturnType<typeof localizedReleaseContent>
  return (
    typeof data.headline === 'string' && data.headline.trim().length > 0 &&
    typeof data.kicker === 'string' && data.kicker.trim().length > 0
  )
}

const hasNotificationIntent = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false

  return (
    ('emailEnabled' in value && value.emailEnabled === true) ||
    ('slackEnabled' in value && value.slackEnabled === true) ||
    ['emailSubject', 'emailPreheader', 'slackIntro'].some(
      (field) => field in value && typeof value[field as keyof typeof value] === 'string' &&
        String(value[field as keyof typeof value]).trim().length > 0,
    ) ||
    ('audienceProvider' in value &&
      typeof value.audienceProvider === 'string' &&
      value.audienceProvider !== 'none')
  )
}

const validateChangelogWrite = createLocalizedWorkflowHook<ChangelogWriteData>({
  beforeWorkflow: ({ data, operation, originalDoc, req, tenantID }) => {
    const nextNotificationOptions = data.notificationOptions ?? originalDoc?.notificationOptions
    const notificationOptionsChanged =
      operation === 'create'
        ? hasNotificationIntent(nextNotificationOptions)
        : data.notificationOptions !== undefined &&
          localizedContentVersion(nextNotificationOptions) !==
            localizedContentVersion(originalDoc?.notificationOptions)
    if (notificationOptionsChanged) {
      assertTenantAssignment(req.user, tenantID, {
        capabilities: ['notify'],
        sections: ['changelog'],
      })
    }
  },
  hasRequiredContent: hasRequiredLocalizedContent,
  label: 'changelog release',
  localizedContent: localizedReleaseContent,
  requiredContentMessage: 'Headline and kicker are required before approving a translation.',
  section: 'changelog',
})

const setPublicationAudit: CollectionBeforeChangeHook = ({ context, data, originalDoc, req }) => {
  if (data._status === 'published' && originalDoc?._status !== 'published') {
    data.publishedAt ??=
      context.skipNotifications && typeof data.releaseDate === 'string'
        ? data.releaseDate
        : new Date().toISOString()
    data.publishedBy ??= req.user?.id
  }

  return data
}

const validateChangelogMedia: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
  if (tenantID === null) return data

  const coverType = data.coverType ?? originalDoc?.coverType
  const coverImage = data.coverImage ?? originalDoc?.coverImage
  if (data._status === 'published' && coverType === 'media' && relationshipID(coverImage) === null) {
    throw new Error('A cover image is required when the cover type is uploaded image.')
  }

  await validateMediaTenant(req, coverImage, tenantID, 'Changelog')
  return data
}

const releaseItemsField = (name: 'features' | 'fixes' | 'improvements', label: string) => ({
  name,
  type: 'array' as const,
  fields: [
    {
      name: 'area',
      type: 'text' as const,
      required: true,
    },
    {
      name: 'title',
      type: 'text' as const,
      localized: true,
      required: true,
    },
    {
      name: 'body',
      type: 'textarea' as const,
      localized: true,
    },
  ],
  label,
})

export const ChangelogReleases: CollectionConfig = {
  slug: 'changelog-releases',
  dbName: 'changelog',
  indexes: [tenantSlugIndex],
  access: {
    create: tenantScopedCreateAccess({ capabilities: ['draft'], sections: ['changelog'] }),
    delete: tenantScopedAccess({ capabilities: ['draft'], sections: ['changelog'] }),
    read: tenantScopedAccess({ capabilities: ['read'], sections: ['changelog'] }),
    update: tenantScopedAccess({ capabilities: ['draft'], sections: ['changelog'] }),
  },
  admin: {
    defaultColumns: ['releaseDate', 'headline', 'slug', '_status', 'updatedAt'],
    group: 'Content',
    hidden: ({ user }) =>
      !isPlatformAdmin(user) &&
      !user?.memberships?.some((membership: Membership) =>
        membership.sections?.includes('changelog'),
      ),
    useAsTitle: 'headline',
  },
  fields: [
    requiredTenantField,
    {
      name: 'releaseDate',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayOnly' } },
      index: true,
      required: true,
    },
    slugField,
    {
      name: 'headline',
      type: 'text',
      localized: true,
      required: true,
    },
    {
      name: 'kicker',
      type: 'textarea',
      localized: true,
      required: true,
    },
    {
      name: 'coverType',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Affiliate', value: 'affiliate' },
        { label: 'Trade copier', value: 'copier' },
        { label: 'Security', value: 'security' },
        { label: 'Payments', value: 'payments' },
        { label: 'Uploaded image', value: 'media' },
      ],
      required: true,
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'flagship',
      type: 'group',
      fields: [
        { name: 'label', type: 'text', localized: true },
        { name: 'title', type: 'text', localized: true },
        { name: 'body', type: 'textarea', localized: true },
        {
          name: 'surface',
          type: 'select',
          options: [
            { label: 'Affiliate', value: 'affiliate' },
            { label: 'Trade copier', value: 'copier' },
            { label: 'Security', value: 'security' },
            { label: 'Payments', value: 'payments' },
          ],
        },
      ],
    },
    releaseItemsField('features', 'New features'),
    releaseItemsField('improvements', 'Improvements'),
    releaseItemsField('fixes', 'Fixes'),
    {
      name: 'notificationOptions',
      type: 'group',
      admin: {
        description:
          'Delivery is implemented by Phase 3 jobs. Only users with notify capability can change these options.',
      },
      fields: [
        {
          name: 'emailEnabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'slackEnabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'emailSubject',
          type: 'text',
          localized: true,
        },
        {
          name: 'emailPreheader',
          type: 'text',
          localized: true,
        },
        {
          name: 'slackIntro',
          type: 'textarea',
          localized: true,
        },
        {
          name: 'audienceProvider',
          dbName: 'audience',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: 'None', value: 'none' },
            { label: 'CMS recipients', value: 'cms' },
            { label: 'External tenant API', value: 'external-api' },
          ],
          required: true,
        },
      ],
    },
    translationStatesField('cl_translations'),
    {
      name: 'publishedAt',
      type: 'date',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
    },
    {
      name: 'publishedBy',
      type: 'relationship',
      access: { create: () => false, update: () => false },
      admin: { readOnly: true },
      relationTo: 'users',
    },
  ],
  hooks: {
    afterChange: [revalidateChangelogWebsite],
    beforeChange: [validateChangelogMedia, setPublicationAudit],
    beforeValidate: [validateChangelogWrite],
  },
  versions: {
    drafts: {
      autosave: { interval: 1500, showSaveDraftButton: true },
      validate: false,
    },
    maxPerDoc: 100,
  },
}
