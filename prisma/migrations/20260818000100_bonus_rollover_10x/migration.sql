-- Exige movimentacao de 10x o bonus promocional antes de libera-lo para saque.
ALTER TABLE "wallets"
  ADD COLUMN "bonus_rollover_remaining_cents" INTEGER NOT NULL DEFAULT 0;

-- Bonus que ja existia antes da regra entra no mesmo rollover, sem liberacao retroativa.
UPDATE "wallets"
   SET "bonus_rollover_remaining_cents" = LEAST(
     "bonus_balance_cents"::BIGINT * 10,
     2147483647
   )::INTEGER
 WHERE "bonus_balance_cents" > 0;

ALTER TABLE "wallet_transactions"
  ADD COLUMN "bonus_unlocked_cents" INTEGER NOT NULL DEFAULT 0;
