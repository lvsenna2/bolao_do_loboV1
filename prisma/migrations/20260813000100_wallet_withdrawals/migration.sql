ALTER TYPE "WalletTransactionType" ADD VALUE 'WITHDRAWAL';

CREATE TYPE "WalletWithdrawalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

CREATE TABLE "wallet_withdrawals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
  "pix_key_type" "PixKeyType" NOT NULL,
  "pix_key" VARCHAR(140) NOT NULL,
  "pix_key_owner_name" VARCHAR(120) NOT NULL,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "receipt_ref" VARCHAR(180),
  "admin_note" VARCHAR(240),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wallet_withdrawals_user_id_created_at_idx" ON "wallet_withdrawals"("user_id", "created_at");
CREATE INDEX "wallet_withdrawals_status_created_at_idx" ON "wallet_withdrawals"("status", "created_at");

ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
