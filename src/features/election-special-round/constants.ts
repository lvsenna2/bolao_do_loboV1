export const ELECTION_2026_ROUND_ID = "20260000-0000-4000-8000-000000000001";

export const winnerRangeOptions = [
  { label: "Menos de 30%", value: "UNDER_30" },
  { label: "30% a 34,99%", value: "30_34_99" },
  { label: "35% a 39,99%", value: "35_39_99" },
  { label: "40% a 44,99%", value: "40_44_99" },
  { label: "45% a 49,99%", value: "45_49_99" },
  { label: "50% a 51,99%", value: "50_51_99" },
  { label: "52% a 53,99%", value: "52_53_99" },
  { label: "54% a 55,99%", value: "54_55_99" },
  { label: "56% a 57,99%", value: "56_57_99" },
  { label: "58% a 59,99%", value: "58_59_99" },
  { label: "60% ou mais", value: "60_PLUS" }
] as const;

export const marginRangeOptions = [
  { label: "Menos de 2%", value: "UNDER_2" },
  { label: "2% a 3,99%", value: "2_3_99" },
  { label: "4% a 5,99%", value: "4_5_99" },
  { label: "6% a 7,99%", value: "6_7_99" },
  { label: "8% a 9,99%", value: "8_9_99" },
  { label: "10% ou mais", value: "10_PLUS" }
] as const;

export function getWinnerRange(percent: number) {
  if (percent < 30) return "UNDER_30";
  if (percent < 35) return "30_34_99";
  if (percent < 40) return "35_39_99";
  if (percent < 45) return "40_44_99";
  if (percent < 50) return "45_49_99";
  if (percent < 52) return "50_51_99";
  if (percent < 54) return "52_53_99";
  if (percent < 56) return "54_55_99";
  if (percent < 58) return "56_57_99";
  if (percent < 60) return "58_59_99";
  return "60_PLUS";
}

export function getMarginRange(percent: number) {
  if (percent < 2) return "UNDER_2";
  if (percent < 4) return "2_3_99";
  if (percent < 6) return "4_5_99";
  if (percent < 8) return "6_7_99";
  if (percent < 10) return "8_9_99";
  return "10_PLUS";
}

export function optionLabel(options: readonly { label: string; value: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}
