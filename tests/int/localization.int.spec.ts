import config from '@/payload.config'
import {
  defaultPlatformLocale,
  platformLocaleCodes,
  tenantLocaleCodes,
  tenantSupportsLocale,
  validateTenantLocaleConfiguration,
} from '@/i18n/locales'
import { describe, expect, it } from 'vitest'

describe('localization foundation', () => {
  it('registers the supported platform locales without implicit fallback', async () => {
    const payloadConfig = await config
    if (!payloadConfig.localization) throw new Error('Localization must be enabled.')

    expect(payloadConfig.localization).toMatchObject({
      defaultLocale: defaultPlatformLocale,
      fallback: false,
    })
    expect(payloadConfig.localization?.locales.map(({ code }) => code)).toEqual(
      platformLocaleCodes,
    )
  })

  it('requires the tenant default locale to be enabled', () => {
    expect(validateTenantLocaleConfiguration('en', ['en', 'de'])).toBe(true)
    expect(validateTenantLocaleConfiguration('de', ['en'])).toBe(
      'The default locale must also be included in supported locales.',
    )
    expect(validateTenantLocaleConfiguration('en', [])).toBe(
      'Choose at least one supported locale.',
    )
    expect(validateTenantLocaleConfiguration('en', ['en', 'en'])).toBe(
      'Each supported locale can only be selected once.',
    )
  })

  it('normalizes locale values and rejects disabled tenant locales', () => {
    expect(tenantLocaleCodes(['en', { locale: 'de' }, 'invalid'])).toEqual(['en', 'de'])
    expect(tenantSupportsLocale('de', 'en', ['en', 'de'])).toBe(true)
    expect(tenantSupportsLocale('fr', 'en', ['en', 'de'])).toBe(false)
  })
})
