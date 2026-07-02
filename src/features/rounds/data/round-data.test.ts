import { describe, expect, it } from "vitest";

import { getMatchStatusLabel, getRoundLabel, getRoundStatusLabel } from "./round-data";

describe("round data formatters", () => {
  it("uses custom round name when available", () => {
    expect(getRoundLabel({ name: "Final", number: 38 })).toBe("Final");
  });

  it("falls back to round number when name is missing", () => {
    expect(getRoundLabel({ name: null, number: 12 })).toBe("Rodada 12");
  });

  it("formats round and match status labels", () => {
    expect(getRoundStatusLabel("OPEN")).toBe("Aberta");
    expect(getRoundStatusLabel("CLOSED")).toBe("Fechada");
    expect(getMatchStatusLabel("SCHEDULED")).toBe("Agendada");
    expect(getMatchStatusLabel("FINISHED")).toBe("Encerrada");
  });
});
