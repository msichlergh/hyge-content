# HYGE Content Platform

Implementation specification for a separate, multi-company content and release-publishing platform.

- Status: Ready for implementation
- Prepared: 14 August 2026
- Revision: 2 — editor policy, website adapter boundary, delivery estimates, CMS decision record, and future roadmap
- Proposed repository: `msichlergh/hyge-content-platform`
- Proposed production URL: `cms.hyge.com`
- Initial tenants: YourPropFirm and one additional QTG company
- First external validation: one HYGE client outside QTG

## 1. Executive decision

Build the platform as a separate private repository, Vercel project, Postgres database, and object-storage integration.

Use free, self-hosted Payload as the application framework and CMS. Use Payload's official multi-tenant plugin for tenant selection and document assignment, but enforce tenant boundaries with explicit server-side access-control tests as well.

The platform is a central authoring and publishing control plane. It is not part of any individual company website, and company websites must not depend on a live CMS request for every visitor request.

```text
HYGE users and client users
            |
            v
  HYGE Content Platform
  Payload admin + API + jobs
      |             |
      |             +--> Resend / Slack
      |
      +--> Postgres + object storage
      |
      +--> signed publish webhooks
                 |
        +--------+---------+
        |                  |
        v                  v
 YourPropFirm site    External client site
 Vercel cache/ISR     Any supported frontend
```

## 2. Objectives

The platform must allow HYGE to:

1. Manage content for multiple QTG and external companies from one Payload deployment.
2. Restrict every user to explicitly assigned companies and content sections.
3. Let Marketing manage blog posts, events, SEO metadata, and media without seeing product-release operations.
4. Let Product Owners draft and publish changelog releases without seeing integration secrets or unrelated companies.
5. Publish content to independent websites without putting content into their Git repositories.
6. On first publication of a changelog release, revalidate the relevant website and reliably fan out Slack and email notifications.
7. Preserve public website availability if Payload, Postgres, Resend, or Slack is temporarily unavailable.
8. Provide an audit trail, retry controls, export capability, and safe tenant offboarding.

## 3. MVP boundary

### Included

- Multi-company tenant management.
- Payload email/password authentication.
- Tenant- and section-scoped access control.
- Blog, event, changelog, SEO metadata, and media collections.
- Tenant-scoped content localization with manual translation review.
- Drafts, versions, previews, scheduled publication where supported by the core.
- Read-only published-content API.
- Signed cache-revalidation webhooks.
- Durable publication events and background delivery jobs.
- Resend email delivery.
- Slack notification delivery.
- Delivery status and retry visibility.
- Existing YourPropFirm changelog import.
- One second QTG tenant and one external-client pilot.

### Explicitly excluded from MVP

- Universal visual page builder.
- Billing, subscriptions, or metered tenant plans.
- Self-service customer signup.
- Full white-labelled admin interface per client.
- Enterprise SSO.
- Payload Enterprise approval workflows.
- Automatic publication of AI-generated content or translations.
- Translation-memory and model fine-tuning infrastructure.
- A/B testing.
- Hosting arbitrary customer websites.
- Replacing a client's CRM, customer database, or transactional notification platform.

Do not add excluded items pre-emptively. Design extension points, but implement only a demonstrated requirement.

## 4. Why a separate repository

The system serves multiple companies and has an independent deployment lifecycle, secrets, database, storage, security boundary, and operational owner. Keeping it inside the YourPropFirm website would:

- Couple CMS deployments to one company's public-site changes.
- Force Payload's Next.js compatibility requirements onto an established website.
- Put cross-company credentials inside a company-specific repository.
- Make ownership and incident blast radius ambiguous.
- Encourage company-specific assumptions in a shared platform.

Each company website should contain only a small content client, content-to-view-model mapper, cache policy, and protected revalidation endpoint.

### One central Payload installation

Payload exists only in the HYGE Content Platform repository and Vercel project. Company websites must not install Payload packages, expose a Payload admin route, run Payload migrations or jobs, connect to its database, or duplicate its collection configuration.

A company website needs only:

- Server-only CMS URL, tenant ID, and read credential.
- A small HTTP client for the versioned HYGE public API.
- A local mapper from the public content contract into the website's view models.
- Website-owned renderers, routes, metadata, cache behavior, and design system.
- A protected signed revalidation endpoint.
- The CMS media domain in its image/CDN allow list where required.

This boundary supports Next.js and other frontend stacks. The platform owns authoring, validation, storage, publishing, and delivery; each website owns presentation and remains independently deployable.

## 5. Recommended technology

| Layer | Choice | Notes |
|---|---|---|
| CMS and admin | Payload 3.x | Free, MIT, self-hosted |
| Web runtime | A Payload-supported Next.js release | Pin exact versions and lockfile |
| Database | Dedicated Supabase Postgres project | Payload tables in a private schema |
| Media | Supabase Storage through Payload's S3 adapter | Server-side S3 credentials only |
| Email | Resend | Auth email and release delivery |
| Slack | Slack app | Shared-channel MVP; OAuth expansion later |
| Hosting | Dedicated Vercel project | CMS and protected cron endpoint |
| Background work | Payload Jobs Queue | Persisted jobs, retries, delivery ledger |
| Monitoring | Sentry plus structured logs | Readable per-tenant/event context |
| CI | GitHub Actions and Vercel checks | Migration, type, test, and build gates |

As of 13 August 2026, Payload `3.88.0` supports specific patched Next.js ranges, including Next `16.2.6+` below `17`. Do not copy a Next version from another repository. Before scaffolding, verify the current `@payloadcms/next` peer dependencies and use the official supported version.

Use Node 24 for development and production. Pin it in `.nvmrc` and the `engines` field. Commit the package lockfile.

### Payload versus Sanity decision record

Payload is the recommended fit for this platform.

Sanity is a strong managed authoring product and would reduce some CMS infrastructure work. It becomes less attractive for this specific shared-agency model because strict client isolation, custom roles, dataset/project topology, seats, and release features depend more heavily on Sanity's commercial plan design. A separate Sanity project per client is viable, but it fragments configuration and operations instead of creating one HYGE control plane. A shared Sanity project with advanced per-client authorization should not be assumed to fit the entry plans.

