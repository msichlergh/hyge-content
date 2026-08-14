import type { CollectionConfig } from 'payload'

import {
  createFirstUserOrPlatformAdmin,
  platformAdminFieldAccess,
  readOwnUserOrPlatformAdmin,
  updateOwnUserOrPlatformAdmin,
} from '../access/users'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    create: createFirstUserOrPlatformAdmin,
    delete: ({ req }) => req.user?.globalRole === 'platform-admin',
    read: readOwnUserOrPlatformAdmin,
    update: updateOwnUserOrPlatformAdmin,
  },
  admin: {
    defaultColumns: ['name', 'email', 'globalRole', 'status'],
    group: 'Platform',
    useAsTitle: 'email',
  },
  auth: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || req.user) return data

        const { totalDocs } = await req.payload.count({
          collection: 'users',
          overrideAccess: true,
        })

        if (totalDocs === 0) {
          data.globalRole = 'platform-admin'
          data.status = 'active'
        }

        return data
      },
    ],
    beforeLogin: [
      ({ user }) => {
        if (user.status === 'suspended') {
          throw new Error('This account is suspended.')
        }
        return user
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'globalRole',
      type: 'select',
      access: {
        create: platformAdminFieldAccess,
        update: platformAdminFieldAccess,
      },
      defaultValue: 'member',
      options: [
        { label: 'Platform administrator', value: 'platform-admin' },
        { label: 'Member', value: 'member' },
      ],
      required: true,
      saveToJWT: true,
    },
    {
      name: 'status',
      type: 'select',
      access: {
        create: platformAdminFieldAccess,
        update: platformAdminFieldAccess,
      },
      defaultValue: 'invited',
      options: [
        { label: 'Invited', value: 'invited' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
      required: true,
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      access: {
        create: () => false,
        update: () => false,
      },
      admin: {
        readOnly: true,
      },
    },
  ],
}
