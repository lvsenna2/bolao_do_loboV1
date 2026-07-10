ALTER TABLE "matches" ADD COLUMN "api_id" INTEGER;

CREATE UNIQUE INDEX "matches_api_id_key" ON "matches"("api_id");

CREATE TABLE "football_sync_logs" (
  "id" UUID NOT NULL,
  "competition_key" VARCHAR(80) NOT NULL,
  "league_id" INTEGER NOT NULL,
  "season" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "message" TEXT,
  "calls_used" INTEGER NOT NULL DEFAULT 0,
  "teams_imported" INTEGER NOT NULL DEFAULT 0,
  "rounds_imported" INTEGER NOT NULL DEFAULT 0,
  "matches_imported" INTEGER NOT NULL DEFAULT 0,
  "standings_imported" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "football_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "football_sync_logs_competition_key_season_idx" ON "football_sync_logs"("competition_key", "season");
CREATE INDEX "football_sync_logs_status_idx" ON "football_sync_logs"("status");
CREATE INDEX "football_sync_logs_finished_at_idx" ON "football_sync_logs"("finished_at");

CREATE TABLE "competition_standings" (
  "id" UUID NOT NULL,
  "season_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "group_name" VARCHAR(120) NOT NULL DEFAULT 'Geral',
  "rank" INTEGER NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "played" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "goals_for" INTEGER NOT NULL DEFAULT 0,
  "goals_against" INTEGER NOT NULL DEFAULT 0,
  "goal_diff" INTEGER NOT NULL DEFAULT 0,
  "form" VARCHAR(30),
  "status" VARCHAR(80),
  "description" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "competition_standings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "competition_standings_season_id_team_id_group_name_key" ON "competition_standings"("season_id", "team_id", "group_name");
CREATE INDEX "competition_standings_season_id_rank_idx" ON "competition_standings"("season_id", "rank");
CREATE INDEX "competition_standings_team_id_idx" ON "competition_standings"("team_id");

ALTER TABLE "competition_standings" ADD CONSTRAINT "competition_standings_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "competition_standings" ADD CONSTRAINT "competition_standings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
