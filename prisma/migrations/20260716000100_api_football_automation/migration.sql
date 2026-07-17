CREATE TYPE "LineupPlayerRole" AS ENUM ('STARTER', 'SUBSTITUTE');

ALTER TYPE "MatchStatus" ADD VALUE 'SUSPENDED';

ALTER TABLE "championships"
  ADD COLUMN "coverage" JSONB,
  ADD COLUMN "coverage_synced_at" TIMESTAMP(3);

ALTER TABLE "seasons"
  ADD COLUMN "coverage" JSONB,
  ADD COLUMN "coverage_synced_at" TIMESTAMP(3);

ALTER TABLE "matches"
  ADD COLUMN "api_status" VARCHAR(20),
  ADD COLUMN "status_long" VARCHAR(80),
  ADD COLUMN "elapsed" INTEGER,
  ADD COLUMN "extra_time" INTEGER,
  ADD COLUMN "halftime_home" INTEGER,
  ADD COLUMN "halftime_away" INTEGER,
  ADD COLUMN "second_half_home" INTEGER,
  ADD COLUMN "second_half_away" INTEGER,
  ADD COLUMN "extra_time_home" INTEGER,
  ADD COLUMN "extra_time_away" INTEGER,
  ADD COLUMN "penalty_home" INTEGER,
  ADD COLUMN "penalty_away" INTEGER,
  ADD COLUMN "football_venue_id" UUID,
  ADD COLUMN "last_synced_at" TIMESTAMP(3),
  ADD COLUMN "live_synced_at" TIMESTAMP(3),
  ADD COLUMN "lineups_synced_at" TIMESTAMP(3),
  ADD COLUMN "events_synced_at" TIMESTAMP(3),
  ADD COLUMN "statistics_synced_at" TIMESTAMP(3),
  ADD COLUMN "players_synced_at" TIMESTAMP(3),
  ADD COLUMN "history_synced_at" TIMESTAMP(3),
  ADD COLUMN "fully_synced_at" TIMESTAMP(3);

