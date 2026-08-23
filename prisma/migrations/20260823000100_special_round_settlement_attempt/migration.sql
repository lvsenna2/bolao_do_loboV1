-- Rastreia a ultima tentativa de apuracao automatica de cada Rodada Especial.
-- A varredura passa a ordenar por este campo (nulos primeiro), entao uma rodada que nunca
-- consegue apurar deixa de prender as 20 vagas da fila e travar todas as outras.
ALTER TABLE "special_rounds"
  ADD COLUMN "settlement_attempted_at" TIMESTAMP(3),
  ADD COLUMN "settlement_error" TEXT;

CREATE INDEX "special_rounds_settlement_attempted_at_idx"
  ON "special_rounds" ("settlement_attempted_at");

-- Premio sem valor a pagar ficava PENDING para sempre e mantinha a rodada na fila de
-- recuperacao de pagamento, ocupando as vagas de quem realmente tinha premio a receber.
UPDATE "special_round_prizes"
   SET "status" = 'CANCELLED'
 WHERE "status" IN ('PENDING', 'CONFIRMED')
   AND "amount" <= 0;