Payload keeps tenant rules, custom section permissions, publication events, notification jobs, delivery state, and the public API in one application under HYGE's control. Its software license does not require Premium/Enterprise for the MVP; infrastructure and engineering still have operating costs.

Reconsider Sanity only if HYGE deliberately chooses a managed SaaS model, accepts one project per client or validates the required enterprise role model, and values the managed editor/content lake more than control over the shared workflow layer.

## 6. Repository bootstrap

Create locally first, then create the private GitHub repository from the scaffold:

```bash
npx create-payload-app@latest hyge-content-platform -t blank --use-npm --no-agent
cd hyge-content-platform
git init
gh repo create msichlergh/hyge-content-platform --private --source=. --remote=origin
```

Before the first commit:

1. Verify `payload`, `@payloadcms/next`, database adapter, rich-text editor, storage adapter, email adapter, and multi-tenant plugin resolve to the same Payload version.
2. Verify the generated Next.js version satisfies `@payloadcms/next` peer dependencies.
3. Set Node 24 in `.nvmrc` and `package.json`.
4. Add `.env.example`, never a real `.env` file.
5. Add this document as `docs/architecture.md`.
6. Add the repository instructions and Conductor settings described below.

### Expected project structure

```text
hyge-content-platform/
├── app/
│   └── (payload)/
├── src/
│   ├── access/
│   ├── collections/
│   ├── endpoints/
│   ├── hooks/
│   ├── jobs/
│   ├── lib/
│   ├── migrations/
│   ├── seed/
│   ├── payload.config.ts
│   └── payload-types.ts
├── tests/
│   ├── access/
│   ├── api/
│   ├── jobs/
│   └── integration/
├── docs/
│   ├── architecture.md
│   ├── operations.md
│   └── tenant-onboarding.md
├── supabase/
│   └── migrations/
├── .conductor/
│   └── settings.toml
├── .env.example
├── .nvmrc
├── AGENTS.md
├── package.json
└── vercel.json
```

## 7. Tenancy model

Use the official `@payloadcms/plugin-multi-tenant` plugin.

Every tenant-owned record must have a required `tenant` relationship. Apply tenancy to:

- Media
- Posts
- Events
- SEO pages
- Changelog releases
- Publication events
- Notification deliveries
- Notification recipients
- Integration connections
- API keys

Set `cleanupAfterTenantDelete: false`. Tenant deletion must never cascade automatically. Offboarding requires an export, confirmation, retention decision, and explicit archival/deletion workflow.

### Tenant identity

Use an immutable UUID as the internal tenant ID and a unique human-readable slug for APIs.

Example slugs:

- `yourpropfirm`
- `fundyourfx`
- `client-company`

Do not use a domain as the primary key. Domains can change.

### Required tenant isolation rule

Every authenticated collection operation must resolve to one of:

1. Global platform administrator: unrestricted.
2. Tenant member: query constrained to allowed tenant IDs and allowed sections.
3. Anonymous/public API: published records only, constrained to the tenant in the signed API credential.
4. System job: explicit tenant ID from an immutable publication event.

Returning `true` for an ordinary tenant user's collection read/update/delete operation is forbidden. Return a tenant-constrained query.

## 8. Users and permissions

Use one Payload auth-enabled `users` collection. Payload authentication is independent of all customer dashboards.

### Global roles

- `platform-admin`: HYGE system administrators; all tenants and settings.
- `member`: everyone else; effective permissions come from tenant memberships.

Do not create global roles such as `marketing-company-a`, `product-company-b`, or page-specific roles.

### Tenant memberships

Each user contains a `memberships` array:

```text
membership
├── tenant
├── sections[]
│   ├── marketing
│   └── changelog
└── capabilities[]
    ├── read
    ├── draft
    ├── publish
    ├── notify
    └── manage-members
```

Example:

```text
SEO specialist
  YourPropFirm: marketing [read, draft, publish]
  Client A: marketing [read, draft]

Product owner
  YourPropFirm: changelog [read, draft, publish, notify]

HYGE account manager
  Client A: marketing [read, draft, publish]
  Client A: changelog [read]
```

### Access matrix

| Collection | Marketing | Product Owner | Tenant Manager | Platform Admin |
|---|---:|---:|---:|---:|
| Posts | Allowed tenant | No | Allowed tenant | All |
| Events | Allowed tenant | Optional read | Allowed tenant | All |
| SEO metadata | Allowed tenant | No | Allowed tenant | All |
| Media | Allowed tenant | Read | Allowed tenant | All |
| Changelog | No | Allowed tenant | Allowed tenant | All |
| Publication events | No | Read allowed tenant | Read allowed tenant | All |
| Delivery results | No | Read allowed tenant | Read allowed tenant | All |
| Notification recipients | No | No | Limited | All |
| Slack/integration setup | No | No | No | All |
| Tenants | No | Read own | Read own | All |
| Users | No | Self only | Tenant-scoped management | All |

### Field-level restrictions

Collection access is not sufficient. Enforce field access for:

- Global role
- Memberships and capabilities
- Tenant relationship
- Publication status
- Notification enablement
- Integration secret references
- Delivery state and provider IDs
- Audit fields

Hiding a field or collection in the admin UI is not security. The API access function must deny it.

### Local API warning

Payload Local API calls can override access control by default. Any request acting on behalf of a user must pass the user and set `overrideAccess: false`. Only explicitly identified system jobs may bypass ordinary user access, and they must always include an immutable tenant ID.

## 9. Collections and schemas

### 9.1 `tenants`

Fields:

- `id`: UUID, immutable.
- `name`: required text.
- `slug`: required unique indexed text.
- `status`: `active`, `suspended`, `archived`.
- `domains`: array of domains.
- `websiteURL`: required URL.
- `timezone`: IANA timezone.
- `defaultLocale`: locale code.
- `supportedLocales`: array.
- `brandName`: public sender/display name.
- `emailFromName`: validated sender name.
- `emailFromAddress`: verified Resend sender.
- `mediaPathPrefix`: immutable unique prefix.
- `createdAt`, `updatedAt`.

Do not store Slack bot tokens, database credentials, webhook secrets, or Resend keys on this document.

