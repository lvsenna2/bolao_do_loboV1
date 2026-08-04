import { z } from "zod";

export const API_FUNDING_AMOUNTS = [10, 15, 20] as const;

export const apiFundingContributionSchema = z.object({
  amount: z.coerce.number().refine(
    (value): value is (typeof API_FUNDING_AMOUNTS)[number] =>
      API_FUNDING_AMOUNTS.includes(value as (typeof API_FUNDING_AMOUNTS)[number]),
    "Escolha uma das opcoes de contribuicao."
  ),
  idempotencyKey: z.string().uuid()
});
