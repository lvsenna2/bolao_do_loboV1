import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, syncLineup } = vi.hoisted(() => ({
  refresh: vi.fn(),
  syncLineup: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh
  })
}));

vi.mock("../actions/special-round-actions", () => ({
  calculateSpecialRoundAction: vi.fn(),
  cancelSpecialRoundAction: vi.fn(),
  confirmSpecialRoundEntryAction: vi.fn(),
  deleteSpecialRoundAction: vi.fn(),
  duplicateSpecialRoundAction: vi.fn(),
  markSpecialRoundPrizePaidAction: vi.fn(),
  refundSpecialRoundEntryAction: vi.fn(),
  syncAndHomologateSpecialRoundAction: vi.fn(),
  syncSpecialRoundLineupAction: syncLineup,
  toggleSpecialRoundEntryBlockAction: vi.fn(),
  updateSpecialRoundStatusAction: vi.fn(),
  updateSpecialRoundTieBreakAction: vi.fn()
}));

import { AdminSpecialRoundWorkspace } from "./admin-round-workspace";

describe("AdminSpecialRoundWorkspace", () => {
  beforeEach(() => {
    refresh.mockReset();
    syncLineup.mockReset();
  });

  it("shows lineup players and runs the dedicated synchronization", async () => {
    syncLineup.mockResolvedValue({
      data: { playerCount: 2 },
      message: "Escalacao atualizada.",
      ok: true
    });

    render(
      <AdminSpecialRoundWorkspace
        entries={[]}
        markets={[
          {
            id: "market-1",
            kind: "GOAL_SCORER",
            options: [
              { active: true, value: "PLAYER:player-1" },
              { active: true, value: "PLAYER:player-2" },
              { active: true, value: "NO_GOAL" }
            ],
            points: 3,
            sortOrder: 8,
            title: "Primeiro jogador a marcar"
          }
        ]}
        specialRoundId="round-1"
        standings={[]}
        status="PREDICTIONS_OPEN"
      />
    );

    expect(screen.getByText(/2 jogadores disponiveis/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buscar escalacao" }));

    await waitFor(() => expect(syncLineup).toHaveBeenCalledOnce());
    expect(syncLineup).toHaveBeenCalledWith("round-1");
    expect(await screen.findByText("Escalacao atualizada.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });
});
