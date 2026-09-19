import { JSDOM } from 'jsdom'

import {
  heading,
  link,
  list,
  paragraph,
  quote,
  root,
  table,
  text,
  TEXT_FORMAT,
  upload,
} from './lexicalBuilders'

/**
 * Converts article HTML (WordPress exports, hand-written bodies, structured
 * blocks rendered to HTML) into the editor's Lexical state.
 *
 * Written against the tags real imports use rather than delegating to a
 * general converter, so images become real media uploads and nothing is
 * silently dropped: anything unrecognised is kept as text and reported.
 */

type Node = Record<string, unknown>

export type ImageResolver = (source: { alt: string; src: string }) => Promise<null | number | string>

export type ConversionReport = {
  droppedImages: string[]
  unknownTags: string[]
}

const BLOCK_TAGS = new Set([
  'blockquote', 'div', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'ol', 'p',
  'section', 'article', 'table', 'ul',
])

const FORMAT_TAGS: Record<string, number> = {
  b: TEXT_FORMAT.bold,
  code: TEXT_FORMAT.code,
  del: TEXT_FORMAT.strikethrough,
  em: TEXT_FORMAT.italic,
  i: TEXT_FORMAT.italic,
  s: TEXT_FORMAT.strikethrough,
  strong: TEXT_FORMAT.bold,
  u: TEXT_FORMAT.underline,
}

const linebreak = (): Node => ({ type: 'linebreak', version: 1 })

const collapse = (value: string) => value.replace(/[\s\u00a0]+/g, ' ')

/** Trims leading/trailing whitespace across the edge text nodes of a run. */
const trimInline = (nodes: Node[]): Node[] => {
  const out = nodes.filter((node) => node.type !== 'text' || String(node.text).length > 0)
  while (out[0]?.type === 'linebreak') out.shift()
  while (out.at(-1)?.type === 'linebreak') out.pop()

  const first = out[0]
  if (first?.type === 'text') first.text = String(first.text).replace(/^\s+/, '')
  const last = out.at(-1)
  if (last?.type === 'text') last.text = String(last.text).replace(/\s+$/, '')

  return out.filter((node) => node.type !== 'text' || String(node.text).length > 0)
}

const hasVisibleText = (nodes: Node[]): boolean =>
  nodes.some(
    (node) =>
      (node.type === 'text' && String(node.text).trim().length > 0) ||
      (node.type === 'link' && hasVisibleText((node.children as Node[]) ?? [])),
  )

