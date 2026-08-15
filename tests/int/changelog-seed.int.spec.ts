import { importYourPropFirmChangelog } from '@/seed/importYourPropFirmChangelog'
import { yourPropFirmChangelog } from '@/seed/yourpropfirmChangelog'
import { describe, expect, it, vi } from 'vitest'

describe('YourPropFirm changelog import', () => {
  it('imports all four historical releases idempotently without notifications', async () => {
    const admin = { globalRole: 'platform-admin', id: 'admin', status: 'active' }
    const tenant = { id: 'tenant-a', slug: 'yourpropfirm' }
    const find = vi.fn(async (options: { collection: string }) => {
      if (options.collection === 'tenants') return { docs: [tenant], totalDocs: 1 }
      if (options.collection === 'users') return { docs: [admin], totalDocs: 1 }
      return { docs: [], totalDocs: 0 }
    })
    const create = vi.fn().mockResolvedValue({ id: 'release' })

    const result = await importYourPropFirmChangelog({ create, find } as never)

    expect(yourPropFirmChangelog).toHaveLength(4)
    expect(result).toEqual({ imported: 4, skipped: 0 })
    expect(create).toHaveBeenCalledTimes(4)
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

    expect(result).toEqual({ imported: 0, skipped: 4 })
    expect(create).not.toHaveBeenCalled()
  })
})
