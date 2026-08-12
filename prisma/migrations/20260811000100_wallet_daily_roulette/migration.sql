CREATE TYPE "WalletTransactionType" AS ENUM ('DEPOSIT', 'BET', 'ROULETTE', 'REFUND', 'BONUS');
CREATE TYPE "RouletteSpinKind" AS ENUM ('DAILY', 'BONUS');

CREATE TABLE "wallets" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "balance_cents" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_transactions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" "WalletTransactionType" NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "balance_before_cents" INTEGER NOT NULL,
  "balance_after_cents" INTEGER NOT NULL,
  "description" VARCHAR(240) NOT NULL,
  "unique_key" VARCHAR(200) NOT NULL,
  "related_entity_id" VARCHAR(120),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_deposits" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "gateway" "PaymentGateway" NOT NULL DEFAULT 'MERCADO_PAGO',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "transaction_id" TEXT,
  "checkout_key" VARCHAR(180) NOT NULL,
  "qr_code" TEXT,
  "qr_code_base64" TEXT,
  "ticket_url" TEXT,
  "provider_status" VARCHAR(80),
  "provider_status_detail" VARCHAR(120),
  "expires_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "last_webhook_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_deposits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_reward_balances" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "special_fragments" INTEGER NOT NULL DEFAULT 0,
  "special_round_vouchers" INTEGER NOT NULL DEFAULT 0,
  "league_vouchers" INTEGER NOT NULL DEFAULT 0,
  "promo_discount_percent" INTEGER NOT NULL DEFAULT 0,
  "promo_discount_max_cents" INTEGER NOT NULL DEFAULT 0,
  "promo_expires_at" TIMESTAMP(3),
  "bonus_spin_date" VARCHAR(10),
  "bonus_spins_remaining" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_reward_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_roulette_spins" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "spin_date" VARCHAR(10) NOT NULL,
  "spin_kind" "RouletteSpinKind" NOT NULL DEFAULT 'DAILY',
  "prize_id" VARCHAR(60) NOT NULL,
  "prize_name" VARCHAR(160) NOT NULL,
  "prize_value" INTEGER NOT NULL DEFAULT 0,
  "probability_units" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_roulette_spins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");
CREATE UNIQUE INDEX "wallet_transactions_unique_key_key" ON "wallet_transactions"("unique_key");
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at");
CREATE INDEX "wallet_transactions_type_created_at_idx" ON "wallet_transactions"("type", "created_at");
CREATE UNIQUE INDEX "wallet_deposits_transaction_id_key" ON "wallet_deposits"("transaction_id");
CREATE UNIQUE INDEX "wallet_deposits_checkout_key_key" ON "wallet_deposits"("checkout_key");
CREATE INDEX "wallet_deposits_user_id_created_at_idx" ON "wallet_deposits"("user_id", "created_at");
CREATE INDEX "wallet_deposits_status_created_at_idx" ON "wallet_deposits"("status", "created_at");
CREATE UNIQUE INDEX "user_reward_balances_user_id_key" ON "user_reward_balances"("user_id");
CREATE UNIQUE INDEX "daily_roulette_spins_user_id_spin_date_spin_kind_key" ON "daily_roulette_spins"("user_id", "spin_date", "spin_kind");
CREATE INDEX "daily_roulette_spins_user_id_created_at_idx" ON "daily_roulette_spins"("user_id", "created_at");
CREATE INDEX "daily_roulette_spins_prize_id_created_at_idx" ON "daily_roulette_spins"("prize_id", "created_at");

ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_deposits" ADD CONSTRAINT "wallet_deposits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_reward_balances" ADD CONSTRAINT "user_reward_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_roulette_spins" ADD CONSTRAINT "daily_roulette_spins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
