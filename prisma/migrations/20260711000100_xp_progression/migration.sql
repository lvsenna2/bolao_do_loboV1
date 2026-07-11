-- AlterTable
ALTER TABLE "leagues" ADD COLUMN "xp_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "badges" ADD COLUMN "key" VARCHAR(80);

-- CreateTable
CREATE TABLE "xp_levels" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "medal" VARCHAR(20) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "min_xp" INTEGER NOT NULL,
    "max_xp" INTEGER,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "benefits" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xp_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_type_configs" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xp_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "admin_id" UUID,
    "guess_id" UUID,
    "match_id" UUID,
    "league_id" UUID,
    "season_id" UUID,
    "type" VARCHAR(80) NOT NULL,
    "amount" INTEGER NOT NULL,
    "unique_key" VARCHAR(180) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "current_count" INTEGER NOT NULL DEFAULT 0,
    "longest_count" INTEGER NOT NULL DEFAULT 0,
    "last_participation_date" TIMESTAMP(3),
    "awarded_milestones" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" TEXT NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "target" INTEGER NOT NULL,
    "xp_reward" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mission_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "mission_id" UUID NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "reward_claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mission_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badges_key_key" ON "badges"("key");

-- CreateIndex
CREATE UNIQUE INDEX "xp_levels_key_key" ON "xp_levels"("key");

-- CreateIndex
CREATE INDEX "xp_levels_active_min_xp_idx" ON "xp_levels"("active", "min_xp");

-- CreateIndex
CREATE INDEX "xp_levels_sort_order_idx" ON "xp_levels"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "xp_type_configs_key_key" ON "xp_type_configs"("key");

-- CreateIndex
CREATE INDEX "xp_type_configs_active_idx" ON "xp_type_configs"("active");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_unique_key_key" ON "xp_events"("unique_key");

-- CreateIndex
CREATE INDEX "xp_events_user_id_created_at_idx" ON "xp_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "xp_events_league_id_created_at_idx" ON "xp_events"("league_id", "created_at");

-- CreateIndex
CREATE INDEX "xp_events_season_id_created_at_idx" ON "xp_events"("season_id", "created_at");

-- CreateIndex
CREATE INDEX "xp_events_type_idx" ON "xp_events"("type");

-- CreateIndex
CREATE UNIQUE INDEX "user_streaks_user_id_key" ON "user_streaks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "missions_key_key" ON "missions"("key");

