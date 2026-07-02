-- DropIndex
DROP INDEX "guesses_user_id_match_id_key";

-- DropIndex
DROP INDEX "rounds_season_id_number_key";

-- AlterTable
ALTER TABLE "guesses" ADD COLUMN     "league_id" UUID;

-- AlterTable
ALTER TABLE "rounds" ADD COLUMN     "league_id" UUID;

-- CreateIndex
CREATE INDEX "guesses_league_id_idx" ON "guesses"("league_id");

-- CreateIndex
CREATE UNIQUE INDEX "guesses_user_id_league_id_match_id_key" ON "guesses"("user_id", "league_id", "match_id");

-- CreateIndex
CREATE INDEX "rounds_league_id_idx" ON "rounds"("league_id");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_league_id_season_id_number_key" ON "rounds"("league_id", "season_id", "number");

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
