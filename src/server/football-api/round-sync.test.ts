import { describe, expect, it } from "vitest";

import { mergeFootballRoundState } from "./round-sync";

const apiRound = {
  endsAt: new Date("2026-07-19T22:00:00.000Z"),
  startsAt: new Date("2026-07-19T19:00:00.000Z"),
  status: "SCHEDULED" as const
};

describe("mergeFootballRoundState", () => {
  it("preserva uma rodada aberta pelo administrador", () => {
    const result = mergeFootballRoundState(
      {
        endsAt: new Date("2026-07-26T22:00:00.000Z"),
        startsAt: new Date("2026-07-17T12:00:00.000Z"),
        status: "OPEN"
      },
      apiRound
    );

    expect(result.status).toBe("OPEN");
    expect(result.startsAt).toEqual(new Date("2026-07-17T12:00:00.000Z"));
    expect(result.endsAt).toEqual(new Date("2026-07-26T22:00:00.000Z"));
  });

  it("avanca a rodada aberta quando as partidas entram ao vivo", () => {
    const result = mergeFootballRoundState(
      { ...apiRound, status: "OPEN" },
      { ...apiRound, status: "LIVE" }
    );

    expect(result.status).toBe("LIVE");
  });

  it("nao reabre uma rodada fechada", () => {
    const result = mergeFootballRoundState({ ...apiRound, status: "CLOSED" }, apiRound);

    expect(result.status).toBe("CLOSED");
  });
});
