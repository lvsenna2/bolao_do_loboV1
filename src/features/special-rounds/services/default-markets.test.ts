import { describe, expect, it } from "vitest";

import { buildAutomaticSpecialRoundMarkets, buildGoalScorerOptions } from "./default-markets";

describe("automatic special round markets", () => {
  it("creates the twelve standard markets in the expected order", () => {
    const markets = buildAutomaticSpecialRoundMarkets("Flamengo", "Fluminense", [
      { id: "player-2", name: "Bruno" },
      { id: "player-1", name: "Andre" }
    ]);

    expect(markets).toHaveLength(12);
    expect(markets.map((market) => market.kind)).toEqual([
      "EXACT_SCORE",
      "MATCH_RESULT",
      "TOTAL_GOALS",
      "TOTAL_CORNERS",
      "BOTH_TEAMS_SCORE",
      "TOTAL_CARDS",
      "FIRST_TEAM_TO_SCORE",
      "GOAL_SCORER",
      "TEAM_MOST_SHOTS_ON_GOAL",
      "TEAM_MOST_CORNERS",
      "TEAM_MOST_CARDS",
      "TEAM_MOST_SHOTS"
    ]);
    expect(markets[1].options).toEqual([
      { label: "Flamengo", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Fluminense", value: "AWAY" }
    ]);
    expect(markets[7].answerType).toBe("OPTION_LIST");
    expect(markets[7].options.at(-1)?.value).toBe("NO_GOAL");
    expect(markets[8].options).toEqual([
      { label: "Flamengo", value: "HOME" },
      { label: "Empate", value: "DRAW" },
      { label: "Fluminense", value: "AWAY" }
    ]);
  });

  it("keeps the scorer market available when lineups are not cataloged yet", () => {
    const markets = buildAutomaticSpecialRoundMarkets("Casa", "Visitante", []);

    expect(markets[7]).toMatchObject({
      answerType: "OPTION_LIST",
      kind: "GOAL_SCORER",
      options: [{ label: "Nenhum jogador (sem gols)", value: "NO_GOAL" }],
      required: true
    });
  });

  it("builds a sorted scorer list without duplicated players", () => {
    expect(
      buildGoalScorerOptions([
        { id: "player-2", name: "Bruno" },
        { id: "player-1", name: "Andre" },
        { id: "player-2", name: "Bruno" }
      ])
    ).toEqual([
      { label: "Andre", value: "PLAYER:player-1" },
      { label: "Bruno", value: "PLAYER:player-2" },
      { label: "Nenhum jogador (sem gols)", value: "NO_GOAL" }
    ]);
  });
});
