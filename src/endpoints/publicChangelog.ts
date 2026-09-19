import type { Endpoint, PayloadRequest } from 'payload'

import type { PlatformLocaleCode } from '../i18n/locales'
import { isApprovedTranslation } from '../i18n/translationStates'
import {
  errorResponse,
  json,
  normalizeMedia,
  publicMeta,
  resolvePublicRequest,
  type PublicFallbackMode,
} from './publicContent'

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
  const context = await resolvePublicRequest(req, 'changelog')
  if (context instanceof Response) return context

  const { fallback, limit, page, requestedLocale: requestedLocaleValue, slug, sourceLocale, tenant } =
    context
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
  const meta = publicMeta(
    context,
    resolvedLocales,
    slug
      ? undefined
      : {
          hasNextPage: releaseResult.hasNextPage,
          hasPrevPage: releaseResult.hasPrevPage,
          returnedItems: data.length,
        },
  )

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
