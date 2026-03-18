CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pegboard_layouts" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

ALTER TABLE "user_preferences"
ADD CONSTRAINT "user_preferences_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
