import type { Endpoint, PayloadRequest } from 'payload'

import { authorizedTenantIDs, isPlatformAdmin } from '../access/memberships'
import { isPlatformLocale, tenantLocaleCodes, type PlatformLocaleCode } from '../i18n/locales'
import { isApprovedTranslation } from '../i18n/translationStates'

type PublicFallbackMode = 'default' | 'none'

type PublicRelease = {
  _status?: unknown
  coverImage?: unknown
  coverType?: unknown
  features?: unknown
  fixes?: unknown
  flagship?: unknown
  headline?: unknown
  id: number | string
  improvements?: unknown
  kicker?: unknown
  releaseDate?: unknown
  slug?: unknown
  tenant?: unknown
  translationStates?: unknown
}

const apiHeaders = (): Headers =>
  new Headers({
    'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
    'Content-Type': 'application/json',
    Vary: 'Authorization',
  })

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: apiHeaders(), status })

const errorResponse = (code: string, message: string, status: number): Response =>
  json({ error: { code, message } }, status)

const routeParam = (req: PayloadRequest, name: string): string | null => {
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

const hasPublicCopy = (release: PublicRelease, locale: PlatformLocaleCode): boolean =>
  isApprovedTranslation(release.translationStates, locale) &&
  typeof release.headline === 'string' &&
  release.headline.trim().length > 0 &&
  typeof release.kicker === 'string' &&
  release.kicker.trim().length > 0

const normalizeItems = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const area = 'area' in item && typeof item.area === 'string' ? item.area : null
        const title = 'title' in item && typeof item.title === 'string' ? item.title : null
        if (!area || !title) return []

        return [
          {
            area,
            body: 'body' in item && typeof item.body === 'string' ? item.body : null,
            title,
          },
        ]
      })
    : []

