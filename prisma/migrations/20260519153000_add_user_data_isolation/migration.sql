ALTER TABLE "gear_items" ADD COLUMN "user_id" TEXT;
ALTER TABLE "purchase_records" ADD COLUMN "user_id" TEXT;
ALTER TABLE "purchase_events" ADD COLUMN "user_id" TEXT;
ALTER TABLE "wishlist_items" ADD COLUMN "user_id" TEXT;
ALTER TABLE "activity_sessions" ADD COLUMN "user_id" TEXT;

UPDATE "gear_items"
SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
WHERE "user_id" IS NULL;

UPDATE "purchase_records"
SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
WHERE "user_id" IS NULL;

UPDATE "purchase_events"
SET "user_id" = COALESCE(
  (SELECT pr."user_id" FROM "purchase_records" pr WHERE pr."id" = "purchase_events"."purchase_record_id"),
  (SELECT gi."user_id" FROM "gear_items" gi WHERE gi."id" = "purchase_events"."gear_item_id"),
  (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
)
WHERE "user_id" IS NULL;

UPDATE "wishlist_items"
SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
WHERE "user_id" IS NULL;

UPDATE "activity_sessions"
SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
WHERE "user_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "user_id" FROM "gear_items"
      UNION ALL SELECT "user_id" FROM "purchase_records"
      UNION ALL SELECT "user_id" FROM "purchase_events"
      UNION ALL SELECT "user_id" FROM "wishlist_items"
      UNION ALL SELECT "user_id" FROM "activity_sessions"
    ) owned_rows
    WHERE "user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot add user data isolation: owned rows exist but no user is available for backfill.';
  END IF;
END $$;

ALTER TABLE "gear_items" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "purchase_records" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "purchase_events" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "wishlist_items" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "activity_sessions" ALTER COLUMN "user_id" SET NOT NULL;

ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_events" ADD CONSTRAINT "purchase_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "gear_items_user_id_idx" ON "gear_items"("user_id");
CREATE INDEX "purchase_records_user_id_idx" ON "purchase_records"("user_id");
CREATE INDEX "purchase_events_user_id_idx" ON "purchase_events"("user_id");
CREATE INDEX "wishlist_items_user_id_idx" ON "wishlist_items"("user_id");
CREATE INDEX "activity_sessions_user_id_idx" ON "activity_sessions"("user_id");

ALTER TABLE "analytics_snapshots" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

UPDATE "analytics_snapshots"
SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1)
WHERE "user_id" IS NULL;

DELETE FROM "analytics_snapshots" WHERE "user_id" IS NULL;

ALTER TABLE "analytics_snapshots" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "analytics_snapshots" DROP CONSTRAINT IF EXISTS "analytics_snapshots_pkey";
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("user_id", "range_key");
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
