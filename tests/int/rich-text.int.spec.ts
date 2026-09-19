import { describe, expect, it } from 'vitest'

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
} from '@/content/lexicalBuilders'
import { headingID, renderRichText } from '@/content/richText'

const media = {
  altText: 'Library alt',
  height: 600,
  id: 'media-1',
  url: 'https://cdn.example.com/chart.webp',
  width: 1200,
}

const uploadNode = (value: unknown, alt?: string) => ({
  fields: alt ? { alt } : null,
  format: '',
  relationTo: 'media',
  type: 'upload',
  value,
  version: 3,
})

describe('rich text rendering', () => {
  it('renders html and an equivalent block list from one document', () => {
    const rendered = renderRichText(
      root([
        heading('h2', 'Risk management'),
        paragraph([text('Protect '), text('capital', TEXT_FORMAT.bold), text(' first.')]),
        list(false, ['Size positions', 'Set stops']),
        list(true, ['One', 'Two']),
        quote('Cut losses early.'),
      ]),
    )

    expect(rendered.html).toContain('<h2 id="risk-management">Risk management</h2>')
    expect(rendered.html).toContain('<strong>capital</strong>')
    expect(rendered.blocks).toEqual([
      { html: 'Risk management', id: 'risk-management', level: 2, text: 'Risk management', type: 'heading' },
      { html: 'Protect <strong>capital</strong> first.', type: 'paragraph' },
      { items: ['Size positions', 'Set stops'], ordered: false, type: 'list' },
      { items: ['One', 'Two'], ordered: true, type: 'list' },
      { html: 'Cut losses early.', type: 'quote' },
    ])
    expect(rendered.toc).toEqual([{ id: 'risk-management', level: 2, text: 'Risk management' }])
  })

  it('gives repeated headings unique, matching anchors in html, blocks and toc', () => {
    const rendered = renderRichText(root([heading('h2', 'Summary'), heading('h3', 'Summary')]))

    expect(rendered.toc.map((entry) => entry.id)).toEqual(['summary', 'summary-2'])
    expect(rendered.html).toContain('id="summary"')
    expect(rendered.html).toContain('id="summary-2"')
  })

  it('renders populated uploads with node alt taking precedence over the library alt', () => {
    const withNodeAlt = renderRichText(root([uploadNode(media, 'Chart of EURUSD') as never]))
    expect(withNodeAlt.blocks).toEqual([
      { alt: 'Chart of EURUSD', height: 600, src: media.url, type: 'image', width: 1200 },
    ])
    expect(withNodeAlt.html).toContain('alt="Chart of EURUSD"')

    const libraryAlt = renderRichText(root([uploadNode(media) as never]))
    expect(libraryAlt.blocks[0]).toMatchObject({ alt: 'Library alt' })
  })

  it('drops unpopulated uploads instead of emitting broken images', () => {
    const rendered = renderRichText(root([uploadNode('media-1') as never]))
    expect(rendered.blocks).toEqual([])
    expect(rendered.html).not.toContain('<img')
  })

  it('renders tables with header detection', () => {
    const rendered = renderRichText(
      root([
        table(
          [
            ['Feature', 'FundYourFX'],
            ['Payout', '24h'],
          ],
          true,
        ),
      ]),
    )

    expect(rendered.blocks).toEqual([
      {
        header: true,
        rows: [
          ['Feature', 'FundYourFX'],
          ['Payout', '24h'],
        ],
        type: 'table',
      },
    ])
    expect(rendered.html).toContain('<table')
  })

  it('neutralizes script URLs in links', () => {
    const rendered = renderRichText(
      root([paragraph([link('javascript:alert(1)', [text('click')])])]),
    )
    expect(rendered.html).not.toContain('javascript:')
  })

  it('escapes heading text into safe anchors and handles non-latin scripts', () => {
    expect(headingID('Why "risk" <matters>')).toBe('why-risk-matters')
    expect(headingID('Café résumé')).toBe('cafe-resume')
    expect(headingID('إدارة المخاطر')).toBe('إدارة-المخاطر')
    expect(headingID('!!!')).toBe('section')
  })

  it('estimates reading time from words and returns an empty render for missing bodies', () => {
    const words = Array.from({ length: 450 }, () => 'word').join(' ')
    expect(renderRichText(root([paragraph(words)])).readingTimeMinutes).toBe(2)
    expect(renderRichText(null)).toEqual({ blocks: [], html: '', readingTimeMinutes: 0, toc: [] })
  })
})