### 9.2 `users`

Fields:

- Payload auth fields.
- `name`.
- `globalRole`: `platform-admin` or `member`.
- `memberships`: tenant, sections, capabilities.
- `status`: `invited`, `active`, `suspended`.
- `lastLoginAt`.

Only platform administrators can assign `platform-admin`, change another user's memberships, or manage integration permissions.

### 9.3 `media`

Fields:

- `tenant`.
- Payload upload fields.
- `altText`: required for publishable images.
- `caption`.
- `credit`.
- `usage`: `blog`, `event`, `changelog`, `general`.
- `status`: `active`, `archived`.
- `uploadedBy`.

Generate responsive image sizes centrally. Reject unsupported MIME types and files over the configured limit. Sanitize filenames and derive the storage key server-side; never accept a client-provided tenant prefix.

### 9.4 `posts`

Fields:

- `tenant`.
- `title`, `slug`, `excerpt`.
- `body`: Lexical rich text.
- `coverImage`.
- `author` or structured author snapshot.
- `category`, `tags`.
- `publishedAt`.
- `seo`: meta title, meta description, canonical override, OG image, noindex.
- Payload `_status`, versions and drafts.

Uniqueness: `(tenant, slug)`.

### 9.5 `events`

Fields:

- `tenant`.
- `title`, `slug`, `summary`, `body`.
- `eventType`: conference, webinar, meetup, launch, other.
- `startsAt`, `endsAt`, `timezone`.
- `locationName`, `address`, `onlineURL`.
- `registrationURL`.
- `coverImage`.
- `speakers` array.
- `seo` group.
- Payload `_status`, versions and drafts.

Uniqueness: `(tenant, slug)`.

### 9.6 `seo-pages`

One record per tenant and website route.

Fields:

- `tenant`.
- `route`: normalized absolute path.
- `metaTitle`.
- `metaDescription`.
- `canonicalOverride`.
- `ogImage`.
- `noindex`.
- Optional structured-data overrides only when a clear requirement exists.

Uniqueness: `(tenant, route)`.

Do not move arbitrary marketing-page bodies into the CMS during MVP. This collection changes metadata, not the website's application structure or commercial claims.

### 9.7 `changelog-releases`

Fields:

- `tenant`.
- `releaseDate`.
- `slug`.
- `headline`.
- `kicker`.
- `coverType` or `coverImage`.
- `flagship`: optional label, title, body, surface/image.
- `features`: array of area, title, body.
- `improvements`: array of area, title, body.
- `fixes`: array of area, title, body.
- `notificationOptions`:
  - `emailEnabled`.
  - `slackEnabled`.
  - `emailSubject`.
  - `emailPreheader`.
  - `slackIntro`.
  - `audienceProvider`.
- `publishedAt`.
- `publishedBy`.
- Payload `_status`, versions and drafts.

Uniqueness: `(tenant, slug)`.

The initial YourPropFirm seed comes from the existing four records in `src/components/Changelog.jsx` in the website repository. Import with `context.skipNotifications = true`; seeding historical content must never send notifications.

### 9.8 `publication-events`

Immutable outbox record created on the first draft-to-published transition.

Fields:

- `tenant`.
- `eventKey`: unique.
- `eventType`: initially `changelog.published` or `changelog.correction`.
- `sourceCollection`, `sourceDocumentID`, `sourceVersionID`.
- `snapshot`: immutable normalized JSON used for all deliveries.
- `status`: `queued`, `preparing`, `sending`, `complete`, `partial`, `failed`.
- `emailEnabled`, `slackEnabled`.
- `createdBy`, `createdAt`.
- `preparedAt`, `completedAt`.
- Aggregate counts.
- Last safe error summary.

Users cannot update or delete these records. System jobs own state transitions.

### 9.9 `notification-deliveries`

One record per event and destination.

Fields:

- `tenant`.
- `publicationEvent`.
- `channel`: `email` or `slack`.
- `destinationKey`: stable external ID, not only an email address.
- `deliveryKey`: unique `(event, channel, destination)` key.
- Destination snapshot required to deliver.
- `status`: `pending`, `processing`, `sent`, `failed`, `suppressed`.
- `attemptCount`.
- `providerMessageID`.
- `lastAttemptAt`, `sentAt`.
- `lastErrorCode`, sanitized `lastErrorMessage`.

Do not expose raw email addresses or delivery payloads to Product Owners unless the business explicitly requires it. Counts and safe failure summaries are sufficient.

### 9.10 `notification-recipients`

Used only for tenants that do not provide recipients from an external dashboard or CRM.

Fields:

- `tenant`.
- `externalID`.
- `name`, `email`, `locale`.
- `recipientType`: `dashboard-admin`, `client-contact`, other approved type.
- `active`.
- `emailProductUpdates`.
- Consent/source metadata.
- `syncedAt`.

Uniqueness: `(tenant, externalID)` and appropriate email deduplication rules.

### 9.11 `integration-connections`

Non-secret integration metadata only.

Fields:

- `tenant`.
- `type`: `website`, `audience-api`, `slack-shared-channel`, `slack-workspace`, `resend-sender`.
- `status`.
- Public/non-secret identifiers such as Slack workspace ID and channel ID.
- `secretReference` pointing to the secret manager.
- Health timestamps and last safe error.

Never store plaintext bot tokens or webhook signing secrets in a normal readable Payload field.

### 9.12 Editor and formatting policy

Use Payload's Lexical editor. Payload already supplies the editing interface; do not build a custom rich-text editor.

Enable this initial authoring set:

- Paragraphs and headings `H2` through `H4`.
- Bold, italic, strikethrough, inline code, blockquotes, and horizontal rules.
- Ordered and unordered lists.
- Links with validation for internal and external destinations.
- Uploads selected from the tenant-scoped media library.
- A fixed toolbar and inline toolbar.
- Curated structured blocks for image with alt text/caption, CTA, quote, allow-listed video embed, gallery, and code snippet when a content type needs them.

Restrict the editor to preserve consistent rendering across different company websites:

