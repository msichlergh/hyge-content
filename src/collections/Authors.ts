import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { relationshipID } from '../access/memberships'
import { requiredTenantField, slugField, tenantSlugIndex } from '../content/fields'
import { validateMediaTenant } from '../content/localizedWorkflow'
import {
  hiddenWithoutSection,
  sectionAccess,
  tenantReferenceWriteGuard,
} from '../content/sectionAccess'

const validateAuthorMedia: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
  if (tenantID !== null) await validateMediaTenant(req, data.avatar, tenantID, 'Author')
  return data
}

/**
 * Bylines. Deliberately outside the translation-approval workflow: role and bio
 * are short, and the public API falls back to the tenant default locale for
 * them explicitly rather than hiding an article because its author has no bio.
 */
export const Authors: CollectionConfig = {
  slug: 'authors',
  access: sectionAccess('marketing'),
  admin: {
    defaultColumns: ['name', 'slug', 'role', 'updatedAt'],
    group: 'Content',
    hidden: hiddenWithoutSection('marketing'),
    useAsTitle: 'name',
  },
  fields: [
    requiredTenantField,
    { name: 'name', type: 'text', required: true },
    slugField,
    { name: 'role', type: 'text', localized: true },
    { name: 'bio', type: 'textarea', localized: true },
    { name: 'avatar', type: 'upload', relationTo: 'media' },
  ],
  hooks: {
    beforeChange: [validateAuthorMedia],
    beforeValidate: [tenantReferenceWriteGuard('marketing', 'author')],
  },
  indexes: [tenantSlugIndex],
}
