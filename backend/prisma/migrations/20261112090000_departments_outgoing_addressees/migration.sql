ALTER TABLE "users" ADD COLUMN "departments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "appeals" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'incoming';

CREATE INDEX "appeals_direction_idx" ON "appeals"("direction");

CREATE TABLE "addressees" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addressees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "addressees_name_key" ON "addressees"("name");

UPDATE "users"
SET "departments" = ARRAY['appeals']::TEXT[]
WHERE "role" = 'user' AND cardinality("departments") = 0;
