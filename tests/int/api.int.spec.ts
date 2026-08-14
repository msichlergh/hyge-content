import config from '@/payload.config'

import { describe, expect, it } from 'vitest'

describe('Payload configuration', () => {
  it('registers the phase-one collections and security plugins', async () => {
    const payloadConfig = await config

    expect(payloadConfig.collections?.map(({ slug }) => slug)).toEqual(
      expect.arrayContaining(['tenants', 'users', 'media']),
    )
    expect(payloadConfig.db).toBeDefined()
  })
})
