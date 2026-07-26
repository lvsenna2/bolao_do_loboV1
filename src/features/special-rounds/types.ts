import type { SpecialRoundStatus } from "@prisma/client";

export type SpecialRoundActionResult<T = undefined> = {
  data?: T;
  fieldErrors?: Record<string, string[]>;
  message: string;
  ok: boolean;
};

export type PrizeDistributionItem = {
  percent: number;
  position: number;
};

export type SpecialRoundAnswer = boolean | number | string | { away: number; home: number };

export type SpecialRoundStatusInfo = {
  label: string;
  value: SpecialRoundStatus;
};