- Do not allow body-level `H1`; the page title owns the single primary heading.
- Do not expose arbitrary font families, font sizes, colors, raw HTML, text alignment, or indentation.
- Exclude underline by default because it is visually confused with links.
- Exclude experimental table support from the MVP.
- Do not offer arbitrary page-layout blocks or style controls.

Payload stores the canonical Lexical JSON. The public API must return a documented, versioned rich-content contract, and every website must render only supported nodes and blocks. Unknown nodes must fail safely without breaking the page. The platform validates required alt text and permitted embed hosts before publication.

Use Payload's upload collection for media selection, metadata, cropping/focal-point controls, thumbnails, and configured responsive sizes. Preview and live preview are integration features: each website must supply a preview URL and renderer; Payload does not automatically know the website's design.

### 9.13 Localization and translation workflow

Use Payload's native field-level localization. Keep one document for each logical content item; do not create a separate document for every language.

The platform owns a versioned global locale registry. The initial registry is English, German, Spanish, French, and Arabic. Each tenant selects a required `defaultLocale` and a non-empty subset in `supportedLocales`; the default must be included in that subset. Arabic uses right-to-left editor behavior. Adding another platform locale is a schema change and requires a migration.

Localize reader-facing copy such as titles, excerpts, rich text, SEO titles and descriptions, image alt text, and captions. Keep tenant IDs, relationships, dates, internal slugs, delivery identifiers, and media files shared. Public website routes should use a locale path prefix and a stable non-localized slug until a tenant demonstrates a requirement for translated slugs.

Disable implicit global fallback. The public API must choose fallback behavior explicitly and report the requested and resolved locales so a missing translation is never mistaken for an approved translation. Cache and revalidation keys include tenant, locale, collection, and document ID.

Translation state is independent from canonical localized content. Content collections added in later phases must track each target locale as `missing`, `draft`, `review`, `approved`, or `stale`, together with the source locale and source version. A source edit marks affected approved translations stale without overwriting them.

Manual translation editing comes first. A later AI action may create translation drafts through a retryable Payload job, using stable rich-text node IDs and a tenant glossary. AI output must never publish automatically and must not overwrite a manually edited translation. Any Local API write initiated by an editor passes that user and uses `overrideAccess: false`.

## 10. Public content API

Expose a stable, versioned read API rather than making every website understand Payload's internal collection schema.

Examples:

```text
GET /api/public/v1/{tenant}/changelog
GET /api/public/v1/{tenant}/changelog/{slug}
GET /api/public/v1/{tenant}/events
GET /api/public/v1/{tenant}/events/{slug}
GET /api/public/v1/{tenant}/posts
GET /api/public/v1/{tenant}/posts/{slug}
GET /api/public/v1/{tenant}/seo?route=/platform-risk
```

Response envelope:

```json
{
  "data": [],
  "meta": {
    "tenant": "yourpropfirm",
    "version": "v1",
    "generatedAt": "2026-08-13T12:00:00.000Z"
  }
}
```

Requirements:

- Return published records only.
- Resolve tenant from a server-side API credential and verify it matches the URL tenant.
- Never accept arbitrary tenant access from a browser-held privileged key.
- Apply pagination, response limits, cache headers, and rate limits.
- Do not return drafts, versions, membership data, internal IDs not needed by consumers, recipient data, integrations, or job state.
- Normalize Payload rich text into a versioned public representation or provide a shared renderer package. Do not expose an undocumented internal JSON shape indefinitely.

## 11. Website integration contract

Each website defines:

- `HYGE_CMS_URL`.
- `HYGE_CMS_TENANT`.
- Server-only `HYGE_CMS_READ_TOKEN`.
- Server-only `HYGE_REVALIDATION_SECRET`.

The website fetches published content from its server components/build process, maps it into local view models, and caches it.

The website must not import `payload`, `@payloadcms/*`, the Payload config, generated Payload database types, or connect directly to the platform database. Its dependency is the stable public HTTP contract only.

Recommended first integration:

```text
src/
├── lib/hyge-content/client.ts       # server-only HTTP client
├── lib/hyge-content/mappers.ts      # API contract -> local view models
├── components/content/              # website-owned rendering
└── app/api/revalidate/content/      # signed webhook receiver
```

After two websites use a stable v1 contract, extract the repeated HTTP, signature-verification, and TypeScript contract code into a small private package such as `@hyge/content-client`. Keep renderers and design components inside each website. Do not block the first integration on publishing this package.

### Availability rule

Public traffic must not require a successful CMS call on every request.

For Next.js websites:

- Use static generation or ISR.
- Cache CMS reads using tags or route revalidation.
- Retain the last successful cached page during CMS failure.
- Treat a CMS fetch failure during revalidation as a failed refresh, not a reason to replace content with an empty page.

### Revalidation endpoint

Each website exposes a protected endpoint such as:

```text
POST /api/revalidate/content
```

Body:

```json
{
  "eventId": "uuid",
  "tenant": "yourpropfirm",
  "contentType": "changelog",
  "slug": "r-2026-08-13",
  "publishedAt": "2026-08-13T12:00:00.000Z"
}
```

Headers:

```text
X-HYGE-Timestamp: unix-seconds
X-HYGE-Signature: hmac-sha256(timestamp + "." + raw-body)
X-Idempotency-Key: event-id
```

The website must:

1. Reject timestamps outside a five-minute window.
2. Verify the signature using constant-time comparison.
3. Reject the wrong tenant.
4. Deduplicate by event ID.
5. Revalidate only affected routes/tags.
6. Return a truthful result; do not claim revalidation when it failed.

## 12. Publication workflow

### Normal first publication

```text
Product Owner saves draft
        |
        v
Preview and revise
        |
        v
_status changes draft -> published
        |
        +--> release becomes available to public API
        +--> immutable publication event inserted
        +--> preparation job queued
                      |
                      +--> website revalidation job
                      +--> resolve audience snapshot
                      +--> create delivery records
                      +--> queue one job per delivery
```

### Send-once rule

Only the first transition from draft to published creates a normal publication event.

Editing an already-published release:

- Updates public content.
- Revalidates the website.
- Does not resend email or Slack automatically.

Sending a correction requires an explicit action that creates a new `changelog.correction` event with its own immutable snapshot and idempotency key.

### Transactional outbox rule

