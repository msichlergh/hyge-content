import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "cms"."_locales" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TYPE "cms"."enum_tenants_supported_locales_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TYPE "cms"."enum_tenants_default_locale" AS ENUM('en', 'de', 'es', 'fr', 'ar');
  CREATE TABLE "cms"."media_locales" (
    "alt_text" varchar NOT NULL,
    "caption" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "cms"."_locales" NOT NULL,
    "_parent_id" uuid NOT NULL
  );

  ALTER TABLE "cms"."tenants_supported_locales" ALTER COLUMN "locale" SET DATA TYPE "cms"."enum_tenants_supported_locales_locale" USING "locale"::"cms"."enum_tenants_supported_locales_locale";
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DEFAULT 'en'::"cms"."enum_tenants_default_locale";
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DATA TYPE "cms"."enum_tenants_default_locale" USING "default_locale"::"cms"."enum_tenants_default_locale";
  ALTER TABLE "cms"."media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "cms"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "cms"."media_locales" USING btree ("_locale","_parent_id");
  INSERT INTO "cms"."media_locales" ("alt_text", "caption", "_locale", "_parent_id")
  SELECT "alt_text", "caption", 'en'::"cms"."_locales", "id" FROM "cms"."media";
  ALTER TABLE "cms"."media" DROP COLUMN "alt_text";
  ALTER TABLE "cms"."media" DROP COLUMN "caption";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "cms"."media" ADD COLUMN "alt_text" varchar;
  ALTER TABLE "cms"."media" ADD COLUMN "caption" varchar;
  UPDATE "cms"."media"
  SET "alt_text" = "localized"."alt_text", "caption" = "localized"."caption"
  FROM (
    SELECT DISTINCT ON ("_parent_id") "_parent_id", "alt_text", "caption"
    FROM "cms"."media_locales"
    ORDER BY "_parent_id", ("_locale" = 'en'::"cms"."_locales") DESC
  ) AS "localized"
  WHERE "localized"."_parent_id" = "media"."id";
  ALTER TABLE "cms"."media" ALTER COLUMN "alt_text" SET NOT NULL;
   ALTER TABLE "cms"."media_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "cms"."media_locales" CASCADE;
  ALTER TABLE "cms"."tenants_supported_locales" ALTER COLUMN "locale" SET DATA TYPE varchar;
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DATA TYPE varchar;
  ALTER TABLE "cms"."tenants" ALTER COLUMN "default_locale" SET DEFAULT 'en';
  DROP TYPE "cms"."_locales";
  DROP TYPE "cms"."enum_tenants_supported_locales_locale";
  DROP TYPE "cms"."enum_tenants_default_locale";`)
}
