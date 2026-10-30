ALTER TABLE "appeals" ADD COLUMN "reply_checked_text" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appeals" ADD COLUMN "reply_checked_at" TIMESTAMP(3);
ALTER TABLE "appeals" ADD COLUMN "reply_checked_by_id" INTEGER;

ALTER TABLE "appeals" ADD CONSTRAINT "appeals_reply_checked_by_id_fkey"
  FOREIGN KEY ("reply_checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
