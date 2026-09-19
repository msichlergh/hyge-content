import { describe, expect, it } from 'vitest'

import { blocksToHTML, htmlToLexical } from '@/content/htmlToLexical'
import { renderRichText } from '@/content/richText'

type AnyNode = { children?: AnyNode[]; type?: string; value?: unknown; [key: string]: unknown }

const media = (id: unknown) => ({ altText: 'alt', height: 10, url: `https://cdn/${id}.webp`, width: 10 })

/** Populates upload nodes the way a depth-1 read would, then renders. */
const render = (state: { root: AnyNode }) => {
  const populate = (node: AnyNode): AnyNode => ({
    ...node,
    ...(node.type === 'upload' ? { value: media(node.value) } : {}),
    ...(node.children ? { children: node.children.map(populate) } : {}),
  })
  return renderRichText({ root: populate(state.root) })
}

const convert = async (html: string) => {
  const sources: string[] = []
  const result = await htmlToLexical(html, async ({ src }) => {
    sources.push(src)
    return src.includes('missing') ? null : `m${sources.length}`
  })
  return { ...result, rendered: render(result.state as never), sources }
}

describe('HTML to Lexical conversion', () => {
  it('keeps headings, formatting and links', async () => {
    const { rendered } = await convert(
      '<h2>Risk</h2><p>Protect <strong>capital</strong> with <a href="/blog/stops">stops</a> and <em>discipline</em>.</p>',
    )

    expect(rendered.html).toContain('<h2 id="risk">Risk</h2>')
    expect(rendered.html).toContain('<strong>capital</strong>')
    expect(rendered.html).toContain('<em>discipline</em>')
    expect(rendered.html).toContain('href="/blog/stops"')
  })

  it('turns images into uploads, including images wrapped in paragraphs and figures', async () => {
    const { rendered, sources } = await convert(
      '<p><img src="/a.webp" alt="Chart"></p><figure><img src="/b.webp"></figure>',
    )

    expect(sources).toEqual(['/a.webp', '/b.webp'])
    expect(rendered.blocks.filter((block) => block.type === 'image')).toHaveLength(2)
    expect(rendered.blocks[0]).toMatchObject({ alt: 'Chart', type: 'image' })
  })

  it('reports images it could not store instead of dropping them silently', async () => {
    const { report } = await convert('<p><img src="/missing.webp"></p>')
    expect(report.droppedImages).toEqual(['/missing.webp'])
  })

  it('keeps tables that WordPress wraps in a figure', async () => {
    const { rendered } = await convert(
      '<figure class="wp-block-table"><table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody><tr><td>Payout</td><td>24h</td></tr></tbody></table></figure>',
    )

    expect(rendered.blocks).toEqual([
      { header: true, rows: [['Item', 'Value'], ['Payout', '24h']], type: 'table' },
    ])
  })

  it('nests lists without consuming numbers in ordered lists', async () => {
    const { state, rendered } = await convert(
      '<ol><li>First<ul><li>Detail</li></ul></li><li>Second</li></ol>',
    )

    const list = (state.root as AnyNode).children?.[0]
    const values = list?.children?.map((item) => item.value)
    expect(values).toEqual([1, 2, 2])
    expect(rendered.html).toContain('nestedListItem')
    expect(rendered.html.match(/Detail/g)).toHaveLength(1)
  })

  it('keeps paragraphs inside list items as separate lines', async () => {
    const { rendered } = await convert('<ul><li><p>Program</p><p>Each program has rules.</p></li></ul>')
    expect(rendered.html).toMatch(/Program<br\s*\/?>Each program has rules\./)
  })

  it('separates caption name and role in attribution figures', async () => {
    const { rendered } = await convert(
      '<figure><blockquote><p>Quote.</p></blockquote><figcaption><strong>Ada Lovelace</strong><span>Founder</span></figcaption></figure>',
    )

    expect(rendered.blocks[0]).toEqual({ html: 'Quote.', type: 'quote' })
    expect(rendered.blocks[1]).toMatchObject({ type: 'paragraph' })
    expect((rendered.blocks[1] as { html: string }).html).toMatch(/Ada Lovelace<\/strong><\/em><br\s*\/?>/)
  })

  it('keeps text from unknown inline tags and reports the tag', async () => {
    const { rendered, report } = await convert('<p>Price <kbd>Ctrl</kbd> key</p>')
    expect(rendered.html).toContain('Price Ctrl key')
    expect(report.unknownTags).toEqual(['kbd'])
  })

  it('drops empty links and empty paragraphs', async () => {
    const { rendered } = await convert('<p><a href="/x"> </a></p><p>&nbsp;</p><p>Kept</p>')
    expect(rendered.blocks).toEqual([{ html: 'Kept', type: 'paragraph' }])
  })

  it('renders structured blocks to escaped HTML', () => {
    expect(
      blocksToHTML([
        { text: 'Tom & Jerry <3', type: 'h2' },
        { items: ['a', 'b'], type: 'ol' },
        { alt: 'x', src: '/i.png', type: 'img' },
        { rows: [['H'], ['v']], type: 'table' },
      ]),
    ).toBe(
      '<h2>Tom &amp; Jerry &lt;3</h2><ol><li>a</li><li>b</li></ol><img src="/i.png" alt="x"><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>v</td></tr></tbody></table>',
    )
  })
})
