import type { SpecialRoundAnswer } from "../types";

export function formatSpecialRoundAnswer(
  answer: SpecialRoundAnswer,
  options: readonly { label: string; value: string }[] = []
) {
  if (
    typeof answer === "object" &&
    answer !== null &&
    "home" in answer &&
    "away" in answer
  ) {
    return `${answer.home} x ${answer.away}`;
  }
  if (typeof answer === "boolean") return answer ? "Sim" : "Nao";
  const option = options.find((item) => item.value === String(answer));
  return option?.label ?? String(answer);
}
