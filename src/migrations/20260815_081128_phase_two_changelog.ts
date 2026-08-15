import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_cl_translations_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TYPE "cms"."enum_cl_translations_state" AS ENUM('missing', 'draft', 'review', 'approved', 'stale');
  CREATE TYPE "cms"."source_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TYPE "cms"."enum_changelog_cover_type" AS ENUM('none', 'affiliate', 'copier', 'security', 'payments', 'media');
  CREATE TYPE "cms"."enum_changelog_flagship_surface" AS ENUM('affiliate', 'copier', 'security', 'payments');
  CREATE TYPE "cms"."audience" AS ENUM('none', 'cms', 'external-api');
  CREATE TYPE "cms"."enum_changelog_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__cl_translations_v_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TYPE "cms"."enum__cl_translations_v_state" AS ENUM('missing', 'draft', 'review', 'approved', 'stale');
  CREATE TYPE "cms"."enum__changelog_v_version_cover_type" AS ENUM('none', 'affiliate', 'copier', 'security', 'payments', 'media');
  CREATE TYPE "cms"."enum__changelog_v_version_flagship_surface" AS ENUM('affiliate', 'copier', 'security', 'payments');
  CREATE TYPE "cms"."enum__changelog_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__changelog_v_published_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TABLE "cms"."changelog_features" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "area" varchar
  );

  CREATE TABLE "cms"."changelog_features_locales" (
    "title" varchar,
    "body" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "cms"."changelog_improvements" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "area" varchar
  );

  CREATE TABLE "cms"."changelog_improvements_locales" (
    "title" varchar,
    "body" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "cms"."changelog_fixes" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "area" varchar
  );

  CREATE TABLE "cms"."changelog_fixes_locales" (
    "title" varchar,
    "body" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "cms"."cl_translations" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "locale" "cms"."enum_cl_translations_locale",
    "state" "cms"."enum_cl_translations_state",
    "source_locale" "cms"."source_locale",
    "source_version" varchar,
    "content_version" varchar
  );

  CREATE TABLE "cms"."changelog" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid,
    "release_date" timestamp(3) with time zone,
    "slug" varchar,
    "cover_type" "cms"."enum_changelog_cover_type" DEFAULT 'none',
    "cover_image_id" uuid,
    "flagship_surface" "cms"."enum_changelog_flagship_surface",
    "notification_options_email_enabled" boolean DEFAULT false,
    "notification_options_slack_enabled" boolean DEFAULT false,
    "notification_options_audience_provider" "cms"."audience" DEFAULT 'none',
    "published_at" timestamp(3) with time zone,
    "published_by_id" uuid,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "cms"."enum_changelog_status" DEFAULT 'draft'
  );

  CREATE TABLE "cms"."changelog_locales" (
    "headline" varchar,
    "kicker" varchar,
    "flagship_label" varchar,
    "flagship_title" varchar,
    "flagship_body" varchar,
    "notification_options_email_subject" varchar,
    "notification_options_email_preheader" varchar,
    "notification_options_slack_intro" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" uuid NOT NULL
  );

  CREATE TABLE "cms"."_changelog_v_version_features" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "area" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_changelog_v_version_features_locales" (
    "title" varchar,
    "body" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" uuid NOT NULL
  );

  CREATE TABLE "cms"."_changelog_v_version_improvements" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "area" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_changelog_v_version_improvements_locales" (
    "title" varchar,
    "body" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" uuid NOT NULL
  );

  CREATE TABLE "cms"."_changelog_v_version_fixes" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "area" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_changelog_v_version_fixes_locales" (
    "title" varchar,
    "body" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" uuid NOT NULL
  );

  CREATE TABLE "cms"."_cl_translations_v" (
    "_order" integer NOT NULL,
    "_parent_id" uuid NOT NULL,
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "locale" "cms"."enum__cl_translations_v_locale",
    "state" "cms"."enum__cl_translations_v_state",
    "source_locale" "cms"."source_locale",
    "source_version" varchar,
    "content_version" varchar,
    "_uuid" varchar
  );

  CREATE TABLE "cms"."_changelog_v" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "parent_id" uuid,
    "version_tenant_id" uuid,
    "version_release_date" timestamp(3) with time zone,
    "version_slug" varchar,
    "version_cover_type" "cms"."enum__changelog_v_version_cover_type" DEFAULT 'none',
    "version_cover_image_id" uuid,
    "version_flagship_surface" "cms"."enum__changelog_v_version_flagship_surface",
    "version_notification_options_email_enabled" boolean DEFAULT false,
    "version_notification_options_slack_enabled" boolean DEFAULT false,
    "version_notification_options_audience_provider" "cms"."audience" DEFAULT 'none',
    "version_published_at" timestamp(3) with time zone,
    "version_published_by_id" uuid,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "cms"."enum__changelog_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "snapshot" boolean,
    "published_locale" "cms"."enum__changelog_v_published_locale",
    "latest" boolean,
    "autosave" boolean
  );

  CREATE TABLE "cms"."_changelog_v_locales" (
    "version_headline" varchar,
    "version_kicker" varchar,
    "version_flagship_label" varchar,
    "version_flagship_title" varchar,
    "version_flagship_body" varchar,
    "version_notification_options_email_subject" varchar,
    "version_notification_options_email_preheader" varchar,
    "version_notification_options_slack_intro" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" uuid NOT NULL
  );

  ALTER TABLE "cms"."users" ADD COLUMN "enable_a_p_i_key" boolean;
  ALTER TABLE "cms"."users" ADD COLUMN "api_key" varchar;
  ALTER TABLE "cms"."users" ADD COLUMN "api_key_index" varchar;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "changelog_id" uuid;
  ALTER TABLE "cms"."changelog_features" ADD CONSTRAINT "changelog_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_features_locales" ADD CONSTRAINT "changelog_features_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_improvements" ADD CONSTRAINT "changelog_improvements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_improvements_locales" ADD CONSTRAINT "changelog_improvements_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog_improvements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_fixes" ADD CONSTRAINT "changelog_fixes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog_fixes_locales" ADD CONSTRAINT "changelog_fixes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog_fixes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."cl_translations" ADD CONSTRAINT "cl_translations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."changelog" ADD CONSTRAINT "changelog_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."changelog" ADD CONSTRAINT "changelog_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."changelog" ADD CONSTRAINT "changelog_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."changelog_locales" ADD CONSTRAINT "changelog_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_version_features" ADD CONSTRAINT "_changelog_v_version_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_version_features_locales" ADD CONSTRAINT "_changelog_v_version_features_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v_version_features"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_version_improvements" ADD CONSTRAINT "_changelog_v_version_improvements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_version_improvements_locales" ADD CONSTRAINT "_changelog_v_version_improvements_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v_version_improvements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_version_fixes" ADD CONSTRAINT "_changelog_v_version_fixes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_version_fixes_locales" ADD CONSTRAINT "_changelog_v_version_fixes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v_version_fixes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_cl_translations_v" ADD CONSTRAINT "_cl_translations_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v" ADD CONSTRAINT "_changelog_v_parent_id_changelog_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."changelog"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v" ADD CONSTRAINT "_changelog_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v" ADD CONSTRAINT "_changelog_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v" ADD CONSTRAINT "_changelog_v_version_published_by_id_users_id_fk" FOREIGN KEY ("version_published_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_changelog_v_locales" ADD CONSTRAINT "_changelog_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_changelog_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "changelog_features_order_idx" ON "cms"."changelog_features" USING btree ("_order");
  CREATE INDEX "changelog_features_parent_id_idx" ON "cms"."changelog_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "changelog_features_locales_locale_parent_id_unique" ON "cms"."changelog_features_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "changelog_improvements_order_idx" ON "cms"."changelog_improvements" USING btree ("_order");
  CREATE INDEX "changelog_improvements_parent_id_idx" ON "cms"."changelog_improvements" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "changelog_improvements_locales_locale_parent_id_unique" ON "cms"."changelog_improvements_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "changelog_fixes_order_idx" ON "cms"."changelog_fixes" USING btree ("_order");
  CREATE INDEX "changelog_fixes_parent_id_idx" ON "cms"."changelog_fixes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "changelog_fixes_locales_locale_parent_id_unique" ON "cms"."changelog_fixes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "cl_translations_order_idx" ON "cms"."cl_translations" USING btree ("_order");
  CREATE INDEX "cl_translations_parent_id_idx" ON "cms"."cl_translations" USING btree ("_parent_id");
  CREATE INDEX "changelog_tenant_idx" ON "cms"."changelog" USING btree ("tenant_id");
  CREATE INDEX "changelog_release_date_idx" ON "cms"."changelog" USING btree ("release_date");
  CREATE INDEX "changelog_slug_idx" ON "cms"."changelog" USING btree ("slug");
  CREATE UNIQUE INDEX "changelog_tenant_slug_unique" ON "cms"."changelog" USING btree ("tenant_id","slug");
  CREATE INDEX "changelog_cover_image_idx" ON "cms"."changelog" USING btree ("cover_image_id");
  CREATE INDEX "changelog_published_by_idx" ON "cms"."changelog" USING btree ("published_by_id");
  CREATE INDEX "changelog_updated_at_idx" ON "cms"."changelog" USING btree ("updated_at");
  CREATE INDEX "changelog_created_at_idx" ON "cms"."changelog" USING btree ("created_at");
  CREATE INDEX "changelog__status_idx" ON "cms"."changelog" USING btree ("_status");
  CREATE UNIQUE INDEX "changelog_locales_locale_parent_id_unique" ON "cms"."changelog_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_changelog_v_version_features_order_idx" ON "cms"."_changelog_v_version_features" USING btree ("_order");
  CREATE INDEX "_changelog_v_version_features_parent_id_idx" ON "cms"."_changelog_v_version_features" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_changelog_v_version_features_locales_locale_parent_id_uniqu" ON "cms"."_changelog_v_version_features_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_changelog_v_version_improvements_order_idx" ON "cms"."_changelog_v_version_improvements" USING btree ("_order");
  CREATE INDEX "_changelog_v_version_improvements_parent_id_idx" ON "cms"."_changelog_v_version_improvements" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_changelog_v_version_improvements_locales_locale_parent_id_u" ON "cms"."_changelog_v_version_improvements_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_changelog_v_version_fixes_order_idx" ON "cms"."_changelog_v_version_fixes" USING btree ("_order");
  CREATE INDEX "_changelog_v_version_fixes_parent_id_idx" ON "cms"."_changelog_v_version_fixes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_changelog_v_version_fixes_locales_locale_parent_id_unique" ON "cms"."_changelog_v_version_fixes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_cl_translations_v_order_idx" ON "cms"."_cl_translations_v" USING btree ("_order");
  CREATE INDEX "_cl_translations_v_parent_id_idx" ON "cms"."_cl_translations_v" USING btree ("_parent_id");
  CREATE INDEX "_changelog_v_parent_idx" ON "cms"."_changelog_v" USING btree ("parent_id");
  CREATE INDEX "_changelog_v_version_version_tenant_idx" ON "cms"."_changelog_v" USING btree ("version_tenant_id");
  CREATE INDEX "_changelog_v_version_version_release_date_idx" ON "cms"."_changelog_v" USING btree ("version_release_date");
  CREATE INDEX "_changelog_v_version_version_slug_idx" ON "cms"."_changelog_v" USING btree ("version_slug");
  CREATE INDEX "_changelog_v_version_version_cover_image_idx" ON "cms"."_changelog_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_changelog_v_version_version_published_by_idx" ON "cms"."_changelog_v" USING btree ("version_published_by_id");
  CREATE INDEX "_changelog_v_version_version_updated_at_idx" ON "cms"."_changelog_v" USING btree ("version_updated_at");
  CREATE INDEX "_changelog_v_version_version_created_at_idx" ON "cms"."_changelog_v" USING btree ("version_created_at");
  CREATE INDEX "_changelog_v_version_version__status_idx" ON "cms"."_changelog_v" USING btree ("version__status");
  CREATE INDEX "_changelog_v_created_at_idx" ON "cms"."_changelog_v" USING btree ("created_at");
  CREATE INDEX "_changelog_v_updated_at_idx" ON "cms"."_changelog_v" USING btree ("updated_at");
  CREATE INDEX "_changelog_v_snapshot_idx" ON "cms"."_changelog_v" USING btree ("snapshot");
  CREATE INDEX "_changelog_v_published_locale_idx" ON "cms"."_changelog_v" USING btree ("published_locale");
  CREATE INDEX "_changelog_v_latest_idx" ON "cms"."_changelog_v" USING btree ("latest");
  CREATE INDEX "_changelog_v_autosave_idx" ON "cms"."_changelog_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "_changelog_v_locales_locale_parent_id_unique" ON "cms"."_changelog_v_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_changelog_releases_fk" FOREIGN KEY ("changelog_id") REFERENCES "cms"."changelog"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_changelog_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("changelog_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."changelog_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog_improvements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog_improvements_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog_fixes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog_fixes_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."cl_translations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."changelog_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_version_features" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_version_features_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_version_improvements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_version_improvements_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_version_fixes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_version_fixes_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_cl_translations_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_changelog_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_changelog_releases_fk";
  DROP INDEX "cms"."payload_locked_documents_rels_changelog_id_idx";
  DROP TABLE "cms"."changelog_features" CASCADE;
  DROP TABLE "cms"."changelog_features_locales" CASCADE;
  DROP TABLE "cms"."changelog_improvements" CASCADE;
  DROP TABLE "cms"."changelog_improvements_locales" CASCADE;
  DROP TABLE "cms"."changelog_fixes" CASCADE;
  DROP TABLE "cms"."changelog_fixes_locales" CASCADE;
  DROP TABLE "cms"."cl_translations" CASCADE;
  DROP TABLE "cms"."changelog" CASCADE;
  DROP TABLE "cms"."changelog_locales" CASCADE;
  DROP TABLE "cms"."_changelog_v_version_features" CASCADE;
  DROP TABLE "cms"."_changelog_v_version_features_locales" CASCADE;
  DROP TABLE "cms"."_changelog_v_version_improvements" CASCADE;
  DROP TABLE "cms"."_changelog_v_version_improvements_locales" CASCADE;
  DROP TABLE "cms"."_changelog_v_version_fixes" CASCADE;
  DROP TABLE "cms"."_changelog_v_version_fixes_locales" CASCADE;
  DROP TABLE "cms"."_cl_translations_v" CASCADE;
  DROP TABLE "cms"."_changelog_v" CASCADE;
  DROP TABLE "cms"."_changelog_v_locales" CASCADE;
  ALTER TABLE "cms"."users" DROP COLUMN "enable_a_p_i_key";
  ALTER TABLE "cms"."users" DROP COLUMN "api_key";
  ALTER TABLE "cms"."users" DROP COLUMN "api_key_index";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "changelog_id";
  DROP TYPE "cms"."enum_cl_translations_locale";
  DROP TYPE "cms"."enum_cl_translations_state";
  DROP TYPE "cms"."source_locale";
  DROP TYPE "cms"."enum_changelog_cover_type";
  DROP TYPE "cms"."enum_changelog_flagship_surface";
  DROP TYPE "cms"."audience";
  DROP TYPE "cms"."enum_changelog_status";
  DROP TYPE "cms"."enum__cl_translations_v_locale";
  DROP TYPE "cms"."enum__cl_translations_v_state";
  DROP TYPE "cms"."enum__changelog_v_version_cover_type";
  DROP TYPE "cms"."enum__changelog_v_version_flagship_surface";
  DROP TYPE "cms"."enum__changelog_v_version_status";
  DROP TYPE "cms"."enum__changelog_v_published_locale";`)
}
