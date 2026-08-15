import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { yourPropFirmChangelog } from './yourpropfirmChangelog'

export const importYourPropFirmChangelog = async (payload: Payload) => {
  const tenantResult = await payload.find({
    collection: 'tenants',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: 'yourpropfirm' } },
  })
  const tenant = tenantResult.docs[0]
  if (!tenant) throw new Error('Create the YourPropFirm tenant before importing changelog data.')

  const adminResult = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [{ globalRole: { equals: 'platform-admin' } }, { status: { equals: 'active' } }],
    },
  })
  const admin = adminResult.docs[0]
  if (!admin) throw new Error('An active platform administrator is required for the import.')

  let imported = 0
  let skipped = 0

  for (const release of yourPropFirmChangelog) {
    const existing = await payload.find({
      collection: 'changelog-releases',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      user: admin,
      where: {
        and: [
          { tenant: { equals: tenant.id } },
          { slug: { equals: release.slug } },
        ],
      },
    })

    if (existing.totalDocs > 0) {
      skipped += 1
      continue
    }

    await payload.create({
      collection: 'changelog-releases',
      context: { skipNotifications: true },
      data: {
        _status: 'published',
        coverType: release.coverType,
        features: release.features,
        fixes: release.fixes,
        flagship: release.flagship,
        headline: release.headline,
        improvements: release.improvements,
        kicker: release.kicker,
        notificationOptions: {
          audienceProvider: 'none',
          emailEnabled: false,
          slackEnabled: false,
        },
        publishedAt: `${release.releaseDate}T12:00:00.000Z`,
        releaseDate: `${release.releaseDate}T12:00:00.000Z`,
        slug: release.slug,
        tenant: tenant.id,
        translationStates: [
          {
            locale: 'en',
            sourceLocale: 'en',
            sourceVersion: 'historical-import',
            state: 'approved',
          },
        ],
      },
      draft: false,
      fallbackLocale: false,
      locale: 'en',
      overrideAccess: false,
      user: admin,
    })
    imported += 1
  }

  return { imported, skipped }
}

const run = async () => {
  const payload = await getPayload({ config })
  const result = await importYourPropFirmChangelog(payload)
  payload.logger.info(
    `YourPropFirm changelog import complete: ${result.imported} imported, ${result.skipped} skipped.`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : 'Changelog import failed.')
      process.exit(1)
    })
}
