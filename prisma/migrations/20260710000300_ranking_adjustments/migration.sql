-- Manual point adjustments made by admins for league rankings.
CREATE TABLE "ranking_adjustments" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "points_delta" INTEGER NOT NULL,
    "reason" VARCHAR(240) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ranking_adjustments_league_id_user_id_idx" ON "ranking_adjustments"("league_id", "user_id");
CREATE INDEX "ranking_adjustments_admin_id_idx" ON "ranking_adjustments"("admin_id");
CREATE INDEX "ranking_adjustments_created_at_idx" ON "ranking_adjustments"("created_at");

ALTER TABLE "ranking_adjustments"
ADD CONSTRAINT "ranking_adjustments_league_id_fkey"
FOREIGN KEY ("league_id") REFERENCES "leagues"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ranking_adjustments"
ADD CONSTRAINT "ranking_adjustments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ranking_adjustments"
ADD CONSTRAINT "ranking_adjustments_admin_id_fkey"
FOREIGN KEY ("admin_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
