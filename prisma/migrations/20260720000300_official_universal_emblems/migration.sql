-- Add the official catalog identifier and global visibility without changing existing awards.
ALTER TABLE "league_badge_awards"
  ADD COLUMN "emblem_key" VARCHAR(40),
  ADD COLUMN "is_universal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "league_badge_awards_user_id_is_universal_idx"
  ON "league_badge_awards"("user_id", "is_universal");
CREATE INDEX "league_badge_awards_emblem_key_idx"
  ON "league_badge_awards"("emblem_key");
