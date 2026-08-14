import type { Access, FieldAccess } from 'payload'

import { asPlatformUser, isPlatformAdmin } from './memberships'

export const platformAdminFieldAccess: FieldAccess = ({ req }) => isPlatformAdmin(req.user)

export const authenticatedFieldReadAccess: FieldAccess = ({ req }) => Boolean(req.user)

export const readOwnUserOrPlatformAdmin: Access = ({ req }) => {
  if (isPlatformAdmin(req.user)) return true

  const user = asPlatformUser(req.user)
  return user
    ? {
        id: {
          equals: user.id,
        },
      }
    : false
}

export const updateOwnUserOrPlatformAdmin: Access = readOwnUserOrPlatformAdmin

export const createFirstUserOrPlatformAdmin: Access = async ({ req }) => {
  if (isPlatformAdmin(req.user)) return true
  if (req.user) return false

  const { totalDocs } = await req.payload.count({
    collection: 'users',
    overrideAccess: true,
  })

  return totalDocs === 0
}
