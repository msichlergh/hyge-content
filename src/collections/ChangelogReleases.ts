import { tenantField } from '@payloadcms/plugin-multi-tenant/fields'
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  PayloadRequest,
  SingleRelationshipField,
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
  isPlatformLocale,
  tenantLocaleCodes,
  type PlatformLocaleCode,
} from '../i18n/locales'
import {
  localizedContentVersion,
  normalizeTranslationStates,
  syncTranslationStateLocales,
  type TranslationStateEntry,
} from '../i18n/translationStates'

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

const requiredTenantField: SingleRelationshipField = {
  ...tenantField({
    isAutosaveEnabled: true,
    name: 'tenant',
    tenantsArrayFieldName: 'memberships',
    tenantsArrayTenantFieldName: 'tenant',
    tenantsCollectionSlug: 'tenants',
    unique: false,
  }),
  required: true,
}

const isDraftOnlyRequest = (req: PayloadRequest): boolean => {
  const draft = req.query?.draft
  return draft === true || draft === 'true'
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
}): void => {
  assertTenantAssignment(req.user, tenantID, {
    capabilities: ['draft'],
    sections: ['changelog'],
  })

  const targetStatus = data._status ?? originalDoc?._status
  const isPublishing = targetStatus === 'published' && !isDraftOnlyRequest(req)
  const isUnpublishing =
    originalDoc?._status === 'published' &&
    targetStatus === 'draft' &&
    !isDraftOnlyRequest(req)

  if (isPublishing || isUnpublishing) {
    assertTenantAssignment(req.user, tenantID, {
      capabilities: ['publish'],
      sections: ['changelog'],
    })
  }
}

const localizedReleaseContent = (data: ChangelogWriteData, originalDoc?: ChangelogWriteData) => ({
  features: data.features ?? originalDoc?.features ?? [],
  fixes: data.fixes ?? originalDoc?.fixes ?? [],
  flagship: data.flagship ?? originalDoc?.flagship ?? null,
  headline: data.headline ?? originalDoc?.headline ?? null,
  improvements: data.improvements ?? originalDoc?.improvements ?? [],
  kicker: data.kicker ?? originalDoc?.kicker ?? null,
})

const hasRequiredLocalizedContent = (data: ReturnType<typeof localizedReleaseContent>): boolean =>
  typeof data.headline === 'string' && data.headline.trim().length > 0 &&
  typeof data.kicker === 'string' && data.kicker.trim().length > 0

const requestedTranslationState = (
  incoming: unknown,
  locale: PlatformLocaleCode,
): TranslationStateEntry | undefined =>
  normalizeTranslationStates(incoming).find((entry) => entry.locale === locale)

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

const validateChangelogWrite: CollectionBeforeValidateHook = async ({
  data: incomingData,
  operation,
  originalDoc: incomingOriginalDoc,
  req,
}) => {
  if (!incomingData) return incomingData

  const data = incomingData as ChangelogWriteData
  const originalDoc = incomingOriginalDoc as ChangelogWriteData | undefined
  const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
  if (tenantID === null) throw new Error('A tenant is required for every changelog release.')

  assertChangelogWriteAccess({ data, originalDoc, req, tenantID })

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

  if (
    operation === 'update' &&
    relationshipID(originalDoc?.tenant) !== null &&
    String(relationshipID(originalDoc?.tenant)) !== String(tenantID)
  ) {
    throw new Error('The tenant assigned to a changelog release is immutable.')
  }

  const tenant = await req.payload.findByID({
    collection: 'tenants',
    depth: 0,
    id: tenantID,
    overrideAccess: false,
    req,
    select: {
      defaultLocale: true,
      supportedLocales: true,
    },
    user: req.user ?? undefined,
  })

  const sourceLocale = tenant.defaultLocale as PlatformLocaleCode
  const supportedLocales = tenantLocaleCodes(tenant.supportedLocales)
  const currentLocale = isPlatformLocale(req.locale) ? req.locale : sourceLocale
  if (!supportedLocales.includes(currentLocale)) {
    throw new Error('The selected locale is not enabled for this tenant.')
  }
  if (operation === 'create' && currentLocale !== sourceLocale) {
    throw new Error('Create the release in the tenant default locale before translating it.')
  }

  const originalStates = syncTranslationStateLocales(
    originalDoc?.translationStates,
    supportedLocales,
    sourceLocale,
  )
  const nextStates = syncTranslationStateLocales(
    originalDoc?.translationStates,
    supportedLocales,
    sourceLocale,
  )
  const originalContent = localizedReleaseContent(originalDoc ?? {})
  const nextContent = localizedReleaseContent(data, originalDoc)
  const originalContentVersion = localizedContentVersion(originalContent)
  const nextContentVersion = localizedContentVersion(nextContent)
  const contentChanged = operation === 'create' || originalContentVersion !== nextContentVersion
  const sourceState = nextStates.find((entry) => entry.locale === sourceLocale)
  const sourceVersion =
    currentLocale === sourceLocale
      ? nextContentVersion
      : sourceState?.contentVersion ?? sourceState?.sourceVersion ?? nextContentVersion
  const targetStatus = data._status ?? originalDoc?._status

  if (currentLocale === sourceLocale) {
    for (const state of nextStates) {
      if (state.locale === sourceLocale) {
        state.contentVersion = nextContentVersion
        state.sourceVersion = nextContentVersion
        state.state =
          targetStatus === 'published' && !isDraftOnlyRequest(req) ? 'approved' : 'draft'
      } else if (contentChanged && state.state === 'approved') {
        state.state = 'stale'
      }
    }
  } else {
    const originalState = originalStates.find((entry) => entry.locale === currentLocale)
    const nextState = nextStates.find((entry) => entry.locale === currentLocale)
    const requestedState = requestedTranslationState(data.translationStates, currentLocale)

    if (nextState) {
      const explicitlyChangedState =
        requestedState !== undefined && requestedState.state !== originalState?.state

      if (contentChanged) {
        nextState.contentVersion = nextContentVersion
        nextState.sourceVersion = sourceVersion
        nextState.state = explicitlyChangedState ? requestedState.state : 'draft'
      } else if (explicitlyChangedState) {
        nextState.state = requestedState.state
      }
    }

    if (nextState?.state === 'approved') {
      if (!hasRequiredLocalizedContent(nextContent)) {
        throw new Error('Headline and kicker are required before approving a translation.')
      }
      nextState.sourceVersion = sourceVersion
    }
  }

  data.translationStates = nextStates
  return data
}

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

