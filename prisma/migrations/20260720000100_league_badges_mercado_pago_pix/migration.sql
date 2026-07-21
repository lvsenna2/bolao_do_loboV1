-- Additive migration: preserves every existing user, guess, ranking and payment.
CREATE TYPE "LeagueBadgeCategory" AS ENUM (
  'CHAMPION',
  'RUNNER_UP',
  'MOST_HITS',
  'MOST_EXACT_SCORES',
  'ROUND_STAR',
  'CONSISTENCY',
  'PARTICIPATION',
  'FAIR_PLAY',
  'CUSTOM'
);

ALTER TABLE "payments"
  ADD COLUMN "checkout_key" VARCHAR(180),
  ADD COLUMN "qr_code_base64" TEXT,
  ADD COLUMN "ticket_url" TEXT,
  ADD COLUMN "provider_status" VARCHAR(80),
  ADD COLUMN "provider_status_detail" VARCHAR(120),
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "last_webhook_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_checkout_key_key" ON "payments"("checkout_key");

CREATE TABLE "league_badge_awards" (
  "id" UUID NOT NULL,
  "league_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "badge_id" UUID NOT NULL,
  "awarded_by_id" UUID,
  "category" "LeagueBadgeCategory" NOT NULL,
  "reason" VARCHAR(240) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "league_badge_awards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "league_badge_awards_league_id_user_id_badge_id_key"
  ON "league_badge_awards"("league_id", "user_id", "badge_id");
CREATE INDEX "league_badge_awards_league_id_category_idx"
  ON "league_badge_awards"("league_id", "category");
CREATE INDEX "league_badge_awards_user_id_created_at_idx"
  ON "league_badge_awards"("user_id", "created_at");
CREATE INDEX "league_badge_awards_badge_id_idx"
  ON "league_badge_awards"("badge_id");
CREATE INDEX "league_badge_awards_awarded_by_id_idx"
  ON "league_badge_awards"("awarded_by_id");

ALTER TABLE "league_badge_awards"
  ADD CONSTRAINT "league_badge_awards_league_id_fkey"
  FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "league_badge_awards"
  ADD CONSTRAINT "league_badge_awards_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "league_badge_awards"
  ADD CONSTRAINT "league_badge_awards_badge_id_fkey"
  FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "league_badge_awards"
  ADD CONSTRAINT "league_badge_awards_awarded_by_id_fkey"
  FOREIGN KEY ("awarded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "badges" ("id", "key", "title", "description", "rarity", "created_at")
VALUES
  ('00000000-0000-4000-8000-000000000601', 'LEAGUE_CHAMPION', 'Campeao da Liga', 'Conquistou o primeiro lugar em uma liga.', 'LEGENDARY', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000602', 'LEAGUE_RUNNER_UP', 'Vice-campeao', 'Terminou uma liga na segunda colocacao.', 'EPIC', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000603', 'MOST_HITS', 'Mira Certeira', 'Foi quem mais acertou resultados em uma liga.', 'EPIC', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000604', 'MOST_EXACT_SCORES', 'Mestre do Placar', 'Foi quem mais acertou placares exatos em uma liga.', 'LEGENDARY', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000605', 'ROUND_STAR', 'Destaque da Rodada', 'Teve o melhor desempenho em uma rodada.', 'RARE', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000606', 'CONSISTENCY', 'Constancia de Ouro', 'Manteve desempenho consistente durante a competicao.', 'EPIC', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000607', 'PARTICIPATION', 'Presenca de Matilha', 'Participou ativamente dos palpites da liga.', 'RARE', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000608', 'FAIR_PLAY', 'Fair Play', 'Recebeu reconhecimento por respeito e jogo limpo.', 'RARE', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
