import type { CollectionConfig } from 'payload'

import { isPlatformAdmin, tenantScopedAccess } from '../access/memberships'

const validURL = (value: null | string | undefined): string | true => {
  if (!value) return true

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? true : 'Enter an HTTP(S) URL.'
  } catch {
    return 'Enter a valid URL.'
  }
}

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  access: {
    create: ({ req }) => isPlatformAdmin(req.user),
    delete: () => false,
    read: tenantScopedAccess({}, 'id'),
    update: ({ req }) => isPlatformAdmin(req.user),
  },
  admin: {
    defaultColumns: ['name', 'slug', 'status', 'websiteURL'],
    group: 'Platform',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      required: true,
      unique: true,
      validate: (value: null | string | undefined) =>
        !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers, and single hyphens only.',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Archived', value: 'archived' },
      ],
      required: true,
    },
    {
      name: 'domains',
      type: 'array',
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'websiteURL',
      type: 'text',
      required: true,
      validate: validURL,
    },
    {
      name: 'timezone',
      type: 'text',
      defaultValue: 'UTC',
      required: true,
    },
    {
      name: 'defaultLocale',
      type: 'text',
      defaultValue: 'en',
      required: true,
    },
    {
      name: 'supportedLocales',
      type: 'array',
      fields: [
        {
          name: 'locale',
          type: 'text',
          required: true,
        },
      ],
      required: true,
    },
    {
      name: 'brandName',
      type: 'text',
      required: true,
    },
    {
      name: 'emailFromName',
      type: 'text',
      required: true,
    },
    {
      name: 'emailFromAddress',
      type: 'email',
    },
    {
      name: 'mediaPathPrefix',
      type: 'text',
      admin: {
        description: 'Immutable storage prefix. Changing it requires a controlled media migration.',
      },
      index: true,
      required: true,
      unique: true,
      validate: (value: null | string | undefined) =>
        !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers, and single hyphens only.',
    },
  ],
}