const validateMediaTenant = async (
  req: PayloadRequest,
  mediaValue: unknown,
  tenantID: number | string,
): Promise<void> => {
  const mediaID = relationshipID(mediaValue)
  if (mediaID === null) return

  const media = await req.payload.findByID({
    collection: 'media',
    depth: 0,
    id: mediaID,
    overrideAccess: false,
    req,
    select: {
      status: true,
      tenant: true,
    },
    user: req.user ?? undefined,
  })

  if (String(relationshipID(media.tenant)) !== String(tenantID) || media.status !== 'active') {
    throw new Error('Changelog media must be active and belong to the same tenant.')
  }
}

const validateChangelogMedia: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
  if (tenantID === null) return data

  const coverType = data.coverType ?? originalDoc?.coverType
  const coverImage = data.coverImage ?? originalDoc?.coverImage
  if (data._status === 'published' && coverType === 'media' && relationshipID(coverImage) === null) {
    throw new Error('A cover image is required when the cover type is uploaded image.')
  }

  await validateMediaTenant(req, coverImage, tenantID)
  return data
}

const translationStateFields = [
  {
    name: 'locale',
    type: 'select' as const,
    options: [
      { label: 'English', value: 'en' },
      { label: 'German', value: 'de' },
      { label: 'Spanish', value: 'es' },
      { label: 'French', value: 'fr' },
      { label: 'Arabic', value: 'ar' },
    ],
    required: true,
  },
  {
    name: 'state',
    type: 'select' as const,
    options: [
      { label: 'Missing', value: 'missing' },
      { label: 'Draft', value: 'draft' },
      { label: 'Ready for review', value: 'review' },
      { label: 'Approved', value: 'approved' },
      { label: 'Stale', value: 'stale' },
    ],
    required: true,
  },
  {
    name: 'sourceLocale',
    dbName: 'source_locale',
    type: 'select' as const,
    admin: { readOnly: true },
    options: [
      { label: 'English', value: 'en' },
      { label: 'German', value: 'de' },
      { label: 'Spanish', value: 'es' },
      { label: 'French', value: 'fr' },
      { label: 'Arabic', value: 'ar' },
    ],
    required: true,
  },
  {
    name: 'sourceVersion',
    type: 'text' as const,
    admin: { readOnly: true },
  },
  {
    name: 'contentVersion',
    type: 'text' as const,
    admin: { hidden: true, readOnly: true },
  },
]

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
    {
      name: 'slug',
      type: 'text',
      index: true,
      required: true,
      validate: (value: null | string | undefined) =>
        !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers, and single hyphens only.',
    },
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
    {
      name: 'translationStates',
      dbName: 'cl_translations',
      type: 'array',
      admin: {
        description:
          'Only approved locales are served publicly. Source edits mark approved translations stale.',
      },
      fields: translationStateFields,
      required: true,
    },
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
