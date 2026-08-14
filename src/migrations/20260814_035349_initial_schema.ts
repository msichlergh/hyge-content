import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."enum_tenants_status" AS ENUM('active', 'suspended', 'archived');
  CREATE TYPE "cms"."enum_users_memberships_sections" AS ENUM('marketing', 'changelog');
  CREATE TYPE "cms"."enum_users_memberships_capabilities" AS ENUM('read', 'draft', 'publish', 'notify', 'manage-members');
  CREATE TYPE "cms"."enum_users_global_role" AS ENUM('platform-admin', 'member');
  CREATE TYPE "cms"."enum_users_status" AS ENUM('invited', 'active', 'suspended');
  CREATE TYPE "cms"."enum_media_usage" AS ENUM('blog', 'event', 'changelog', 'general');
  CREATE TYPE "cms"."enum_media_status" AS ENUM('active', 'archived');
  CREATE TABLE "cms"."tenants_domains" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"domain" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."tenants_supported_locales" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"locale" varchar NOT NULL
  );
  
  CREATE TABLE "cms"."tenants" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "cms"."enum_tenants_status" DEFAULT 'active' NOT NULL,
  	"website_u_r_l" varchar NOT NULL,
  	"timezone" varchar DEFAULT 'UTC' NOT NULL,
  	"default_locale" varchar DEFAULT 'en' NOT NULL,
  	"brand_name" varchar NOT NULL,
  	"email_from_name" varchar NOT NULL,
  	"email_from_address" varchar,
  	"media_path_prefix" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."users_memberships_sections" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "cms"."enum_users_memberships_sections",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "cms"."users_memberships_capabilities" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "cms"."enum_users_memberships_capabilities",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "cms"."users_memberships" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tenant_id" uuid NOT NULL
  );
  
  CREATE TABLE "cms"."users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "cms"."users" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"global_role" "cms"."enum_users_global_role" DEFAULT 'member' NOT NULL,
  	"status" "cms"."enum_users_status" DEFAULT 'invited' NOT NULL,
  	"last_login_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "cms"."media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"tenant_id" uuid NOT NULL,
  	"alt_text" varchar NOT NULL,
  	"caption" varchar,
  	"credit" varchar,
  	"usage" "cms"."enum_media_usage" DEFAULT 'general' NOT NULL,
  	"status" "cms"."enum_media_status" DEFAULT 'active' NOT NULL,
  	"uploaded_by_id" uuid,
  	"prefix" varchar DEFAULT '',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "cms"."payload_kv" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tenants_id" uuid,
  	"users_id" uuid,
  	"media_id" uuid
  );
  
  CREATE TABLE "cms"."payload_preferences" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cms"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  CREATE TABLE "cms"."payload_migrations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "cms"."tenants_domains" ADD CONSTRAINT "tenants_domains_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."tenants_supported_locales" ADD CONSTRAINT "tenants_supported_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users_memberships_sections" ADD CONSTRAINT "users_memberships_sections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."users_memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users_memberships_capabilities" ADD CONSTRAINT "users_memberships_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."users_memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users_memberships" ADD CONSTRAINT "users_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."users_memberships" ADD CONSTRAINT "users_memberships_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."media" ADD CONSTRAINT "media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "cms"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."media" ADD CONSTRAINT "media_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "cms"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "cms"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "cms"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cms"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "cms"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tenants_domains_order_idx" ON "cms"."tenants_domains" USING btree ("_order");
  CREATE INDEX "tenants_domains_parent_id_idx" ON "cms"."tenants_domains" USING btree ("_parent_id");
  CREATE INDEX "tenants_supported_locales_order_idx" ON "cms"."tenants_supported_locales" USING btree ("_order");
  CREATE INDEX "tenants_supported_locales_parent_id_idx" ON "cms"."tenants_supported_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "tenants_slug_idx" ON "cms"."tenants" USING btree ("slug");
  CREATE INDEX "tenants_status_idx" ON "cms"."tenants" USING btree ("status");
  CREATE UNIQUE INDEX "tenants_media_path_prefix_idx" ON "cms"."tenants" USING btree ("media_path_prefix");
  CREATE INDEX "tenants_updated_at_idx" ON "cms"."tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "cms"."tenants" USING btree ("created_at");
  CREATE INDEX "users_memberships_sections_order_idx" ON "cms"."users_memberships_sections" USING btree ("order");
  CREATE INDEX "users_memberships_sections_parent_idx" ON "cms"."users_memberships_sections" USING btree ("parent_id");
  CREATE INDEX "users_memberships_capabilities_order_idx" ON "cms"."users_memberships_capabilities" USING btree ("order");
  CREATE INDEX "users_memberships_capabilities_parent_idx" ON "cms"."users_memberships_capabilities" USING btree ("parent_id");
  CREATE INDEX "users_memberships_order_idx" ON "cms"."users_memberships" USING btree ("_order");
  CREATE INDEX "users_memberships_parent_id_idx" ON "cms"."users_memberships" USING btree ("_parent_id");
  CREATE INDEX "users_memberships_tenant_idx" ON "cms"."users_memberships" USING btree ("tenant_id");
  CREATE INDEX "users_sessions_order_idx" ON "cms"."users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "cms"."users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "cms"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "cms"."users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "cms"."users" USING btree ("email");
  CREATE INDEX "media_tenant_idx" ON "cms"."media" USING btree ("tenant_id");
  CREATE INDEX "media_status_idx" ON "cms"."media" USING btree ("status");
  CREATE INDEX "media_uploaded_by_idx" ON "cms"."media" USING btree ("uploaded_by_id");
  CREATE INDEX "media_updated_at_idx" ON "cms"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "cms"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "cms"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "cms"."media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "cms"."media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "cms"."media" USING btree ("sizes_hero_filename");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "cms"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "cms"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "cms"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "cms"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "cms"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "cms"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "cms"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "cms"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_preferences_key_idx" ON "cms"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "cms"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "cms"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "cms"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "cms"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "cms"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "cms"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "cms"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "cms"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cms"."tenants_domains" CASCADE;
  DROP TABLE "cms"."tenants_supported_locales" CASCADE;
  DROP TABLE "cms"."tenants" CASCADE;
  DROP TABLE "cms"."users_memberships_sections" CASCADE;
  DROP TABLE "cms"."users_memberships_capabilities" CASCADE;
  DROP TABLE "cms"."users_memberships" CASCADE;
  DROP TABLE "cms"."users_sessions" CASCADE;
  DROP TABLE "cms"."users" CASCADE;
  DROP TABLE "cms"."media" CASCADE;
  DROP TABLE "cms"."payload_kv" CASCADE;
  DROP TABLE "cms"."payload_locked_documents" CASCADE;
  DROP TABLE "cms"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "cms"."payload_preferences" CASCADE;
  DROP TABLE "cms"."payload_preferences_rels" CASCADE;
  DROP TABLE "cms"."payload_migrations" CASCADE;
  DROP TYPE "cms"."enum_tenants_status";
  DROP TYPE "cms"."enum_users_memberships_sections";
  DROP TYPE "cms"."enum_users_memberships_capabilities";
  DROP TYPE "cms"."enum_users_global_role";
  DROP TYPE "cms"."enum_users_status";
  DROP TYPE "cms"."enum_media_usage";
  DROP TYPE "cms"."enum_media_status";`)
}
