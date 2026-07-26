ALTER TYPE "NotificationType" ADD VALUE 'SPECIAL_ROUND';

CREATE TYPE "SpecialRoundStatus" AS ENUM (
  'DRAFT',
  'REGISTRATION_OPEN',
  'PREDICTIONS_OPEN',
  'PREDICTIONS_CLOSED',
  'AWAITING_RESULT',
  'CALCULATING',
  'FINALIZED',
  'CANCELLED'
);

CREATE TYPE "SpecialRoundMarketKind" AS ENUM (
  'EXACT_SCORE',
  'MATCH_RESULT',
  'TOTAL_GOALS',
  'TOTAL_CORNERS',
  'BOTH_TEAMS_SCORE',
  'TOTAL_CARDS',
  'FIRST_TEAM_TO_SCORE',
  'GOAL_SCORER',
  'CUSTOM'
);

CREATE TYPE "SpecialRoundAnswerType" AS ENUM (
  'SINGLE_CHOICE',
  'INTEGER',
  'SCORE',
  'BOOLEAN',
  'SHORT_TEXT',
  'OPTION_LIST'
);

CREATE TYPE "SpecialRoundPrizeMode" AS ENUM ('FIXED', 'POOL');
CREATE TYPE "SpecialRoundPrizeStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED');

