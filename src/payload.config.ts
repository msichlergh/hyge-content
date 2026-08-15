import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import {
  BlockquoteFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import type { PlatformUser } from './access/memberships'
import { isPlatformAdmin, membershipCapabilities, membershipSections } from './access/memberships'
import { authenticatedFieldReadAccess, platformAdminFieldAccess } from './access/users'
import { Users } from './collections/Users'
import { ChangelogReleases } from './collections/ChangelogReleases'
import { Media } from './collections/Media'
import { Tenants } from './collections/Tenants'
import { publicChangelogEndpoints } from './endpoints/publicChangelog'
import {
  defaultPlatformLocale,
  filterTenantLocales,
  platformLocales,
} from './i18n/locales'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const storageEnabled = Boolean(
  process.env.S3_BUCKET &&
  process.env.S3_ENDPOINT &&
  process.env.S3_REGION &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY,
)
const databaseURI =
  process.env.PAYLOAD_MIGRATING === 'true'
    ? process.env.DATABASE_DIRECT_URI || process.env.DATABASE_URI
    : process.env.DATABASE_URI

const mediaStorageOptions = {
  ...(process.env.S3_PUBLIC_URL
    ? {
        generateFileURL: ({ filename, prefix }: { filename: string; prefix?: string }) =>
          [process.env.S3_PUBLIC_URL?.replace(/\/$/, ''), prefix, filename]
            .filter(Boolean)
            .join('/'),
      }
    : {}),
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Tenants, Users, Media, ChangelogReleases],
  editor: lexicalEditor({
    features: () => [
      ParagraphFeature(),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
      BoldFeature(),
      ItalicFeature(),
      StrikethroughFeature(),
      InlineCodeFeature(),
      BlockquoteFeature(),
      HorizontalRuleFeature(),
      UnorderedListFeature(),
      OrderedListFeature(),
      LinkFeature(),
      UploadFeature({ enabledCollections: ['media'] }),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
    ],
  }),
  endpoints: publicChangelogEndpoints,
  localization: {
    defaultLocale: defaultPlatformLocale,
    fallback: false,
    filterAvailableLocales: filterTenantLocales,
    locales: platformLocales,
  },
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.APP_URL || 'http://localhost:3000',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    idType: 'uuid',
    migrationDir: path.resolve(dirname, 'migrations'),
    pool: {
      connectionString: databaseURI || '',
    },
    push: process.env.NODE_ENV === 'development',
    schemaName: process.env.PAYLOAD_DATABASE_SCHEMA || 'cms',
  }),
  sharp,
  plugins: [
    multiTenantPlugin<{ user: PlatformUser }>({
      cleanupAfterTenantDelete: false,
      collections: {
        'changelog-releases': {
          customTenantField: true,
        },
        media: {
          customTenantField: true,
        },
      },
      tenantsArrayField: {
        arrayFieldAccess: {
          create: platformAdminFieldAccess,
          read: authenticatedFieldReadAccess,
          update: platformAdminFieldAccess,
        },
        arrayFieldName: 'memberships',
        arrayTenantFieldName: 'tenant',
        includeDefaultField: true,
        rowFields: [
          {
            name: 'sections',
            type: 'select',
            hasMany: true,
            options: membershipSections.map((section) => ({ label: section, value: section })),
            required: true,
            saveToJWT: true,
          },
          {
            name: 'capabilities',
            type: 'select',
            hasMany: true,
            options: membershipCapabilities.map((capability) => ({
              label: capability,
              value: capability,
            })),
            required: true,
            saveToJWT: true,
          },
        ],
        tenantFieldAccess: {
          create: platformAdminFieldAccess,
          read: authenticatedFieldReadAccess,
          update: platformAdminFieldAccess,
        },
      },
      tenantsSlug: 'tenants',
      userHasAccessToAllTenants: isPlatformAdmin,
    }),
    s3Storage({
      acl: 'public-read',
      alwaysInsertFields: true,
      bucket: process.env.S3_BUCKET || 'hyge-public-media',
      collections: {
        media: mediaStorageOptions,
      },
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
        region: process.env.S3_REGION || 'local',
      },
      enabled: storageEnabled,
    }),
  ],
})
