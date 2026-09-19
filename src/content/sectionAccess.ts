import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'

import {
  assertTenantAssignment,
  isPlatformAdmin,
  relationshipID,
  tenantScopedAccess,
  tenantScopedCreateAccess,
  type Membership,
  type MembershipSection,
} from '../access/memberships'

/** Standard tenant-scoped CRUD access for a content section. */
export const sectionAccess = (section: MembershipSection): CollectionConfig['access'] => ({
  create: tenantScopedCreateAccess({ capabilities: ['draft'], sections: [section] }),
  delete: tenantScopedAccess({ capabilities: ['draft'], sections: [section] }),
  read: tenantScopedAccess({ capabilities: ['read'], sections: [section] }),
  update: tenantScopedAccess({ capabilities: ['draft'], sections: [section] }),
})

/** Hide a collection from members who have no membership in its section. */
export const hiddenWithoutSection =
  (section: MembershipSection) =>
  ({ user }: { user: unknown }): boolean =>
    !isPlatformAdmin(user) &&
    !(user as { memberships?: Membership[] } | null)?.memberships?.some((membership) =>
      membership.sections?.includes(section),
    )

/**
 * Write guard for tenant-owned reference data (authors, categories) that has no
 * draft workflow: the writer needs draft capability in the section, and the
 * tenant can never be reassigned.
 */
export const tenantReferenceWriteGuard =
  (section: MembershipSection, label: string): CollectionBeforeValidateHook =>
  ({ data, operation, originalDoc, req }) => {
    if (!data) return data

    const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
    if (tenantID === null) throw new Error(`A tenant is required for every ${label}.`)

    assertTenantAssignment(req.user, tenantID, { capabilities: ['draft'], sections: [section] })

    if (
      operation === 'update' &&
      relationshipID(originalDoc?.tenant) !== null &&
      String(relationshipID(originalDoc?.tenant)) !== String(tenantID)
    ) {
      throw new Error(`The tenant assigned to a ${label} is immutable.`)
    }

    return data
  }
