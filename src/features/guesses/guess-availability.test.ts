import { describe, expect, it } from "vitest";

import { isMatchAcceptingGuesses, isRoundAcceptingGuesses } from "./guess-availability";

const now = new Date("2026-07-24T12:00:00.000Z");

describe("guess availability", () => {
  it("libera uma rodada aberta mesmo antes do inicio esportivo da rodada", () => {
    expect(isRoundAcceptingGuesses("OPEN", new Date("2026-07-27T00:30:00.000Z"), now)).toBe(
      true
    );
  });

  it("bloqueia rodadas fechadas ou com periodo encerrado", () => {
    expect(
      isRoundAcceptingGuesses("SCHEDULED", new Date("2026-07-27T00:30:00.000Z"), now)
    ).toBe(false);
    expect(isRoundAcceptingGuesses("OPEN", new Date("2026-07-24T11:59:59.000Z"), now)).toBe(
      false
    );
  });

  it("bloqueia a partida exatamente no horario de inicio", () => {
    expect(isMatchAcceptingGuesses("SCHEDULED", new Date("2026-07-24T12:00:01.000Z"), now)).toBe(
      true
    );
    expect(isMatchAcceptingGuesses("SCHEDULED", now, now)).toBe(false);
    expect(isMatchAcceptingGuesses("LIVE", new Date("2026-07-24T13:00:00.000Z"), now)).toBe(
      false
    );
  });
});
