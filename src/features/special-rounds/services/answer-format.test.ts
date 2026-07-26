import { describe, expect, it } from "vitest";

import { formatSpecialRoundAnswer } from "./answer-format";

describe("formatSpecialRoundAnswer", () => {
  it("formats score answers", () => {
    expect(formatSpecialRoundAnswer({ away: 1, home: 2 })).toBe("2 x 1");
  });

  it("uses the configured option label", () => {
    expect(
      formatSpecialRoundAnswer("HOME", [
        { label: "Time da casa", value: "HOME" },
        { label: "Empate", value: "DRAW" }
      ])
    ).toBe("Time da casa");
  });

  it("formats boolean answers", () => {
    expect(formatSpecialRoundAnswer(true)).toBe("Sim");
    expect(formatSpecialRoundAnswer(false)).toBe("Nao");
  });
});