Do not call Slack or Resend directly inside the collection lifecycle hook.

The hook must only:

1. Detect a valid publication transition.
2. Write an immutable publication event with a unique key.
3. Queue a durable preparation job.

External delivery occurs asynchronously after the content save succeeds.

### Job topology

Recommended Payload tasks:

- `prepare-publication`
- `revalidate-website`
- `send-release-email`
- `send-release-slack`
- `reconcile-publication-status`

Enable Payload job concurrency control.

Concurrency keys:

- Preparation: `publication:{eventID}`.
- Delivery: `delivery:{deliveryID}`.
- Revalidation: `tenant:{tenantID}:content:{contentType}:{slug}`.

Jobs must be safe to retry. A worker checks the delivery ledger before contacting a provider.

### Idempotency

- Publication event key: source document ID plus source version ID plus event type.
- Delivery key: event ID plus channel plus stable destination key.
- Resend: send the delivery key as the provider idempotency key.
- Slack: check local sent state before sending and store Slack's response timestamp/message ID.
- Keep local idempotency records permanently for the configured audit-retention period. Resend's provider-side idempotency window is not the system of record.

## 13. Audience resolution

Support two provider types.

### External audience provider

Use this when a dashboard or CRM is authoritative for active administrators.

The CMS calls a tenant-configured, authenticated endpoint:

```text
POST /internal/content-audiences/release
```

Request:

```json
{
  "eventId": "uuid",
  "releaseId": "uuid",
  "audience": "active-dashboard-admins"
}
```

Response:

```json
{
  "emailRecipients": [
    {
      "id": "stable-user-id",
      "email": "admin@example.com",
      "name": "Admin Name",
      "locale": "en",
      "firmId": "stable-firm-id"
    }
  ],
  "slackDestinations": [
    {
      "id": "stable-destination-id",
      "channelId": "C123456",
      "firmId": "stable-firm-id"
    }
  ]
}
```

Snapshot recipients into delivery records at publication time. A later user-role change must not silently rewrite the audit history of an already-prepared event.

### CMS-managed recipients

Use this for external clients without an audience API. Platform administrators can import or synchronize recipients. Product Owners do not receive general access to the address list.

Always enforce active status, verified/syntactically valid email, tenant match, notification preference, suppression state, and deduplication.

## 14. Slack architecture

### MVP: HYGE-controlled shared channels

If client communication occurs in Slack Connect channels inside a HYGE-controlled workspace:

- Install one HYGE Slack app.
- Store the bot token in the deployment secret manager.
- Store only each tenant's channel ID in Payload.
- Request the minimum `chat:write` scope.
- Invite the bot to the required private/shared channels.

This is the smallest secure implementation.

### Later: independent client workspaces

If the app must install into each client's Slack workspace, add:

- Slack OAuth v2 installation flow.
- Workspace and installer metadata.
- Encrypted token storage or a secret-manager reference.
- Token rotation strategy.
- Channel selection and reconnection flow.
- Uninstall/revocation handling.
- Per-workspace health status.

Do not implement multi-workspace OAuth until a client actually needs it.

### Message requirements

- Tenant brand and release headline.
- Plain-text fallback for accessibility.
- Short summary.
- Link to the tenant's changelog anchor/detail page.
- No confidential release details.
- No user impersonation.

## 15. Email architecture

Use `@payloadcms/email-resend` for Payload auth emails and the Resend API/SDK for notification deliveries that require explicit idempotency and delivery IDs.

Each tenant must have a verified sender identity before email is enabled.

Requirements:

- Send individual or appropriately bounded batch deliveries.
- Never use one enormous BCC list.
- Store provider message ID per recipient.
- Process bounce and complaint webhooks.
- Maintain suppression state.
- Include required preference/unsubscribe behavior based on message classification and applicable law.
- Do not send from an unverified fallback domain in production.
- Render tenant branding from structured fields, not arbitrary HTML entered by editors.

## 16. Database architecture

Use a dedicated Supabase project for the content platform.

### Schema ownership

Payload owns its tables and migrations in a private `cms` schema using Payload's Postgres adapter and migration system.

Do not expose the `cms` schema through Supabase Data API/PostgREST. Do not grant `anon` or `authenticated` access to it. Payload authentication and access control are the application authorization layer.

Payload-managed tables use Payload migrations. Supabase-specific objects—storage buckets, storage policies, extensions, and project-level setup—use Supabase migrations. Never let both migration systems manage the same table or schema object.

### Connections

- Runtime: Supabase's supported pooled connection for serverless workloads.
- Migrations/administration: direct database connection where required.
- Keep both server-only.
- Configure conservative pool limits for Vercel concurrency.
- Do not expose database URLs using `NEXT_PUBLIC_` variables.

### IDs and indexes

- Use UUID IDs.
- Index tenant relationship on every tenant-owned collection.
- Add compound uniqueness for tenant plus slug/route/external ID.
- Index publication status and release date.
- Index job and delivery status plus next-attempt time.
- Index publication and delivery idempotency keys uniquely.

## 17. Media storage

Use Supabase Storage through Payload's official S3-compatible adapter.

### Storage layout

```text
hyge-public-media/
├── yourpropfirm/
│   ├── posts/
│   ├── events/
│   └── changelog/
├── second-qtg-company/
└── external-client/
```

The server derives the tenant prefix from the authenticated membership and selected tenant. A request cannot choose another prefix directly.

### Security

- S3 access keys are server-only and have broad bucket power.
- Never send S3 access keys to a browser.
- Use Payload/client-upload presigning when direct browser uploads are needed.
- Restrict MIME types and sizes.
- Public marketing media must contain no sensitive data.
- Admin listing and mutation remain tenant-scoped even when the final published asset is publicly readable.
- Use separate buckets when clients require different retention, residency, access rules, or billing.

### Durability

Supabase Storage's S3 compatibility does not provide S3 object versioning. Payload document versions do not back up deleted binary files. Back up or replicate media separately and test restoration.

## 18. Secret management

Secrets include:

- Payload secret.
- Database URLs.
- Supabase Storage S3 access keys.
- Resend API key.
- Slack bot tokens and OAuth secrets.
- Cron secret.
- Per-tenant API and webhook signing secrets.

