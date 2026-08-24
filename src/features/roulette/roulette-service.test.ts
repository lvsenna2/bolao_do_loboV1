import { beforeEach, describe, expect, it, vi } from "vitest";

const { creditWalletMock, transactionMock } = vi.hoisted(() => ({
  creditWalletMock: vi.fn(),
  transactionMock: vi.fn()
}));

vi.mock("@/features/wallet/services/wallet-service", () => ({
  BONUS_ROLLOVER_MULTIPLIER: 10,
  creditWalletInTransaction: creditWalletMock
}));

vi.mock("@/server/db", () => ({
  prisma: { $transaction: transactionMock }
}));

import { DAILY_ROULETTE_PRIZES } from "./roulette-config";
import { pickRoulettePrize, spinRoulette } from "./roulette-service";

describe("daily roulette", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps configured probability at 100%", () => {
    expect(DAILY_ROULETTE_PRIZES.reduce((sum, prize) => sum + prize.probabilityUnits, 0)).toBe(
      100_000
    );
  });

  it("selects jackpot only on final unit", () => {
    expect(pickRoulettePrize(DAILY_ROULETTE_PRIZES, 99_999).id).toBe("jackpot");
  });

  it("selects no prize in first half", () => {
    expect(pickRoulettePrize(DAILY_ROULETTE_PRIZES, 49_999).id).toBe("none");
  });

  it("credits cash prizes as non-withdrawable bonus", async () => {
    const tx = {
      dailyRouletteSpin: {
        create: vi.fn().mockResolvedValue({ id: "spin-1", prizeId: "balance_200" }),
        findUnique: vi.fn().mockResolvedValue(null)
      },
      notification: { create: vi.fn().mockResolvedValue({}) }
    };
    transactionMock.mockImplementation(async (callback) => callback(tx));

    await spinRoulette("user-1", "DAILY", 70_000);

    expect(creditWalletMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amountCents: 200,
        bucket: "BONUS",
        rolloverRequirementCents: 2_000,
        userId: "user-1"
      })
    );
  });
});
