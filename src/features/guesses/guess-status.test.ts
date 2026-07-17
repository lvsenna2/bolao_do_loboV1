import { describe, expect, it } from "vitest";

import type { GuessMatchView, GuessView } from "./data/guess-data";
import {
  formatGuessTimeRemaining,
  getGuessCardState,
  matchesGuessFilter
} from "./guess-status";

const now = new Date("2026-07-16T15:00:00.000Z").getTime();
const guess: GuessView = {
  awayPrediction: 1,
  homePrediction: 2,
  id: "guess-id",
  joker: false,
  leagueId: "league-id",
  prediction: "HOME",
  score: null,
  submittedAt: "2026-07-16T14:00:00.000Z",
  updatedAt: "2026-07-16T14:00:00.000Z"
};
const baseMatch: GuessMatchView = {
  awayScore: null,
  awayTeam: {
    apiId: 2,
    id: "away-id",
    logo: null,
    name: "Visitante",
    shortName: "VIS"
  },
  canEdit: true,
  championshipName: "Campeonato",
  city: null,
  elapsed: null,
  existingGuess: null,
  homeScore: null,
  homeTeam: {
    apiId: 1,
    id: "home-id",
    logo: null,
    name: "Mandante",
    shortName: "MAN"
  },
  id: "match-id",
  kickoff: "2026-07-16T15:45:00.000Z",
  leagueId: "league-id",
  leagueName: "Liga",
  roundId: "round-id",
  roundLabel: "Rodada 1",
  scoring: {
    exactScoreBonus: 3,
    jokerLimitPerRound: 1,
    jokerMultiplier: 2,
    winnerHit: 3
  },
  stadium: null,
  status: "SCHEDULED",
  statusLong: null
};

describe("guess status", () => {
  it("identifica palpite pendente e salvo", () => {
    expect(getGuessCardState(baseMatch)).toBe("PENDING");
    expect(getGuessCardState({ ...baseMatch, existingGuess: guess })).toBe("SAVED");
    expect(
      getGuessCardState({
        ...baseMatch,
        existingGuess: { ...guess, awayPrediction: null }
      })
    ).toBe("PENDING");
  });

  it("separa partida bloqueada, ao vivo e finalizada", () => {
    expect(getGuessCardState({ ...baseMatch, canEdit: false })).toBe("BLOCKED");
    expect(getGuessCardState({ ...baseMatch, canEdit: false, status: "LIVE" })).toBe("LIVE");
    expect(getGuessCardState({ ...baseMatch, canEdit: false, status: "FINISHED" })).toBe(
      "FINISHED"
    );
  });

  it("filtra partidas proximas de iniciar", () => {
    expect(matchesGuessFilter(baseMatch, "STARTING_SOON", now)).toBe(true);
    expect(
      matchesGuessFilter(
        { ...baseMatch, kickoff: "2026-07-16T17:00:00.000Z" },
        "STARTING_SOON",
        now
      )
    ).toBe(false);
  });

  it("considera palpites encerrados no filtro de realizados", () => {
    expect(
      matchesGuessFilter(
        { ...baseMatch, canEdit: false, existingGuess: guess, status: "FINISHED" },
        "SAVED",
        now
      )
    ).toBe(true);
  });

  it("formata o prazo sem mudar a regra de bloqueio", () => {
    expect(formatGuessTimeRemaining(baseMatch.kickoff, now)).toBe("45min restantes");
    expect(formatGuessTimeRemaining("2026-07-16T14:59:00.000Z", now)).toBe(
      "Prazo encerrado"
    );
  });
});
