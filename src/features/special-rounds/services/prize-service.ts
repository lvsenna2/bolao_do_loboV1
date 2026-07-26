import type { PrizeDistributionItem } from "../types";

export function calculateSpecialRoundPrizePool(input: {
  adminFeePercent: number;
  confirmedAmounts: number[];
  fixedPrize?: number | null;
  mode: "FIXED" | "POOL";
  poolPercent: number;
}) {
  const collected = input.confirmedAmounts.reduce((total, amount) => total + amount, 0);
  const prize =
    input.mode === "FIXED" ? (input.fixedPrize ?? 0) : collected * (input.poolPercent / 100);

  return {
    adminFee: collected * (input.adminFeePercent / 100),
    collected,
    prize: Math.round(prize * 100) / 100
  };
}

export function distributeSpecialRoundPrize(prize: number, distribution: PrizeDistributionItem[]) {
  return distribution.map((item) => ({
    amount: Math.round(prize * (item.percent / 100) * 100) / 100,
    percentage: item.percent,
    position: item.position
  }));
}
