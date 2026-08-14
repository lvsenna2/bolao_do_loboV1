-- Rodada Especial Promocional de Selecao Unica + separacao entre saldo normal e saldo bonus.

ALTER TYPE "SpecialRoundMarketKind" ADD VALUE 'TEAM_TO_SCORE';

CREATE TYPE "SpecialRoundFormat" AS ENUM ('STANDARD', 'PROMO_SINGLE_SELECTION');
CREATE TYPE "SpecialRoundPromoSide" AS ENUM ('HOME', 'AWAY');

ALTER TABLE "special_rounds"
  ADD COLUMN "format" "SpecialRoundFormat" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "promo_slug" VARCHAR(80),
  ADD COLUMN "promo_headline" VARCHAR(160),
  ADD COLUMN "promo_selection_label" VARCHAR(160),
  ADD COLUMN "promo_side" "SpecialRoundPromoSide",
  ADD COLUMN "promo_odds" DECIMAL(6,2),
  ADD COLUMN "promo_min_stake_cents" INTEGER,
  ADD COLUMN "promo_max_stake_cents" INTEGER,
  ADD COLUMN "promo_banner_url" TEXT;

CREATE UNIQUE INDEX "special_rounds_promo_slug_key" ON "special_rounds"("promo_slug");
CREATE INDEX "special_rounds_format_status_idx" ON "special_rounds"("format", "status");

ALTER TABLE "special_round_entries"
  ADD COLUMN "bonus_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "wallets"
  ADD COLUMN "bonus_balance_cents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "wallet_transactions"
  ADD COLUMN "bonus_amount_cents" INTEGER NOT NULL DEFAULT 0;
