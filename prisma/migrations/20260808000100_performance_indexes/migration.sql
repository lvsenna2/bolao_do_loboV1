CREATE INDEX "league_members_user_status_idx"
ON "league_members"("user_id", "status");

CREATE INDEX "rounds_league_status_starts_at_idx"
ON "rounds"("league_id", "status", "starts_at");

CREATE INDEX "matches_status_kickoff_idx"
ON "matches"("status", "kickoff");

CREATE INDEX "guesses_user_league_deleted_at_idx"
ON "guesses"("user_id", "league_id", "deleted_at");

CREATE INDEX "scores_user_league_idx"
ON "scores"("user_id", "league_id");
