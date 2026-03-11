CREATE TYPE "PurchaseEventType" AS ENUM ('PURCHASED', 'CONSUMED', 'DAMAGED', 'STATUS_CHANGED');

CREATE TABLE "purchase_events" (
  "id" TEXT NOT NULL,
  "purchase_record_id" TEXT,
  "gear_item_id" TEXT,
  "event_type" "PurchaseEventType" NOT NULL,
  "quantity_delta" INTEGER NOT NULL DEFAULT 0,
  "from_status" "ItemStatus",
  "to_status" "ItemStatus",
  "event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "purchase_events_purchase_record_id_event_at_idx" ON "purchase_events"("purchase_record_id", "event_at");
CREATE INDEX "purchase_events_gear_item_id_event_at_idx" ON "purchase_events"("gear_item_id", "event_at");
CREATE INDEX "purchase_events_event_type_event_at_idx" ON "purchase_events"("event_type", "event_at");

ALTER TABLE "purchase_events"
ADD CONSTRAINT "purchase_events_purchase_record_id_fkey"
FOREIGN KEY ("purchase_record_id") REFERENCES "purchase_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_events"
ADD CONSTRAINT "purchase_events_gear_item_id_fkey"
FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
