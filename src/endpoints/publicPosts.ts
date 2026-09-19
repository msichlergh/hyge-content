import type { Endpoint, PayloadRequest, Where } from 'payload'

import { relationshipID } from '../access/memberships'
import { renderRichText } from '../content/richText'
import { isPlatformLocale, type PlatformLocaleCode } from '../i18n/locales'
import { isApprovedTranslation, normalizeTranslationStates } from '../i18n/translationStates'
import {
  errorResponse,
  json,
  normalizeMedia,
  publicMeta,
  resolvePublicRequest,
  type PublicRequestContext,
} from './publicContent'

type PublicPost = {
  author?: unknown
  body?: unknown
  categories?: unknown
  coverImage?: unknown
  excerpt?: unknown
  id: number | string
  legacyPath?: unknown
  publishedDate?: unknown
  seo?: {
    canonicalURL?: unknown
    metaDescription?: unknown
    metaTitle?: unknown
    noIndex?: unknown
    ogImage?: unknown
  } | null
  slug?: unknown
  title?: unknown
  translationStates?: unknown
  updatedAt?: unknown
}

type Reference = { id: number | string; name?: unknown; slug?: unknown; [key: string]: unknown }

const text = (value: unknown): null | string =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

const hasPublicCopy = (post: PublicPost, locale: PlatformLocaleCode): boolean =>
  isApprovedTranslation(post.translationStates, locale) && text(post.title) !== null

/** Locales a reader can actually be served, for hreflang alternates. */
const availableLocales = (post: PublicPost): PlatformLocaleCode[] =>
  normalizeTranslationStates(post.translationStates)
    .filter((entry) => entry.state === 'approved' && isPlatformLocale(entry.locale))
    .map((entry) => entry.locale)

/**
 * Authors and categories are reference data without a translation workflow, so
 * they are read with an explicit fallback to the tenant default locale: an
 * untranslated category name must not hide an approved article.
 */
const loadReferences = async (
  req: PayloadRequest,
  collection: 'authors' | 'categories',
  ids: (number | string)[],
  context: PublicRequestContext,
): Promise<Map<string, Reference>> => {
  if (ids.length === 0) return new Map()

  const result = await req.payload.find({
    collection,
    depth: 1,
    fallbackLocale: context.sourceLocale,
    limit: ids.length,
    locale: context.requestedLocale,
    overrideAccess: false,
    pagination: false,
    req,
    user: req.user ?? undefined,
    where: {
      and: [{ id: { in: ids } }, { tenant: { equals: context.tenant.id } }],
    },
  })

  return new Map(result.docs.map((doc) => [String(doc.id), doc as unknown as Reference]))
}

const referenceIDs = (posts: PublicPost[], field: 'author' | 'categories') => [
  ...new Set(
    posts
      .flatMap((post) => (Array.isArray(post[field]) ? post[field] : [post[field]]))
      .map(relationshipID)
      .filter((id): id is number | string => id !== null)
      .map(String),
  ),
]

const mapAuthor = (value: unknown, authors: Map<string, Reference>) => {
  const id = relationshipID(value)
  const author = id === null ? undefined : authors.get(String(id))
  if (!author) return null

  return {
    avatar: normalizeMedia(author.avatar),
    bio: text(author.bio),
    name: text(author.name) ?? '',
    role: text(author.role),
    slug: text(author.slug) ?? '',
  }
}

const mapCategories = (value: unknown, categories: Map<string, Reference>) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => categories.get(String(relationshipID(entry))))
    .filter((category): category is Reference => Boolean(category))
    .map((category) => ({ name: text(category.name) ?? '', slug: text(category.slug) ?? '' }))

export const mapPublicPost = (
  post: PublicPost,
  resolvedLocale: PlatformLocaleCode,
  references: { authors: Map<string, Reference>; categories: Map<string, Reference> },
  detail: boolean,
) => {
  const rendered = renderRichText(post.body)

  return {
    author: mapAuthor(post.author, references.authors),
    availableLocales: availableLocales(post),
    categories: mapCategories(post.categories, references.categories),
    cover: normalizeMedia(post.coverImage),
    date: post.publishedDate,
    excerpt: text(post.excerpt),
    legacyPath: text(post.legacyPath),
    locale: resolvedLocale,
    readingTimeMinutes: rendered.readingTimeMinutes,
    slug: post.slug,
    title: post.title,
    updatedAt: post.updatedAt,
    ...(detail
      ? {
          body: { blocks: rendered.blocks, html: rendered.html, toc: rendered.toc },
          seo: {
            canonicalURL: text(post.seo?.canonicalURL),
            description: text(post.seo?.metaDescription) ?? text(post.excerpt),
            image: normalizeMedia(post.seo?.ogImage) ?? normalizeMedia(post.coverImage),
            noIndex: post.seo?.noIndex === true,
            title: text(post.seo?.metaTitle) ?? text(post.title),
          },
        }
      : {}),
  }
}

