import { randomUUID } from 'node:crypto'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { heading, paragraph, root } from '@/content/lexicalBuilders'
import { handlePublicPosts } from '@/endpoints/publicPosts'
import config from '@/payload.config'

/**
 * Database-backed: exercises the real hooks, access control, schema and public
 * API together. Runs wherever DATABASE_URI points at a migrated database (CI
 * always); skipped otherwise so the pure unit suites stay runnable anywhere.
 */
const hasDatabase = Boolean(process.env.DATABASE_URI)

type AnyDoc = Record<string, unknown> & { id: number | string }

describe.skipIf(!hasDatabase)('posts (database-backed)', () => {
  const run = randomUUID().slice(0, 8)
  let payload: Payload
  let admin: AnyDoc
  let tenantA: AnyDoc
  let tenantB: AnyDoc
  let editor: AnyDoc
  let reader: AnyDoc
  let changelogOnly: AnyDoc
  let authorA: AnyDoc
  let authorB: AnyDoc
  let categoryA: AnyDoc
  const created: { collection: 'authors' | 'categories' | 'posts' | 'tenants' | 'users'; id: number | string }[] =
    []

  const asUser = (user: AnyDoc) => ({ ...user, collection: 'users' }) as never

  const createTenant = async (label: string, locales: string[]) => {
    const tenant = (await payload.create({
      collection: 'tenants',
      data: {
        brandName: label,
        defaultLocale: 'en',
        domains: [{ domain: `${label.toLowerCase()}-${run}.example.com` }],
        emailFromName: label,
        mediaPathPrefix: `${label.toLowerCase()}-${run}`,
        name: `${label} ${run}`,
        slug: `${label.toLowerCase()}-${run}`,
        status: 'active',
        supportedLocales: locales.map((locale) => ({ locale })),
        timezone: 'UTC',
        websiteURL: `https://${label.toLowerCase()}-${run}.example.com`,
      } as never,
      overrideAccess: true,
    })) as unknown as AnyDoc
    created.push({ collection: 'tenants', id: tenant.id })
    return tenant
  }

  const createUser = async (
    label: string,
    memberships: { capabilities: string[]; sections: string[]; tenant: number | string }[],
  ) => {
    const user = (await payload.create({
      collection: 'users',
      data: {
        email: `${label}-${run}@example.com`,
        globalRole: 'member',
        memberships,
        name: label,
        password: randomUUID(),
        status: 'active',
      } as never,
      overrideAccess: true,
    })) as unknown as AnyDoc
    created.push({ collection: 'users', id: user.id })
    return user
  }

  const body = (title: string) =>
    root([heading('h2', `${title} overview`), paragraph(`${title} body copy for readers.`)])

  const createPost = async (
    user: AnyDoc,
    data: Record<string, unknown>,
    status: 'draft' | 'published' = 'published',
  ) => {
    const post = (await payload.create({
      collection: 'posts',
      data: {
        _status: status,
        body: body(String(data.title)),
        publishedDate: '2026-01-15T00:00:00.000Z',
        tenant: tenantA.id,
        ...data,
      } as never,
      draft: status === 'draft',
      locale: 'en',
      overrideAccess: false,
      user: asUser(user),
    })) as unknown as AnyDoc
    created.push({ collection: 'posts', id: post.id })
    return post
  }

  const callAPI = async (path: string, routeParams: Record<string, string>, user = reader) => {
    const req = await createLocalReq(
      {
        req: {
          headers: new Headers({ authorization: 'users API-Key test' }),
          routeParams,
          url: `https://app.hyge.io${path}`,
        } as never,
        user: asUser(user),
      },
      payload,
    )
    const response = await handlePublicPosts(req)
    return { body: (await response.json()) as Record<string, unknown>, status: response.status }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })

    admin = (await payload.create({
      collection: 'users',
      data: {
        email: `admin-${run}@example.com`,
        globalRole: 'platform-admin',
        name: 'Test admin',
        password: randomUUID(),
        status: 'active',
      } as never,
      overrideAccess: true,
    })) as unknown as AnyDoc
    created.push({ collection: 'users', id: admin.id })

    tenantA = await createTenant('Alpha', ['en', 'de'])
    tenantB = await createTenant('Beta', ['en'])

    editor = await createUser('editor', [
      { capabilities: ['read', 'draft', 'publish'], sections: ['marketing'], tenant: tenantA.id },
    ])
    reader = await createUser('reader', [
      { capabilities: ['read'], sections: ['marketing'], tenant: tenantA.id },
    ])
    changelogOnly = await createUser('changelog', [
      { capabilities: ['read', 'draft', 'publish'], sections: ['changelog'], tenant: tenantA.id },
    ])

    const reference = async (
      collection: 'authors' | 'categories',
      tenant: AnyDoc,
      data: Record<string, unknown>,
    ) => {
      const doc = (await payload.create({
        collection,
        data: { tenant: tenant.id, ...data } as never,
        locale: 'en',
        overrideAccess: true,
        user: asUser(admin),
      })) as unknown as AnyDoc
      created.push({ collection, id: doc.id })
      return doc
    }

    authorA = await reference('authors', tenantA, { name: 'Ada', role: 'Head of Risk', slug: 'ada' })
    authorB = await reference('authors', tenantB, { name: 'Bo', slug: 'bo' })
    categoryA = await reference('categories', tenantA, { name: 'Risk', slug: 'risk' })
  }, 120_000)

  afterAll(async () => {
    if (!payload) return
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
  }, 120_000)

  it('publishes a post in the source locale and approves only that locale', async () => {
    const post = await createPost(editor, {
      author: authorA.id,
      categories: [categoryA.id],
      slug: 'first-post',
      title: 'First post',
    })

    const states = post.translationStates as { locale: string; state: string }[]
    expect(states.find((entry) => entry.locale === 'en')?.state).toBe('approved')
    expect(states.find((entry) => entry.locale === 'de')?.state).toBe('missing')
    expect(post.publishedAt).toBeTruthy()
  })

  it('rejects linking an author that belongs to another tenant', async () => {
    await expect(
      createPost(editor, { author: authorB.id, slug: 'cross-tenant', title: 'Cross tenant' }),
    ).rejects.toThrow(/same tenant/)
  })

  it('denies post writes to members without the marketing section', async () => {
    await expect(
      createPost(changelogOnly, { slug: 'no-section', title: 'No section' }),
    ).rejects.toThrow(/not allowed/)
  })

  it('enforces one slug per tenant', async () => {
    await createPost(editor, { slug: 'unique-slug', title: 'Unique' })
    await expect(createPost(editor, { slug: 'unique-slug', title: 'Duplicate' })).rejects.toThrow(
      /slug|unique|invalid/i,
    )
  })

  it('serves published posts with rendered body, author and categories', async () => {
    const tenantSlug = String(tenantA.slug)
    const { body: detail, status } = await callAPI(
      `/api/public/v1/${tenantSlug}/posts/first-post`,
      { slug: 'first-post', tenant: tenantSlug },
    )

    expect(status).toBe(200)
    const data = detail.data as {
      author: unknown
      availableLocales: string[]
      body: { html: string; toc: unknown }
      categories: unknown
      seo: unknown
      title: string
    }
    expect(data.title).toBe('First post')
    expect(data.author).toMatchObject({ name: 'Ada', role: 'Head of Risk', slug: 'ada' })
    expect(data.categories).toEqual([{ name: 'Risk', slug: 'risk' }])
    expect(data.body.html).toContain('<h2 id="first-post-overview">')
    expect(data.body.toc).toEqual([
      { id: 'first-post-overview', level: 2, text: 'First post overview' },
    ])
    expect(data.availableLocales).toEqual(['en'])
    expect(data.seo).toMatchObject({ noIndex: false, title: 'First post' })
  })

  it('never serves drafts', async () => {
    await createPost(editor, { slug: 'draft-only', title: 'Draft only' }, 'draft')
    const tenantSlug = String(tenantA.slug)
    const { status } = await callAPI(`/api/public/v1/${tenantSlug}/posts/draft-only`, {
      slug: 'draft-only',
      tenant: tenantSlug,
    })
    expect(status).toBe(404)
  })

  it('hides untranslated locales unless the caller asks for the default fallback', async () => {
    const tenantSlug = String(tenantA.slug)
    const strict = await callAPI(`/api/public/v1/${tenantSlug}/posts?locale=de`, {
      tenant: tenantSlug,
    })
    expect(strict.body.data).toEqual([])

    const withFallback = await callAPI(
      `/api/public/v1/${tenantSlug}/posts?locale=de&fallback=default`,
      { tenant: tenantSlug },
    )
    const items = withFallback.body.data as { locale: string; slug: string }[]
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.locale === 'en')).toBe(true)
    expect((withFallback.body.meta as { fallbackUsed: boolean }).fallbackUsed).toBe(true)
  })

  it('serves an approved translation and marks it stale when the source changes', async () => {
    const post = await createPost(editor, { slug: 'translated', title: 'Translated' })

    await payload.update({
      collection: 'posts',
      data: {
        _status: 'published',
        body: body('Übersetzt'),
        title: 'Übersetzt',
        translationStates: [{ locale: 'de', sourceLocale: 'en', state: 'approved' }],
      } as never,
      id: post.id,
      locale: 'de',
      overrideAccess: false,
      user: asUser(editor),
    })

    const tenantSlug = String(tenantA.slug)
    const german = await callAPI(`/api/public/v1/${tenantSlug}/posts/translated?locale=de`, {
      slug: 'translated',
      tenant: tenantSlug,
    })
    expect(german.status).toBe(200)
    expect((german.body.data as { title: string }).title).toBe('Übersetzt')

    const edited = (await payload.update({
      collection: 'posts',
      data: { _status: 'published', title: 'Translated, revised' } as never,
      id: post.id,
      locale: 'en',
      overrideAccess: false,
      user: asUser(editor),
    })) as unknown as AnyDoc
    const states = edited.translationStates as { locale: string; state: string }[]
    expect(states.find((entry) => entry.locale === 'de')?.state).toBe('stale')

    const staleGerman = await callAPI(`/api/public/v1/${tenantSlug}/posts/translated?locale=de`, {
      slug: 'translated',
      tenant: tenantSlug,
    })
    expect(staleGerman.status).toBe(404)
  })

  it("does not reveal another tenant's posts to a scoped API key", async () => {
    const tenantSlug = String(tenantB.slug)
    const { status } = await callAPI(`/api/public/v1/${tenantSlug}/posts`, { tenant: tenantSlug })
    expect(status).toBe(404)
  })
})
