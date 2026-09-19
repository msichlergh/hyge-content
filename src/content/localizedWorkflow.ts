import type { CollectionBeforeValidateHook, Field, PayloadRequest } from 'payload'

import {
  assertTenantAssignment,
  relationshipID,
  type MembershipSection,
} from '../access/memberships'
import {
  isPlatformLocale,
  platformLocaleOptions,
  tenantLocaleCodes,
  type PlatformLocaleCode,
} from '../i18n/locales'
import {
  localizedContentVersion,
  normalizeTranslationStates,
  syncTranslationStateLocales,
  type TranslationStateEntry,
} from '../i18n/translationStates'

/**
 * Shared editorial workflow for tenant-owned, localized, draft-enabled content.
 *
 * Every localized collection follows the same rules: content is created in the
 * tenant's default locale, each supported locale carries a translation state,
 * only approved locales are served publicly, and editing the source marks
 * approved translations stale. Collections supply only what differs: which
 * section grants access and which fields count as localized content.
 */

type WorkflowData = {
  _status?: 'draft' | 'published'
  tenant?: unknown
  translationStates?: unknown
}

export const isDraftOnlyRequest = (req: PayloadRequest): boolean => {
  const draft = req.query?.draft
  return draft === true || draft === 'true'
}

export const assertSectionWriteAccess = ({
  data,
  originalDoc,
  req,
  section,
  tenantID,
}: {
  data: WorkflowData
  originalDoc?: WorkflowData
  req: PayloadRequest
  section: MembershipSection
  tenantID: number | string
}): void => {
  assertTenantAssignment(req.user, tenantID, {
    capabilities: ['draft'],
    sections: [section],
  })

  const targetStatus = data._status ?? originalDoc?._status
  const isPublishing = targetStatus === 'published' && !isDraftOnlyRequest(req)
  const isUnpublishing =
    originalDoc?._status === 'published' && targetStatus === 'draft' && !isDraftOnlyRequest(req)

  if (isPublishing || isUnpublishing) {
    assertTenantAssignment(req.user, tenantID, {
      capabilities: ['publish'],
      sections: [section],
    })
  }
}

export type LocalizedWorkflowOptions<TData extends WorkflowData> = {
  /** Human label used in error messages, e.g. "changelog release". */
  label: string
  section: MembershipSection
  /** The localized fields whose change marks translations stale. */
  localizedContent: (data: TData, originalDoc?: TData) => unknown
  /** Whether a locale has enough content to be approved. */
  hasRequiredContent: (content: unknown) => boolean
  requiredContentMessage: string
  /** Extra collection-specific checks run after tenant access is confirmed. */
  beforeWorkflow?: (args: {
    data: TData
    operation: 'create' | 'update'
    originalDoc?: TData
    req: PayloadRequest
    tenantID: number | string
  }) => Promise<void> | void
}

const requestedTranslationState = (
  incoming: unknown,
  locale: PlatformLocaleCode,
): TranslationStateEntry | undefined =>
  normalizeTranslationStates(incoming).find((entry) => entry.locale === locale)

export const createLocalizedWorkflowHook = <TData extends WorkflowData>(
  options: LocalizedWorkflowOptions<TData>,
): CollectionBeforeValidateHook =>
  async ({ data: incomingData, operation, originalDoc: incomingOriginalDoc, req }) => {
    if (!incomingData) return incomingData

    const data = incomingData as TData
    const originalDoc = incomingOriginalDoc as TData | undefined
    const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
    if (tenantID === null) throw new Error(`A tenant is required for every ${options.label}.`)

    assertSectionWriteAccess({ data, originalDoc, req, section: options.section, tenantID })

    await options.beforeWorkflow?.({
      data,
      operation: operation === 'create' ? 'create' : 'update',
      originalDoc,
      req,
      tenantID,
    })

    if (
      operation === 'update' &&
      relationshipID(originalDoc?.tenant) !== null &&
      String(relationshipID(originalDoc?.tenant)) !== String(tenantID)
    ) {
      throw new Error(`The tenant assigned to a ${options.label} is immutable.`)
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
      throw new Error(`Create the ${options.label} in the tenant default locale before translating it.`)
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
    const nextContent = options.localizedContent(data, originalDoc)
    const originalContentVersion = localizedContentVersion(
      options.localizedContent((originalDoc ?? {}) as TData),
    )
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
        if (!options.hasRequiredContent(nextContent)) {
          throw new Error(options.requiredContentMessage)
        }
        nextState.sourceVersion = sourceVersion
      }
    }

    data.translationStates = nextStates
    return data
  }

export const validateMediaTenant = async (
  req: PayloadRequest,
  mediaValue: unknown,
  tenantID: number | string,
  label: string,
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
    throw new Error(`${label} media must be active and belong to the same tenant.`)
  }
}

export const translationStateFields: Field[] = [
  {
    name: 'locale',
    type: 'select',
    options: platformLocaleOptions,
    required: true,
  },
  {
    name: 'state',
    type: 'select',
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
    type: 'select',
    admin: { readOnly: true },
    options: platformLocaleOptions,
    required: true,
  },
  {
    name: 'sourceVersion',
    type: 'text',
    admin: { readOnly: true },
  },
  {
    name: 'contentVersion',
    type: 'text',
    admin: { hidden: true, readOnly: true },
  },
]

export const translationStatesField = (dbName: string): Field => ({
  name: 'translationStates',
  dbName,
  type: 'array',
  admin: {
    description:
      'Only approved locales are served publicly. Source edits mark approved translations stale.',
  },
  fields: translationStateFields,
  required: true,
})
