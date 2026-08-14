import { Forbidden, type Access, type Where } from 'payload'

export const membershipSections = ['marketing', 'changelog'] as const
export const membershipCapabilities = [
  'read',
  'draft',
  'publish',
  'notify',
  'manage-members',
] as const

export type MembershipSection = (typeof membershipSections)[number]
export type MembershipCapability = (typeof membershipCapabilities)[number]

type RelationshipValue = number | string | { id?: number | string | null }

export type Membership = {
  capabilities?: (MembershipCapability | null)[] | null
  sections?: (MembershipSection | null)[] | null
  tenant?: RelationshipValue | null
}

export type PlatformUser = {
  collection?: string
  globalRole?: 'member' | 'platform-admin' | null
  id: number | string
  memberships?: (Membership | null)[] | null
}

type TenantAccessOptions = {
  capabilities: MembershipCapability[]
  sections: MembershipSection[]
}

export const relationshipID = (value: unknown): number | string | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (!value || typeof value !== 'object' || !('id' in value)) return null

  const id = value.id
  return typeof id === 'number' || typeof id === 'string' ? id : null
}

export const asPlatformUser = (value: unknown): PlatformUser | null => {
  if (!value || typeof value !== 'object' || !('id' in value)) return null

  const id = value.id
  if (typeof id !== 'number' && typeof id !== 'string') return null

  return value as PlatformUser
}

export const isPlatformAdmin = (value: unknown): boolean =>
  asPlatformUser(value)?.globalRole === 'platform-admin'

export const authorizedTenantIDs = (
  value: unknown,
  options?: Partial<TenantAccessOptions>,
): (number | string)[] => {
  const user = asPlatformUser(value)
  if (!user) return []

  const requiredSections = options?.sections ?? []
  const requiredCapabilities = options?.capabilities ?? []
  const ids = new Set<number | string>()

  for (const membership of user.memberships ?? []) {
    if (!membership) continue

    const hasSection =
      requiredSections.length === 0 ||
      requiredSections.some((section) => membership.sections?.includes(section))
    const hasCapability =
      requiredCapabilities.length === 0 ||
      requiredCapabilities.some((capability) => membership.capabilities?.includes(capability))

    if (!hasSection || !hasCapability) continue

    const tenantID = relationshipID(membership.tenant)
    if (tenantID !== null) ids.add(tenantID)
  }

  return [...ids]
}

export const hasMembershipAccess = (
  value: unknown,
  options?: Partial<TenantAccessOptions>,
): boolean => isPlatformAdmin(value) || authorizedTenantIDs(value, options).length > 0

export const assertTenantAssignment = (
  value: unknown,
  tenant: unknown,
  options: Partial<TenantAccessOptions>,
  t?: ConstructorParameters<typeof Forbidden>[0],
): void => {
  if (isPlatformAdmin(value)) return

  const tenantID = relationshipID(tenant)
  const isAllowed =
    tenantID !== null &&
    authorizedTenantIDs(value, options).some((allowedID) => String(allowedID) === String(tenantID))

  if (!isAllowed) throw new Forbidden(t)
}

export const tenantWhere = (tenantIDs: (number | string)[], field = 'tenant'): Where | false =>
  tenantIDs.length > 0
    ? {
        [field]: {
          in: tenantIDs,
        },
      }
    : false

export const tenantScopedAccess =
  (options: Partial<TenantAccessOptions>, field = 'tenant'): Access =>
  ({ req }) => {
    if (isPlatformAdmin(req.user)) return true
    return tenantWhere(authorizedTenantIDs(req.user, options), field)
  }

export const tenantScopedCreateAccess =
  (options: Partial<TenantAccessOptions>): Access =>
  ({ req }) =>
    hasMembershipAccess(req.user, options)
