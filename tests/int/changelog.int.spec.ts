import { ChangelogReleases, assertChangelogWriteAccess } from '@/collections/ChangelogReleases'
import { Users } from '@/collections/Users'
import {
  isApprovedTranslation,
  localizedContentVersion,
  syncTranslationStateLocales,
} from '@/i18n/translationStates'
import type { PlatformUser } from '@/access/memberships'
import { describe, expect, it, vi } from 'vitest'

const marketingMember: PlatformUser = {
  collection: 'users',
  globalRole: 'member',
  id: 'marketing-user',
  memberships: [
    { capabilities: ['read', 'draft'], sections: ['marketing'], tenant: 'tenant-a' },
  ],
}

const changelogEditor: PlatformUser = {
  collection: 'users',
  globalRole: 'member',
  id: 'editor-user',
  memberships: [
    { capabilities: ['read', 'draft'], sections: ['changelog'], tenant: 'tenant-a' },
  ],
}

const changelogPublisher: PlatformUser = {
  collection: 'users',
  globalRole: 'member',
  id: 'publisher-user',
  memberships: [
    {
      capabilities: ['read', 'draft', 'publish'],
      sections: ['changelog'],
      tenant: 'tenant-a',
    },
  ],
}

const changelogNotifier: PlatformUser = {
  collection: 'users',
  globalRole: 'member',
  id: 'notifier-user',
  memberships: [
    {
      capabilities: ['read', 'draft', 'notify'],
      sections: ['changelog'],
      tenant: 'tenant-a',
    },
  ],
}

const requestFor = (user: PlatformUser, extra: Record<string, unknown> = {}) =>
  ({ payload: {}, query: {}, user, ...extra }) as never

