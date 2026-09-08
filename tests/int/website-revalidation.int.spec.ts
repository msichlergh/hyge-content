import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { revalidateChangelogWebsite } from '@/hooks/revalidateChangelogWebsite'
import {
  REVALIDATION_IDEMPOTENCY_HEADER,
  REVALIDATION_SIGNATURE_HEADER,
  REVALIDATION_TIMESTAMP_HEADER,
  resolveRevalidationTarget,
  revalidationEndpointURL,
  revalidationEventID,
  revalidationHeaders,
  revalidationSecretEnvKey,
  signRevalidationRequest,
  verifyRevalidationSignature,
} from '@/lib/websiteRevalidation'

const SECRET = 'a-test-signing-secret'

describe('revalidation signing', () => {
  it('signs timestamp + "." + raw body with hmac-sha256', () => {
    const body = '{"slug":"r-2026-03-18"}'
    const expected = createHmac('sha256', SECRET).update(`1700000000.${body}`).digest('hex')

    expect(signRevalidationRequest(1700000000, body, SECRET)).toBe(expected)
  })

  it('verifies a matching signature and rejects tampering', () => {
    const body = '{"slug":"r-2026-03-18"}'
    const signature = signRevalidationRequest(1700000000, body, SECRET)

    expect(verifyRevalidationSignature(1700000000, body, SECRET, signature)).toBe(true)
    expect(verifyRevalidationSignature(1700000001, body, SECRET, signature)).toBe(false)
    expect(verifyRevalidationSignature(1700000000, `${body} `, SECRET, signature)).toBe(false)
    expect(verifyRevalidationSignature(1700000000, body, 'other-secret', signature)).toBe(false)
    expect(verifyRevalidationSignature(1700000000, body, SECRET, undefined)).toBe(false)
    expect(verifyRevalidationSignature(1700000000, body, SECRET, 'short')).toBe(false)
  })
})

describe('revalidation target resolution', () => {
  it('derives a tenant-scoped environment variable name', () => {
    expect(revalidationSecretEnvKey('yourpropfirm')).toBe('HYGE_REVALIDATION_SECRET_YOURPROPFIRM')
    expect(revalidationSecretEnvKey('qtg-markets')).toBe('HYGE_REVALIDATION_SECRET_QTG_MARKETS')
  })

  it('builds the endpoint from the tenant website origin only', () => {
    expect(revalidationEndpointURL('https://yourpropfirm.com')).toBe(
      'https://yourpropfirm.com/api/revalidate/content',
    )
    expect(revalidationEndpointURL('https://yourpropfirm.com/changelog?a=1')).toBe(
      'https://yourpropfirm.com/api/revalidate/content',
    )
    expect(revalidationEndpointURL('http://localhost:3001')).toBe(
      'http://localhost:3001/api/revalidate/content',
    )
  })

  it('refuses plaintext remote origins and malformed URLs', () => {
    expect(revalidationEndpointURL('http://yourpropfirm.com')).toBeNull()
    expect(revalidationEndpointURL('not-a-url')).toBeNull()
  })

  it('returns null unless both a secret and a website URL exist', () => {
    const env = { HYGE_REVALIDATION_SECRET_YOURPROPFIRM: SECRET }

    expect(resolveRevalidationTarget('yourpropfirm', 'https://yourpropfirm.com', env)).toEqual({
      endpointURL: 'https://yourpropfirm.com/api/revalidate/content',
      secret: SECRET,
    })
    expect(resolveRevalidationTarget('unconfigured', 'https://example.com', env)).toBeNull()
    expect(resolveRevalidationTarget('yourpropfirm', null, env)).toBeNull()
    expect(resolveRevalidationTarget('yourpropfirm', 'https://yourpropfirm.com', {})).toBeNull()
  })
})

