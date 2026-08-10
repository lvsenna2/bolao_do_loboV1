-- Resultados oficiais podem ser homologados automaticamente pelo sistema,
-- sem um administrador humano como responsavel pelo lancamento.
ALTER TABLE "special_round_results" ALTER COLUMN "entered_by_id" DROP NOT NULL;
