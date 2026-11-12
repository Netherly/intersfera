-- Поля карточки по реальным входящим и исходящим письмам.
ALTER TABLE "appeals" ADD COLUMN "sender_type" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appeals" ADD COLUMN "object_address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appeals" ADD COLUMN "correspondent_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appeals" ADD COLUMN "correspondent_date" DATE;
ALTER TABLE "appeals" ADD COLUMN "reply_deadline" DATE;
ALTER TABLE "appeals" ADD COLUMN "reply_email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appeals" ADD COLUMN "outgoing_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appeals" ADD COLUMN "outgoing_date" DATE;

CREATE INDEX "appeals_sender_type_idx" ON "appeals"("sender_type");

-- Базы для подготовки ответа.
CREATE TABLE "materials" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "citation" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "materials_kind_title_key" ON "materials"("kind", "title");
CREATE INDEX "materials_kind_idx" ON "materials"("kind");
