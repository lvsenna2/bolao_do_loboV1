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

describe("selecao unica da rodada promocional", () => {
  const promoMarket = (side: "AWAY" | "HOME") => [
    {
      answerType: "BOOLEAN",
      id: "promo",
      kind: "TEAM_TO_SCORE" as const,
      options: [{ value: side }],
      title: "Marcar pelo menos 1 gol"
    }
  ];

  const finishedMatch = (homeScore: number, awayScore: number) => ({
    awayScore,
    awayTeamId: "away",
    events: [],
    homeScore,
    homeTeamId: "home",
    statistics: [],
    status: "FINISHED"
  });

  it("acerta quando o mandante cobrado marca", () => {
    const result = deriveCatalogResults(finishedMatch(2, 1), promoMarket("HOME"));
    expect(result.answers).toEqual({ promo: true });
    expect(result.missing).toEqual([]);
  });

  it("erra quando o mandante cobrado nao marca", () => {
    expect(deriveCatalogResults(finishedMatch(0, 3), promoMarket("HOME")).answers).toEqual({
      promo: false
    });
  });

  it("le o lado visitante da opcao do mercado", () => {
    expect(deriveCatalogResults(finishedMatch(2, 0), promoMarket("AWAY")).answers).toEqual({
      promo: false
    });
    expect(deriveCatalogResults(finishedMatch(2, 1), promoMarket("AWAY")).answers).toEqual({
      promo: true
    });
  });

  const presetMarket = (selection: string) => [
    {
      answerType: "BOOLEAN",
      id: "preset",
      kind: "PROMO_SELECTION" as const,
      options: [{ value: selection }],
      title: selection
    }
  ];

  it.each([
    ["HOME_TO_SCORE", true],
    ["AWAY_TO_SCORE", true],
    ["BOTH_TEAMS_SCORE", true],
    ["HOME_WIN", true],
    ["DRAW", false],
    ["AWAY_WIN", false],
    ["HOME_TO_QUALIFY", true],
    ["AWAY_TO_QUALIFY", false],
    ["OVER_1_5", true],
    ["OVER_2_5", true],
    ["UNDER_2_5", false],
    ["UNDER_3_5", true]
  ])("apura o preset promocional %s", (selection, expected) => {
    expect(deriveCatalogResults(finishedMatch(2, 1), presetMarket(selection)).answers).toEqual({
      preset: expected
    });
  });

  it("apura classificacao pelos penaltis quando o placar termina empatado", () => {
    const match = { ...finishedMatch(1, 1), penaltyAway: 3, penaltyHome: 4 };
    expect(deriveCatalogResults(match, presetMarket("HOME_TO_QUALIFY")).answers).toEqual({
      preset: true
    });
    expect(deriveCatalogResults(match, presetMarket("AWAY_TO_QUALIFY")).answers).toEqual({
      preset: false
    });
  });

  it("aguarda o classificado quando empate ainda nao possui penaltis", () => {
    const result = deriveCatalogResults(finishedMatch(1, 1), presetMarket("HOME_TO_QUALIFY"));
    expect(result.answers).toEqual({});
    expect(result.missing).toEqual(["HOME_TO_QUALIFY"]);
  });
});
