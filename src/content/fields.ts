import { tenantField } from '@payloadcms/plugin-multi-tenant/fields'
import type { Field, SingleRelationshipField } from 'payload'

export const requiredTenantField: SingleRelationshipField = {
  ...tenantField({
    isAutosaveEnabled: true,
    name: 'tenant',
    tenantsArrayFieldName: 'memberships',
    tenantsArrayTenantFieldName: 'tenant',
    tenantsCollectionSlug: 'tenants',
    unique: false,
  }),
  required: true,
}

export const slugField: Field = {
  name: 'slug',
  type: 'text',
  index: true,
  required: true,
  validate: (value: null | string | undefined) =>
    !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
      ? true
      : 'Use lowercase letters, numbers, and single hyphens only.',
}

/** One slug per tenant. Declared in config so generated migrations keep it. */
export const tenantSlugIndex = { fields: ['tenant', 'slug'], unique: true }
