-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('IN_USE', 'USED_UP', 'WORN_OUT', 'STORED');

-- AlterTable
ALTER TABLE "purchase_records" ADD COLUMN     "item_status" "ItemStatus" NOT NULL DEFAULT 'IN_USE';

-- CreateIndex
CREATE INDEX "purchase_records_item_status_idx" ON "purchase_records"("item_status");