CREATE TABLE "football_venues" (
  "id" UUID NOT NULL,
  "external_id" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "address" VARCHAR(200),
  "city" VARCHAR(100),
  "country" VARCHAR(80),
  "capacity" INTEGER,
  "surface" VARCHAR(80),
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "football_venues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "football_players" (
  "id" UUID NOT NULL,
  "external_id" INTEGER NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "first_name" VARCHAR(100),
  "last_name" VARCHAR(100),
  "position" VARCHAR(40),
  "photo_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "football_players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_lineups" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "formation" VARCHAR(30),
  "coach_external_id" INTEGER,
  "coach_name" VARCHAR(140),
  "coach_photo_url" TEXT,
  "complete" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_lineups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_lineup_players" (
  "id" UUID NOT NULL,
  "lineup_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "role" "LineupPlayerRole" NOT NULL,
  "shirt_number" INTEGER,
  "position" VARCHAR(20),
  "grid" VARCHAR(20),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_lineup_players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_events" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "external_key" VARCHAR(180) NOT NULL,
  "elapsed" INTEGER NOT NULL,
  "extra" INTEGER,
  "team_id" UUID,
  "player_id" UUID,
  "assist_player_id" UUID,
  "type" VARCHAR(60) NOT NULL,
  "detail" VARCHAR(120),
  "comments" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_statistics" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "period" VARCHAR(20) NOT NULL DEFAULT 'FULL_TIME',
  "type" VARCHAR(100) NOT NULL,
  "value" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_statistics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_player_statistics" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "team_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "statistics" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_player_statistics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match_insights" (
  "id" UUID NOT NULL,
  "match_id" UUID NOT NULL,
  "home_recent" JSONB,
  "away_recent" JSONB,
  "home_season_stats" JSONB,
  "away_season_stats" JSONB,
  "head_to_head" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "football_api_request_logs" (
  "id" UUID NOT NULL,
  "endpoint" VARCHAR(100) NOT NULL,
  "params" JSONB,
  "status_code" INTEGER,
  "ok" BOOLEAN NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "daily_limit" INTEGER,
  "daily_remaining" INTEGER,
  "minute_limit" INTEGER,
  "minute_remaining" INTEGER,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "football_api_request_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "football_sync_states" (
  "key" VARCHAR(80) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'IDLE',
  "last_started_at" TIMESTAMP(3),
  "last_finished_at" TIMESTAMP(3),
  "last_success_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "last_error" TEXT,
  "calls_used" INTEGER NOT NULL DEFAULT 0,
  "daily_remaining" INTEGER,
  "tracked_matches" INTEGER NOT NULL DEFAULT 0,
  "live_matches" INTEGER NOT NULL DEFAULT 0,
  "pending_lineups" INTEGER NOT NULL DEFAULT 0,
  "pending_final_details" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "football_sync_states_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "football_sync_locks" (
  "key" VARCHAR(80) NOT NULL,
  "owner_token" VARCHAR(80) NOT NULL,
  "locked_until" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "football_sync_locks_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "football_automation_logs" (
  "id" UUID NOT NULL,
  "run_id" VARCHAR(80) NOT NULL,
  "trigger" VARCHAR(30) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "calls_used" INTEGER NOT NULL DEFAULT 0,
  "tracked_matches" INTEGER NOT NULL DEFAULT 0,
  "live_matches" INTEGER NOT NULL DEFAULT 0,
  "pending_lineups" INTEGER NOT NULL DEFAULT 0,
  "pending_final_details" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "error" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "football_automation_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "football_venues_external_id_key" ON "football_venues"("external_id");
CREATE INDEX "football_venues_city_idx" ON "football_venues"("city");
CREATE UNIQUE INDEX "football_players_external_id_key" ON "football_players"("external_id");
CREATE INDEX "football_players_name_idx" ON "football_players"("name");
CREATE UNIQUE INDEX "match_lineups_match_id_team_id_key" ON "match_lineups"("match_id", "team_id");
CREATE INDEX "match_lineups_team_id_idx" ON "match_lineups"("team_id");
CREATE UNIQUE INDEX "match_lineup_players_lineup_id_player_id_key" ON "match_lineup_players"("lineup_id", "player_id");
CREATE INDEX "match_lineup_players_player_id_idx" ON "match_lineup_players"("player_id");
CREATE UNIQUE INDEX "match_events_external_key_key" ON "match_events"("external_key");
CREATE INDEX "match_events_match_id_elapsed_idx" ON "match_events"("match_id", "elapsed");
CREATE INDEX "match_events_team_id_idx" ON "match_events"("team_id");
CREATE UNIQUE INDEX "match_statistics_match_id_team_id_period_type_key" ON "match_statistics"("match_id", "team_id", "period", "type");
CREATE INDEX "match_statistics_team_id_idx" ON "match_statistics"("team_id");
CREATE UNIQUE INDEX "match_player_statistics_match_id_team_id_player_id_key" ON "match_player_statistics"("match_id", "team_id", "player_id");
CREATE INDEX "match_player_statistics_player_id_idx" ON "match_player_statistics"("player_id");
CREATE UNIQUE INDEX "match_insights_match_id_key" ON "match_insights"("match_id");
CREATE INDEX "football_api_request_logs_created_at_idx" ON "football_api_request_logs"("created_at");
CREATE INDEX "football_api_request_logs_endpoint_created_at_idx" ON "football_api_request_logs"("endpoint", "created_at");
CREATE INDEX "football_api_request_logs_ok_created_at_idx" ON "football_api_request_logs"("ok", "created_at");
CREATE INDEX "football_sync_locks_locked_until_idx" ON "football_sync_locks"("locked_until");
CREATE UNIQUE INDEX "football_automation_logs_run_id_key" ON "football_automation_logs"("run_id");
CREATE INDEX "football_automation_logs_status_created_at_idx" ON "football_automation_logs"("status", "created_at");
CREATE INDEX "football_automation_logs_created_at_idx" ON "football_automation_logs"("created_at");
CREATE INDEX "matches_api_status_idx" ON "matches"("api_status");
CREATE INDEX "matches_last_synced_at_idx" ON "matches"("last_synced_at");
CREATE INDEX "matches_fully_synced_at_idx" ON "matches"("fully_synced_at");
CREATE INDEX "matches_football_venue_id_idx" ON "matches"("football_venue_id");

ALTER TABLE "matches" ADD CONSTRAINT "matches_football_venue_id_fkey" FOREIGN KEY ("football_venue_id") REFERENCES "football_venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_lineup_players" ADD CONSTRAINT "match_lineup_players_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "match_lineups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_lineup_players" ADD CONSTRAINT "match_lineup_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "football_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "football_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_assist_player_id_fkey" FOREIGN KEY ("assist_player_id") REFERENCES "football_players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_statistics" ADD CONSTRAINT "match_statistics_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_player_statistics" ADD CONSTRAINT "match_player_statistics_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_player_statistics" ADD CONSTRAINT "match_player_statistics_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_player_statistics" ADD CONSTRAINT "match_player_statistics_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "football_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "match_insights" ADD CONSTRAINT "match_insights_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
