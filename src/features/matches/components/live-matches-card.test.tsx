import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { LiveMatchesCard } from "./live-matches-card";
import type { LiveMatchView } from "../data/live-matches-data";

function buildMatch(overrides: Partial<LiveMatchView> = {}): LiveMatchView {
  return {
    awayScore: 1,
    awayTeam: { apiId: 2, logo: null, name: "Palmeiras", shortName: "PAL" },
    championshipName: "Brasileirao Serie A",
    elapsed: 72,
    homeScore: 2,
    homeTeam: { apiId: 1, logo: null, name: "Flamengo", shortName: "FLA" },
    id: "match-1",
    status: "LIVE",
    ...overrides
  };
}

describe("LiveMatchesCard", () => {
  it("mostra placar, minuto e campeonato de um jogo ao vivo", () => {
    render(<LiveMatchesCard matches={[buildMatch()]} />);

    expect(screen.getByText("Jogos ao vivo")).toBeInTheDocument();
    expect(screen.getByText("FLA")).toBeInTheDocument();
    expect(screen.getByText("PAL")).toBeInTheDocument();
    expect(screen.getByLabelText("Placar 2 a 1")).toBeInTheDocument();
    expect(screen.getByText("72'")).toBeInTheDocument();
    expect(screen.getByText("Brasileirao Serie A")).toBeInTheDocument();
  });

  it("mostra o intervalo sem minuto de jogo", () => {
    render(<LiveMatchesCard matches={[buildMatch({ elapsed: 45, status: "HALFTIME" })]} />);

    expect(screen.getByText("Intervalo")).toBeInTheDocument();
    expect(screen.queryByText("45'")).not.toBeInTheDocument();
  });

  it("nao renderiza nada sem jogos ao vivo", () => {
    const { container } = render(<LiveMatchesCard matches={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
