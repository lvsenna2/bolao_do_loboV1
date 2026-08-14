-- Automacao do Pix de saida no botao Aprovar: rastreio da transferencia, quem aprovou e
-- chave de idempotencia para nao transferir duas vezes.

ALTER TYPE "WalletWithdrawalStatus" ADD VALUE 'PIX_PROCESSING' AFTER 'APPROVED';
ALTER TYPE "WalletWithdrawalStatus" ADD VALUE 'PIX_FAILED' AFTER 'PAID';

ALTER TABLE "wallet_withdrawals"
  ADD COLUMN "approved_by_id" UUID,
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "payout_idempotency_key" VARCHAR(80),
  ADD COLUMN "transfer_provider" VARCHAR(40),
  ADD COLUMN "transfer_id" VARCHAR(120),
  ADD COLUMN "transfer_status" VARCHAR(60),
  ADD COLUMN "transfer_error" VARCHAR(400),
  ADD COLUMN "transfer_attempted_at" TIMESTAMP(3);

-- Saques que ja existem herdam o proprio id como chave de idempotencia.
UPDATE "wallet_withdrawals"
   SET "payout_idempotency_key" = 'withdrawal:' || "id"::text
 WHERE "payout_idempotency_key" IS NULL;

-- Saques ja aprovados antes desta migration mantem o revisor como aprovador.
UPDATE "wallet_withdrawals"
   SET "approved_by_id" = "reviewed_by_id",
       "approved_at" = "reviewed_at"
 WHERE "approved_by_id" IS NULL
   AND "status" IN ('APPROVED', 'PAID');

ALTER TABLE "wallet_withdrawals"
  ALTER COLUMN "payout_idempotency_key" SET NOT NULL;

CREATE UNIQUE INDEX "wallet_withdrawals_payout_idempotency_key_key" ON "wallet_withdrawals"("payout_idempotency_key");
CREATE UNIQUE INDEX "wallet_withdrawals_transfer_id_key" ON "wallet_withdrawals"("transfer_id");

ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
