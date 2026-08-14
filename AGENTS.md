# Repository instructions

- Treat `docs/architecture.md` as the authoritative scope and implement phases in order.
- Keep Payload in this repository only. Consumer websites depend on the public HTTP contract, never Payload internals or the database.
- For ordinary tenant users, collection read, update, and delete access must return tenant-constrained queries. Do not return `true` to make the admin UI work.
- Any Local API operation acting for a user must pass that user and set `overrideAccess: false`.
- Never enable automatic tenant cleanup. Offboarding requires export, retention confirmation, and an explicit operation.
- Never call Slack, Resend, or website webhooks synchronously from a content save hook. Use immutable publication events and retryable jobs.
- Do not commit secrets, recipient payloads, raw provider responses, or production data.
- Keep Payload packages on the same exact version and verify the supported Next.js peer range before upgrading.
- Run typecheck, access tests, lint, and the production build for every implementation change.
