-- Add XP notifications without changing or deleting existing notification data.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'XP';

ALTER TABLE "notifications"
  ADD COLUMN "message" TEXT,
  ADD COLUMN "xp_received" INTEGER,
  ADD COLUMN "level_after" INTEGER,
  ADD COLUMN "is_read" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "related_entity_id" VARCHAR(180),
  ADD COLUMN "unique_key" VARCHAR(220),
  ADD COLUMN "icon" VARCHAR(40);

UPDATE "notifications"
SET
  "message" = COALESCE("message", "body"),
  "is_read" = CASE WHEN "read_at" IS NULL THEN false ELSE true END
WHERE "message" IS NULL OR "is_read" = false;

CREATE UNIQUE INDEX "notifications_unique_key_key" ON "notifications"("unique_key");
CREATE INDEX "notifications_user_type_created_at_idx" ON "notifications"("user_id", "type", "created_at");
CREATE INDEX "notifications_user_is_read_idx" ON "notifications"("user_id", "is_read");

INSERT INTO "xp_type_configs" ("id", "key", "label", "description", "amount", "active", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000209', 'DAILY_LOGIN', 'Login diario', 'XP bonus concedido no primeiro login do dia.', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "amount" = EXCLUDED."amount",
  "active" = EXCLUDED."active",
  "updated_at" = CURRENT_TIMESTAMP;
