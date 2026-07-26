import {
  SpecialRoundAnswerType,
  SpecialRoundMarketKind,
  SpecialRoundPrizeMode,
  SpecialRoundStatus
} from "@prisma/client";
import { z } from "zod";

import { preprocessSaoPauloDateTimeLocal } from "@/lib/date-time";

const dateTime = z.preprocess(preprocessSaoPauloDateTimeLocal, z.date());
const money = z.coerce.number().min(0).max(1_000_000);
const percent = z.coerce.number().min(0).max(100);

export const idSchema = z.string().uuid();

export const specialRoundSchema = z
  .object({
    adminFeePercent: percent.default(0),
    awayTeamLogo: z.string().url().or(z.literal("")).optional(),
    awayTeamName: z.string().trim().min(2).max(120),
    description: z.string().trim().max(3000).optional(),
    entryFee: money,
    fixedPrize: money.optional(),
    homeTeamLogo: z.string().url().or(z.literal("")).optional(),
    homeTeamName: z.string().trim().min(2).max(120),
    matchId: z.string().uuid().or(z.literal("")).optional(),
    matchStartsAt: dateTime,
    name: z.string().trim().min(3).max(140),
    predictionsCloseAt: dateTime,
    predictionsOpenAt: dateTime,
    prizeDistribution: z
      .array(
        z.object({
          percent,
          position: z.number().int().positive()
        })
      )
      .min(1),
    prizeMode: z.nativeEnum(SpecialRoundPrizeMode),
    prizePoolPercent: percent.default(100),
    registrationClosesAt: dateTime,
    registrationOpensAt: dateTime,
    rules: z.string().trim().max(10_000).optional(),
    winnerCount: z.coerce.number().int().min(1).max(100)
  })
  .superRefine((value, context) => {
    if (value.registrationOpensAt >= value.registrationClosesAt) {
      context.addIssue({
        code: "custom",
        message: "O encerramento deve ocorrer depois da abertura.",
        path: ["registrationClosesAt"]
      });
    }
    if (value.predictionsOpenAt >= value.predictionsCloseAt) {
      context.addIssue({
        code: "custom",
        message: "O fechamento deve ocorrer depois da abertura.",
        path: ["predictionsCloseAt"]
      });
    }
    if (value.predictionsCloseAt > value.matchStartsAt) {
      context.addIssue({
        code: "custom",
        message: "Os palpites precisam fechar antes do inicio da partida.",
        path: ["predictionsCloseAt"]
      });
    }
    const distributionTotal = value.prizeDistribution.reduce(
      (total, item) => total + item.percent,
      0
    );
    if (Math.abs(distributionTotal - 100) > 0.01) {
      context.addIssue({
        code: "custom",
        message: "A distribuicao dos premios deve totalizar 100%.",
        path: ["prizeDistribution"]
      });
    }
    if (value.prizeDistribution.length !== value.winnerCount) {
      context.addIssue({
        code: "custom",
        message: "Informe uma faixa para cada premiado.",
        path: ["winnerCount"]
      });
    }
    if (value.prizePoolPercent + value.adminFeePercent > 100) {
      context.addIssue({
        code: "custom",
        message: "Premiacao e taxa administrativa nao podem superar 100%.",
        path: ["prizePoolPercent"]
      });
    }
    if (value.prizeMode === "FIXED" && !value.fixedPrize) {
      context.addIssue({
        code: "custom",
        message: "Informe o valor fixo da premiacao.",
        path: ["fixedPrize"]
      });
    }
  });

export const specialRoundMarketSchema = z
  .object({
    active: z.boolean().default(true),
    answerType: z.nativeEnum(SpecialRoundAnswerType),
    description: z.string().trim().max(1000).optional(),
    kind: z.nativeEnum(SpecialRoundMarketKind),
    line: z.coerce.number().min(0).max(1000).optional(),
    options: z
      .array(z.object({ label: z.string().trim().min(1), value: z.string().trim().min(1) }))
      .max(30)
      .default([]),
    points: z.coerce.number().int().min(0).max(10_000),
    required: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
    specialRoundId: idSchema,
    title: z.string().trim().min(2).max(160)
  })
  .superRefine((value, context) => {
    if (
      ["TOTAL_GOALS", "TOTAL_CORNERS", "TOTAL_CARDS"].includes(value.kind) &&
      value.line === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Informe a linha deste mercado.",
        path: ["line"]
      });
    }
    if (
      [
        "MATCH_RESULT",
        "TOTAL_GOALS",
        "TOTAL_CORNERS",
        "TOTAL_CARDS",
        "FIRST_TEAM_TO_SCORE"
      ].includes(value.kind) &&
      !["SINGLE_CHOICE", "OPTION_LIST"].includes(value.answerType)
    ) {
      context.addIssue({
        code: "custom",
        message: "Este mercado deve usar uma lista de opcoes.",
        path: ["answerType"]
      });
    }
    if (value.kind === "BOTH_TEAMS_SCORE" && value.answerType !== "BOOLEAN") {
      context.addIssue({
        code: "custom",
        message: "Ambas marcam deve usar resposta sim ou nao.",
        path: ["answerType"]
      });
    }
    if (value.kind === "EXACT_SCORE" && value.answerType !== "SCORE") {
      context.addIssue({
        code: "custom",
        message: "Placar exato deve usar resposta do tipo placar.",
        path: ["answerType"]
      });
    }
  });

export const predictionBatchSchema = z.object({
  answers: z.record(
    idSchema,
    z.union([
      z.boolean(),
      z.number(),
      z.string(),
      z.object({
        away: z.number().int().min(0).max(99),
        home: z.number().int().min(0).max(99)
      })
    ])
  ),
  specialRoundId: idSchema
});

export const resultBatchSchema = predictionBatchSchema;

export const statusTransitionSchema = z.object({
  specialRoundId: idSchema,
  status: z.nativeEnum(SpecialRoundStatus)
});
