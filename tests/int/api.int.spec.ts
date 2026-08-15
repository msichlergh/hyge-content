import config from '@/payload.config'

import { describe, expect, it } from 'vitest'

describe('Payload configuration', () => {
  it('registers the phase-two collections, endpoints, and security plugins', async () => {
    const payloadConfig = await config

    expect(payloadConfig.collections?.map(({ slug }) => slug)).toEqual(
      expect.arrayContaining(['tenants', 'users', 'media', 'changelog-releases']),
    )
    expect(payloadConfig.db).toBeDefined()
    expect(payloadConfig.endpoints?.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        '/public/v1/:tenant/changelog',
        '/public/v1/:tenant/changelog/:slug',
      ]),
    )
  })
})
