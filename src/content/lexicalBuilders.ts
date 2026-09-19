/**
 * Minimal builders for Lexical editor state, used by importers and tests to
 * produce the exact node shapes the Payload editor itself saves.
 */

type Node = Record<string, unknown>

const element = (type: string, children: Node[], extra: Node = {}): Node => ({
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  type,
  version: 1,
  ...extra,
})

export const TEXT_FORMAT = { bold: 1, code: 16, italic: 2, strikethrough: 4, underline: 8 } as const

export const text = (value: string, format = 0): Node => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
})

export const link = (url: string, children: Node[], newTab = false): Node =>
  element('link', children, {
    fields: { linkType: 'custom', newTab, url },
    version: 3,
  })

const inline = (content: Node[] | string): Node[] =>
  typeof content === 'string' ? (content ? [text(content)] : []) : content

export const paragraph = (content: Node[] | string): Node =>
  element('paragraph', inline(content), { textFormat: 0, textStyle: '' })

export const heading = (tag: 'h2' | 'h3' | 'h4', content: Node[] | string): Node =>
  element('heading', inline(content), { tag })

export const list = (ordered: boolean, items: (Node[] | string)[]): Node =>
  element(
    'list',
    items.map((item, index) => element('listitem', inline(item), { value: index + 1 })),
    { listType: ordered ? 'number' : 'bullet', start: 1, tag: ordered ? 'ol' : 'ul' },
  )

export const quote = (content: Node[] | string): Node => element('quote', inline(content))

export const upload = (mediaID: number | string, alt?: string): Node => ({
  fields: alt ? { alt } : null,
  format: '',
  relationTo: 'media',
  type: 'upload',
  value: mediaID,
  version: 3,
})

export const table = (rows: (Node[] | string)[][], header: boolean): Node =>
  element(
    'table',
    rows.map((row, rowIndex) =>
      element(
        'tablerow',
        row.map((cell) =>
          element('tablecell', [paragraph(cell)], {
            backgroundColor: null,
            colSpan: 1,
            headerState: header && rowIndex === 0 ? 1 : 0,
            rowSpan: 1,
          }),
        ),
      ),
    ),
  )

export const root = (children: Node[]) => ({ root: element('root', children) })
