import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  isSpecialRoundMatchStarted,
  SpecialRoundMatchScoreboard,
  type SpecialRoundMatchView
} from "./match-scoreboard";

function buildMatch(overrides: Partial<SpecialRoundMatchView> = {}): SpecialRoundMatchView {
  return {
    awayScore: 1,
    awayTeamApiId: 2,
    awayTeamLogo: null,
    awayTeamName: "Aston Villa",
    elapsed: null,
    homeScore: 2,
    homeTeamApiId: 1,
    homeTeamLogo: null,
    homeTeamName: "Paris Saint-Germain",
    matchStartsAt: new Date("2026-08-12T16:00:00.000Z"),
    penaltyAway: null,
    penaltyHome: null,
    status: "FINISHED",
    ...overrides
  };
}

describe("SpecialRoundMatchScoreboard", () => {
  it("mostra o placar final quando a partida terminou", () => {
    render(<SpecialRoundMatchScoreboard match={buildMatch()} />);

    expect(screen.getByLabelText("Placar 2 a 1")).toBeInTheDocument();
    expect(screen.getByText("Jogo encerrado")).toBeInTheDocument();
  });

  it("mostra os penaltis quando a decisao foi para as cobrancas", () => {
    render(
      <SpecialRoundMatchScoreboard
        match={buildMatch({ awayScore: 2, penaltyAway: 3, penaltyHome: 4 })}
      />
    );

    expect(screen.getByText("Penaltis 4 x 3")).toBeInTheDocument();
  });

  it("mostra o minuto de jogo enquanto a partida esta ao vivo", () => {
    render(<SpecialRoundMatchScoreboard match={buildMatch({ elapsed: 63, status: "LIVE" })} />);

    expect(screen.getByText("63'")).toBeInTheDocument();
  });

  it("nao mostra placar antes do apito inicial", () => {
    render(
      <SpecialRoundMatchScoreboard
        match={buildMatch({ awayScore: null, homeScore: null, status: "SCHEDULED" })}
      />
    );

    expect(screen.queryByLabelText(/^Placar/)).not.toBeInTheDocument();
    expect(screen.getByText("A comecar")).toBeInTheDocument();
  });
});

describe("isSpecialRoundMatchStarted", () => {
  it("considera iniciada apenas depois que a partida sai do calendario", () => {
    expect(isSpecialRoundMatchStarted(null)).toBe(false);
    expect(isSpecialRoundMatchStarted("SCHEDULED")).toBe(false);
    expect(isSpecialRoundMatchStarted("POSTPONED")).toBe(false);
    expect(isSpecialRoundMatchStarted("LIVE")).toBe(true);
    expect(isSpecialRoundMatchStarted("FINISHED")).toBe(true);
  });
});