describe('changelog collection', () => {
  it('enables versions, drafts, and encrypted user API keys', () => {
    expect(ChangelogReleases.versions).toMatchObject({
      drafts: { autosave: { showSaveDraftButton: true }, validate: false },
      maxPerDoc: 100,
    })
    expect(ChangelogReleases.versions).not.toMatchObject({
      drafts: { schedulePublish: true },
    })
    expect(Users.auth).toMatchObject({ useAPIKey: true })
  })

  it('keeps marketing out and returns tenant constraints for product owners', async () => {
    const read = ChangelogReleases.access?.read
    const create = ChangelogReleases.access?.create
    if (!read || !create) throw new Error('Changelog access controls must be configured.')

    expect(await read({ req: requestFor(marketingMember) } as never)).toBe(false)
    expect(await create({ req: requestFor(marketingMember) } as never)).toBe(false)
    expect(await read({ req: requestFor(changelogEditor) } as never)).toEqual({
      tenant: { in: ['tenant-a'] },
    })
    expect(await create({ req: requestFor(changelogEditor) } as never)).toBe(true)
  })

  it('requires exact tenant assignment and publish capability', () => {
    expect(() =>
      assertChangelogWriteAccess({
        data: { _status: 'draft' },
        req: requestFor(changelogEditor),
        tenantID: 'tenant-b',
      }),
    ).toThrow('You are not allowed to perform this action.')

    expect(() =>
      assertChangelogWriteAccess({
        data: { _status: 'published' },
        req: requestFor(changelogEditor),
        tenantID: 'tenant-a',
      }),
    ).toThrow('You are not allowed to perform this action.')

    expect(() =>
      assertChangelogWriteAccess({
        data: { _status: 'published' },
        req: requestFor(changelogPublisher),
        tenantID: 'tenant-a',
      }),
    ).not.toThrow()

    expect(() =>
      assertChangelogWriteAccess({
        data: { _status: 'published' },
        originalDoc: { _status: 'published' },
        req: requestFor(changelogEditor, { query: { draft: 'true' } }),
        tenantID: 'tenant-a',
      }),
    ).not.toThrow()
  })

  it('marks approved translations stale when source copy changes', async () => {
    const beforeValidate = ChangelogReleases.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error('Translation validation hook must be configured.')

    const originalContent = {
      features: [],
      fixes: [],
      flagship: null,
      headline: 'Original',
      improvements: [],
      kicker: 'Original kicker',
    }
    const originalVersion = localizedContentVersion(originalContent)
    const findByID = vi.fn().mockResolvedValue({
      defaultLocale: 'en',
      supportedLocales: [{ locale: 'en' }, { locale: 'de' }],
    })
    const result = await beforeValidate({
      collection: ChangelogReleases as never,
      context: {},
      data: { _status: 'draft', headline: 'Updated', tenant: 'tenant-a' },
      operation: 'update',
      originalDoc: {
        ...originalContent,
        _status: 'draft',
        tenant: 'tenant-a',
        translationStates: [
          {
            contentVersion: originalVersion,
            locale: 'en',
            sourceLocale: 'en',
            sourceVersion: originalVersion,
            state: 'approved',
          },
          {
            contentVersion: 'german-version',
            locale: 'de',
            sourceLocale: 'en',
            sourceVersion: originalVersion,
            state: 'approved',
          },
        ],
      },
      req: requestFor(changelogPublisher, {
        locale: 'en',
        payload: { findByID },
      }),
    } as never)

    expect(result.translationStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: 'en', state: 'draft' }),
        expect.objectContaining({ locale: 'de', state: 'stale' }),
      ]),
    )
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ overrideAccess: false, user: changelogPublisher }),
    )
  })

  it('requires notify capability to change delivery intent', async () => {
    const beforeValidate = ChangelogReleases.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error('Changelog validation hook must be configured.')

    const findByID = vi.fn().mockResolvedValue({
      defaultLocale: 'en',
      supportedLocales: [{ locale: 'en' }],
    })
    const args = {
      collection: ChangelogReleases as never,
      context: {},
      data: {
        _status: 'draft',
        notificationOptions: { emailEnabled: true },
        tenant: 'tenant-a',
      },
      operation: 'update' as const,
      originalDoc: {
        _status: 'draft',
        headline: 'Release',
        kicker: 'Kicker',
        notificationOptions: { emailEnabled: false },
        tenant: 'tenant-a',
      },
    }

    await expect(
      beforeValidate({
        ...args,
        req: requestFor(changelogEditor, { locale: 'en', payload: { findByID } }),
      } as never),
    ).rejects.toThrow('You are not allowed to perform this action.')
    await expect(
      beforeValidate({
        ...args,
        req: requestFor(changelogNotifier, { locale: 'en', payload: { findByID } }),
      } as never),
    ).resolves.toBeDefined()
  })

  it('only accepts workflow state changes for the locale being edited', async () => {
    const beforeValidate = ChangelogReleases.hooks?.beforeValidate?.[0]
    if (!beforeValidate) throw new Error('Translation validation hook must be configured.')

    const findByID = vi.fn().mockResolvedValue({
      defaultLocale: 'en',
      supportedLocales: [{ locale: 'en' }, { locale: 'de' }, { locale: 'fr' }],
    })
    const result = await beforeValidate({
      collection: ChangelogReleases as never,
      context: {},
      data: {
        _status: 'draft',
        headline: 'Neue Überschrift',
        tenant: 'tenant-a',
        translationStates: [
          { locale: 'de', sourceLocale: 'en', state: 'review' },
          { locale: 'fr', sourceLocale: 'en', state: 'approved' },
        ],
      },
      operation: 'update',
      originalDoc: {
        _status: 'draft',
        headline: 'Alte Überschrift',
        kicker: 'Deutscher Teaser',
        tenant: 'tenant-a',
        translationStates: [
          {
            contentVersion: 'english-version',
            locale: 'en',
            sourceLocale: 'en',
            sourceVersion: 'english-version',
            state: 'approved',
          },
          { locale: 'de', sourceLocale: 'en', state: 'draft' },
          { locale: 'fr', sourceLocale: 'en', state: 'draft' },
        ],
      },
      req: requestFor(changelogPublisher, {
        locale: 'de',
        payload: { findByID },
      }),
    } as never)

    expect(result.translationStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: 'de', state: 'review' }),
        expect.objectContaining({ locale: 'fr', state: 'draft' }),
      ]),
    )
  })
})

describe('translation state helpers', () => {
  it('adds missing tenant locales without duplicating existing states', () => {
    const states = syncTranslationStateLocales(
      [{ locale: 'en', sourceLocale: 'en', state: 'approved' }],
      ['en', 'de'],
      'en',
    )

    expect(states).toHaveLength(2)
    expect(states[1]).toMatchObject({ locale: 'de', sourceLocale: 'en', state: 'missing' })
    expect(isApprovedTranslation(states, 'en')).toBe(true)
    expect(isApprovedTranslation(states, 'de')).toBe(false)
  })

  it('creates stable content versions independent of Payload row IDs', () => {
    expect(localizedContentVersion([{ id: 'row-a', title: 'Same' }])).toBe(
      localizedContentVersion([{ id: 'row-b', title: 'Same' }]),
    )
  })
})
