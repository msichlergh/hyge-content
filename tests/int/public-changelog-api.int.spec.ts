import { handlePublicChangelog } from '@/endpoints/publicChangelog'
import type { PlatformUser } from '@/access/memberships'
import { describe, expect, it, vi } from 'vitest'

const apiUser: PlatformUser & { status: 'active' } = {
  collection: 'users',
  globalRole: 'member',
  id: 'api-user',
  memberships: [
    { capabilities: ['read'], sections: ['changelog'], tenant: 'tenant-a' },
  ],
  status: 'active',
}

const tenant = {
  defaultLocale: 'en',
  id: 'tenant-a',
  slug: 'yourpropfirm',
  status: 'active',
  supportedLocales: [{ locale: 'en' }, { locale: 'de' }],
}

const englishRelease = {
  _status: 'published',
  coverType: 'affiliate',
  features: [{ area: 'Affiliate', id: 'internal-row', title: 'Campaigns' }],
  fixes: [],
  headline: 'English headline',
  id: 'release-a',
  improvements: [],
  kicker: 'English kicker',
  releaseDate: '2026-03-18T12:00:00.000Z',
  slug: 'r-2026-03-18',
  tenant: 'tenant-a',
  translationStates: [
    { locale: 'en', sourceLocale: 'en', sourceVersion: 'v1', state: 'approved' },
    { locale: 'de', sourceLocale: 'en', sourceVersion: 'v1', state: 'missing' },
  ],
}

const germanMissingRelease = {
  ...englishRelease,
  features: [{ area: 'Affiliate', id: 'internal-row', title: null }],
  headline: null,
  kicker: null,
}

const requestWith = ({
  find,
  path = '/api/public/v1/yourpropfirm/changelog?locale=de&fallback=default',
  routeParams = { tenant: 'yourpropfirm' },
  user = apiUser,
}: {
  find: ReturnType<typeof vi.fn>
  path?: string
  routeParams?: Record<string, string>
  user?: (PlatformUser & { status: string }) | null
}) => {
  const request = new Request(`https://app.hyge.io${path}`, {
    headers: user ? { Authorization: 'users API-Key test-key' } : {},
  })

  return Object.assign(request, {
    payload: { find },
    routeParams,
    user,
  }) as never
}

const paginated = (docs: unknown[]) => ({
  docs,
  hasNextPage: false,
  hasPrevPage: false,
  totalDocs: docs.length,
})

describe('public changelog API', () => {
  it('requires API-key authentication before querying content', async () => {
    const find = vi.fn()
    const response = await handlePublicChangelog(requestWith({ find, user: null }))

    expect(response.status).toBe(401)
    expect(find).not.toHaveBeenCalled()
  })

  it('rejects API keys without changelog read access before querying tenants', async () => {
    const find = vi.fn()
    const marketingUser: PlatformUser & { status: 'active' } = {
      collection: 'users',
      globalRole: 'member',
      id: 'marketing-user',
      memberships: [
        { capabilities: ['read'], sections: ['marketing'], tenant: 'tenant-a' },
      ],
      status: 'active',
    }
    const response = await handlePublicChangelog(
      requestWith({ find, user: marketingUser }),
    )

    expect(response.status).toBe(404)
    expect(find).not.toHaveBeenCalled()
  })

  it('does not reveal a tenant the credential cannot access', async () => {
    const find = vi.fn().mockResolvedValueOnce(paginated([]))
    const response = await handlePublicChangelog(requestWith({ find }))

    expect(response.status).toBe(404)
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        overrideAccess: false,
        user: apiUser,
      }),
    )
  })

  it('uses the default locale only when fallback is explicit', async () => {
    const find = vi.fn(async (options: { collection: string; locale?: string }) => {
      if (options.collection === 'tenants') return paginated([tenant])
      return options.locale === 'de'
        ? paginated([germanMissingRelease])
        : paginated([englishRelease])
    })
    const response = await handlePublicChangelog(requestWith({ find }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([
      expect.objectContaining({
        headline: 'English headline',
        locale: 'en',
        slug: 'r-2026-03-18',
      }),
    ])
    expect(body.data[0]).not.toHaveProperty('id')
    expect(body.data[0]).not.toHaveProperty('translationStates')
    expect(body.data[0].sections.features[0]).not.toHaveProperty('id')
    expect(body.meta).toMatchObject({
      fallbackLocale: 'en',
      fallbackUsed: true,
      requestedLocale: 'de',
      resolvedLocales: ['en'],
      tenant: 'yourpropfirm',
      version: 'v1',
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'changelog-releases',
        draft: false,
        fallbackLocale: false,
        locale: 'de',
        overrideAccess: false,
        user: apiUser,
        where: expect.objectContaining({
          and: expect.arrayContaining([{ _status: { equals: 'published' } }]),
        }),
      }),
    )
  })

  it('omits missing translations when fallback is not requested', async () => {
    const find = vi.fn(async (options: { collection: string }) =>
      options.collection === 'tenants'
        ? paginated([tenant])
        : paginated([germanMissingRelease]),
    )
    const response = await handlePublicChangelog(
      requestWith({
        find,
        path: '/api/public/v1/yourpropfirm/changelog?locale=de&fallback=none',
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.meta).toMatchObject({ fallbackLocale: null, fallbackUsed: false })
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('returns one normalized release from the detail endpoint', async () => {
    const find = vi.fn(async (options: { collection: string }) =>
      options.collection === 'tenants' ? paginated([tenant]) : paginated([englishRelease]),
    )
    const response = await handlePublicChangelog(
      requestWith({
        find,
        path: '/api/public/v1/yourpropfirm/changelog/r-2026-03-18?locale=en',
        routeParams: { slug: 'r-2026-03-18', tenant: 'yourpropfirm' },
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data).toMatchObject({ locale: 'en', slug: 'r-2026-03-18' })
    expect(body.meta).not.toHaveProperty('pagination')
  })
})
