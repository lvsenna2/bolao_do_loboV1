-- Existing accounts remain valid; phone is required only for new registrations.
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(15);

CREATE INDEX "users_phone_idx" ON "users"("phone");
