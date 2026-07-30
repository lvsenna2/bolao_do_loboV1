import { ElectionRoundStatus, ElectionTurn } from "@prisma/client";
import { z } from "zod";

import { preprocessSaoPauloDateTimeLocal } from "@/lib/date-time";
import { marginRangeOptions, winnerRangeOptions } from "./constants";

const winnerRanges = winnerRangeOptions.map((option) => option.value) as [string, ...string[]];
const marginRanges = marginRangeOptions.map((option) => option.value) as [string, ...string[]];

export const electionPredictionSchema = z
  .object({
    marginRange: z.enum(marginRanges),
    roundId: z.string().uuid(),
    runnerUpCandidateId: z.string().uuid(),
    turn: z.nativeEnum(ElectionTurn),
    winnerCandidateId: z.string().uuid(),
    winnerRange: z.enum(winnerRanges)
  })
  .refine((value) => value.winnerCandidateId !== value.runnerUpCandidateId, {
    message: "Presidente e segundo colocado devem ser candidatos diferentes.",
    path: ["runnerUpCandidateId"]
  });

export const electionCandidateSchema = z.object({
  name: z.string().trim().min(2).max(140),
  party: z.string().trim().min(1).max(40),
  roundId: z.string().uuid(),
  sortOrder: z.coerce.number().int().min(0).max(1000)
});

export const electionCandidateUpdateSchema = electionCandidateSchema.extend({
  candidateId: z.string().uuid()
});

export const electionSettingsSchema = z
  .object({
    description: z.string().trim().max(3000).optional(),
    name: z.string().trim().min(3).max(140),
    noWinnerDestination: z.string().trim().max(1000).optional(),
    registrationClosesAt: z.preprocess(preprocessSaoPauloDateTimeLocal, z.date()),
    registrationOpensAt: z.preprocess(preprocessSaoPauloDateTimeLocal, z.date()),
    roundId: z.string().uuid(),
    rules: z.string().trim().max(10_000).optional(),
    status: z.nativeEnum(ElectionRoundStatus)
  })
  .refine((value) => value.registrationOpensAt < value.registrationClosesAt, {
    message: "O encerramento deve ocorrer depois da abertura.",
    path: ["registrationClosesAt"]
  });

export const electionResultSchema = z
  .object({
    roundId: z.string().uuid(),
    runnerUpCandidateId: z.string().uuid(),
    runnerUpPercent: z.coerce.number().min(0).max(100),
    turn: z.nativeEnum(ElectionTurn),
    winnerCandidateId: z.string().uuid(),
    winnerPercent: z.coerce.number().min(0).max(100)
  })
  .superRefine((value, context) => {
    if (value.winnerCandidateId === value.runnerUpCandidateId) {
      context.addIssue({
        code: "custom",
        message: "Presidente e segundo colocado devem ser diferentes.",
        path: ["runnerUpCandidateId"]
      });
    }
    if (value.winnerPercent <= value.runnerUpPercent) {
      context.addIssue({
        code: "custom",
        message: "O percentual do vencedor deve ser maior.",
        path: ["winnerPercent"]
      });
    }
  });