const normalizeMedia = (value: unknown) => {
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

export const mapPublicChangelogRelease = (
  release: PublicRelease,
  resolvedLocale: PlatformLocaleCode,
) => ({
  cover: {
    image: normalizeMedia(release.coverImage),
    type: typeof release.coverType === 'string' ? release.coverType : 'none',
  },
  date: release.releaseDate,
  flagship:
    release.flagship && typeof release.flagship === 'object'
      ? {
          body:
            'body' in release.flagship && typeof release.flagship.body === 'string'
              ? release.flagship.body
              : null,
          label:
            'label' in release.flagship && typeof release.flagship.label === 'string'
              ? release.flagship.label
              : null,
          surface:
            'surface' in release.flagship && typeof release.flagship.surface === 'string'
              ? release.flagship.surface
              : null,
          title:
            'title' in release.flagship && typeof release.flagship.title === 'string'
              ? release.flagship.title
              : null,
        }
      : null,
  headline: release.headline,
  kicker: release.kicker,
  locale: resolvedLocale,
  sections: {
    features: normalizeItems(release.features),
    fixes: normalizeItems(release.fixes),
    improvements: normalizeItems(release.improvements),
  },
  slug: release.slug,
})

const resolveFallbacks = async ({
  fallbackMode,
  releases,
  req,
  requestedLocale,
  sourceLocale,
  tenantID,
}: {
  fallbackMode: PublicFallbackMode
  releases: PublicRelease[]
  req: PayloadRequest
  requestedLocale: PlatformLocaleCode
  sourceLocale: PlatformLocaleCode
  tenantID: number | string
}): Promise<{ release: PublicRelease; resolvedLocale: PlatformLocaleCode }[]> => {
  const resolved = new Map<
    string,
    { release: PublicRelease; resolvedLocale: PlatformLocaleCode }
  >()
  const fallbackIDs: (number | string)[] = []

  for (const release of releases) {
    if (hasPublicCopy(release, requestedLocale)) {
      resolved.set(String(release.id), { release, resolvedLocale: requestedLocale })
    } else if (fallbackMode === 'default' && requestedLocale !== sourceLocale) {
      fallbackIDs.push(release.id)
    }
  }

  if (fallbackIDs.length > 0) {
    const fallbackResult = await req.payload.find({
      collection: 'changelog-releases',
      depth: 1,
      draft: false,
      fallbackLocale: false,
      limit: fallbackIDs.length,
      locale: sourceLocale,
      overrideAccess: false,
      pagination: false,
      req,
      user: req.user ?? undefined,
      where: {
        and: [
          { id: { in: fallbackIDs } },
          { tenant: { equals: tenantID } },
          { _status: { equals: 'published' } },
        ],
      },
    })

    for (const release of fallbackResult.docs) {
      if (hasPublicCopy(release as PublicRelease, sourceLocale)) {
        resolved.set(String(release.id), {
          release: release as PublicRelease,
          resolvedLocale: sourceLocale,
        })
      }
    }
  }

  return releases.flatMap((release) => {
    const match = resolved.get(String(release.id))
    return match ? [match] : []
  })
}

export const handlePublicChangelog = async (req: PayloadRequest): Promise<Response> => {
  if (!isAPIKeyRequest(req) || !req.user || req.user.status !== 'active') {
    return errorResponse('unauthorized', 'A valid content API key is required.', 401)
  }

  const tenantSlug = routeParam(req, 'tenant')
  if (!tenantSlug) return errorResponse('invalid_tenant', 'A tenant slug is required.', 400)

  const allowedTenantIDs = authorizedTenantIDs(req.user, {
    capabilities: ['read'],
    sections: ['changelog'],
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
  const requestedLocaleValue = url.searchParams.get('locale') ?? sourceLocale
  if (
    !isPlatformLocale(requestedLocaleValue) ||
    !supportedLocales.includes(requestedLocaleValue)
  ) {
    return errorResponse('unsupported_locale', 'The requested locale is not enabled.', 400)
  }

  const slug = routeParam(req, 'slug')
  const releaseResult = await req.payload.find({
    collection: 'changelog-releases',
    depth: 1,
    draft: false,
    fallbackLocale: false,
    limit: slug ? 1 : limit,
    locale: requestedLocaleValue,
    overrideAccess: false,
    page: slug ? 1 : page,
    req,
    sort: '-releaseDate',
    user: req.user,
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { _status: { equals: 'published' } },
        ...(slug ? [{ slug: { equals: slug } }] : []),
      ],
    },
  })

  const resolved = await resolveFallbacks({
    fallbackMode: fallback,
    releases: releaseResult.docs as PublicRelease[],
    req,
    requestedLocale: requestedLocaleValue,
    sourceLocale,
    tenantID: tenant.id,
  })
  const data = resolved.map(({ release, resolvedLocale }) =>
    mapPublicChangelogRelease(release, resolvedLocale),
  )

  if (slug && data.length === 0) {
    return errorResponse('not_found', 'Published release not found for this locale.', 404)
  }

  const resolvedLocales = [...new Set(resolved.map(({ resolvedLocale }) => resolvedLocale))]
  const fallbackUsed = resolvedLocales.some((locale) => locale !== requestedLocaleValue)
  const meta = {
    fallbackLocale: fallback === 'default' ? sourceLocale : null,
    fallbackUsed,
    generatedAt: new Date().toISOString(),
    requestedLocale: requestedLocaleValue,
    resolvedLocales,
    tenant: tenantSlug,
    version: 'v1',
    ...(slug
      ? {}
      : {
          pagination: {
            hasNextPage: releaseResult.hasNextPage,
            hasPrevPage: releaseResult.hasPrevPage,
            limit,
            page,
            returnedItems: data.length,
          },
        }),
  }

  return json({ data: slug ? data[0] : data, meta })
}

export const publicChangelogEndpoints: Endpoint[] = [
  {
    handler: handlePublicChangelog,
    method: 'get',
    path: '/public/v1/:tenant/changelog',
  },
  {
    handler: handlePublicChangelog,
    method: 'get',
    path: '/public/v1/:tenant/changelog/:slug',
  },
]
