import type { PayloadRequest } from 'payload'

import {
  authorizedTenantIDs,
  isPlatformAdmin,
  type MembershipSection,
} from '../access/memberships'
import { isPlatformLocale, tenantLocaleCodes, type PlatformLocaleCode } from '../i18n/locales'

/**
 * Shared request handling for the public v1 content API.
 *
 * Every content type resolves auth, tenant, locale, fallback and pagination the
 * same way; only the query and the response mapping differ.
 */

export type PublicFallbackMode = 'default' | 'none'

const apiHeaders = (): Headers =>
  new Headers({
    'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    'Content-Type': 'application/json',
    Vary: 'Authorization',
  })

export const json = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: apiHeaders(), status })

export const errorResponse = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status)

export const routeParam = (req: PayloadRequest, name: string): string | null => {
  const value = req.routeParams?.[name]
  return typeof value === 'string' && value.length > 0 ? value : null
}

const integerQuery = (
  searchParams: URLSearchParams,
  name: string,
  defaultValue: number,
  maximum: number,
): number | null => {
  const raw = searchParams.get(name)
  if (raw === null) return defaultValue

  const value = Number(raw)
  return Number.isInteger(value) && value > 0 && value <= maximum ? value : null
}

const isAPIKeyRequest = (req: PayloadRequest): boolean =>
  Boolean(req.user) && Boolean(req.headers.get('authorization')?.startsWith('users API-Key '))

export const normalizeMedia = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string') {
    return null
  }

  const sizes: Record<string, unknown> =
    'sizes' in value && value.sizes && typeof value.sizes === 'object'
      ? (value.sizes as Record<string, unknown>)
      : {}
  const imageSize = (name: string) => {
    const candidate = sizes[name]
    if (!candidate || typeof candidate !== 'object' || !('url' in candidate)) return null
    if (typeof candidate.url !== 'string') return null

    return {
      height:
        'height' in candidate && typeof candidate.height === 'number' ? candidate.height : null,
      url: candidate.url,
      width: 'width' in candidate && typeof candidate.width === 'number' ? candidate.width : null,
    }
  }

  return {
    altText: 'altText' in value && typeof value.altText === 'string' ? value.altText : '',
    height: 'height' in value && typeof value.height === 'number' ? value.height : null,
    sizes: {
      card: imageSize('card'),
      hero: imageSize('hero'),
      thumbnail: imageSize('thumbnail'),
    },
    url: value.url,
    width: 'width' in value && typeof value.width === 'number' ? value.width : null,
  }
}

export type PublicTenant = {
  defaultLocale?: unknown
  id: number | string
  slug?: unknown
  supportedLocales?: unknown
}

export type PublicRequestContext = {
  fallback: PublicFallbackMode
  limit: number
  page: number
  requestedLocale: PlatformLocaleCode
  searchParams: URLSearchParams
  slug: null | string
  sourceLocale: PlatformLocaleCode
  supportedLocales: PlatformLocaleCode[]
  tenant: PublicTenant
  tenantSlug: string
}

/**
 * Validates a public API request for one content section. Returns either a
 * ready error Response or the resolved context.
 */
export const resolvePublicRequest = async (
  req: PayloadRequest,
  section: MembershipSection,
): Promise<PublicRequestContext | Response> => {
  if (!isAPIKeyRequest(req) || !req.user || req.user.status !== 'active') {
    return errorResponse('unauthorized', 'A valid content API key is required.', 401)
  }

  const tenantSlug = routeParam(req, 'tenant')
  if (!tenantSlug) return errorResponse('invalid_tenant', 'A tenant slug is required.', 400)

  const allowedTenantIDs = authorizedTenantIDs(req.user, {
    capabilities: ['read'],
    sections: [section],
  })
  if (!isPlatformAdmin(req.user) && allowedTenantIDs.length === 0) {
    return errorResponse('not_found', 'Tenant not found.', 404)
  }

  const url = new URL(req.url ?? 'http://localhost')
  const fallback = url.searchParams.get('fallback') ?? 'none'
  if (fallback !== 'none' && fallback !== 'default') {
    return errorResponse('invalid_fallback', 'Fallback must be `none` or `default`.', 400)
  }

  const page = integerQuery(url.searchParams, 'page', 1, 10_000)
  const limit = integerQuery(url.searchParams, 'limit', 20, 50)
  if (page === null || limit === null) {
    return errorResponse('invalid_pagination', 'Use a positive page and a limit from 1 to 50.', 400)
  }

  const tenantResult = await req.payload.find({
    collection: 'tenants',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    req,
    user: req.user,
    where: {
      and: [
        { slug: { equals: tenantSlug } },
        { status: { equals: 'active' } },
        ...(isPlatformAdmin(req.user) ? [] : [{ id: { in: allowedTenantIDs } }]),
      ],
    },
  })
  const tenant = tenantResult.docs[0]
  if (!tenant) return errorResponse('not_found', 'Tenant not found.', 404)

  const supportedLocales = tenantLocaleCodes(tenant.supportedLocales)
  const sourceLocale = tenant.defaultLocale as PlatformLocaleCode
  const requestedLocale = url.searchParams.get('locale') ?? sourceLocale
  if (!isPlatformLocale(requestedLocale) || !supportedLocales.includes(requestedLocale)) {
    return errorResponse('unsupported_locale', 'The requested locale is not enabled.', 400)
  }

  return {
    fallback,
    limit,
    page,
    requestedLocale,
    searchParams: url.searchParams,
    slug: routeParam(req, 'slug'),
    sourceLocale,
    supportedLocales,
    tenant,
    tenantSlug,
  }
}

export const publicMeta = (
  context: PublicRequestContext,
  resolvedLocales: PlatformLocaleCode[],
  pagination?: {
    hasNextPage: boolean
    hasPrevPage: boolean
    returnedItems: number
  },
) => ({
  fallbackLocale: context.fallback === 'default' ? context.sourceLocale : null,
  fallbackUsed: resolvedLocales.some((locale) => locale !== context.requestedLocale),
  generatedAt: new Date().toISOString(),
  requestedLocale: context.requestedLocale,
  resolvedLocales,
  tenant: context.tenantSlug,
  version: 'v1',
  ...(pagination
    ? {
        pagination: {
          ...pagination,
          limit: context.limit,
          page: context.page,
        },
      }
    : {}),
})
