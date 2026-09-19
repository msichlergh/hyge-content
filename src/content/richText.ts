import {
  convertLexicalToHTML,
  defaultHTMLConverters,
  type HTMLConverters,
} from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'

/**
 * Public rendering of stored rich text.
 *
 * Websites get two views of the same body so none of them has to understand
 * Lexical: `html` for sites that render prose directly, and `blocks` — a small,
 * stable vocabulary — for sites that map content onto their own components.
 * Inline formatting inside a block (bold, italic, links) is delivered as HTML.
 */

type LexicalNode = SerializedLexicalNode & {
  children?: LexicalNode[]
  fields?: Record<string, unknown> | null
  headerState?: number
  listType?: string
  tag?: string
  text?: string
  value?: unknown
}

export type PublicBlock =
  | { html: string; type: 'paragraph' }
  | { html: string; id: string; level: 2 | 3 | 4; text: string; type: 'heading' }
  | { items: string[]; ordered: boolean; type: 'list' }
  | { alt: string; height: number | null; src: string; type: 'image'; width: number | null }
  | { header: boolean; rows: string[][]; type: 'table' }
  | { html: string; type: 'quote' }
  | { type: 'divider' }

export type TocEntry = { id: string; level: 2 | 3 | 4; text: string }

export type RenderedRichText = {
  blocks: PublicBlock[]
  html: string
  readingTimeMinutes: number
  toc: TocEntry[]
}

const WORDS_PER_MINUTE = 225

const escapeHTML = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const plainText = (node: LexicalNode | undefined): string => {
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  if (node.type === 'linebreak') return '\n'
  return (node.children ?? []).map(plainText).join(node.type === 'root' ? '\n' : '')
}

/**
 * Latin diacritics are dropped ("résumé" -> "resume"); combining marks in other
 * scripts are kept and recomposed, so Arabic or Vietnamese anchors stay intact.
 */
export const headingID = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .normalize('NFC')
    .slice(0, 80) || 'section'

type MediaDoc = {
  altText?: unknown
  height?: unknown
  url?: unknown
  width?: unknown
}

const mediaImage = (value: unknown, fields?: Record<string, unknown> | null) => {
  if (!value || typeof value !== 'object') return null
  const media = value as MediaDoc
  if (typeof media.url !== 'string' || media.url.length === 0) return null

  const fieldAlt = typeof fields?.alt === 'string' ? fields.alt : ''
  return {
    alt: fieldAlt || (typeof media.altText === 'string' ? media.altText : ''),
    height: typeof media.height === 'number' ? media.height : null,
    src: media.url,
    width: typeof media.width === 'number' ? media.width : null,
  }
}

/** Makes heading IDs unique within one document, in document order. */
const createIDAllocator = () => {
  const used = new Map<string, number>()
  return (text: string): string => {
    const base = headingID(text)
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }
}

const buildConverters = (allocateID: (text: string) => string): HTMLConverters => ({
  ...defaultHTMLConverters,
  heading: ({ node, nodesToHTML }) => {
    const heading = node as LexicalNode
    const tag = ['h2', 'h3', 'h4'].includes(heading.tag ?? '') ? heading.tag : 'h2'
    const children = nodesToHTML({ nodes: heading.children ?? [] }).join('')
    return `<${tag} id="${escapeHTML(allocateID(plainText(heading)))}">${children}</${tag}>`
  },
  upload: ({ node }) => {
    const upload = node as LexicalNode
    const image = mediaImage(upload.value, upload.fields)
    if (!image) return ''

    const size =
      image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ''
    return `<figure><img src="${escapeHTML(image.src)}" alt="${escapeHTML(image.alt)}"${size} loading="lazy" /></figure>`
  },
})

const rootOf = (children: LexicalNode[]): SerializedEditorState =>
  ({
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }) as unknown as SerializedEditorState

const inlineHTML = (children: LexicalNode[] | undefined, converters: HTMLConverters): string =>
  convertLexicalToHTML({
    converters,
    data: rootOf(children ?? []),
    disableContainer: true,
    disableIndent: true,
    disableTextAlign: true,
  }).trim()

const toBlock = (
  node: LexicalNode,
  converters: HTMLConverters,
  toc: TocEntry[],
  allocateID: (text: string) => string,
): PublicBlock | null => {
  switch (node.type) {
    case 'paragraph': {
      const html = inlineHTML(node.children, converters)
      return html ? { html, type: 'paragraph' } : null
    }
    case 'heading': {
      const level = Number((node.tag ?? 'h2').slice(1))
      const safeLevel = (level >= 2 && level <= 4 ? level : 2) as 2 | 3 | 4
      const text = plainText(node).trim()
      const id = allocateID(text)
      toc.push({ id, level: safeLevel, text })
      return { html: inlineHTML(node.children, converters), id, level: safeLevel, text, type: 'heading' }
    }
    case 'list':
      return {
        items: (node.children ?? []).map((item) => inlineHTML(item.children, converters)),
        ordered: node.listType === 'number' || node.tag === 'ol',
        type: 'list',
      }
    case 'upload': {
      const image = mediaImage(node.value, node.fields)
      return image ? { ...image, type: 'image' } : null
    }
    case 'table': {
      const rows = (node.children ?? []).map((row) =>
        (row.children ?? []).map((cell) =>
          (cell.children ?? []).map((child) => inlineHTML(child.children, converters)).join(' '),
        ),
      )
      const firstRowIsHeader = Boolean(
        node.children?.[0]?.children?.every((cell) => (cell.headerState ?? 0) > 0),
      )
      return { header: firstRowIsHeader, rows, type: 'table' }
    }
    case 'quote': {
      const html = inlineHTML(node.children, converters)
      return html ? { html, type: 'quote' } : null
    }
    case 'horizontalrule':
      return { type: 'divider' }
    default:
      return null
  }
}

export const renderRichText = (value: unknown): RenderedRichText => {
  const empty: RenderedRichText = { blocks: [], html: '', readingTimeMinutes: 0, toc: [] }
  if (!value || typeof value !== 'object' || !('root' in value)) return empty

  const state = value as SerializedEditorState
  const children = ((state.root as unknown as LexicalNode).children ?? []) as LexicalNode[]

  // Separate allocators so html and blocks produce identical, independent IDs.
  const html = convertLexicalToHTML({
    converters: buildConverters(createIDAllocator()),
    data: state,
    disableContainer: true,
    disableIndent: true,
    disableTextAlign: true,
  }).trim()

  const blockAllocator = createIDAllocator()
  const blockConverters = buildConverters(createIDAllocator())
  const toc: TocEntry[] = []
  const blocks = children
    .map((node) => toBlock(node, blockConverters, toc, blockAllocator))
    .filter((block): block is PublicBlock => block !== null)

  const words = plainText(state.root as unknown as LexicalNode).split(/\s+/).filter(Boolean).length

  return {
    blocks,
    html,
    readingTimeMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    toc,
  }
}
