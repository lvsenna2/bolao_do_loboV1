CREATE TYPE "ElectionRoundStatus" AS ENUM (
  'DRAFT',
  'REGISTRATION_OPEN',
  'CLOSED',
  'RESULT_PENDING',
  'FINALIZED',
  'CANCELLED'
);

CREATE TYPE "ElectionTurn" AS ENUM ('FIRST', 'SECOND');

CREATE TABLE "election_rounds" (
  "id" UUID NOT NULL,
  "created_by_id" UUID,
  "name" VARCHAR(140) NOT NULL,
  "description" TEXT,
  "rules" TEXT,
  "banner_url" TEXT,
  "entry_fee" DECIMAL(10,2) NOT NULL DEFAULT 10,
  "registration_opens_at" TIMESTAMP(3) NOT NULL,
  "registration_closes_at" TIMESTAMP(3) NOT NULL,
  "status" "ElectionRoundStatus" NOT NULL DEFAULT 'DRAFT',
  "final_prize" DECIMAL(10,2),
  "no_winner_destination" TEXT,
  "finalized_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "election_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_candidates" (
  "id" UUID NOT NULL,
  "round_id" UUID NOT NULL,
  "name" VARCHAR(140) NOT NULL,
  "party" VARCHAR(40) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "election_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_entries" (
  "id" UUID NOT NULL,
  "round_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payment_gateway" "PaymentGateway" NOT NULL DEFAULT 'MERCADO_PAGO',
  "transaction_id" TEXT,
  "checkout_key" VARCHAR(180),
  "qr_code" TEXT,
  "qr_code_base64" TEXT,
  "ticket_url" TEXT,
  "provider_status" VARCHAR(80),
  "provider_status_detail" VARCHAR(120),
  "payment_expires_at" TIMESTAMP(3),
  "last_webhook_at" TIMESTAMP(3),
  "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "refunded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "election_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_predictions" (
  "id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "winner_candidate_id" UUID NOT NULL,
  "runner_up_candidate_id" UUID NOT NULL,
  "turn" "ElectionTurn" NOT NULL,
  "winner_range" VARCHAR(40) NOT NULL,
  "margin_range" VARCHAR(40) NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "election_predictions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_results" (
  "id" UUID NOT NULL,
  "round_id" UUID NOT NULL,
  "winner_candidate_id" UUID NOT NULL,
  "runner_up_candidate_id" UUID NOT NULL,
  "entered_by_id" UUID NOT NULL,
  "turn" "ElectionTurn" NOT NULL,
  "winner_percent" DECIMAL(5,2) NOT NULL,
  "runner_up_percent" DECIMAL(5,2) NOT NULL,
  "winner_range" VARCHAR(40) NOT NULL,
  "margin_range" VARCHAR(40) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "election_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_winners" (
  "id" UUID NOT NULL,
  "round_id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "share_percent" DECIMAL(5,2) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "election_winners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "election_audit_logs" (
  "id" UUID NOT NULL,
  "round_id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "entity" VARCHAR(100) NOT NULL,
  "entity_id" VARCHAR(80),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "election_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "election_rounds_status_registration_closes_at_idx"
  ON "election_rounds"("status", "registration_closes_at");
CREATE INDEX "election_rounds_created_by_id_idx" ON "election_rounds"("created_by_id");
CREATE UNIQUE INDEX "election_candidates_round_id_name_key"
  ON "election_candidates"("round_id", "name");
CREATE INDEX "election_candidates_round_id_active_sort_order_idx"
  ON "election_candidates"("round_id", "active", "sort_order");
CREATE UNIQUE INDEX "election_entries_transaction_id_key" ON "election_entries"("transaction_id");
CREATE UNIQUE INDEX "election_entries_checkout_key_key" ON "election_entries"("checkout_key");
CREATE UNIQUE INDEX "election_entries_round_id_user_id_key"
  ON "election_entries"("round_id", "user_id");
CREATE INDEX "election_entries_user_id_idx" ON "election_entries"("user_id");
CREATE INDEX "election_entries_round_id_payment_status_idx"
  ON "election_entries"("round_id", "payment_status");
CREATE UNIQUE INDEX "election_predictions_entry_id_key" ON "election_predictions"("entry_id");
CREATE INDEX "election_predictions_winner_candidate_id_idx"
  ON "election_predictions"("winner_candidate_id");
CREATE INDEX "election_predictions_runner_up_candidate_id_idx"
  ON "election_predictions"("runner_up_candidate_id");
CREATE INDEX "election_predictions_submitted_at_idx" ON "election_predictions"("submitted_at");
CREATE UNIQUE INDEX "election_results_round_id_key" ON "election_results"("round_id");
CREATE INDEX "election_results_entered_by_id_idx" ON "election_results"("entered_by_id");
CREATE UNIQUE INDEX "election_winners_entry_id_key" ON "election_winners"("entry_id");
CREATE INDEX "election_winners_round_id_idx" ON "election_winners"("round_id");
CREATE INDEX "election_audit_logs_round_id_created_at_idx"
  ON "election_audit_logs"("round_id", "created_at");
CREATE INDEX "election_audit_logs_actor_id_idx" ON "election_audit_logs"("actor_id");

ALTER TABLE "election_rounds"
  ADD CONSTRAINT "election_rounds_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "election_candidates"
  ADD CONSTRAINT "election_candidates_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "election_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_entries"
  ADD CONSTRAINT "election_entries_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "election_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_entries"
  ADD CONSTRAINT "election_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "election_predictions"
  ADD CONSTRAINT "election_predictions_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "election_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_predictions"
  ADD CONSTRAINT "election_predictions_winner_candidate_id_fkey"
  FOREIGN KEY ("winner_candidate_id") REFERENCES "election_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "election_predictions"
  ADD CONSTRAINT "election_predictions_runner_up_candidate_id_fkey"
  FOREIGN KEY ("runner_up_candidate_id") REFERENCES "election_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "election_results"
  ADD CONSTRAINT "election_results_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "election_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_results"
  ADD CONSTRAINT "election_results_winner_candidate_id_fkey"
  FOREIGN KEY ("winner_candidate_id") REFERENCES "election_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "election_results"
  ADD CONSTRAINT "election_results_runner_up_candidate_id_fkey"
  FOREIGN KEY ("runner_up_candidate_id") REFERENCES "election_candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "election_results"
  ADD CONSTRAINT "election_results_entered_by_id_fkey"
  FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "election_winners"
  ADD CONSTRAINT "election_winners_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "election_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_winners"
  ADD CONSTRAINT "election_winners_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "election_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_audit_logs"
  ADD CONSTRAINT "election_audit_logs_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "election_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "election_audit_logs"
  ADD CONSTRAINT "election_audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "election_rounds" (
  "id",
  "name",
  "description",
  "rules",
  "entry_fee",
  "registration_opens_at",
  "registration_closes_at",
  "status",
  "updated_at"
) VALUES (
  '20260000-0000-4000-8000-000000000001',
  'Eleições Presidenciais 2026',
  'Evento temporário e independente para palpites sobre a eleição presidencial de 2026.',
  'Cada participante envia um único palpite com cinco respostas obrigatórias. Vence somente quem acertar os cinco mercados. Havendo mais de um vencedor, a premiação será dividida igualmente.',
  10.00,
  CURRENT_TIMESTAMP,
  '2026-10-04 11:00:00',
  'REGISTRATION_OPEN',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "election_candidates" (
  "id",
  "round_id",
  "name",
  "party",
  "sort_order",
  "updated_at"
) VALUES
  ('20260000-0000-4000-8000-000000000101', '20260000-0000-4000-8000-000000000001', 'Luiz Inácio Lula da Silva', 'PT', 1, CURRENT_TIMESTAMP),
  ('20260000-0000-4000-8000-000000000102', '20260000-0000-4000-8000-000000000001', 'Flávio Bolsonaro', 'PL', 2, CURRENT_TIMESTAMP),
  ('20260000-0000-4000-8000-000000000103', '20260000-0000-4000-8000-000000000001', 'Romeu Zema', 'Novo', 3, CURRENT_TIMESTAMP),
  ('20260000-0000-4000-8000-000000000104', '20260000-0000-4000-8000-000000000001', 'Aldo Rebelo', 'DC', 4, CURRENT_TIMESTAMP),
  ('20260000-0000-4000-8000-000000000105', '20260000-0000-4000-8000-000000000001', 'Rui Costa Pimenta', 'PCO', 5, CURRENT_TIMESTAMP),
  ('20260000-0000-4000-8000-000000000106', '20260000-0000-4000-8000-000000000001', 'Edmilson Costa', 'PCB', 6, CURRENT_TIMESTAMP),
  ('20260000-0000-4000-8000-000000000107', '20260000-0000-4000-8000-000000000001', 'Renan Santos', 'Missão', 7, CURRENT_TIMESTAMP)
ON CONFLICT ("round_id", "name") DO NOTHING;
