import type { CollectionConfig } from 'payload'

import { requiredTenantField, slugField, tenantSlugIndex } from '../content/fields'
import {
  hiddenWithoutSection,
  sectionAccess,
  tenantReferenceWriteGuard,
} from '../content/sectionAccess'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: sectionAccess('marketing'),
  admin: {
    defaultColumns: ['name', 'slug', 'updatedAt'],
    group: 'Content',
    hidden: hiddenWithoutSection('marketing'),
    useAsTitle: 'name',
  },
  fields: [
    requiredTenantField,
    { name: 'name', type: 'text', localized: true, required: true },
    slugField,
    { name: 'description', type: 'textarea', localized: true },
  ],
  hooks: {
    beforeValidate: [tenantReferenceWriteGuard('marketing', 'category')],
  },
  indexes: [tenantSlugIndex],
}
