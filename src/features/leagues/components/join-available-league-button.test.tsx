import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

vi.mock("../actions/league-actions", () => ({
  joinAvailableLeagueAction: vi.fn(),
  joinLeagueWithWalletAction: vi.fn()
}));

vi.mock("@/features/payments/components/pix-payment-card", () => ({
  PixPaymentCard: () => <div>Pix existente</div>
}));

import { JoinAvailableLeagueButton } from "./join-available-league-button";

describe("JoinAvailableLeagueButton", () => {
  it("mostra a opcao de voltar para um Pix criado antes de abrir a pagina", () => {
    render(
      <JoinAvailableLeagueButton
        initialPaymentIntent={{
          amountLabel: "R$ 5,00",
          leagueName: "Copa do Brasil",
          paymentId: "payment-1",
          pixCode: "pix-code",
          qrCodeDataUri: "data:image/png;base64,abc",
          transactionId: "123"
        }}
        leagueId="league-1"
        requiresPayment
      />
    );

    expect(screen.getByRole("button", { name: "Voltar e escolher saldo ou vale" })).toBeVisible();
    expect(screen.getByText("Pix existente")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Voltar e escolher saldo ou vale" }));

    expect(screen.getByRole("button", { name: "Pagar e entrar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Usar saldo ou vale" })).toBeVisible();
    expect(screen.queryByText("Pix existente")).not.toBeInTheDocument();
  });
});
