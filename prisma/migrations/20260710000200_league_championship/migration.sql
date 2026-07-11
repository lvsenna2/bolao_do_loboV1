-- Add nullable first so existing databases can be backfilled safely.
ALTER TABLE "leagues" ADD COLUMN "championship_id" UUID;

-- Prefer the championship already used by rounds linked to each league.
UPDATE "leagues" AS "league"
SET "championship_id" = "source"."championship_id"
FROM (
    SELECT DISTINCT ON ("rounds"."league_id")
        "rounds"."league_id",
        "seasons"."championship_id"
    FROM "rounds"
    INNER JOIN "seasons" ON "seasons"."id" = "rounds"."season_id"
    WHERE "rounds"."league_id" IS NOT NULL
    ORDER BY "rounds"."league_id", "rounds"."created_at" ASC
) AS "source"
WHERE "league"."id" = "source"."league_id"
  AND "league"."championship_id" IS NULL;

-- Compatibility fallback for old leagues that have no rounds yet.
INSERT INTO "championships" (
    "id",
    "name",
    "country",
    "logo",
    "provider",
    "api_id",
    "status",
    "description",
    "primary_color",
    "created_at",
    "updated_at",
    "deleted_at"
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Campeonato legado',
    'Brasil',
    NULL,
    'system',
    NULL,
    'ACTIVE',
    'Criado automaticamente para manter compatibilidade com ligas antigas sem campeonato.',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    NULL
WHERE EXISTS (SELECT 1 FROM "leagues" WHERE "championship_id" IS NULL)
  AND NOT EXISTS (
      SELECT 1
      FROM "championships"
      WHERE "id" = '00000000-0000-0000-0000-000000000001'::uuid
  );

UPDATE "leagues"
SET "championship_id" = '00000000-0000-0000-0000-000000000001'::uuid
WHERE "championship_id" IS NULL;

ALTER TABLE "leagues" ALTER COLUMN "championship_id" SET NOT NULL;

CREATE INDEX "leagues_championship_id_idx" ON "leagues"("championship_id");

ALTER TABLE "leagues"
ADD CONSTRAINT "leagues_championship_id_fkey"
FOREIGN KEY ("championship_id") REFERENCES "championships"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
