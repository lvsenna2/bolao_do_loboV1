import { describe, expect, it } from "vitest";

import { buildAutomaticSpecialRoundMarkets } from "./default-markets";

describe("automatic special round markets", () => {
  it("creates the eight standard markets in the expected order", () => {
    const markets = buildAutomaticSpecialRoundMarkets("Flamengo", "Fluminense", [
      { id: "player-2", name: "Bruno" },
      { id: "player-1", name: "Andre" }
    ]);

    expect(markets).toHaveLength(8);
    expect(markets.map((market) => market.kind)).toEqual([
      "EXACT_SCORE",
      "MATCH_RESULT",
      "TOTAL_GOALS",
      "TOTAL_CORNERS",
      "BOTH_TEAMS_SCORE",
      "TOTAL_CARDS",
      "FIRST_TEAM_TO_SCORE",
      "GOAL_SCORER"
    ]);
    expect(markets[1].options).toEqual([
      { label: "Flamengo", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Fluminense", value: "AWAY" }
    ]);
    expect(markets[7].answerType).toBe("OPTION_LIST");
    expect(markets[7].options.at(-1)?.value).toBe("NO_GOAL");
  });

  it("keeps the scorer market available when lineups are not cataloged yet", () => {
    const markets = buildAutomaticSpecialRoundMarkets("Casa", "Visitante", []);

    expect(markets[7]).toMatchObject({
      answerType: "SHORT_TEXT",
      kind: "GOAL_SCORER",
      required: true
    });
  });
});
