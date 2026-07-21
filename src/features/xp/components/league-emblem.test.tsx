import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeagueEmblem, LeagueEmblemList } from "./league-emblem";

const emblem = {
  badge: { title: "Mira Certeira" },
  championship: { name: "Brasileirao 2026" },
  customTitle: "Rei dos Acertos",
  emblemColor: "#22C55E",
  emblemIcon: "TARGET",
  emblemStyle: "SHIELD",
  id: "award-1"
};

describe("LeagueEmblem", () => {
  it("exibe a insignia personalizada e o campeonato", () => {
    render(<LeagueEmblem emblem={emblem} />);

    expect(screen.getByText("Rei dos Acertos")).toBeInTheDocument();
    expect(screen.getByText("Brasileirao 2026")).toBeInTheDocument();
  });

  it("mantem o significado acessivel na versao compacta do ranking", () => {
    render(<LeagueEmblemList emblems={[emblem]} />);

    expect(screen.getByLabelText("Rei dos Acertos, Brasileirao 2026")).toBeInTheDocument();
  });
});
