# Tenant onboarding

Tenant onboarding is a platform-administrator workflow. It is not self-service in the MVP.

Before activation, confirm:

1. Immutable tenant slug and media path prefix.
2. Website URL, locales, timezone, and brand fields.
3. Assigned users, sections, and capabilities.
4. Server-only website API and revalidation credentials.
5. Audience source and notification ownership.
6. Verified Resend sender identity before email is enabled.
7. Slack destination and app membership before Slack is enabled.
8. Retention, export, offboarding, and regional-residency requirements.

Never reuse secrets between tenants or environments. Never delete a tenant through the ordinary collection API.
