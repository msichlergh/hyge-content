# Operations

This runbook will be completed alongside the infrastructure and publication-job phases.

## Required production controls

- Dedicated Supabase project with Payload tables isolated in the unexposed `cms` schema.
- Runtime pooled database URL and separate direct migration URL.
- Public media bucket with separately tested backup or replication.
- Vercel environment separation for development, preview, and production.
- Protected job-runner endpoint, structured logs, Sentry, queue-age alerts, and failed-delivery alerts.
- Database and media restore drill before onboarding an external tenant.

## Deployment gate

Do not enable production publication until migrations, admin login, public API reads, media upload, signed revalidation, job execution, and tenant-isolation tests have passed in the target environment.
