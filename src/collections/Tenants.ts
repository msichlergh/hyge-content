import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { isPlatformAdmin, tenantScopedAccess } from '../access/memberships'
import {
  defaultPlatformLocale,
  platformLocaleOptions,
  validateTenantLocaleConfiguration,
} from '../i18n/locales'

const validURL = (value: null | string | undefined): string | true => {
  if (!value) return true

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? true : 'Enter an HTTP(S) URL.'
  } catch {
    return 'Enter a valid URL.'
  }
}

const validateTenantLocales: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data

  const defaultLocale = data.defaultLocale ?? originalDoc?.defaultLocale ?? defaultPlatformLocale
  const supportedLocales =
    data.supportedLocales ?? originalDoc?.supportedLocales ?? [{ locale: defaultLocale }]
  const validation = validateTenantLocaleConfiguration(defaultLocale, supportedLocales)

  if (validation !== true) throw new Error(validation)

  data.defaultLocale ??= defaultLocale
  data.supportedLocales ??= supportedLocales
  return data
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
  hooks: {
    beforeValidate: [validateTenantLocales],
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
      type: 'select',
      defaultValue: defaultPlatformLocale,
      options: platformLocaleOptions,
      required: true,
    },
    {
      name: 'supportedLocales',
      type: 'array',
      defaultValue: [{ locale: defaultPlatformLocale }],
      fields: [
        {
          name: 'locale',
          type: 'select',
          options: platformLocaleOptions,
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
