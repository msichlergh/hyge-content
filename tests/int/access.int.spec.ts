import {
  assertTenantAssignment,
  authorizedTenantIDs,
  tenantScopedAccess,
  tenantScopedCreateAccess,
  type PlatformUser,
} from '@/access/memberships'
import { readOwnUserOrPlatformAdmin } from '@/access/users'
import { describe, expect, it } from 'vitest'

const member: PlatformUser = {
  collection: 'users',
  globalRole: 'member',
  id: 'user-a',
  memberships: [
    {
      capabilities: ['read', 'draft'],
      sections: ['marketing'],
      tenant: 'tenant-a',
    },
    {
      capabilities: ['read'],
      sections: ['changelog'],
      tenant: { id: 'tenant-b' },
    },
  ],
}

const platformAdmin: PlatformUser = {
  collection: 'users',
  globalRole: 'platform-admin',
  id: 'admin',
  memberships: [],
}

const requestFor = (user: PlatformUser | null) => ({ req: { user } }) as never

describe('tenant access controls', () => {
  it('returns only tenant IDs matching both section and capability', () => {
    expect(
      authorizedTenantIDs(member, {
        capabilities: ['read'],
        sections: ['marketing'],
      }),
    ).toEqual(['tenant-a'])

    expect(
      authorizedTenantIDs(member, {
        capabilities: ['draft'],
        sections: ['changelog'],
      }),
    ).toEqual([])
  })

  it('returns a tenant-constrained query for ordinary members', async () => {
    const access = tenantScopedAccess({
      capabilities: ['read'],
      sections: ['marketing'],
    })

    expect(await access(requestFor(member))).toEqual({
      tenant: {
        in: ['tenant-a'],
      },
    })
  })

  it('uses the requested field for tenant collection reads', async () => {
    const access = tenantScopedAccess({}, 'id')

    expect(await access(requestFor(member))).toEqual({
      id: {
        in: ['tenant-a', 'tenant-b'],
      },
    })
  })

  it('denies anonymous and unassigned member access', async () => {
    const read = tenantScopedAccess({ capabilities: ['read'], sections: ['marketing'] })
    const publish = tenantScopedCreateAccess({
      capabilities: ['publish'],
      sections: ['marketing'],
    })

    expect(await read(requestFor(null))).toBe(false)
    expect(await publish(requestFor(member))).toBe(false)
  })

  it('rejects a create assignment outside the required membership scope', () => {
    expect(() =>
      assertTenantAssignment(member, 'tenant-b', {
        capabilities: ['draft'],
        sections: ['marketing', 'changelog'],
      }),
    ).toThrow('You are not allowed to perform this action.')

    expect(() =>
      assertTenantAssignment(member, 'tenant-a', {
        capabilities: ['draft'],
        sections: ['marketing', 'changelog'],
      }),
    ).not.toThrow()
  })

  it('allows unrestricted access only for platform administrators', async () => {
    const access = tenantScopedAccess({
      capabilities: ['read'],
      sections: ['marketing'],
    })

    expect(await access(requestFor(platformAdmin))).toBe(true)
  })
})

describe('user access controls', () => {
  it('limits members to their own user document', async () => {
    expect(await readOwnUserOrPlatformAdmin(requestFor(member))).toEqual({
      id: {
        equals: 'user-a',
      },
    })
  })

  it('allows platform administrators to read all users', async () => {
    expect(await readOwnUserOrPlatformAdmin(requestFor(platformAdmin))).toBe(true)
  })
})
