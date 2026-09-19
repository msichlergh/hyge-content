import config from '@payload-config'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload, type Payload } from 'payload'

import { blocksToHTML, htmlToLexical, type ConversionReport } from '../content/htmlToLexical'
import type { PlatformLocaleCode } from '../i18n/locales'

/**
 * Imports a site's existing articles from a normalized bundle. Idempotent per
 * (tenant, slug): existing posts are skipped, so re-running never duplicates or
 * overwrites editorial changes made in the CMS.
 *
 * Images are downloaded from the site, stored in the tenant's media library and
 * deduplicated by content hash. Imported posts are published and approved in
 * every imported locale, keep their original dates, and send no notifications
 * or website revalidation (`context.skipNotifications`).
 *
 * Usage: IMPORT_BUNDLE=/path/bundle.json npm run import:posts
 */

type Body = { blocks: Parameters<typeof blocksToHTML>[0] } | { html: string }

type BundleTranslation = {
  body: Body
  excerpt?: string
  locale: PlatformLocaleCode
  seo?: { description?: string; title?: string }
  title: string
}

export type PostBundle = {
  authors?: { avatarURL?: string; bio?: string; name: string; role?: string; slug: string }[]
  categories?: { name: string; slug: string }[]
  posts: {
    author?: string
    body: Body
    categories?: string[]
    cover?: { alt?: string; url: string }
    date: string
    excerpt?: string
    legacyPath?: string
    seo?: { description?: string; title?: string }
    slug: string
    title: string
    translations?: BundleTranslation[]
  }[]
  /** Base URL for resolving relative image paths, e.g. https://yourpropfirm.com */
  sourceBaseURL: string
  tenant: string
}

export type ImportResult = {
  imagesUploaded: number
  imported: number
  report: Record<string, ConversionReport>
  skipped: number
  translationsImported: number
}

const approved = (locale: PlatformLocaleCode, sourceLocale: PlatformLocaleCode) => ({
  locale,
  sourceLocale,
  sourceVersion: 'historical-import',
  state: 'approved' as const,
})

const htmlOf = (body: Body): string => ('html' in body ? body.html : blocksToHTML(body.blocks))

const MIME_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