describe('revalidation event identity', () => {
  it('is stable for the same document version and unique per version', () => {
    const first = revalidationEventID('yourpropfirm', 'changelog', 'r-2026-03-18', 'v1')

    expect(revalidationEventID('yourpropfirm', 'changelog', 'r-2026-03-18', 'v1')).toBe(first)
    expect(revalidationEventID('yourpropfirm', 'changelog', 'r-2026-03-18', 'v2')).not.toBe(first)
    expect(revalidationEventID('other', 'changelog', 'r-2026-03-18', 'v1')).not.toBe(first)
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('emits the signed transport headers', () => {
    const event = {
      contentType: 'changelog',
      eventId: 'event-1',
      publishedAt: '2026-03-18T12:00:00.000Z',
      slug: 'r-2026-03-18',
      tenant: 'yourpropfirm',
    } as const
    const rawBody = JSON.stringify(event)
    const headers = revalidationHeaders(event, rawBody, SECRET, 1700000000)

    expect(headers[REVALIDATION_IDEMPOTENCY_HEADER]).toBe('event-1')
    expect(headers[REVALIDATION_TIMESTAMP_HEADER]).toBe('1700000000')
    expect(
      verifyRevalidationSignature(1700000000, rawBody, SECRET, headers[REVALIDATION_SIGNATURE_HEADER]),
    ).toBe(true)
  })
})

type HookArgs = Parameters<typeof revalidateChangelogWebsite>[0]

const tenant = { id: 'tenant-1', slug: 'yourpropfirm', websiteURL: 'https://yourpropfirm.com' }

const logger = { error: vi.fn(), info: vi.fn() }

const hookArgs = (overrides: Record<string, unknown> = {}): HookArgs =>
  ({
    context: {},
    doc: {
      _status: 'published',
      publishedAt: '2026-03-18T12:00:00.000Z',
      slug: 'r-2026-03-18',
      tenant: 'tenant-1',
      updatedAt: '2026-03-18T12:00:00.000Z',
    },
    previousDoc: { _status: 'draft' },
    req: { payload: { findByID: vi.fn().mockResolvedValue(tenant), logger } },
    ...overrides,
  }) as unknown as HookArgs

describe('changelog publish sends a signed revalidation', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.HYGE_REVALIDATION_SECRET_YOURPROPFIRM = SECRET
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    logger.error.mockClear()
    logger.info.mockClear()
  })

  afterEach(() => {
    delete process.env.HYGE_REVALIDATION_SECRET_YOURPROPFIRM
    vi.unstubAllGlobals()
  })

  it('posts a verifiable signed request on first publication', async () => {
    await revalidateChangelogWebsite(hookArgs())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]

    expect(url).toBe('https://yourpropfirm.com/api/revalidate/content')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      contentType: 'changelog',
      publishedAt: '2026-03-18T12:00:00.000Z',
      slug: 'r-2026-03-18',
      tenant: 'yourpropfirm',
    })
    expect(init.headers[REVALIDATION_IDEMPOTENCY_HEADER]).toBe(body.eventId)
    expect(
      verifyRevalidationSignature(
        init.headers[REVALIDATION_TIMESTAMP_HEADER],
        init.body,
        SECRET,
        init.headers[REVALIDATION_SIGNATURE_HEADER],
      ),
    ).toBe(true)
  })

  it('stays silent for drafts, suppressed imports, and unchanged autosaves', async () => {
    await revalidateChangelogWebsite(hookArgs({ doc: { _status: 'draft', slug: 'r-1' } }))
    await revalidateChangelogWebsite(hookArgs({ context: { skipNotifications: true } }))
    await revalidateChangelogWebsite(
      hookArgs({
        previousDoc: { _status: 'published', updatedAt: '2026-03-18T12:00:00.000Z' },
      }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does nothing when the tenant has no configured signing secret', async () => {
    delete process.env.HYGE_REVALIDATION_SECRET_YOURPROPFIRM

    await revalidateChangelogWebsite(hookArgs())

    expect(fetchMock).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('never fails a publish when the website rejects or the request throws', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(revalidateChangelogWebsite(hookArgs())).resolves.toBeDefined()

    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(revalidateChangelogWebsite(hookArgs())).resolves.toBeDefined()

    expect(logger.error).toHaveBeenCalledTimes(2)
  })
})
