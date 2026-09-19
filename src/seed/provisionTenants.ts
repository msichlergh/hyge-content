import config from '@payload-config'
import { randomBytes } from 'node:crypto'
import { chmodSync, writeFileSync } from 'node:fs'
import { getPayload, type Payload } from 'payload'

import type { PlatformLocaleCode } from '../i18n/locales'

/**
 * Idempotent provisioning of tenant websites: the tenant record and one
 * read-only website API user each. Safe to re-run.
 *
 * - Never rotates an existing API key and never removes a supported locale.
 * - New API keys are written only to PROVISION_OUTPUT (mode 0600), never logged.
 *
 * Usage: PROVISION_OUTPUT=/path/keys.json npm run provision:tenants
 */

type SiteDefinition = {
  apiUserEmail: string
  brandName: string
  defaultLocale: PlatformLocaleCode
  domain: string
  locales: PlatformLocaleCode[]
  mediaPathPrefix: string
  name: string
  slug: string
  websiteURL: string
}

export const sites: SiteDefinition[] = [
  {
    apiUserEmail: 'cms-api@yourpropfirm.com',
    brandName: 'YourPropFirm',
    defaultLocale: 'en',
    domain: 'yourpropfirm.com',
    locales: ['en'],
    mediaPathPrefix: 'yourpropfirm',
    name: 'YourPropFirm',
    slug: 'yourpropfirm',
    websiteURL: 'https://yourpropfirm.com',
  },
  {
    apiUserEmail: 'cms-api@fundyourfx.io',
    brandName: 'FundYourFX',
    defaultLocale: 'en',
    domain: 'fundyourfx.io',
    locales: ['en', 'ar', 'de', 'es', 'fr', 'id', 'pt', 'vi'],
    mediaPathPrefix: 'fundyourfx',
    name: 'FundYourFX',
    slug: 'fundyourfx',
    websiteURL: 'https://fundyourfx.io',
  },
  {
    apiUserEmail: 'cms-api@quantsentry.com',
    brandName: 'QuantSentry',
    defaultLocale: 'en',
    domain: 'quantsentry.com',
    locales: ['en'],
    mediaPathPrefix: 'quantsentry',
    name: 'QuantSentry',
    slug: 'quantsentry',
    websiteURL: 'https://quantsentry.com',
  },
  {
    apiUserEmail: 'cms-api@ibmc.id',
    brandName: 'IBMC',
    defaultLocale: 'en',
    domain: 'ibmc.id',
    locales: ['en'],
    mediaPathPrefix: 'ibmc',
    name: 'IBMC',
    slug: 'ibmc',
    // The new site is live on Vercel; ibmc.id still points at the legacy PHP
    // site. Switch this to https://ibmc.id when DNS moves.
    websiteURL: 'https://ibmc-website-ten.vercel.app',
  },
]

const API_SECTIONS = ['changelog', 'marketing'] as const

type Membership = { capabilities?: string[]; sections?: string[]; tenant?: unknown }

const tenantIDOf = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) return String(value.id)
  return null
}

const ensureTenant = async (payload: Payload, site: SiteDefinition) => {
  const existing = await payload.find({
    collection: 'tenants',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: site.slug } },
  })

  if (existing.docs[0]) {
    const tenant = existing.docs[0]
    const current = (tenant.supportedLocales ?? []).map((entry) => entry.locale)
    const missing = site.locales.filter((locale) => !current.includes(locale))
    if (missing.length === 0) return { created: false, id: tenant.id, localesAdded: [] }

    await payload.update({
      collection: 'tenants',
      data: {
        supportedLocales: [...current, ...missing].map((locale) => ({ locale })),
      } as never,
      id: tenant.id,
      overrideAccess: true,
    })
    return { created: false, id: tenant.id, localesAdded: missing }
  }

  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      brandName: site.brandName,
      defaultLocale: site.defaultLocale,
      domains: [{ domain: site.domain }],
      emailFromName: site.brandName,
      mediaPathPrefix: site.mediaPathPrefix,
      name: site.name,
      slug: site.slug,
      status: 'active',
      supportedLocales: site.locales.map((locale) => ({ locale })),
      timezone: 'UTC',
      websiteURL: site.websiteURL,
    } as never,
    overrideAccess: true,
  })
  return { created: true, id: tenant.id, localesAdded: site.locales }
}

const ensureAPIUser = async (payload: Payload, site: SiteDefinition, tenantID: number | string) => {
  const existing = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { email: { equals: site.apiUserEmail } },
  })

  const wantedMembership = {
    capabilities: ['read'],
    sections: [...API_SECTIONS] as string[],
    tenant: String(tenantID) as string | null,
  }

  const user = existing.docs[0]
  if (user) {
    const memberships = (user.memberships ?? []) as Membership[]
    const index = memberships.findIndex((entry) => tenantIDOf(entry.tenant) === String(tenantID))
    const current = index >= 0 ? memberships[index] : undefined
    const isExact =
      current !== undefined &&
      API_SECTIONS.every((section) => current.sections?.includes(section)) &&
      current.sections?.length === API_SECTIONS.length &&
      current.capabilities?.length === 1 &&
      current.capabilities[0] === 'read'
    if (isExact) return { apiKey: null, created: false, membershipUpdated: false }

    // Website keys live in website environments; they only ever read. Enforce
    // exactly read access so a leaked key cannot edit, publish or notify.
    const next = memberships.map((entry) => ({ ...entry, tenant: tenantIDOf(entry.tenant) }))
    if (index >= 0) next[index] = wantedMembership
    else next.push(wantedMembership)

    await payload.update({
      collection: 'users',
      data: { memberships: next } as never,
      id: user.id,
      overrideAccess: true,
    })
    return {
      apiKey: null,
      capabilitiesBefore: current?.capabilities ?? [],
      created: false,
      membershipUpdated: true,
    }
  }

  const apiKey = randomBytes(32).toString('hex')
  await payload.create({
    collection: 'users',
    data: {
      apiKey,
      email: site.apiUserEmail,
      enableAPIKey: true,
      globalRole: 'member',
      memberships: [wantedMembership],
      name: `${site.brandName} Website API`,
      password: randomBytes(32).toString('base64url'),
      status: 'active',
    } as never,
    overrideAccess: true,
  })
  return { apiKey, created: true, membershipUpdated: false }
}

export const provisionTenants = async (payload: Payload) => {
  const report: Record<string, unknown> = {}
  const keys: Record<string, string> = {}

  for (const site of sites) {
    const tenant = await ensureTenant(payload, site)
    const apiUser = await ensureAPIUser(payload, site, tenant.id)
    if (apiUser.apiKey) keys[site.slug] = apiUser.apiKey

    report[site.slug] = {
      apiKeyIssued: Boolean(apiUser.apiKey),
      apiUserCreated: apiUser.created,
      capabilitiesBefore: 'capabilitiesBefore' in apiUser ? apiUser.capabilitiesBefore : undefined,
      membershipUpdated: apiUser.membershipUpdated,
      tenantCreated: tenant.created,
      tenantLocalesAdded: tenant.localesAdded,
    }
  }

  return { keys, report }
}

const run = async () => {
  const output = process.env.PROVISION_OUTPUT
  if (!output) throw new Error('Set PROVISION_OUTPUT to a private file path for newly issued keys.')

  const payload = await getPayload({ config })
  const { keys, report } = await provisionTenants(payload)

  writeFileSync(output, JSON.stringify(keys, null, 2), { mode: 0o600 })
  chmodSync(output, 0o600)

  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

if (process.argv[1]?.endsWith('provisionTenants.ts')) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
