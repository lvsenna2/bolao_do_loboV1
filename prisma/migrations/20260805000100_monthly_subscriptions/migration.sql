CREATE TYPE "SubscriptionPlan" AS ENUM ('PRATA', 'OURO', 'PLATINUM');
CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('PIX', 'CARD');
CREATE TYPE "SubscriptionStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELED',
    'EXPIRED',
    'REFUNDED'
);

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "payment_method" "SubscriptionPaymentMethod" NOT NULL,
    "provider" "PaymentGateway" NOT NULL DEFAULT 'MERCADO_PAGO',
    "provider_customer_id" VARCHAR(120),
    "provider_subscription_id" VARCHAR(120),
    "provider_payment_id" VARCHAR(120),
    "checkout_key" VARCHAR(180),
    "checkout_url" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "provider_status" VARCHAR(80),
    "provider_status_detail" VARCHAR(120),
    "qr_code" TEXT,
    "qr_code_base64" TEXT,
    "ticket_url" TEXT,
    "payment_expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "last_webhook_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_events" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "status" "SubscriptionStatus",
    "provider_resource_id" VARCHAR(120),
    "unique_key" VARCHAR(220) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscriptions_user_id_created_at_idx" ON "subscriptions"("user_id", "created_at");
CREATE UNIQUE INDEX "subscriptions_one_open_per_user_key"
ON "subscriptions"("user_id")
WHERE "status" IN ('PENDING', 'ACTIVE', 'PAST_DUE');
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");
CREATE UNIQUE INDEX "subscriptions_provider_payment_id_key" ON "subscriptions"("provider_payment_id");
CREATE UNIQUE INDEX "subscriptions_checkout_key_key" ON "subscriptions"("checkout_key");
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");
CREATE INDEX "subscriptions_provider_payment_id_idx" ON "subscriptions"("provider_payment_id");
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");
CREATE UNIQUE INDEX "subscription_events_unique_key_key" ON "subscription_events"("unique_key");
CREATE INDEX "subscription_events_subscription_id_created_at_idx" ON "subscription_events"("subscription_id", "created_at");
CREATE INDEX "subscription_events_provider_resource_id_idx" ON "subscription_events"("provider_resource_id");

ALTER TABLE "subscriptions"
ADD CONSTRAINT "subscriptions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_events"
ADD CONSTRAINT "subscription_events_subscription_id_fkey"
FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