Rules:

- Store deployment-wide secrets in Vercel encrypted environment variables.
- For dynamic per-client credentials, store ciphertext in a dedicated secret manager and keep only a reference in Payload.
- Never display a recovered secret in ordinary Payload collection reads.
- Never log tokens, recipient payloads, database URLs, raw OAuth callbacks, or complete provider responses.
- Rotate secrets without editing content documents.
- Use different secrets for production, preview, and local development.

## 19. Environment variables

The initial `.env.example` should contain names and descriptions only:

```dotenv
NODE_ENV=development
PAYLOAD_SECRET=

DATABASE_URI=
DATABASE_DIRECT_URI=
PAYLOAD_DATABASE_SCHEMA=cms

S3_BUCKET=
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_URL=

RESEND_API_KEY=
DEFAULT_EMAIL_FROM_ADDRESS=
DEFAULT_EMAIL_FROM_NAME=

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=

CRON_SECRET=
APP_URL=http://localhost:3000
```

Per-tenant website, audience-provider, and signing credentials must move to managed integration records/secret references rather than an ever-growing JSON environment variable.

## 20. Background worker and Vercel

Configure a protected Vercel Cron endpoint to run the `release-notifications` Payload queue at least every minute in production.

Requirements:

- Verify `Authorization: Bearer ${CRON_SECRET}`.
- Limit jobs per invocation.
- Leave timed-out/uncompleted jobs recoverable.
- Use Payload concurrency controls.
- Alert when the oldest runnable job exceeds five minutes.
- Alert when a publication remains partial/failed beyond the retry window.
- Provide a platform-admin retry action that requeues only failed deliveries.

Do not use an unprotected public job-runner URL.

## 21. Admin experience

### Marketing user

Sees only:

- Tenant selector for assigned tenants.
- Posts.
- Events.
- SEO pages.
- Media.

Does not see changelog releases, publication events, deliveries, integrations, recipients, tenant configuration, or users.

### Product Owner

Sees only:

- Tenant selector for assigned tenants.
- Changelog releases.
- Read-only publication/delivery summary.
- Relevant media.

Can publish only when membership includes `publish`. Can trigger notifications only when membership includes `notify`.

### Platform administrator

Sees all tenants and operational collections. Secret values remain non-readable even to ordinary admin views.

### Publishing confirmation

Before first changelog publication, show a confirmation summary:

- Tenant.
- Website destination.
- Email enabled/disabled and estimated recipient count if available.
- Slack enabled/disabled and channel count.
- Explicit statement that ordinary future edits will not resend.

## 22. Audit and observability

Audit at minimum:

- Login and authentication failures.
- User and membership changes.
- Tenant changes.
- Draft, publish, unpublish, correction, and delete actions.
- Integration changes.
- Publication-event creation.
- Delivery state changes and manual retries.

Structured log context:

```text
requestId, tenantId, userId, collection, documentId,
publicationEventId, deliveryId, provider, attempt
```

Never place content bodies, tokens, or complete email addresses in routine logs. Mask identifiers where full values are unnecessary.

Operational dashboards should show:

- Publications by state.
- Pending/failed deliveries by tenant and channel.
- Oldest runnable job.
- Provider error rate.
- Revalidation latency and failures.
- Database connection saturation.
- Storage upload failures.

## 23. Backup, recovery, and offboarding

### Backup

- Enable managed Postgres backups appropriate to the business SLA.
- Back up or replicate storage objects separately.
- Retain Payload migrations in Git.
- Perform a restore drill before onboarding the first external client and at least quarterly afterward.

### Tenant export

Provide an admin-only export producing:

- Structured JSON for content and metadata.
- Media manifest and downloadable archive or transfer process.
- User/membership audit relevant to the tenant.
- Publication and delivery audit within retention policy.

### Tenant offboarding

1. Suspend new publication.
2. Revoke API and webhook credentials.
3. Export tenant data and media.
4. Obtain explicit retention/deletion decision.
5. Archive tenant.
6. Delete only through a separate confirmed operation after retention expires.

Never use the multi-tenant plugin's automatic cascading cleanup for ordinary offboarding.

## 24. Testing strategy

### Mandatory authorization tests

For every tenant-owned collection:

- Anonymous user cannot read drafts.
- Tenant A user cannot read Tenant B drafts or published records through authenticated admin APIs.
- Tenant A user cannot create a record assigned to Tenant B.
- Tenant A user cannot change an existing record's tenant to Tenant B.
- Marketing cannot access changelog or delivery collections.
- Product Owner cannot access recipient or integration-secret data.
- Members cannot promote themselves or edit memberships.
- Local API calls acting as users respect `overrideAccess: false`.
- Public API credential for Tenant A cannot request Tenant B.

These are release-blocking tests, not optional smoke tests.

### Publication tests

- Draft save sends nothing.
- First publish creates one publication event.
- Repeated save of a published release creates no new notification event.
- Retry does not duplicate already-sent delivery.
- Historical seed creates no events.
- Explicit correction creates a distinct event.
- Partial provider failure preserves successful deliveries and retries failures only.
- CMS/database/provider outage does not replace cached website content with empty content.

### Provider contract tests

- Mock Resend and Slack responses, rate limits, timeouts, and malformed responses.
- Verify HMAC signatures and replay rejection.
- Verify directory/audience schema validation.
- Verify secrets and addresses do not appear in logs or public responses.

### Build and migration tests

- Type check.
- Unit and integration tests.
- Payload configuration validation.
- Migration up on an empty database.
- Migration up on a production-like snapshot.
- Build using production-like environment names without production credentials.

## 25. CI/CD and migrations

Required pull-request checks:

1. `npm ci`.
2. Type check.
3. Unit and integration tests.
4. Tenant-isolation test suite.
5. Production build.
6. Migration validation against an ephemeral database.
7. Dependency/security scan.

Production deployment order:

1. Confirm a recent backup.
2. Run pending Payload migrations once.
3. Deploy the application.
4. Run smoke tests for admin login, public API, media, and job runner.
5. Confirm publication queue health.

Do not enable Payload development schema push in production. Do not run multiple deploy instances racing the same migrations.

## 26. Conductor setup