export const importPosts = async (
  payload: Payload,
  bundle: PostBundle,
  fetchImpl: typeof fetch = fetch,
): Promise<ImportResult> => {
  const tenant = (
    await payload.find({
      collection: 'tenants',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: bundle.tenant } },
    })
  ).docs[0]
  if (!tenant) throw new Error(`Tenant ${bundle.tenant} does not exist. Run provision:tenants.`)

  const admin = (
    await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [{ globalRole: { equals: 'platform-admin' } }, { status: { equals: 'active' } }],
      },
    })
  ).docs[0]
  if (!admin) throw new Error('An active platform administrator is required for the import.')

  const sourceLocale = tenant.defaultLocale as PlatformLocaleCode
  const asAdmin = { overrideAccess: false, user: admin } as const
  const result: ImportResult = {
    imagesUploaded: 0,
    imported: 0,
    report: {},
    skipped: 0,
    translationsImported: 0,
  }

  // --- media, deduplicated by content hash within the tenant -------------------
  const mediaByHash = new Map<string, number | string>()
  const mediaBySource = new Map<string, null | number | string>()

  const resolveImage = async ({ alt, src }: { alt: string; src: string }, fallbackAlt: string) => {
    const url = new URL(src, bundle.sourceBaseURL).toString()
    if (mediaBySource.has(url)) return mediaBySource.get(url) ?? null

    const response = await fetchImpl(url)
    if (!response.ok) {
      mediaBySource.set(url, null)
      return null
    }
    const data = Buffer.from(await response.arrayBuffer())
    const mimetype = (response.headers.get('content-type') ?? '').split(';')[0].trim()
    const extension = MIME_EXTENSIONS[mimetype]
    if (!extension) {
      mediaBySource.set(url, null)
      return null
    }

    const hash = createHash('sha256').update(data).digest('hex').slice(0, 16)
    const filename = `${path.basename(new URL(url).pathname).replace(/\.[a-z0-9]+$/i, '').slice(0, 60)}-${hash}.${extension}`

    let mediaID = mediaByHash.get(hash)
    if (!mediaID) {
      const existing = await payload.find({
        collection: 'media',
        depth: 0,
        limit: 1,
        ...asAdmin,
        where: { and: [{ tenant: { equals: tenant.id } }, { filename: { equals: filename } }] },
      })
      mediaID = existing.docs[0]?.id
    }
    if (!mediaID) {
      const created = await payload.create({
        collection: 'media',
        data: {
          altText: alt || fallbackAlt,
          status: 'active',
          tenant: tenant.id,
          usage: 'blog',
        } as never,
        file: { data, mimetype, name: filename, size: data.length },
        locale: sourceLocale,
        ...asAdmin,
      })
      mediaID = created.id
      result.imagesUploaded += 1
    }

    mediaByHash.set(hash, mediaID)
    mediaBySource.set(url, mediaID)
    return mediaID
  }

  // --- reference data -------------------------------------------------------------
  const ensureReference = async (
    collection: 'authors' | 'categories',
    slug: string,
    data: Record<string, unknown>,
  ) => {
    const existing = await payload.find({
      collection,
      depth: 0,
      limit: 1,
      ...asAdmin,
      where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    })
    if (existing.docs[0]) return existing.docs[0].id

    const created = await payload.create({
      collection,
      data: { ...data, slug, tenant: tenant.id } as never,
      locale: sourceLocale,
      ...asAdmin,
    })
    return created.id
  }

  const authorIDs = new Map<string, number | string>()
  for (const author of bundle.authors ?? []) {
    const avatar = author.avatarURL
      ? await resolveImage({ alt: author.name, src: author.avatarURL }, author.name)
      : null
    authorIDs.set(
      author.slug,
      await ensureReference('authors', author.slug, {
        avatar: avatar ?? undefined,
        bio: author.bio,
        name: author.name,
        role: author.role,
      }),
    )
  }

  const categoryIDs = new Map<string, number | string>()
  for (const category of bundle.categories ?? []) {
    categoryIDs.set(
      category.slug,
      await ensureReference('categories', category.slug, { name: category.name }),
    )
  }

  // --- posts ------------------------------------------------------------------------
  for (const post of bundle.posts) {
    const existing = await payload.find({
      collection: 'posts',
      depth: 0,
      limit: 1,
      ...asAdmin,
      where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: post.slug } }] },
    })
    if (existing.totalDocs > 0) {
      result.skipped += 1
      continue
    }

    const { report, state } = await htmlToLexical(htmlOf(post.body), (image) =>
      resolveImage(image, post.title),
    )
    if (report.droppedImages.length || report.unknownTags.length) result.report[post.slug] = report

    const cover = post.cover
      ? await resolveImage({ alt: post.cover.alt ?? post.title, src: post.cover.url }, post.title)
      : null

    const translations = (post.translations ?? []).filter((entry) => entry.locale !== sourceLocale)
    const created = await payload.create({
      collection: 'posts',
      context: { skipNotifications: true },
      data: {
        _status: 'published',
        author: post.author ? authorIDs.get(post.author) : undefined,
        body: state,
        categories: (post.categories ?? [])
          .map((slug) => categoryIDs.get(slug))
          .filter((id) => id !== undefined),
        coverImage: cover ?? undefined,
        excerpt: post.excerpt,
        legacyPath: post.legacyPath,
        publishedDate: new Date(`${post.date.slice(0, 10)}T00:00:00.000Z`).toISOString(),
        seo: { metaDescription: post.seo?.description, metaTitle: post.seo?.title },
        slug: post.slug,
        tenant: tenant.id,
        title: post.title,
        translationStates: [approved(sourceLocale, sourceLocale)],
      } as never,
      draft: false,
      locale: sourceLocale,
      ...asAdmin,
    })
    result.imported += 1

    for (const translation of translations) {
      const converted = await htmlToLexical(htmlOf(translation.body), (image) =>
        resolveImage(image, translation.title),
      )
      if (converted.report.droppedImages.length || converted.report.unknownTags.length) {
        result.report[`${post.slug}@${translation.locale}`] = converted.report
      }

      await payload.update({
        collection: 'posts',
        context: { skipNotifications: true },
        data: {
          _status: 'published',
          body: converted.state,
          excerpt: translation.excerpt,
          seo: {
            metaDescription: translation.seo?.description,
            metaTitle: translation.seo?.title,
          },
          title: translation.title,
          translationStates: [approved(translation.locale, sourceLocale)],
        } as never,
        id: created.id,
        locale: translation.locale,
        ...asAdmin,
      })
      result.translationsImported += 1
    }
  }

  return result
}

const run = async () => {
  const bundlePath = process.env.IMPORT_BUNDLE
  if (!bundlePath) throw new Error('Set IMPORT_BUNDLE to a post bundle JSON file.')

  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as PostBundle
  const payload = await getPayload({ config })
  const result = await importPosts(payload, bundle)
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

if (process.argv[1]?.endsWith('importPosts.ts')) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
