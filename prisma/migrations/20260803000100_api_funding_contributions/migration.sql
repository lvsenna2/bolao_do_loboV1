CREATE TABLE "api_funding_contributions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'MERCADO_PAGO',
    "transaction_id" TEXT,
    "checkout_key" VARCHAR(180) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "qr_code" TEXT,
    "qr_code_base64" TEXT,
    "ticket_url" TEXT,
    "provider_status" VARCHAR(80),
    "provider_status_detail" VARCHAR(120),
    "payment_expires_at" TIMESTAMP(3),
    "last_webhook_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_funding_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_funding_contributions_transaction_id_key"
ON "api_funding_contributions"("transaction_id");

CREATE UNIQUE INDEX "api_funding_contributions_checkout_key_key"
ON "api_funding_contributions"("checkout_key");

CREATE INDEX "api_funding_contributions_user_id_status_idx"
ON "api_funding_contributions"("user_id", "status");

CREATE INDEX "api_funding_contributions_status_paid_at_idx"
ON "api_funding_contributions"("status", "paid_at");

CREATE INDEX "api_funding_contributions_created_at_idx"
ON "api_funding_contributions"("created_at");

ALTER TABLE "api_funding_contributions"
ADD CONSTRAINT "api_funding_contributions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
