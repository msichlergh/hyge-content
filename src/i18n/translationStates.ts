import { createHash } from 'node:crypto'

import {
  isPlatformLocale,
  type PlatformLocaleCode,
} from './locales'

export const translationStateValues = ['missing', 'draft', 'review', 'approved', 'stale'] as const

export type TranslationStateValue = (typeof translationStateValues)[number]

export type TranslationStateEntry = {
  contentVersion?: null | string
  id?: null | string
  locale: PlatformLocaleCode
  sourceLocale: PlatformLocaleCode
  sourceVersion?: null | string
  state: TranslationStateValue
}

const isTranslationState = (value: unknown): value is TranslationStateValue =>
  typeof value === 'string' && translationStateValues.includes(value as TranslationStateValue)

export const normalizeTranslationStates = (value: unknown): TranslationStateEntry[] => {
  if (!Array.isArray(value)) return []

  const entries: TranslationStateEntry[] = []
  const seen = new Set<PlatformLocaleCode>()

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue

    const locale = 'locale' in candidate ? candidate.locale : null
    const sourceLocale = 'sourceLocale' in candidate ? candidate.sourceLocale : null
    const state = 'state' in candidate ? candidate.state : null
    if (
      !isPlatformLocale(locale) ||
      !isPlatformLocale(sourceLocale) ||
      !isTranslationState(state) ||
      seen.has(locale)
    ) {
      continue
    }

    seen.add(locale)
    entries.push({
      contentVersion:
        'contentVersion' in candidate && typeof candidate.contentVersion === 'string'
          ? candidate.contentVersion
          : null,
      id: 'id' in candidate && typeof candidate.id === 'string' ? candidate.id : undefined,
      locale,
      sourceLocale,
      sourceVersion:
        'sourceVersion' in candidate && typeof candidate.sourceVersion === 'string'
          ? candidate.sourceVersion
          : null,
      state,
    })
  }

  return entries
}

export const syncTranslationStateLocales = (
  value: unknown,
  supportedLocales: PlatformLocaleCode[],
  sourceLocale: PlatformLocaleCode,
): TranslationStateEntry[] => {
  const existing = new Map(normalizeTranslationStates(value).map((entry) => [entry.locale, entry]))

  return supportedLocales.map((locale) => ({
    ...(existing.get(locale) ?? {
      contentVersion: null,
      locale,
      sourceVersion: null,
      state: locale === sourceLocale ? 'draft' : 'missing',
    }),
    locale,
    sourceLocale,
  }))
}

export const translationStateFor = (
  value: unknown,
  locale: PlatformLocaleCode,
): TranslationStateEntry | undefined =>
  normalizeTranslationStates(value).find((entry) => entry.locale === locale)

export const isApprovedTranslation = (
  value: unknown,
  locale: PlatformLocaleCode,
): boolean => translationStateFor(value, locale)?.state === 'approved'

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value ?? null

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'id')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  )
}

export const localizedContentVersion = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')
