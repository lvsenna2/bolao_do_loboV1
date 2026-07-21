import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeagueEmblem, LeagueEmblemList } from "./league-emblem";

const emblem = {
  badge: { title: "Mestre dos Placares" },
  championship: { name: "Brasileirao 2026" },
  customTitle: "Mestre dos Placares",
  emblemColor: "#F4B41A",
  emblemIcon: "OFFICIAL",
  emblemKey: "SCORE_MASTER",
  emblemStyle: "CATALOG",
  id: "award-1",
  isUniversal: false
};

describe("LeagueEmblem", () => {
  it("exibe a insignia oficial e o campeonato", () => {
    render(<LeagueEmblem emblem={emblem} />);

    expect(screen.getByText("Mestre dos Placares")).toBeInTheDocument();
    expect(screen.getByText("Brasileirao 2026")).toBeInTheDocument();
  });

  it("mantem o significado acessivel na versao compacta do ranking", () => {
    render(<LeagueEmblemList emblems={[emblem]} />);

    expect(screen.getByLabelText("Mestre dos Placares, Brasileirao 2026")).toBeInTheDocument();
  });

  it("identifica uma insignia universal", () => {
    render(<LeagueEmblem emblem={{ ...emblem, isUniversal: true }} />);

    expect(screen.getByText("Emblema universal")).toBeInTheDocument();
  });
});
