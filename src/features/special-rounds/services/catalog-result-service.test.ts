import { describe, expect, it } from "vitest";

import { deriveCatalogResults } from "./catalog-result-service";

const markets = [
  { answerType: "SCORE", id: "exact", kind: "EXACT_SCORE", options: [], title: "Placar" },
  {
    answerType: "SINGLE_CHOICE",
    id: "result",
    kind: "MATCH_RESULT",
    options: [],
    title: "Resultado"
  },
  {
    answerType: "SINGLE_CHOICE",
    id: "goals",
    kind: "TOTAL_GOALS",
    options: [],
    title: "Gols"
  },
  {
    answerType: "SINGLE_CHOICE",
    id: "corners",
    kind: "TOTAL_CORNERS",
    options: [],
    title: "Escanteios"
  },
  {
    answerType: "BOOLEAN",
    id: "both",
    kind: "BOTH_TEAMS_SCORE",
    options: [],
    title: "Ambas"
  },
  {
    answerType: "SINGLE_CHOICE",
    id: "cards",
    kind: "TOTAL_CARDS",
    options: [],
    title: "Cartoes"
  },
  {
    answerType: "SINGLE_CHOICE",
    id: "first-team",
    kind: "FIRST_TEAM_TO_SCORE",
    options: [],
    title: "Primeiro time"
  },
  {
    answerType: "OPTION_LIST",
    id: "scorer",
    kind: "GOAL_SCORER",
    options: [{ value: "PLAYER:player-1" }],
    title: "Artilheiro"
  }
] as const;

describe("catalog special round results", () => {
  it("derives every official answer from a finished catalog match", () => {
    const result = deriveCatalogResults(
      {
        awayScore: 1,
        awayTeamId: "away",
        events: [
          {
            elapsed: 20,
            extra: null,
            player: { id: "player-1", name: "Atacante" },
            teamId: "home",
            type: "Goal"
          }
        ],
        homeScore: 2,
        homeTeamId: "home",
        statistics: [
          { type: "Corner Kicks", value: "6" },
          { type: "Corner Kicks", value: "5" },
          { type: "Yellow Cards", value: "2" },
          { type: "Yellow Cards", value: "3" },
          { type: "Red Cards", value: "1" },
          { type: "Red Cards", value: "0" }
        ],
        status: "FINISHED"
      },
      [...markets]
    );

    expect(result.missing).toEqual([]);
    expect(result.answers).toMatchObject({
      both: true,
      cards: 6,
      corners: 11,
      exact: { away: 1, home: 2 },
      "first-team": "HOME",
      goals: 3,
      result: "HOME",
      scorer: "PLAYER:player-1"
    });
  });

  it("reports catalog fields that are still missing", () => {
    const result = deriveCatalogResults(
      {
        awayScore: 1,
        awayTeamId: "away",
        events: [],
        homeScore: 1,
        homeTeamId: "home",
        statistics: [],
        status: "FINISHED"
      },
      [...markets]
    );

    expect(result.missing).toEqual(
      expect.arrayContaining(["Escanteios", "Cartoes", "Primeiro time", "Artilheiro"])
    );
  });
});
