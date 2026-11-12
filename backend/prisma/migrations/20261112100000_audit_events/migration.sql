CREATE TABLE "audit_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