-- CreateIndex
CREATE INDEX "missions_active_starts_at_ends_at_idx" ON "missions"("active", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_mission_progress_user_id_mission_id_key" ON "user_mission_progress"("user_id", "mission_id");

-- CreateIndex
CREATE INDEX "user_mission_progress_mission_id_idx" ON "user_mission_progress"("mission_id");

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_guess_id_fkey" FOREIGN KEY ("guess_id") REFERENCES "guesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mission_progress" ADD CONSTRAINT "user_mission_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mission_progress" ADD CONSTRAINT "user_mission_progress_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed initial configurable XP levels.
INSERT INTO "xp_levels" ("id", "key", "name", "medal", "color", "min_xp", "max_xp", "discount_percent", "benefits", "active", "sort_order", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000101', 'iniciante', 'Iniciante', '🥉', '#94A3B8', 0, 249, 0, '{"benefits":["Entrada no sistema de progressao"]}', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000102', 'bronze', 'Bronze', '🥉', '#B45309', 250, 749, 0, '{"benefits":["Patente Bronze no perfil"]}', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000103', 'prata', 'Prata', '🥈', '#CBD5E1', 750, 1999, 0, '{"benefits":["Patente Prata no perfil"]}', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000104', 'ouro', 'Ouro', '🥇', '#FBBF24', 2000, 4999, 5, '{"benefits":["5% de desconto em ligas pagas"]}', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000105', 'platina', 'Platina', '💎', '#38BDF8', 5000, 9999, 10, '{"benefits":["10% de desconto em ligas pagas"]}', true, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000106', 'diamante', 'Diamante', '🔷', '#2563EB', 10000, 19999, 15, '{"benefits":["15% de desconto em ligas pagas"]}', true, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000107', 'mestre', 'Mestre', '👑', '#A855F7', 20000, 39999, 20, '{"benefits":["20% de desconto em ligas pagas"]}', true, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000108', 'grao-mestre', 'Grão-Mestre', '⭐', '#EC4899', 40000, 79999, 25, '{"benefits":["25% de desconto em ligas pagas"]}', true, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000109', 'lendario', 'Lendário', '🌟', '#F97316', 80000, 149999, 30, '{"benefits":["30% de desconto em ligas pagas"]}', true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000110', 'lobo-supremo', 'Lobo Supremo', '🐺', '#FACC15', 150000, NULL, 40, '{"benefits":["40% de desconto em ligas pagas"]}', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "medal" = EXCLUDED."medal",
  "color" = EXCLUDED."color",
  "min_xp" = EXCLUDED."min_xp",
  "max_xp" = EXCLUDED."max_xp",
  "discount_percent" = EXCLUDED."discount_percent",
  "benefits" = EXCLUDED."benefits",
  "active" = EXCLUDED."active",
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = CURRENT_TIMESTAMP;

-- Seed initial XP source configuration.
INSERT INTO "xp_type_configs" ("id", "key", "label", "description", "amount", "active", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000201', 'GUESS_SUBMITTED', 'Palpite enviado', 'XP concedido imediatamente ao salvar o primeiro palpite da partida.', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000202', 'RESULT_HIT', 'Resultado correto', 'XP concedido quando o palpite acerta vencedor ou empate.', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000203', 'EXACT_SCORE', 'Placar exato', 'XP bonus concedido quando o palpite acerta o placar exato.', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000204', 'STREAK_3_DAYS', 'Sequencia de 3 dias', 'Bonus por tres dias consecutivos de participacao.', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000205', 'STREAK_7_DAYS', 'Sequencia de 7 dias', 'Bonus por sete dias consecutivos de participacao.', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000206', 'STREAK_15_DAYS', 'Sequencia de 15 dias', 'Bonus por quinze dias consecutivos de participacao.', 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000207', 'MISSION_REWARD', 'Recompensa de missao', 'XP bonus concedido ao completar uma missao.', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000208', 'ADMIN_ADJUSTMENT', 'Ajuste administrativo', 'XP concedido ou removido manualmente pelo administrador.', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "amount" = EXCLUDED."amount",
  "active" = EXCLUDED."active",
  "updated_at" = CURRENT_TIMESTAMP;

-- Seed expandable achievement definitions on the existing badge table.
INSERT INTO "badges" ("id", "key", "title", "description", "image", "rarity", "created_at")
VALUES
  ('00000000-0000-4000-8000-000000000301', 'FIRST_GUESS', 'Primeiro palpite', 'Enviou o primeiro palpite no Bolao do Lobo.', NULL, 'COMMON', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000302', 'FIRST_RESULT_HIT', 'Primeiro resultado correto', 'Acertou vencedor ou empate pela primeira vez.', NULL, 'COMMON', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000303', 'FIRST_EXACT_SCORE', 'Primeiro placar exato', 'Acertou um placar exato pela primeira vez.', NULL, 'RARE', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000304', 'TEN_GUESSES', '10 palpites realizados', 'Chegou a dez palpites enviados.', NULL, 'COMMON', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000305', 'FIFTY_GUESSES', '50 palpites realizados', 'Chegou a cinquenta palpites enviados.', NULL, 'RARE', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000306', 'ONE_HUNDRED_GUESSES', '100 palpites realizados', 'Chegou a cem palpites enviados.', NULL, 'EPIC', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000307', 'FIVE_EXACT_SCORES', '5 placares exatos', 'Acertou cinco placares exatos.', NULL, 'RARE', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000308', 'TEN_EXACT_SCORES', '10 placares exatos', 'Acertou dez placares exatos.', NULL, 'EPIC', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000309', 'TEN_LEAGUES', 'Entrou em 10 ligas', 'Participou de dez ligas ativas.', NULL, 'EPIC', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000310', 'STREAK_PARTICIPANT', 'Sequencia de participacao', 'Manteve participacao em dias consecutivos.', NULL, 'RARE', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "image" = EXCLUDED."image",
  "rarity" = EXCLUDED."rarity";

-- Seed default weekly mission templates for the current long-running window.
INSERT INTO "missions" ("id", "key", "title", "description", "type", "target", "xp_reward", "starts_at", "ends_at", "active", "created_at", "updated_at")
VALUES
  ('00000000-0000-4000-8000-000000000401', 'WEEKLY_10_GUESSES', 'Fazer 10 palpites', 'Envie 10 palpites durante a semana.', 'GUESSES_SUBMITTED', 10, 100, TIMESTAMP '2026-01-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000402', 'WEEKLY_3_RESULTS', 'Acertar 3 resultados', 'Acerte 3 vencedores ou empates durante a semana.', 'RESULT_HITS', 3, 120, TIMESTAMP '2026-01-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000403', 'WEEKLY_1_EXACT', 'Acertar 1 placar exato', 'Acerte um placar exato durante a semana.', 'EXACT_SCORES', 1, 150, TIMESTAMP '2026-01-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000404', 'WEEKLY_2_LEAGUES', 'Participar de 2 ligas', 'Esteja ativo em duas ligas durante a semana.', 'ACTIVE_LEAGUES', 2, 80, TIMESTAMP '2026-01-01 00:00:00', TIMESTAMP '2026-12-31 23:59:59', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "title" = EXCLUDED."title",
  "description" = EXCLUDED."description",
  "type" = EXCLUDED."type",
  "target" = EXCLUDED."target",
  "xp_reward" = EXCLUDED."xp_reward",
  "active" = EXCLUDED."active",
  "updated_at" = CURRENT_TIMESTAMP;

-- Configurable minimum value after discounts on paid leagues.
INSERT INTO "settings" ("id", "key", "value", "created_at", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000501', 'paidLeagueMinimumEntryFee', '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
  "value" = COALESCE("settings"."value", EXCLUDED."value"),
  "updated_at" = CURRENT_TIMESTAMP;