export const htmlToLexical = async (
  html: string,
  resolveImage: ImageResolver,
): Promise<{ report: ConversionReport; state: ReturnType<typeof root> }> => {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window
  const report: ConversionReport = { droppedImages: [], unknownTags: [] }
  const blocks: Node[] = []

  const inline = (element: Element, format = 0): Node[] => {
    const out: Node[] = []
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 3) {
        const value = collapse(child.textContent ?? '')
        if (value) out.push(text(value, format))
        continue
      }
      if (child.nodeType !== 1) continue

      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (tag === 'br') out.push(linebreak())
      else if (tag === 'img') continue // handled at block level
      else if (tag === 'a') {
        const href = el.getAttribute('href') ?? ''
        const children = inline(el, format)
        if (!href || !hasVisibleText(children)) out.push(...children)
        else out.push(link(href, children, el.getAttribute('target') === '_blank'))
      } else if (tag in FORMAT_TAGS) out.push(...inline(el, format | FORMAT_TAGS[tag]))
      else if (tag === 'p' || tag === 'div') {
        // Paragraphs inside list items or cells: keep them as separate lines.
        if (out.length > 0) out.push(linebreak())
        out.push(...inline(el, format))
      } else {
        if (!['span', 'mark', 'small', 'sup', 'sub', 'abbr', 'cite', 'time'].includes(tag)) {
          report.unknownTags.push(tag)
        }
        out.push(...inline(el, format))
      }
    }
    return out
  }

  const pushImage = async (img: Element) => {
    const src = img.getAttribute('src') ?? ''
    const alt = collapse(img.getAttribute('alt') ?? '').trim()
    if (!src) return
    const mediaID = await resolveImage({ alt, src })
    if (mediaID === null) report.droppedImages.push(src)
    else blocks.push(upload(mediaID, alt || undefined))
  }

  const pushParagraph = (nodes: Node[]) => {
    const content = trimInline(nodes)
    if (hasVisibleText(content)) blocks.push(paragraph(content))
  }

  const listNode = (element: Element): Node => {
    const ordered = element.tagName.toLowerCase() === 'ol'
    const built = list(ordered, [])
    const children = built.children as Node[]
    let value = 1

    for (const li of Array.from(element.children)) {
      if (li.tagName.toLowerCase() !== 'li') continue
      const nested = Array.from(li.children).filter((child) =>
        ['ol', 'ul'].includes(child.tagName.toLowerCase()),
      )
      nested.forEach((child) => child.remove())

      const content = trimInline(inline(li))
      children.push({
        children: content,
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'listitem',
        value: value++,
        version: 1,
      })

      // Lexical nests a list inside its own list item that follows the parent
      // item. Wrapper items carry no marker, so they do not consume a number.
      for (const child of nested) {
        children.push({
          children: [listNode(child)],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'listitem',
          value,
          version: 1,
        })
      }
    }
    return built
  }

  const walk = async (element: Element) => {
    let pending: Node[] = []
    const flush = () => {
      pushParagraph(pending)
      pending = []
    }

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 3) {
        const value = collapse(child.textContent ?? '')
        if (value.trim()) pending.push(text(value))
        continue
      }
      if (child.nodeType !== 1) continue

      const el = child as Element
      const tag = el.tagName.toLowerCase()
      if (!BLOCK_TAGS.has(tag)) {
        // Inline element at block level: gather into a paragraph.
        if (tag === 'br') pending.push(linebreak())
        else pending.push(...inline({ childNodes: [el] } as unknown as Element))
        continue
      }
      flush()

      switch (tag) {
        case 'p': {
          const images = Array.from(el.querySelectorAll('img'))
          const content = trimInline(inline(el))
          if (hasVisibleText(content)) blocks.push(paragraph(content))
          for (const img of images) await pushImage(img)
          break
        }
        case 'h1':
        case 'h2':
          blocks.push(heading('h2', trimInline(inline(el))))
          break
        case 'h3':
          blocks.push(heading('h3', trimInline(inline(el))))
          break
        case 'h4':
        case 'h5':
        case 'h6':
          blocks.push(heading('h4', trimInline(inline(el))))
          break
        case 'ul':
        case 'ol':
          blocks.push(listNode(el))
          break
        case 'img':
          await pushImage(el)
          break
        case 'figure': {
          const caption = el.querySelector('figcaption')
          caption?.remove()
          // Attribution captions put name and role in adjacent elements with no
          // whitespace between them; keep them on separate lines.
          for (const part of Array.from(caption?.querySelectorAll('*') ?? [])) {
            const next = part.nextSibling
            if (next && next.nodeType === 1 && part.parentElement === next.parentElement) {
              part.after(el.ownerDocument.createElement('br'))
            }
          }
          // WordPress wraps images and tables alike in <figure>.
          await walk(el)
          if (caption) pushParagraph(inline(caption, TEXT_FORMAT.italic))
          break
        }
        case 'blockquote': {
          const content = trimInline(inline(el))
          if (hasVisibleText(content)) blocks.push(quote(content))
          break
        }
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr')).map((row) =>
            Array.from(row.children).map((cell) => trimInline(inline(cell))),
          )
          const header = Boolean(el.querySelector('thead, th'))
          if (rows.length > 0) blocks.push(table(rows, header))
          break
        }
        case 'hr':
          blocks.push({ type: 'horizontalrule', version: 1 })
          break
        default:
          await walk(el)
      }
    }
    flush()
  }

  await walk(document.body)
  return { report, state: root(blocks) }
}

/** Renders structured import blocks (FundYourFX format) to HTML for conversion. */
export const blocksToHTML = (
  blocks: { items?: string[]; rows?: string[][]; src?: string; alt?: string; text?: string; type: string }[],
): string => {
  const esc = (value = '') =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return blocks
    .map((block) => {
      switch (block.type) {
        case 'p':
        case 'h2':
        case 'h3':
        case 'h4':
          return `<${block.type}>${esc(block.text)}</${block.type}>`
        case 'ul':
        case 'ol':
          return `<${block.type}>${(block.items ?? []).map((item) => `<li>${esc(item)}</li>`).join('')}</${block.type}>`
        case 'img':
          return `<img src="${esc(block.src)}" alt="${esc(block.alt)}">`
        case 'table': {
          const [head, ...body] = block.rows ?? []
          if (!head) return ''
          return `<table><thead><tr>${head.map((cell) => `<th>${esc(cell)}</th>`).join('')}</tr></thead><tbody>${body
            .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`
        }
        default:
          return block.text ? `<p>${esc(block.text)}</p>` : ''
      }
    })
    .join('')
}
