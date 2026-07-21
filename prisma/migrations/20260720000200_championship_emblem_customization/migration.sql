-- Preserve existing awards while associating them directly with their championship.
ALTER TABLE "league_badge_awards"
  ADD COLUMN "championship_id" UUID,
  ADD COLUMN "custom_title" VARCHAR(100),
  ADD COLUMN "emblem_color" VARCHAR(7) NOT NULL DEFAULT '#F4B41A',
  ADD COLUMN "emblem_style" VARCHAR(24) NOT NULL DEFAULT 'MEDAL',
  ADD COLUMN "emblem_icon" VARCHAR(24) NOT NULL DEFAULT 'TROPHY';

UPDATE "league_badge_awards" AS award
SET "championship_id" = league."championship_id"
FROM "leagues" AS league
WHERE award."league_id" = league."id";

ALTER TABLE "league_badge_awards"
  ALTER COLUMN "championship_id" SET NOT NULL;

CREATE INDEX "league_badge_awards_championship_id_user_id_idx"
  ON "league_badge_awards"("championship_id", "user_id");
CREATE INDEX "league_badge_awards_championship_id_category_idx"
  ON "league_badge_awards"("championship_id", "category");

ALTER TABLE "league_badge_awards"
  ADD CONSTRAINT "league_badge_awards_championship_id_fkey"
  FOREIGN KEY ("championship_id") REFERENCES "championships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
