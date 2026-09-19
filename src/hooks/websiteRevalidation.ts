import type { CollectionAfterChangeHook } from 'payload'

import { relationshipID } from '../access/memberships'
import {
  resolveRevalidationTarget,
  revalidationEventID,
  revalidationHeaders,
  type RevalidationContentType,
  type RevalidationEvent,
} from '../lib/websiteRevalidation'

const REVALIDATION_TIMEOUT_MS = 5000

/**
 * Best-effort signed revalidation on publish, per content type.
 *
 * It never blocks or fails a publish. Phase 3 replaces the inline send with the
 * publication outbox and the `revalidate-website` queue job, which adds durable
 * retry; the signed request contract stays identical.
 */
export const createWebsiteRevalidationHook =
  (contentType: RevalidationContentType): CollectionAfterChangeHook =>
  async ({ context, doc, previousDoc, req }) => {
    const { payload } = req

    // Seed imports and other notification-suppressed writes must stay silent.
    if (context.skipNotifications) return doc
    if (doc?._status !== 'published') return doc

    // Autosave rewrites of an unchanged published document are not new content.
    if (previousDoc?._status === 'published' && previousDoc?.updatedAt === doc?.updatedAt)
      return doc

    const slug = typeof doc.slug === 'string' ? doc.slug : null
    const tenantID = relationshipID(doc.tenant)
    if (!slug || tenantID === null) return doc

    try {
      const tenant = await payload.findByID({
        id: tenantID,
        collection: 'tenants',
        depth: 0,
        overrideAccess: true,
        req,
      })

      const target = resolveRevalidationTarget(tenant?.slug, tenant?.websiteURL)
      if (!target) return doc

      const publishedAt =
        typeof doc.publishedAt === 'string' ? doc.publishedAt : new Date().toISOString()
      const version = typeof doc.updatedAt === 'string' ? doc.updatedAt : publishedAt

      const event: RevalidationEvent = {
        contentType,
        eventId: revalidationEventID(tenant.slug, contentType, slug, version),
        publishedAt,
        slug,
        tenant: tenant.slug,
      }

      const rawBody = JSON.stringify(event)
      const timestamp = Math.floor(Date.now() / 1000)

      const response = await fetch(target.endpointURL, {
        body: rawBody,
        headers: revalidationHeaders(event, rawBody, target.secret, timestamp),
        method: 'POST',
        signal: AbortSignal.timeout(REVALIDATION_TIMEOUT_MS),
      })

      if (!response.ok) {
        payload.logger.error(
          { eventId: event.eventId, slug, status: response.status, tenant: event.tenant },
          'Website revalidation was rejected.',
        )
        return doc
      }

      payload.logger.info(
        { eventId: event.eventId, slug, tenant: event.tenant },
        'Website revalidation accepted.',
      )
    } catch (error) {
      // Never surface the signing secret or the response body in logs.
      payload.logger.error(
        { message: error instanceof Error ? error.message : 'Unknown error', slug },
        'Website revalidation failed.',
      )
    }

    return doc
  }

export const revalidateChangelogWebsite = createWebsiteRevalidationHook('changelog')
