import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

export type ScoringDefaults = {
  exactScoreBonus: number;
  jokerLimitPerRound: number;
  jokerMultiplier: number;
  winnerHit: number;
};

export const fallbackScoring: ScoringDefaults = {
  exactScoreBonus: 3,
  jokerLimitPerRound: 1,
  jokerMultiplier: 2,
  winnerHit: 3
};

type JsonObject = Record<string, Prisma.JsonValue>;

function isJsonObject(value: Prisma.JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumberSetting(value: JsonObject, key: keyof ScoringDefaults) {
  const rawValue = value[key];

  return typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : undefined;
}

export async function getScoringDefaults(): Promise<ScoringDefaults> {
  const setting = await prisma.setting.findUnique({
    select: {
      value: true
    },
    where: {
      key: "scoring.default"
    }
  });

  if (!setting || !isJsonObject(setting.value)) {
    return fallbackScoring;
  }

  return {
    exactScoreBonus:
      readNumberSetting(setting.value, "exactScoreBonus") ?? fallbackScoring.exactScoreBonus,
    jokerLimitPerRound:
      readNumberSetting(setting.value, "jokerLimitPerRound") ?? fallbackScoring.jokerLimitPerRound,
    jokerMultiplier:
      readNumberSetting(setting.value, "jokerMultiplier") ?? fallbackScoring.jokerMultiplier,
    winnerHit: readNumberSetting(setting.value, "winnerHit") ?? fallbackScoring.winnerHit
  };
}

export function getPointsPreview(scoring: ScoringDefaults, joker: boolean) {
  const basePoints = scoring.winnerHit + scoring.exactScoreBonus;

  return joker ? basePoints * scoring.jokerMultiplier : basePoints;
}