Add shared repository settings at `.conductor/settings.toml` and merge them to the default branch before expecting the Mac client to use them.

```toml
"$schema" = "https://conductor.build/schemas/settings.repo.schema.json"

[scripts]
setup = "npm ci"
run_mode = "nonconcurrent"

[scripts.run.dev]
available_in = [ "local" ]
command = "npm run dev -- --port $CONDUCTOR_PORT"
default = true
icon = "play"

[scripts.run.test]
command = "npm test"
icon = "test-tube"
```

Use `nonconcurrent` while workspaces share one development database. Switch to `concurrent` only after every workspace receives an isolated database/schema and storage prefix.

Use Conductor Files to copy for `.env.local`. Do not put secrets in the setup script. Setup and run scripts execute in non-interactive shells, so the repository must pin and invoke its toolchain explicitly rather than depend on interactive shell startup.

## 27. Delivery estimate

For one experienced full-stack developer familiar with Next.js, Postgres, and Vercel:

| Deliverable | Expected effort |
|---|---:|
| Working proof: login, editor, media, and one changelog | 2–3 working days |
| Production-ready first version through the internal two-tenant pilot | 3–5 weeks |
| First website integration | 2–4 working days |
| Each later website using the same content types | 0.5–2 working days |
| Import the four existing changelog releases | Less than 1 day |
| Migrate approximately 67 existing blog articles | 3–7 additional working days |
| Harden onboarding and operations for external HYGE clients | 1–2 additional weeks after the internal pilot |

Indicative production build breakdown:

- Repository, Payload, Postgres, storage, and Vercel: 1–2 days.
- Tenancy, users, permissions, and isolation tests: 3–5 days.
- Changelog, public API, and first website integration: 3–5 days.
- Resend, Slack, durable jobs, idempotency, and retry ledger: 4–7 days.
- Blog, events, SEO, rich content, and media: 4–7 days.
- Monitoring, backup/restore, second tenant, and production QA: 3–5 days.

These ranges assume the scope in this document and overlap between workstreams. Slack workspace topology, Resend domain/DNS verification, access to the dashboard's administrator audience API, legacy rich-text cleanup, and production credentials are the most likely external delays. Do not compress tenant-isolation tests or send-once delivery work to meet a date.

## 28. Implementation phases

### Phase 0: repository and infrastructure

- Create private repository.
- Scaffold supported Payload/Next versions.
- Pin Node and dependencies.
- Create dedicated Supabase project and storage bucket.
- Configure development, preview, and production environments.
- Add CI, Conductor settings, and base documentation.

Exit criteria: clean build, Payload login, database migration, test upload, protected job-runner smoke test.

### Phase 1: tenancy and permissions

- Tenants and users collections.
- Global locale registry and tenant locale constraints.
- Membership sections/capabilities.
- Multi-tenant plugin.
- Explicit tenant access functions.
- Access matrix and mandatory isolation tests.
- Disable automatic tenant cleanup.

Exit criteria: all cross-tenant and cross-section negative tests pass.

### Phase 2: changelog vertical slice

- Localized changelog collection, translation states, and versions/drafts.
- Locale-aware public v1 changelog API with explicit fallback.
- YourPropFirm website content client and safe fallback.
- Signed revalidation endpoint.
- Import four current YourPropFirm releases without notifications.

Exit criteria: Product Owner publishes a test release in preview; the preview website updates without a full deploy.

### Phase 3: durable notifications

- Publication event/outbox.
- Payload job queue and protected runner.
- Audience provider contract and CMS recipients.
- Resend delivery and webhooks.
- Slack shared-channel delivery.
- Delivery ledger, retry, and status UI.

Exit criteria: one publication creates exactly one message per intended destination under retries and injected failures.

### Phase 4: marketing content

- Localized media, posts, events, and SEO collections.
- Rich-text public representation.
- Marketing-only admin experience.
- Optional queued AI translation drafts with human approval.
- One company website integrates events and SEO.

Exit criteria: Marketing can publish without seeing changelog or operational data.

### Phase 5: second QTG tenant

- Add second tenant.
- Verify tenant-specific branding, API credentials, storage paths, website webhook, and roles.
- Run full isolation suite with real tenant IDs.

Exit criteria: no content, media, users, recipients, or integration state leaks between the two tenants.

### Phase 6: external HYGE client pilot

- Contractual data/retention requirements.
- Client users and permissions.
- Sender/domain verification.
- Export/offboarding test.
- Decide whether Slack Connect MVP is sufficient.

Exit criteria: external client can operate within its tenant without HYGE exposing QTG or other client data.

Only after Phase 6 should the team consider self-service onboarding, billing, white-labelling, enterprise SSO, or a universal component system.

## 29. Acceptance criteria

The initial platform is complete when:

- One Payload deployment serves at least two tenants.
- A Marketing user sees only assigned marketing collections and tenants.
- A Product Owner sees only assigned changelog collections and delivery summaries.
- Cross-tenant API attempts fail in automated tests.
- Existing YourPropFirm changelog data is imported without sending notifications.
- Tenant users can edit only configured locales, and missing translations do not publish implicitly.
- A new changelog release can be drafted, previewed, and published.
- Publication updates the correct website cache.
- Email reaches active intended administrators through Resend.
- Slack posts to intended shared client channels.
- Retries do not duplicate successful messages.
- Editing a published release does not resend notifications.
- A correction requires an explicit action and has its own audit event.
- Public websites continue serving their last successful cached content during CMS/provider outages.
- Production has backups, monitoring, a protected worker, and a tested restore path.
- No production secret exists in Git, browser bundles, ordinary logs, or readable content fields.

## 30. Decisions still required before production

These do not block repository scaffolding, but each must be resolved before its dependent feature is enabled:

1. Confirm the final repository and product name.
2. Confirm CMS production domain.
3. Select the dedicated Supabase organization/project and billing owner.
4. Confirm Slack topology: HYGE Slack Connect channels or independent client workspaces.
5. Define the YourPropFirm dashboard audience-provider endpoint and authentication.
6. Decide who legally/operationally owns email notification preferences and suppression.
7. Verify each tenant's Resend sender domain.
8. Define retention periods for content versions, publication audits, and recipient/delivery records.
9. Confirm whether any external client requires regional data residency or separate storage/database infrastructure.
10. Decide whether simple draft/publish permissions are enough or Payload Enterprise approval workflows are commercially required.