const findPosts = (
  req: PayloadRequest,
  context: PublicRequestContext,
  locale: PlatformLocaleCode,
  where: Where[],
  pagination: { limit: number; page: number } | false,
) =>
  req.payload.find({
    collection: 'posts',
    depth: 1,
    draft: false,
    fallbackLocale: false,
    locale,
    overrideAccess: false,
    req,
    sort: '-publishedDate',
    user: req.user ?? undefined,
    where: {
      and: [
        { tenant: { equals: context.tenant.id } },
        { _status: { equals: 'published' } },
        ...where,
      ],
    },
    ...(pagination ? pagination : { pagination: false }),
  })

export const handlePublicPosts = async (req: PayloadRequest): Promise<Response> => {
  const context = await resolvePublicRequest(req, 'marketing')
  if (context instanceof Response) return context

  const filters: Where[] = []
  if (context.slug) filters.push({ slug: { equals: context.slug } })

  const categorySlug = context.searchParams.get('category')
  if (categorySlug) {
    const category = await req.payload.find({
      collection: 'categories',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      req,
      user: req.user ?? undefined,
      where: {
        and: [{ slug: { equals: categorySlug } }, { tenant: { equals: context.tenant.id } }],
      },
    })
    if (!category.docs[0]) return errorResponse('not_found', 'Category not found.', 404)
    filters.push({ categories: { in: [category.docs[0].id] } })
  }

  const result = await findPosts(
    req,
    context,
    context.requestedLocale,
    filters,
    context.slug ? { limit: 1, page: 1 } : { limit: context.limit, page: context.page },
  )
  const posts = result.docs as unknown as PublicPost[]

  const resolved: { locale: PlatformLocaleCode; post: PublicPost }[] = []
  const fallbackIDs: (number | string)[] = []
  for (const post of posts) {
    if (hasPublicCopy(post, context.requestedLocale)) {
      resolved.push({ locale: context.requestedLocale, post })
    } else if (context.fallback === 'default' && context.requestedLocale !== context.sourceLocale) {
      fallbackIDs.push(post.id)
    }
  }

  if (fallbackIDs.length > 0) {
    const fallback = await findPosts(
      req,
      context,
      context.sourceLocale,
      [{ id: { in: fallbackIDs } }],
      false,
    )
    const fallbackByID = new Map(
      (fallback.docs as unknown as PublicPost[])
        .filter((post) => hasPublicCopy(post, context.sourceLocale))
        .map((post) => [String(post.id), post]),
    )
    // Preserve the requested page order.
    for (const post of posts) {
      const match = fallbackByID.get(String(post.id))
      if (match) resolved.push({ locale: context.sourceLocale, post: match })
    }
    const order = new Map(posts.map((post, index) => [String(post.id), index]))
    resolved.sort((a, b) => (order.get(String(a.post.id)) ?? 0) - (order.get(String(b.post.id)) ?? 0))
  }

  const resolvedPosts = resolved.map(({ post }) => post)
  const [authors, categories] = await Promise.all([
    loadReferences(req, 'authors', referenceIDs(resolvedPosts, 'author'), context),
    loadReferences(req, 'categories', referenceIDs(resolvedPosts, 'categories'), context),
  ])

  const data = resolved.map(({ locale, post }) =>
    mapPublicPost(post, locale, { authors, categories }, Boolean(context.slug)),
  )

  if (context.slug && data.length === 0) {
    return errorResponse('not_found', 'Published post not found for this locale.', 404)
  }

  const meta = publicMeta(
    context,
    [...new Set(resolved.map(({ locale }) => locale))],
    context.slug
      ? undefined
      : {
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
          returnedItems: data.length,
        },
  )

  return json({ data: context.slug ? data[0] : data, meta })
}

export const handlePublicCategories = async (req: PayloadRequest): Promise<Response> => {
  const context = await resolvePublicRequest(req, 'marketing')
  if (context instanceof Response) return context

  const result = await req.payload.find({
    collection: 'categories',
    depth: 0,
    fallbackLocale: context.sourceLocale,
    locale: context.requestedLocale,
    overrideAccess: false,
    pagination: false,
    req,
    sort: 'slug',
    user: req.user ?? undefined,
    where: { tenant: { equals: context.tenant.id } },
  })

  return json({
    data: result.docs.map((category) => ({
      description: text(category.description),
      name: text(category.name) ?? '',
      slug: category.slug,
    })),
    meta: publicMeta(context, [context.requestedLocale]),
  })
}

export const publicPostEndpoints: Endpoint[] = [
  { handler: handlePublicPosts, method: 'get', path: '/public/v1/:tenant/posts' },
  { handler: handlePublicPosts, method: 'get', path: '/public/v1/:tenant/posts/:slug' },
  { handler: handlePublicCategories, method: 'get', path: '/public/v1/:tenant/categories' },
]
