# Public content API v1

The public content API is a server-to-server contract. Website code must call it from the server and cache the last successful response. Do not expose the API key in a browser bundle.

## Authentication

Create a dedicated active Payload user for each website integration:

- Global role: `member`.
- Tenant membership: the website tenant only.
- Section: `changelog`.
- Capability: `read`.
- Payload API key: enabled for that user.

Send the generated key exactly as:

```text
Authorization: users API-Key <key>
```

The endpoint resolves the tenant through that user's membership. A key without access to the URL tenant receives `404` and cannot enumerate another tenant.

## Endpoints

```text
GET /api/public/v1/{tenant}/changelog
GET /api/public/v1/{tenant}/changelog/{slug}
```

Query parameters:

- `locale`: an enabled tenant locale; defaults to the tenant's default locale.
- `fallback`: `none` by default, or `default` to explicitly use the tenant default locale when an approved requested-locale translation is unavailable.
- `page`: positive integer for the list endpoint; defaults to `1`.
- `limit`: `1` through `50` for the list endpoint; defaults to `20`.

Only published releases with an `approved` translation state are returned. Draft, review, missing, and stale translations are never served. Payload's implicit localization fallback is disabled.

## Response

```json
{
  "data": [
    {
      "slug": "r-2026-03-18",
      "date": "2026-03-18T12:00:00.000Z",
      "headline": "Affiliate rebuild: campaigns, tiers, and payout verification.",
      "kicker": "...",
      "locale": "en",
      "cover": {
        "type": "affiliate",
        "image": null
      },
      "flagship": {
        "label": "The big one",
        "title": "Affiliate Campaign Management",
        "body": "...",
        "surface": "affiliate"
      },
      "sections": {
        "features": [],
        "improvements": [],
        "fixes": []
      }
    }
  ],
  "meta": {
    "tenant": "yourpropfirm",
    "version": "v1",
    "requestedLocale": "de",
    "fallbackLocale": "en",
    "resolvedLocales": ["de", "en"],
    "fallbackUsed": true,
    "generatedAt": "2026-08-15T12:00:00.000Z"
  }
}
```

Each item reports its actual `locale`. Consumers must not label fallback copy as an approved translation of the requested locale.

Responses use `Cache-Control: private` and `Vary: Authorization`. The consumer website owns ISR/static caching, safe fallback to its last successful content, and presentation.

## Historical YourPropFirm import

After the Phase 2 migration is deployed, run once with production environment variables:

```bash
npm run seed:yourpropfirm-changelog
```

The import is idempotent by tenant and slug. It passes `context.skipNotifications = true`; historical releases must never create publication notifications when Phase 3 hooks are added.

## Signed website revalidation

On publish, the CMS posts a signed request to the tenant website so it can refresh
cached routes without a redeploy. The sender lives in
`src/hooks/revalidateChangelogWebsite.ts`; the signing primitives are in
`src/lib/websiteRevalidation.ts`.

### Configuration

The endpoint is derived from the tenant's `websiteURL` origin plus
`/api/revalidate/content`. Only `https` origins are accepted, except `localhost`
for development.

The signing secret is read from a tenant-scoped environment variable on the CMS:

```text
HYGE_REVALIDATION_SECRET_<TENANT_SLUG>
```

For example `HYGE_REVALIDATION_SECRET_YOURPROPFIRM`. The website stores the same
value as `HYGE_REVALIDATION_SECRET`. If a tenant has no secret configured, the
CMS sends nothing at all rather than failing a publish.

### Request

```json
{
  "eventId": "uuid",
  "tenant": "yourpropfirm",
  "contentType": "changelog",
  "slug": "r-2026-03-18",
  "publishedAt": "2026-03-18T12:00:00.000Z"
}
```

```text
X-HYGE-Timestamp: unix-seconds
X-HYGE-Signature: hmac-sha256(timestamp + "." + raw-body), hex
X-Idempotency-Key: event-id
```

`eventId` is derived from tenant, content type, slug, and document version, so a
resend of the same version carries the same key and deduplicates cleanly.

### Receiver requirements

The website endpoint must:

1. Reject timestamps outside a five-minute window.
2. Verify the signature over the **raw** body using constant-time comparison.
3. Reject a tenant other than its own.
4. Deduplicate by `eventId`.
5. Revalidate only the affected routes/tags.
6. Return a truthful status; never report success for a failed refresh.

`verifyRevalidationSignature` in `src/lib/websiteRevalidation.ts` is the reference
implementation of step 2.

### Delivery guarantees

Phase 2 delivery is best-effort and inline: a rejected or failed revalidation is
logged and never blocks or reverses a publish. Draft saves, unchanged autosaves,
and `context.skipNotifications` imports send nothing. Phase 3 moves this behind
the publication outbox and the `revalidate-website` queue job for durable retry;
the wire contract above does not change.
