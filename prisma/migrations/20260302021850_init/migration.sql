-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "WishlistStatus" AS ENUM ('WANT', 'WATCHING', 'PURCHASED', 'DROPPED');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('MANUAL', 'APPLE_HEALTH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_dimensions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_id" TEXT,
    "category_id" TEXT,
    "model_code" TEXT,
    "spec_json" JSONB,
    "cover_image_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_ratings" (
    "id" TEXT NOT NULL,
    "gear_item_id" TEXT NOT NULL,
    "power" DECIMAL(4,2) NOT NULL,
    "control" DECIMAL(4,2) NOT NULL,
    "durability" DECIMAL(4,2) NOT NULL,
    "comfort" DECIMAL(4,2) NOT NULL,
    "value" DECIMAL(4,2) NOT NULL,
    "overall" DECIMAL(4,2) NOT NULL,
    "review_text" TEXT,
    "rated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_reviews" (
    "id" TEXT NOT NULL,
    "gear_item_id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "score_text" TEXT,
    "summary_text" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_records" (
    "id" TEXT NOT NULL,
    "gear_item_id" TEXT,
    "brand_id" TEXT,
    "category_id" TEXT,
    "item_name_snapshot" TEXT NOT NULL,
    "unit_price_cny" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price_cny" DECIMAL(12,2) NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT,
    "is_second_hand" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "receipt_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_id" TEXT,
    "category_id" TEXT,
    "target_price_cny" DECIMAL(12,2),
    "current_seen_price_cny" DECIMAL(12,2),
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "WishlistStatus" NOT NULL DEFAULT 'WANT',
    "source_url" TEXT,
    "image_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_transitions" (
    "id" TEXT NOT NULL,
    "wishlist_item_id" TEXT NOT NULL,
    "from_status" "WishlistStatus" NOT NULL,
    "to_status" "WishlistStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_purchase_id" TEXT,

    CONSTRAINT "wishlist_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_sessions" (
    "id" TEXT NOT NULL,
    "activity_date" TIMESTAMP(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "source" "ActivitySource" NOT NULL DEFAULT 'MANUAL',
    "external_id" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "brands_normalized_name_key" ON "brands"("normalized_name");

-- CreateIndex
CREATE INDEX "brands_name_idx" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "rating_dimensions_key_key" ON "rating_dimensions"("key");

-- CreateIndex
CREATE INDEX "rating_dimensions_sort_order_idx" ON "rating_dimensions"("sort_order");

-- CreateIndex
CREATE INDEX "gear_items_name_idx" ON "gear_items"("name");

-- CreateIndex
CREATE INDEX "gear_items_brand_id_idx" ON "gear_items"("brand_id");

-- CreateIndex
CREATE INDEX "gear_items_category_id_idx" ON "gear_items"("category_id");

-- CreateIndex
CREATE INDEX "gear_ratings_gear_item_id_rated_at_idx" ON "gear_ratings"("gear_item_id", "rated_at");

-- CreateIndex
CREATE INDEX "external_reviews_gear_item_id_idx" ON "external_reviews"("gear_item_id");

-- CreateIndex
CREATE INDEX "purchase_records_purchase_date_idx" ON "purchase_records"("purchase_date");

-- CreateIndex
CREATE INDEX "purchase_records_brand_id_idx" ON "purchase_records"("brand_id");

-- CreateIndex
CREATE INDEX "purchase_records_category_id_idx" ON "purchase_records"("category_id");

-- CreateIndex
CREATE INDEX "wishlist_items_status_idx" ON "wishlist_items"("status");

-- CreateIndex
CREATE INDEX "wishlist_items_priority_idx" ON "wishlist_items"("priority");

-- CreateIndex
CREATE INDEX "wishlist_transitions_wishlist_item_id_changed_at_idx" ON "wishlist_transitions"("wishlist_item_id", "changed_at");

-- CreateIndex
CREATE INDEX "activity_sessions_activity_date_idx" ON "activity_sessions"("activity_date");

-- AddForeignKey
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_items" ADD CONSTRAINT "gear_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_ratings" ADD CONSTRAINT "gear_ratings_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_reviews" ADD CONSTRAINT "external_reviews_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_records" ADD CONSTRAINT "purchase_records_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_transitions" ADD CONSTRAINT "wishlist_transitions_wishlist_item_id_fkey" FOREIGN KEY ("wishlist_item_id") REFERENCES "wishlist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_transitions" ADD CONSTRAINT "wishlist_transitions_linked_purchase_id_fkey" FOREIGN KEY ("linked_purchase_id") REFERENCES "purchase_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
