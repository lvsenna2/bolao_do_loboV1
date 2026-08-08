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
    options: [{ value: "PLAYER:player-1:HOME" }],
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
      scorer: "PLAYER:player-1:HOME"
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

  it("counts card events when aggregated statistics are unavailable", () => {
    const result = deriveCatalogResults(
      {
        awayScore: 1,
        awayTeamId: "away",
        events: [
          {
            detail: "Yellow Card",
            elapsed: 20,
            extra: null,
            player: null,
            teamId: "home",
            type: "Card"
          },
          {
            detail: "Yellow Card",
            elapsed: 45,
            extra: 2,
            player: null,
            teamId: "away",
            type: "Card"
          }
        ],
        homeScore: 2,
        homeTeamId: "home",
        statistics: [
          { type: "Yellow Cards", value: null },
          { type: "Red Cards", value: null }
        ],
        status: "FINISHED"
      },
      [markets.find((market) => market.kind === "TOTAL_CARDS")!]
    );

    expect(result.answers.cards).toBe(2);
    expect(result.missing).toEqual([]);
  });

  it("uses card events when only part of the card statistics is available", () => {
    const result = deriveCatalogResults(
      {
        awayScore: 1,
        awayTeamId: "away",
        events: [
          {
            detail: "Yellow Card",
            elapsed: 20,
            extra: null,
            player: null,
            teamId: "home",
            type: "Card"
          },
          {
            detail: "Red Card",
            elapsed: 70,
            extra: null,
            player: null,
            teamId: "away",
            type: "Card"
          }
        ],
        homeScore: 2,
        homeTeamId: "home",
        statistics: [
          { teamId: "home", type: "Yellow Cards", value: "1" },
          { teamId: "away", type: "Yellow Cards", value: "0" }
        ],
        status: "FINISHED"
      },
      [
        markets.find((market) => market.kind === "TOTAL_CARDS")!,
        {
          answerType: "SINGLE_CHOICE",
          id: "team-cards",
          kind: "TEAM_MOST_CARDS",
          options: [],
          title: "Cartoes por time"
        }
      ]
    );

    expect(result.answers.cards).toBe(2);
    expect(result.answers["team-cards"]).toBe("DRAW");
    expect(result.missing).toEqual([]);
  });

  it("derives team comparison markets from per-team statistics", () => {
    const teamMarkets = [
      {
        answerType: "SINGLE_CHOICE",
        id: "shots-on-goal",
        kind: "TEAM_MOST_SHOTS_ON_GOAL",
        options: [],
        title: "Chutes no gol"
      },
      {
        answerType: "SINGLE_CHOICE",
        id: "team-corners",
        kind: "TEAM_MOST_CORNERS",
        options: [],
        title: "Escanteios por time"
      },
      {
        answerType: "SINGLE_CHOICE",
        id: "team-cards",
        kind: "TEAM_MOST_CARDS",
        options: [],
        title: "Cartoes por time"
      },
      {
        answerType: "SINGLE_CHOICE",
        id: "shots",
        kind: "TEAM_MOST_SHOTS",
        options: [],
        title: "Finalizacoes"
      }
    ] as const;
    const result = deriveCatalogResults(
      {
        awayScore: 1,
        awayTeamId: "away",
        events: [
          {
            elapsed: 20,
            extra: null,
            player: null,
            teamId: "home",
            type: "Card"
          },
          {
            elapsed: 30,
            extra: null,
            player: null,
            teamId: "away",
            type: "Card"
          },
          {
            elapsed: 40,
            extra: null,
            player: null,
            teamId: "away",
            type: "Card"
          }
        ],
        homeScore: 2,
        homeTeamId: "home",
        statistics: [
          { teamId: "home", type: "Shots on Goal", value: "5" },
          { teamId: "away", type: "Shots on Goal", value: "3" },
          { teamId: "home", type: "Corner Kicks", value: "4" },
          { teamId: "away", type: "Corner Kicks", value: "4" },
          { teamId: "home", type: "Total Shots", value: "9" },
          { teamId: "away", type: "Total Shots", value: "12" },
          { teamId: "home", type: "Yellow Cards", value: null },
          { teamId: "away", type: "Yellow Cards", value: null }
        ],
        status: "FINISHED"
      },
      teamMarkets
    );

    expect(result.answers).toEqual({
      shots: "AWAY",
      "shots-on-goal": "HOME",
      "team-cards": "AWAY",
      "team-corners": "DRAW"
    });
    expect(result.missing).toEqual([]);
  });
});
