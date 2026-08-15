import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'
import type { Locale, PayloadRequest } from 'payload'

export const defaultPlatformLocale = 'en' as const
export const platformLocaleCodes = ['en', 'de', 'es', 'fr', 'ar'] as const

export type PlatformLocaleCode = (typeof platformLocaleCodes)[number]

const localeLabels: Record<PlatformLocaleCode, string> = {
  ar: 'Arabic',
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
}

export const platformLocales: Locale[] = platformLocaleCodes.map((code) => ({
  code,
  label: localeLabels[code],
  ...(code === 'ar' ? { rtl: true } : {}),
}))

export const platformLocaleOptions = platformLocaleCodes.map((value) => ({
  label: localeLabels[value],
  value,
}))

export const isPlatformLocale = (value: unknown): value is PlatformLocaleCode =>
  typeof value === 'string' && platformLocaleCodes.includes(value as PlatformLocaleCode)

export const tenantLocaleCodes = (value: unknown): PlatformLocaleCode[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    const candidate =
      typeof entry === 'object' && entry !== null && 'locale' in entry ? entry.locale : entry
    return isPlatformLocale(candidate) ? [candidate] : []
  })
}

export const validateTenantLocaleConfiguration = (
  defaultLocale: unknown,
  supportedLocales: unknown,
): string | true => {
  if (!isPlatformLocale(defaultLocale)) return 'Choose a supported default locale.'

  const localeCodes = tenantLocaleCodes(supportedLocales)
  if (localeCodes.length === 0) return 'Choose at least one supported locale.'
  if (new Set(localeCodes).size !== localeCodes.length) {
    return 'Each supported locale can only be selected once.'
  }
  if (!localeCodes.includes(defaultLocale)) {
    return 'The default locale must also be included in supported locales.'
  }

  return true
}

export const tenantSupportsLocale = (
  locale: null | string | undefined,
  defaultLocale: unknown,
  supportedLocales: unknown,
): boolean => {
  if (!locale || locale === 'all') return true
  if (!isPlatformLocale(locale) || !isPlatformLocale(defaultLocale)) return false

  return tenantLocaleCodes(supportedLocales).includes(locale)
}

export const filterTenantLocales = async ({
  locales,
  req,
}: {
  locales: Locale[]
  req: PayloadRequest
}): Promise<Locale[]> => {
  const tenantID = getTenantFromCookie(req.headers, 'text')
  if (!tenantID) return locales

  const tenant = await req.payload.findByID({
    collection: 'tenants',
    depth: 0,
    disableErrors: true,
    id: tenantID,
    overrideAccess: false,
    req,
    select: {
      defaultLocale: true,
      supportedLocales: true,
    },
    user: req.user ?? undefined,
  })

  if (!tenant) return []

  const allowedLocales = new Set(tenantLocaleCodes(tenant.supportedLocales))
  return locales.filter(({ code }) => allowedLocales.has(code as PlatformLocaleCode))
}
