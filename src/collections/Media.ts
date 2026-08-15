import { tenantField } from '@payloadcms/plugin-multi-tenant/fields'
import path from 'path'
import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  SingleRelationshipField,
} from 'payload'

import {
  assertTenantAssignment,
  isPlatformAdmin,
  relationshipID,
  tenantScopedAccess,
  tenantScopedCreateAccess,
  type Membership,
} from '../access/memberships'
import { tenantSupportsLocale } from '../i18n/locales'

const setMediaPrefix: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const tenantID = relationshipID(data.tenant ?? originalDoc?.tenant)
  if (tenantID === null) {
    throw new Error('A tenant is required before media can be uploaded.')
  }

  assertTenantAssignment(
    req.user,
    tenantID,
    {
      capabilities: ['draft'],
      sections: ['marketing', 'changelog'],
    },
    req.t,
  )

  if (
    operation === 'update' &&
    relationshipID(originalDoc?.tenant) !== null &&
    String(relationshipID(originalDoc?.tenant)) !== String(tenantID)
  ) {
    throw new Error('The tenant assigned to media is immutable.')
  }

  const tenant = await req.payload.findByID({
    collection: 'tenants',
    depth: 0,
    id: tenantID,
    overrideAccess: false,
    req,
    select: {
      defaultLocale: true,
      mediaPathPrefix: true,
      supportedLocales: true,
    },
    user: req.user ?? undefined,
  })

  if (!tenantSupportsLocale(req.locale, tenant.defaultLocale, tenant.supportedLocales)) {
    throw new Error('The selected locale is not enabled for this tenant.')
  }

  if (operation !== 'create') return data

  data.prefix = path.posix.join(tenant.mediaPathPrefix, data.usage || 'general')
  return data
}

const requiredTenantField: SingleRelationshipField = {
  ...tenantField({
    isAutosaveEnabled: false,
    name: 'tenant',
    tenantsArrayFieldName: 'memberships',
    tenantsArrayTenantFieldName: 'tenant',
    tenantsCollectionSlug: 'tenants',
    unique: false,
  }),
  required: true,
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: tenantScopedCreateAccess({
      capabilities: ['draft'],
      sections: ['marketing', 'changelog'],
    }),
    delete: tenantScopedAccess({
      capabilities: ['draft'],
      sections: ['marketing', 'changelog'],
    }),
    read: tenantScopedAccess({
      capabilities: ['read'],
      sections: ['marketing', 'changelog'],
    }),
    update: tenantScopedAccess({
      capabilities: ['draft'],
      sections: ['marketing', 'changelog'],
    }),
  },
  admin: {
    defaultColumns: ['filename', 'altText', 'usage', 'status', 'updatedAt'],
    group: 'Content',
    hidden: ({ user }) =>
      !isPlatformAdmin(user) &&
      !user?.memberships?.some(
        (membership: Membership) =>
          membership.sections?.includes('marketing') || membership.sections?.includes('changelog'),
      ),
    useAsTitle: 'altText',
  },
  hooks: {
    beforeValidate: [setMediaPrefix],
  },
  fields: [
    requiredTenantField,
    {
      name: 'altText',
      type: 'text',
      localized: true,
      required: true,
    },
    {
      name: 'caption',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'credit',
      type: 'text',
    },
    {
      name: 'usage',
      type: 'select',
      defaultValue: 'general',
      options: [
        { label: 'Blog', value: 'blog' },
        { label: 'Event', value: 'event' },
        { label: 'Changelog', value: 'changelog' },
        { label: 'General', value: 'general' },
      ],
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      required: true,
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      access: {
        create: () => false,
        update: () => false,
      },
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ operation, req, value }) => (operation === 'create' ? req.user?.id : value),
        ],
      },
      relationTo: 'users',
    },
    {
      name: 'prefix',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
      },
      defaultValue: '',
    },
  ],
  upload: {
    focalPoint: true,
    imageSizes: [
      { name: 'thumbnail', width: 480 },
      { name: 'card', width: 960 },
      { name: 'hero', width: 1920 },
    ],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
  },
}
