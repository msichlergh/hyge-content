# HYGE Content Platform

Central multi-tenant authoring and release-publishing control plane for HYGE, QTG companies, and selected external clients.

The application is built with Payload 3, Next.js, dedicated Supabase Postgres, and Supabase Storage through its S3-compatible API. Company websites consume only the versioned public HTTP contract; they do not install Payload or connect to this database.

The authoritative scope and architecture are in [`docs/architecture.md`](docs/architecture.md).

## Current implementation status

This repository currently contains the Phase 0 scaffold and the first Phase 1 security foundation:

- Payload/Next/Postgres bootstrap pinned to Node 24 and Payload `3.88.0`.
- Tenant and user schemas with UUID database IDs.
- Official multi-tenant plugin with automatic tenant cleanup disabled.
- Section/capability membership model and explicit tenant-constrained access helpers.
- Tenant-scoped media with server-derived storage prefixes.
- Supabase S3 adapter configuration that activates only when all credentials are present.
- Initial authorization/configuration tests.

Content collections, the public API, website revalidation, publication events, jobs, and notifications are later phases and are not implemented yet.

## Local setup

Requirements:

- Node `24.16.0` through nvm or an equivalent version manager.
- npm 11.
- A Postgres database. A disposable local service is provided in `docker-compose.yml`; production uses a dedicated Supabase project.

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Populate at minimum `PAYLOAD_SECRET` and `DATABASE_URI`. Do not commit `.env.local` or any real credentials.

Conductor workspaces copy `.env.local` through `.worktreeinclude`. Repository run scripts use `scripts/with-node` so non-interactive Conductor shells can load the pinned nvm version.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

Database migrations and storage uploads require real local or development infrastructure and must be verified before Phase 0 is considered operationally complete.
