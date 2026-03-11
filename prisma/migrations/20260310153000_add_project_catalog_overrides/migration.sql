CREATE TABLE "project_catalog_overrides" (
  "id" TEXT NOT NULL,
  "entry_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand_name" TEXT NOT NULL,
  "model_code" TEXT,
  "category_name" TEXT NOT NULL,
  "suggested_unit_price_cny" DECIMAL(12,2),
  "popularity" INTEGER NOT NULL DEFAULT 50,
  "image_url" TEXT,
  "tags_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_catalog_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_catalog_overrides_entry_key_key" ON "project_catalog_overrides"("entry_key");
CREATE INDEX "project_catalog_overrides_category_name_popularity_idx" ON "project_catalog_overrides"("category_name", "popularity");
