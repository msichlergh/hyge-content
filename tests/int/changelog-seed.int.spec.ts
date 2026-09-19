import { importYourPropFirmChangelog } from '@/seed/importYourPropFirmChangelog'
import { yourPropFirmChangelog } from '@/seed/yourpropfirmChangelog'
import { describe, expect, it, vi } from 'vitest'

describe('YourPropFirm changelog import', () => {
  it('imports every release idempotently without notifications', async () => {
    const admin = { globalRole: 'platform-admin', id: 'admin', status: 'active' }
    const tenant = { id: 'tenant-a', slug: 'yourpropfirm' }
    const find = vi.fn(async (options: { collection: string }) => {
      if (options.collection === 'tenants') return { docs: [tenant], totalDocs: 1 }
      if (options.collection === 'users') return { docs: [admin], totalDocs: 1 }
      return { docs: [], totalDocs: 0 }
    })
    const create = vi.fn(async (options: { collection: string }) => ({
      id: options.collection === 'media' ? 'media-1' : 'release',
    }))

    const result = await importYourPropFirmChangelog({ create, find } as never)
    const releaseCount = yourPropFirmChangelog.length
    const withCovers = yourPropFirmChangelog.filter((release) => release.coverImage).length

    expect(releaseCount).toBe(6)
    expect(result).toEqual({ imported: releaseCount, skipped: 0 })
    expect(create).toHaveBeenCalledTimes(releaseCount + withCovers)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'media',
        data: expect.objectContaining({ tenant: 'tenant-a', usage: 'changelog' }),
        overrideAccess: false,
        user: admin,
      }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'changelog-releases',
        data: expect.objectContaining({ coverImage: 'media-1', slug: 'r-2026-08-14' }),
      }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'changelog-releases',
        context: { skipNotifications: true },
        overrideAccess: false,
        user: admin,
      }),
    )
  })

  it('skips tenant and slug pairs that already exist', async () => {
    const find = vi.fn(async (options: { collection: string }) => {
      if (options.collection === 'tenants') {
        return { docs: [{ id: 'tenant-a', slug: 'yourpropfirm' }], totalDocs: 1 }
      }
      if (options.collection === 'users') {
        return {
          docs: [{ globalRole: 'platform-admin', id: 'admin', status: 'active' }],
          totalDocs: 1,
        }
      }
      return { docs: [{ id: 'existing' }], totalDocs: 1 }
    })
    const create = vi.fn()

    const result = await importYourPropFirmChangelog({ create, find } as never)

    expect(result).toEqual({ imported: 0, skipped: yourPropFirmChangelog.length })
    expect(create).not.toHaveBeenCalled()
  })
})
