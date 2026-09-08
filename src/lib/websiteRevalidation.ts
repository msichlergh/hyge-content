import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const REVALIDATION_SIGNATURE_HEADER = 'X-HYGE-Signature'
export const REVALIDATION_TIMESTAMP_HEADER = 'X-HYGE-Timestamp'
export const REVALIDATION_IDEMPOTENCY_HEADER = 'X-Idempotency-Key'

/** Receivers must reject timestamps outside this window. */
export const REVALIDATION_TIMESTAMP_TOLERANCE_SECONDS = 300

export const REVALIDATION_PATH = '/api/revalidate/content'

export type RevalidationContentType = 'changelog'

export type RevalidationEvent = {
  contentType: RevalidationContentType
  eventId: string
  publishedAt: string
  slug: string
  tenant: string
}

export type RevalidationTarget = {
  endpointURL: string
  secret: string
}

/**
 * Per-tenant signing secrets are read from a tenant-scoped environment variable.
 * Phase 3 replaces this resolver with managed integration records holding a
 * secret reference; nothing else in the send path needs to change.
 */
export const revalidationSecretEnvKey = (tenantSlug: string): string =>
  `HYGE_REVALIDATION_SECRET_${tenantSlug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`

export const revalidationEndpointURL = (websiteURL: string): null | string => {
  try {
    const base = new URL(websiteURL)
    if (base.protocol !== 'https:' && base.hostname !== 'localhost') return null
    return `${base.origin}${REVALIDATION_PATH}`
  } catch {
    return null
  }
}

export const resolveRevalidationTarget = (
  tenantSlug: unknown,
  websiteURL: unknown,
  env: Record<string, string | undefined> = process.env,
): null | RevalidationTarget => {
  if (typeof tenantSlug !== 'string' || tenantSlug.length === 0) return null
  if (typeof websiteURL !== 'string' || websiteURL.length === 0) return null

  const secret = env[revalidationSecretEnvKey(tenantSlug)]
  if (typeof secret !== 'string' || secret.length === 0) return null

  const endpointURL = revalidationEndpointURL(websiteURL)
  if (!endpointURL) return null

  return { endpointURL, secret }
}

/** hmac-sha256(timestamp + "." + raw-body), hex encoded. */
export const signRevalidationRequest = (
  timestamp: number | string,
  rawBody: string,
  secret: string,
): string => createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')

export const verifyRevalidationSignature = (
  timestamp: number | string,
  rawBody: string,
  secret: string,
  candidate: unknown,
): boolean => {
  if (typeof candidate !== 'string') return false

  const expected = Buffer.from(signRevalidationRequest(timestamp, rawBody, secret), 'utf8')
  const received = Buffer.from(candidate, 'utf8')
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}

/**
 * Deterministic event ID so a retry of the same document version carries the
 * same idempotency key and the receiver can safely deduplicate.
 */
export const revalidationEventID = (
  tenantSlug: string,
  contentType: RevalidationContentType,
  slug: string,
  version: string,
): string => {
  const digest = createHash('sha256')
    .update([tenantSlug, contentType, slug, version].join(' '))
    .digest('hex')

  const variant = ((parseInt(digest.slice(16, 17), 16) & 0x3) | 0x8).toString(16)

  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `5${digest.slice(13, 16)}`,
    `${variant}${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-')
}

export const revalidationHeaders = (
  event: RevalidationEvent,
  rawBody: string,
  secret: string,
  timestamp: number,
): Record<string, string> => ({
  'Content-Type': 'application/json',
  [REVALIDATION_IDEMPOTENCY_HEADER]: event.eventId,
  [REVALIDATION_SIGNATURE_HEADER]: signRevalidationRequest(timestamp, rawBody, secret),
  [REVALIDATION_TIMESTAMP_HEADER]: String(timestamp),
})
