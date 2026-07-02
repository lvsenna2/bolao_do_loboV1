import { z } from "zod";

export const predictionValues = ["HOME", "DRAW", "AWAY"] as const;

export type GuessPrediction = (typeof predictionValues)[number];

const scoreSchema = z.coerce
  .number({
    invalid_type_error: "Informe um placar valido.",
    required_error: "Informe o placar."
  })
  .int("Use apenas numeros inteiros.")
  .min(0, "O placar nao pode ser negativo.")
  .max(99, "Informe um placar menor que 100.");

export function getPredictionFromScore(homePrediction: number, awayPrediction: number) {
  if (homePrediction > awayPrediction) {
    return "HOME" as const;
  }

  if (homePrediction < awayPrediction) {
    return "AWAY" as const;
  }

  return "DRAW" as const;
}

export const upsertGuessSchema = z
  .object({
    matchId: z.string().uuid("Partida invalida."),
    leagueId: z.string().uuid("Liga invalida.").optional(),
    prediction: z.enum(predictionValues, {
      errorMap: () => ({ message: "Selecione o vencedor." })
    }),
    homePrediction: scoreSchema,
    awayPrediction: scoreSchema,
    joker: z.coerce.boolean().default(false)
  })
  .superRefine((data, context) => {
    const scorePrediction = getPredictionFromScore(data.homePrediction, data.awayPrediction);

    if (data.prediction !== scorePrediction) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O vencedor selecionado deve acompanhar o placar informado.",
        path: ["prediction"]
      });
    }
  });

export const deleteGuessSchema = z.object({
  guessId: z.string().uuid("Palpite invalido.")
});

export type UpsertGuessInput = z.infer<typeof upsertGuessSchema>;
export type DeleteGuessInput = z.infer<typeof deleteGuessSchema>;