## 31. Free versus Payload Enterprise

The MVP does not require Payload Enterprise.

Free self-hosted Payload covers multi-tenancy, users, access control, drafts, versions, media, APIs, hooks, jobs, and custom admin behavior. HYGE may commercially operate the platform for QTG and external clients without a per-tenant Payload license.

Re-evaluate Enterprise when a paying client specifically requires:

- Enterprise SSO.
- Payload's packaged formal approval workflows.
- Advanced visual editing.
- Enterprise AI or A/B testing.
- Contractual vendor support/SLA.

Infrastructure, storage, database, email, monitoring, and engineering remain paid operational costs even when the Payload license is free.

## 32. Future expansion roadmap

The platform can become HYGE's client content-operations layer, but it should expand through workflows adjacent to content—not into a generic CRM, project-management suite, or website builder.

### Near-term extensions that reuse the current foundation

1. **Approvals and editorial calendar:** assignments, due dates, review states, campaign calendar, and comments. Add when multiple people regularly coordinate publication.
2. **Advanced localization:** translation assignments, translation memory, provider integrations, and per-locale publication refinements. Keep provider state separate from canonical content.
3. **Additional distribution channels:** LinkedIn, X, in-product announcements, RSS, and customer-status banners generated from the same approved release snapshot. Each channel remains an idempotent delivery adapter.
4. **Reusable brand and campaign assets:** tenant-scoped logos, approved copy snippets, campaign kits, legal disclaimers, UTM presets, and downloadable press assets.
5. **Content analytics:** ingest page and campaign performance from the authoritative analytics provider, then show content-level outcomes without turning Payload into the analytics warehouse.
6. **Content requests and intake:** structured briefs from client teams that Marketing can triage into posts, events, releases, or campaigns.

### Later agency-platform capabilities

1. **Client portal:** white-labelled review, commenting, approvals, publication history, and exports for external clients.
2. **Campaign orchestration:** group content and deliveries under campaigns, with per-channel schedules and approval gates.
3. **Governance:** expiry/review dates, mandatory legal approval for selected tenants, reusable policy checks, and retention controls.
4. **Asset transformation and delivery:** centralized derivatives, CDN policies, rights/expiry metadata, and brand-safe asset reuse.
5. **AI assistance with human approval:** briefs, summaries, channel adaptations, SEO suggestions, and translation drafts. Never auto-publish generated content.
6. **Commercial operations:** tenant provisioning, plan limits, usage reporting, and billing only if HYGE proves repeatable external demand.

### Expansion rule

Add a capability only when it benefits multiple tenants or materially improves HYGE's repeated delivery process. Company-specific business logic should remain in that company's systems. Integrations should reference external systems of record rather than copying entire CRM, support, billing, or analytics datasets into the CMS.

The recommended sequence is: prove changelog and notifications, add marketing content, onboard a second QTG company, pilot one external client, measure repeated operational pain, then select the next shared workflow. White-labelling, self-service signup, billing, and a universal page builder remain post-validation decisions.

## 33. Primary references

- Payload installation and supported versions: https://payloadcms.com/docs/getting-started/installation
- Payload access control: https://payloadcms.com/docs/access-control/overview
- Payload collection access: https://payloadcms.com/docs/access-control/collections
- Payload multi-tenant plugin: https://payloadcms.com/docs/plugins/multi-tenant
- Payload hooks: https://payloadcms.com/docs/hooks/overview
- Payload Jobs Queue: https://payloadcms.com/docs/jobs-queue/overview
- Payload job concurrency: https://payloadcms.com/docs/jobs-queue/workflows
- Payload Postgres adapter and migrations: https://payloadcms.com/docs/database/postgres
- Payload email: https://payloadcms.com/docs/email/overview
- Payload storage adapters: https://payloadcms.com/docs/upload/storage-adapters
- Payload rich-text features: https://payloadcms.com/docs/rich-text/official-features
- Payload structured rich-text blocks: https://payloadcms.com/docs/rich-text/blocks
- Payload uploads and media: https://payloadcms.com/docs/upload/overview
- Payload drafts, versions, and autosave: https://payloadcms.com/docs/versions/drafts
- Payload live preview: https://payloadcms.com/docs/live-preview/overview
- Payload self-hosting and Enterprise boundary: https://payloadcms.com/get-started
- Supabase Storage S3 authentication: https://supabase.com/docs/guides/storage/s3/authentication
- Supabase Storage S3 compatibility: https://supabase.com/docs/guides/storage/s3/compatibility
- Supabase Data API security: https://supabase.com/docs/guides/api/securing-your-api
- Slack OAuth: https://api.slack.com/authentication/oauth-v2
- Slack `chat.postMessage`: https://docs.slack.dev/reference/methods/chat.postMessage/
- Resend idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys
- Sanity pricing and plan limits: https://www.sanity.io/pricing
- Sanity roles: https://www.sanity.io/docs/user-guides/roles
- Sanity multi-tenancy implementation: https://www.sanity.io/docs/developer-guides/multi-tenancy-implementation
- Sanity API CDN: https://www.sanity.io/docs/content-lake/api-cdn
- Sanity Content Releases: https://www.sanity.io/docs/user-guides/content-releases
- Conductor repository scripts: https://conductor.build/docs/reference/scripts
- Conductor files to copy: https://conductor.build/docs/reference/files-to-copy

## 34. Implementation instruction to the next agent

Use this document as the authoritative scope. Implement phases in order. Do not add excluded or future-roadmap features until the MVP and external pilot justify them. Install Payload only in the central platform repository; websites consume the versioned HTTP contract and keep their own renderers. Apply the editor allow-list in section 9.12. Do not weaken tenant access to make the admin UI work. Start with automated isolation tests before adding content collections. Treat publication as an immutable event and notifications as retryable deliveries, never as synchronous side effects inside a save hook. Keep websites cached and independently available. Stop before production enablement if any tenant secret, audience source, sender identity, or Slack destination remains ambiguous.
