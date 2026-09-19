import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_post_translations_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar', 'id', 'pt', 'vi');
  CREATE TYPE "cms"."enum_post_translations_state" AS ENUM('missing', 'draft', 'review', 'approved', 'stale');
  CREATE TYPE "cms"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__post_translations_v_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar', 'id', 'pt', 'vi');
  CREATE TYPE "cms"."enum__post_translations_v_state" AS ENUM('missing', 'draft', 'review', 'approved', 'stale');
  CREATE TYPE "cms"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "cms"."enum__posts_v_published_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar', 'id', 'pt', 'vi');
  ALTER TYPE "cms"."_locales" ADD VALUE 'id';
  ALTER TYPE "cms"."_locales" ADD VALUE 'pt';
  ALTER TYPE "cms"."_locales" ADD VALUE 'vi';
  ALTER TYPE "cms"."enum_tenants_supported_locales_locale" ADD VALUE 'id';
  ALTER TYPE "cms"."enum_tenants_supported_locales_locale" ADD VALUE 'pt';
  ALTER TYPE "cms"."enum_tenants_supported_locales_locale" ADD VALUE 'vi';
  ALTER TYPE "cms"."enum_tenants_default_locale" ADD VALUE 'id';
  ALTER TYPE "cms"."enum_tenants_default_locale" ADD VALUE 'pt';
  ALTER TYPE "cms"."enum_tenants_default_locale" ADD VALUE 'vi';
  ALTER TYPE "cms"."enum_cl_translations_locale" ADD VALUE 'id';
  ALTER TYPE "cms"."enum_cl_translations_locale" ADD VALUE 'pt';
  ALTER TYPE "cms"."enum_cl_translations_locale" ADD VALUE 'vi';
  ALTER TYPE "cms"."source_locale" ADD VALUE 'id';
  ALTER TYPE "cms"."source_locale" ADD VALUE 'pt';
  ALTER TYPE "cms"."source_locale" ADD VALUE 'vi';
  ALTER TYPE "cms"."enum__cl_translations_v_locale" ADD VALUE 'id';
  ALTER TYPE "cms"."enum__cl_translations_v_locale" ADD VALUE 'pt';
  ALTER TYPE "cms"."enum__cl_translations_v_locale" ADD VALUE 'vi';
  ALTER TYPE "cms"."enum__changelog_v_published_locale" ADD VALUE 'id';
  ALTER TYPE "cms"."enum__changelog_v_published_locale" ADD VALUE 'pt';
  ALTER TYPE "cms"."enum__changelog_v_published_locale" ADD VALUE 'vi';
  CREATE TABLE "cms"."post_translations" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"locale" "cms"."enum_post_translations_locale",
  	"state" "cms"."enum_post_translations_state",
  	"source_locale" "cms"."source_locale",
  	"source_version" varchar,
  	"content_version" varchar
  );
  
  CREATE TABLE "cms"."posts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid,
  	"slug" varchar,
  	"published_date" timestamp(3) with time zone,
  	"author_id" uuid,
  	"cover_image_id" uuid,
  	"seo_og_image_id" uuid,
  	"seo_canonical_u_r_l" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"legacy_path" varchar,
  	"published_at" timestamp(3) with time zone,
  	"published_by_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "cms"."enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "cms"."posts_locales" (
  	"title" varchar,
  	"excerpt" varchar,
  	"body" jsonb,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "cms"."posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" uuid
  );
  
  CREATE TABLE "cms"."_post_translations_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"locale" "cms"."enum__post_translations_v_locale",
  	"state" "cms"."enum__post_translations_v_state",
  	"source_locale" "cms"."source_locale",
  	"source_version" varchar,
  	"content_version" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "cms"."_posts_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_tenant_id" uuid,
  	"version_slug" varchar,
  	"version_published_date" timestamp(3) with time zone,
  	"version_author_id" uuid,
  	"version_cover_image_id" uuid,
  	"version_seo_og_image_id" uuid,
  	"version_seo_canonical_u_r_l" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_legacy_path" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_published_by_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "cms"."enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "cms"."enum__posts_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "cms"."_posts_v_locales" (
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_body" jsonb,
  	"version_seo_meta_title" varchar,
  	"version_seo_meta_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "cms"."_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" uuid
  );
  
  CREATE TABLE "cms"."authors" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"avatar_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."authors_locales" (
  	"role" varchar,
  	"bio" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  CREATE TABLE "cms"."categories" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."categories_locales" (
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "cms"."_locales" NOT NULL,
  	"_parent_id" uuid NOT NULL
  );
  
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "posts_id" uuid;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "authors_id" uuid;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD COLUMN "categories_id" uuid;
  ALTER TABLE "cms"."post_translations" ADD CONSTRAINT "post_translations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "cms"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts" ADD CONSTRAINT "posts_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."posts_rels" ADD CONSTRAINT "posts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_post_translations_v" ADD CONSTRAINT "_post_translations_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_author_id_authors_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "cms"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v" ADD CONSTRAINT "_posts_v_version_published_by_id_users_id_fk" FOREIGN KEY ("version_published_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_locales" ADD CONSTRAINT "_posts_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."authors" ADD CONSTRAINT "authors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."authors" ADD CONSTRAINT "authors_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "cms"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."authors_locales" ADD CONSTRAINT "authors_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."categories" ADD CONSTRAINT "categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."categories_locales" ADD CONSTRAINT "categories_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "post_translations_order_idx" ON "cms"."post_translations" USING btree ("_order");
  CREATE INDEX "post_translations_parent_id_idx" ON "cms"."post_translations" USING btree ("_parent_id");
  CREATE INDEX "posts_tenant_idx" ON "cms"."posts" USING btree ("tenant_id");
  CREATE INDEX "posts_slug_idx" ON "cms"."posts" USING btree ("slug");
  CREATE INDEX "posts_published_date_idx" ON "cms"."posts" USING btree ("published_date");
  CREATE INDEX "posts_author_idx" ON "cms"."posts" USING btree ("author_id");
  CREATE INDEX "posts_cover_image_idx" ON "cms"."posts" USING btree ("cover_image_id");
  CREATE INDEX "posts_seo_seo_og_image_idx" ON "cms"."posts" USING btree ("seo_og_image_id");
  CREATE INDEX "posts_legacy_path_idx" ON "cms"."posts" USING btree ("legacy_path");
  CREATE INDEX "posts_published_by_idx" ON "cms"."posts" USING btree ("published_by_id");
  CREATE INDEX "posts_updated_at_idx" ON "cms"."posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "cms"."posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "cms"."posts" USING btree ("_status");
  CREATE UNIQUE INDEX "tenant_slug_1_idx" ON "cms"."posts" USING btree ("tenant_id","slug");
  CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "cms"."posts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "posts_rels_order_idx" ON "cms"."posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "cms"."posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "cms"."posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_categories_id_idx" ON "cms"."posts_rels" USING btree ("categories_id");
  CREATE INDEX "_post_translations_v_order_idx" ON "cms"."_post_translations_v" USING btree ("_order");
  CREATE INDEX "_post_translations_v_parent_id_idx" ON "cms"."_post_translations_v" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_parent_idx" ON "cms"."_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_tenant_idx" ON "cms"."_posts_v" USING btree ("version_tenant_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "cms"."_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_published_date_idx" ON "cms"."_posts_v" USING btree ("version_published_date");
  CREATE INDEX "_posts_v_version_version_author_idx" ON "cms"."_posts_v" USING btree ("version_author_id");
  CREATE INDEX "_posts_v_version_version_cover_image_idx" ON "cms"."_posts_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_posts_v_version_seo_version_seo_og_image_idx" ON "cms"."_posts_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_posts_v_version_version_legacy_path_idx" ON "cms"."_posts_v" USING btree ("version_legacy_path");
  CREATE INDEX "_posts_v_version_version_published_by_idx" ON "cms"."_posts_v" USING btree ("version_published_by_id");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "cms"."_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "cms"."_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "cms"."_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "cms"."_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "cms"."_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_snapshot_idx" ON "cms"."_posts_v" USING btree ("snapshot");
  CREATE INDEX "_posts_v_published_locale_idx" ON "cms"."_posts_v" USING btree ("published_locale");
  CREATE INDEX "_posts_v_latest_idx" ON "cms"."_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "cms"."_posts_v" USING btree ("autosave");
  CREATE INDEX "version_tenant_version_slug_1_idx" ON "cms"."_posts_v" USING btree ("version_tenant_id","version_slug");
  CREATE UNIQUE INDEX "_posts_v_locales_locale_parent_id_unique" ON "cms"."_posts_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_posts_v_rels_order_idx" ON "cms"."_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "cms"."_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "cms"."_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_categories_id_idx" ON "cms"."_posts_v_rels" USING btree ("categories_id");
  CREATE INDEX "authors_tenant_idx" ON "cms"."authors" USING btree ("tenant_id");
  CREATE INDEX "authors_slug_idx" ON "cms"."authors" USING btree ("slug");
  CREATE INDEX "authors_avatar_idx" ON "cms"."authors" USING btree ("avatar_id");
  CREATE INDEX "authors_updated_at_idx" ON "cms"."authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "cms"."authors" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_slug_2_idx" ON "cms"."authors" USING btree ("tenant_id","slug");
  CREATE UNIQUE INDEX "authors_locales_locale_parent_id_unique" ON "cms"."authors_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "categories_tenant_idx" ON "cms"."categories" USING btree ("tenant_id");
  CREATE INDEX "categories_slug_idx" ON "cms"."categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "cms"."categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "cms"."categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "tenant_slug_3_idx" ON "cms"."categories" USING btree ("tenant_id","slug");
  CREATE UNIQUE INDEX "categories_locales_locale_parent_id_unique" ON "cms"."categories_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "cms"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "cms"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "cms"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "tenant_slug_idx" ON "cms"."changelog" USING btree ("tenant_id","slug");
  DROP INDEX IF EXISTS "cms"."changelog_tenant_slug_unique";
  CREATE INDEX "version_tenant_version_slug_idx" ON "cms"."_changelog_v" USING btree ("version_tenant_id","version_slug");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("authors_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("categories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cms"."post_translations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."posts_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_post_translations_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_posts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_posts_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."_posts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."authors_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "cms"."categories_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."post_translations" CASCADE;
  DROP TABLE "cms"."posts" CASCADE;
  DROP TABLE "cms"."posts_locales" CASCADE;
  DROP TABLE "cms"."posts_rels" CASCADE;
  DROP TABLE "cms"."_post_translations_v" CASCADE;
  DROP TABLE "cms"."_posts_v" CASCADE;
  DROP TABLE "cms"."_posts_v_locales" CASCADE;
  DROP TABLE "cms"."_posts_v_rels" CASCADE;
  DROP TABLE "cms"."authors" CASCADE;
  DROP TABLE "cms"."authors_locales" CASCADE;
  DROP TABLE "cms"."categories" CASCADE;
  DROP TABLE "cms"."categories_locales" CASCADE;
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_posts_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_authors_fk";
  
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";
  
  ALTER TABLE "cms"."media_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."changelog_features_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."changelog_improvements_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."changelog_fixes_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."changelog_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."_changelog_v_version_features_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."_changelog_v_version_improvements_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."_changelog_v_version_fixes_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."_changelog_v_locales" ALTER COLUMN "_locale" SET DATA TYPE text;
  DROP TYPE "cms"."_locales";
  CREATE TYPE "cms"."_locales" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."media_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."changelog_features_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."changelog_improvements_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."changelog_fixes_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."changelog_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."_changelog_v_version_features_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."_changelog_v_version_improvements_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."_changelog_v_version_fixes_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."_changelog_v_locales" ALTER COLUMN "_locale" SET DATA TYPE "cms"."_locales" USING "_locale"::"cms"."_locales";
  ALTER TABLE "cms"."tenants_supported_locales" ALTER COLUMN "locale" SET DATA TYPE text;
  DROP TYPE "cms"."enum_tenants_supported_locales_locale";
  CREATE TYPE "cms"."enum_tenants_supported_locales_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."tenants_supported_locales" ALTER COLUMN "locale" SET DATA TYPE "cms"."enum_tenants_supported_locales_locale" USING "locale"::"cms"."enum_tenants_supported_locales_locale";
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DEFAULT 'en'::text;
  DROP TYPE "cms"."enum_tenants_default_locale";
  CREATE TYPE "cms"."enum_tenants_default_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DEFAULT 'en'::"cms"."enum_tenants_default_locale";
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DATA TYPE "cms"."enum_tenants_default_locale" USING "default_locale"::"cms"."enum_tenants_default_locale";
  ALTER TABLE "cms"."cl_translations" ALTER COLUMN "locale" SET DATA TYPE text;
  DROP TYPE "cms"."enum_cl_translations_locale";
  CREATE TYPE "cms"."enum_cl_translations_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."cl_translations" ALTER COLUMN "locale" SET DATA TYPE "cms"."enum_cl_translations_locale" USING "locale"::"cms"."enum_cl_translations_locale";
  ALTER TABLE "cms"."cl_translations" ALTER COLUMN "source_locale" SET DATA TYPE text;
  ALTER TABLE "cms"."_cl_translations_v" ALTER COLUMN "source_locale" SET DATA TYPE text;
  DROP TYPE "cms"."source_locale";
  CREATE TYPE "cms"."source_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."cl_translations" ALTER COLUMN "source_locale" SET DATA TYPE "cms"."source_locale" USING "source_locale"::"cms"."source_locale";
  ALTER TABLE "cms"."_cl_translations_v" ALTER COLUMN "source_locale" SET DATA TYPE "cms"."source_locale" USING "source_locale"::"cms"."source_locale";
  ALTER TABLE "cms"."_cl_translations_v" ALTER COLUMN "locale" SET DATA TYPE text;
  DROP TYPE "cms"."enum__cl_translations_v_locale";
  CREATE TYPE "cms"."enum__cl_translations_v_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."_cl_translations_v" ALTER COLUMN "locale" SET DATA TYPE "cms"."enum__cl_translations_v_locale" USING "locale"::"cms"."enum__cl_translations_v_locale";
  ALTER TABLE "cms"."_changelog_v" ALTER COLUMN "published_locale" SET DATA TYPE text;
  DROP TYPE "cms"."enum__changelog_v_published_locale";
  CREATE TYPE "cms"."enum__changelog_v_published_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  ALTER TABLE "cms"."_changelog_v" ALTER COLUMN "published_locale" SET DATA TYPE "cms"."enum__changelog_v_published_locale" USING "published_locale"::"cms"."enum__changelog_v_published_locale";
  DROP INDEX "cms"."tenant_slug_idx";
  CREATE UNIQUE INDEX IF NOT EXISTS "changelog_tenant_slug_unique" ON "cms"."changelog" USING btree ("tenant_id","slug");
  DROP INDEX "cms"."version_tenant_version_slug_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_posts_id_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_authors_id_idx";
  DROP INDEX "cms"."payload_locked_documents_rels_categories_id_idx";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "posts_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "authors_id";
  ALTER TABLE "cms"."payload_locked_documents_rels" DROP COLUMN "categories_id";
  DROP TYPE "cms"."enum_post_translations_locale";
  DROP TYPE "cms"."enum_post_translations_state";
  DROP TYPE "cms"."enum_posts_status";
  DROP TYPE "cms"."enum__post_translations_v_locale";
  DROP TYPE "cms"."enum__post_translations_v_state";
  DROP TYPE "cms"."enum__posts_v_version_status";
  DROP TYPE "cms"."enum__posts_v_published_locale";`)
}
