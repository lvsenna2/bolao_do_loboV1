import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SpecialRoundPredictionForm } from "./prediction-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

vi.mock("../actions/special-round-actions", () => ({
  submitSpecialRoundPredictionsAction: vi.fn()
}));

const scorerMarket = {
  answerType: "OPTION_LIST" as const,
  description: "Escolha o primeiro jogador a marcar.",
  id: "market-1",
  kind: "GOAL_SCORER" as const,
  points: 3,
  required: true,
  title: "Primeiro jogador a marcar"
};

describe("SpecialRoundPredictionForm", () => {
  it("keeps both team groups ready while the lineup is unavailable", () => {
    render(
      <SpecialRoundPredictionForm
        awayTeamName="Sao Paulo"
        homeTeamName="Flamengo"
        initialAnswers={{}}
        markets={[
          {
            ...scorerMarket,
            options: [{ label: "Nenhum jogador (sem gols)", value: "NO_GOAL" }]
          }
        ]}
        specialRoundId="round-1"
      />
    );

    const select = screen.getByRole("combobox", { name: "Primeiro jogador a marcar" });
    expect(select.querySelector('optgroup[label="Flamengo"]')).toBeInTheDocument();
    expect(select.querySelector('optgroup[label="Sao Paulo"]')).toBeInTheDocument();
    expect(screen.getByText(/jogadores aparecerao aqui/i)).toBeInTheDocument();
  });

  it("places synchronized players under their respective teams", () => {
    render(
      <SpecialRoundPredictionForm
        awayTeamName="Sao Paulo"
        homeTeamName="Flamengo"
        initialAnswers={{}}
        markets={[
          {
            ...scorerMarket,
            options: [
              { group: "Flamengo", label: "Pedro", value: "PLAYER:player-1" },
              { group: "Sao Paulo", label: "Calleri", value: "PLAYER:player-2" },
              { label: "Nenhum jogador (sem gols)", value: "NO_GOAL" }
            ]
          }
        ]}
        specialRoundId="round-1"
      />
    );

    const select = screen.getByRole("combobox", { name: "Primeiro jogador a marcar" });
    const homeGroup = select.querySelector('optgroup[label="Flamengo"]');
    const awayGroup = select.querySelector('optgroup[label="Sao Paulo"]');

    expect(homeGroup).not.toBeNull();
    expect(awayGroup).not.toBeNull();
    expect(
      within(homeGroup as HTMLElement).getByRole("option", { name: "Pedro" })
    ).toBeInTheDocument();
    expect(
      within(awayGroup as HTMLElement).getByRole("option", { name: "Calleri" })
    ).toBeInTheDocument();
  });
});