CREATE TABLE "special_rounds" (
  "id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "match_id" UUID,
  "name" VARCHAR(140) NOT NULL,
  "description" TEXT,
  "rules" TEXT,
  "home_team_name" VARCHAR(120) NOT NULL,
  "away_team_name" VARCHAR(120) NOT NULL,
  "home_team_logo" TEXT,
  "away_team_logo" TEXT,
  "match_starts_at" TIMESTAMP(3) NOT NULL,
  "registration_opens_at" TIMESTAMP(3) NOT NULL,
  "registration_closes_at" TIMESTAMP(3) NOT NULL,
  "predictions_open_at" TIMESTAMP(3) NOT NULL,
  "predictions_close_at" TIMESTAMP(3) NOT NULL,
  "entry_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "prize_mode" "SpecialRoundPrizeMode" NOT NULL DEFAULT 'POOL',
  "fixed_prize" DECIMAL(10,2),
  "prize_pool_percent" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "admin_fee_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "winner_count" INTEGER NOT NULL DEFAULT 1,
  "prize_distribution" JSONB NOT NULL,
  "final_prize" DECIMAL(10,2),
  "status" "SpecialRoundStatus" NOT NULL DEFAULT 'DRAFT',
  "ranking_published_at" TIMESTAMP(3),
  "finalized_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_entries" (
  "id" UUID NOT NULL,
  "special_round_id" UUID NOT NULL,
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
  "blocked_at" TIMESTAMP(3),
  "blocked_reason" VARCHAR(240),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_round_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_markets" (
  "id" UUID NOT NULL,
  "special_round_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "kind" "SpecialRoundMarketKind" NOT NULL,
  "answer_type" "SpecialRoundAnswerType" NOT NULL,
  "line" DECIMAL(8,2),
  "points" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_round_markets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_market_options" (
  "id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "value" VARCHAR(120) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "special_round_market_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_predictions" (
  "id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "answer" JSONB NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "admin_edit_at" TIMESTAMP(3),
  CONSTRAINT "special_round_predictions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_results" (
  "id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "entered_by_id" UUID NOT NULL,
  "answer" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_round_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_scores" (
  "id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "market_id" UUID NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "hit" BOOLEAN NOT NULL DEFAULT false,
  "max_points_hit" BOOLEAN NOT NULL DEFAULT false,
  "exact_score_hit" BOOLEAN NOT NULL DEFAULT false,
  "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "special_round_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_standings" (
  "id" UUID NOT NULL,
  "special_round_id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "position" INTEGER,
  "total_points" INTEGER NOT NULL DEFAULT 0,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "max_points_hits" INTEGER NOT NULL DEFAULT 0,
  "exact_score_hits" INTEGER NOT NULL DEFAULT 0,
  "first_submitted_at" TIMESTAMP(3),
  "manual_tie_break" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_round_standings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_prizes" (
  "id" UUID NOT NULL,
  "special_round_id" UUID NOT NULL,
  "entry_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "SpecialRoundPrizeStatus" NOT NULL DEFAULT 'PENDING',
  "confirmed_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "special_round_prizes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "special_round_audit_logs" (
  "id" UUID NOT NULL,
  "special_round_id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "entity" VARCHAR(100) NOT NULL,
  "entity_id" VARCHAR(80),
  "old_value" JSONB,
  "new_value" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "special_round_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "special_round_entries_transaction_id_key" ON "special_round_entries"("transaction_id");
CREATE UNIQUE INDEX "special_round_entries_checkout_key_key" ON "special_round_entries"("checkout_key");
CREATE UNIQUE INDEX "special_round_entries_special_round_id_user_id_key" ON "special_round_entries"("special_round_id", "user_id");
CREATE UNIQUE INDEX "special_round_market_options_market_id_value_key" ON "special_round_market_options"("market_id", "value");
CREATE UNIQUE INDEX "special_round_predictions_entry_id_market_id_key" ON "special_round_predictions"("entry_id", "market_id");
CREATE UNIQUE INDEX "special_round_results_market_id_key" ON "special_round_results"("market_id");
CREATE UNIQUE INDEX "special_round_scores_entry_id_market_id_key" ON "special_round_scores"("entry_id", "market_id");
CREATE UNIQUE INDEX "special_round_standings_entry_id_key" ON "special_round_standings"("entry_id");
CREATE UNIQUE INDEX "special_round_standings_special_round_id_position_key" ON "special_round_standings"("special_round_id", "position");
CREATE UNIQUE INDEX "special_round_prizes_entry_id_key" ON "special_round_prizes"("entry_id");
CREATE UNIQUE INDEX "special_round_prizes_special_round_id_position_key" ON "special_round_prizes"("special_round_id", "position");

CREATE INDEX "special_rounds_status_predictions_close_at_idx" ON "special_rounds"("status", "predictions_close_at");
CREATE INDEX "special_rounds_match_starts_at_idx" ON "special_rounds"("match_starts_at");
CREATE INDEX "special_rounds_created_by_id_idx" ON "special_rounds"("created_by_id");
CREATE INDEX "special_rounds_match_id_idx" ON "special_rounds"("match_id");
CREATE INDEX "special_round_entries_user_id_idx" ON "special_round_entries"("user_id");
CREATE INDEX "special_round_entries_special_round_id_payment_status_idx" ON "special_round_entries"("special_round_id", "payment_status");
CREATE INDEX "special_round_entries_registered_at_idx" ON "special_round_entries"("registered_at");
CREATE INDEX "special_round_markets_special_round_id_active_sort_order_idx" ON "special_round_markets"("special_round_id", "active", "sort_order");
CREATE INDEX "special_round_market_options_market_id_sort_order_idx" ON "special_round_market_options"("market_id", "sort_order");
CREATE INDEX "special_round_predictions_user_id_idx" ON "special_round_predictions"("user_id");
CREATE INDEX "special_round_predictions_market_id_idx" ON "special_round_predictions"("market_id");
CREATE INDEX "special_round_predictions_submitted_at_idx" ON "special_round_predictions"("submitted_at");
CREATE INDEX "special_round_results_entered_by_id_idx" ON "special_round_results"("entered_by_id");
CREATE INDEX "special_round_scores_entry_id_points_idx" ON "special_round_scores"("entry_id", "points");
CREATE INDEX "special_round_scores_market_id_idx" ON "special_round_scores"("market_id");
CREATE INDEX "special_round_standings_special_round_id_total_points_hits_idx" ON "special_round_standings"("special_round_id", "total_points" DESC, "hits" DESC);
CREATE INDEX "special_round_prizes_special_round_id_status_idx" ON "special_round_prizes"("special_round_id", "status");
CREATE INDEX "special_round_audit_logs_special_round_id_created_at_idx" ON "special_round_audit_logs"("special_round_id", "created_at");
CREATE INDEX "special_round_audit_logs_actor_id_idx" ON "special_round_audit_logs"("actor_id");
CREATE INDEX "special_round_audit_logs_action_idx" ON "special_round_audit_logs"("action");

ALTER TABLE "special_rounds" ADD CONSTRAINT "special_rounds_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_rounds" ADD CONSTRAINT "special_rounds_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "special_round_entries" ADD CONSTRAINT "special_round_entries_special_round_id_fkey" FOREIGN KEY ("special_round_id") REFERENCES "special_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_entries" ADD CONSTRAINT "special_round_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_markets" ADD CONSTRAINT "special_round_markets_special_round_id_fkey" FOREIGN KEY ("special_round_id") REFERENCES "special_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_market_options" ADD CONSTRAINT "special_round_market_options_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "special_round_markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "special_round_predictions" ADD CONSTRAINT "special_round_predictions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "special_round_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_predictions" ADD CONSTRAINT "special_round_predictions_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "special_round_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_predictions" ADD CONSTRAINT "special_round_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_results" ADD CONSTRAINT "special_round_results_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "special_round_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_results" ADD CONSTRAINT "special_round_results_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_scores" ADD CONSTRAINT "special_round_scores_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "special_round_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_scores" ADD CONSTRAINT "special_round_scores_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "special_round_markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_standings" ADD CONSTRAINT "special_round_standings_special_round_id_fkey" FOREIGN KEY ("special_round_id") REFERENCES "special_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_standings" ADD CONSTRAINT "special_round_standings_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "special_round_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_prizes" ADD CONSTRAINT "special_round_prizes_special_round_id_fkey" FOREIGN KEY ("special_round_id") REFERENCES "special_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_prizes" ADD CONSTRAINT "special_round_prizes_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "special_round_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_audit_logs" ADD CONSTRAINT "special_round_audit_logs_special_round_id_fkey" FOREIGN KEY ("special_round_id") REFERENCES "special_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "special_round_audit_logs" ADD CONSTRAINT "special_round_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
