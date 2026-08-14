import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

import {
  creditWalletInTransaction,
  debitWalletInTransaction,
  reverseWalletCreditInTransaction
} from "./wallet-service";

/**
 * Carteira em memoria com a mesma semantica do Prisma para os campos usados aqui: `updateMany`
 * so aplica quando o filtro de saldo passa, que e o que impede gasto duplicado.
 */
function walletTx(initial: { balanceCents: number; bonusBalanceCents: number }) {
  const state = { ...initial };
  const created: {
    amountCents: number;
    balanceAfterCents: number;
    balanceBeforeCents: number;
    bonusAmountCents: number;
    uniqueKey: string;
  }[] = [];

  return {
    created,
    state,
    tx: {
      wallet: {
        findUniqueOrThrow: vi.fn(async () => ({ ...state })),
        update: vi.fn(async ({ data }: { data: Record<string, { decrement?: number; increment?: number }> }) => {
          for (const [field, change] of Object.entries(data)) {
            const key = field as "balanceCents" | "bonusBalanceCents";
            state[key] += (change.increment ?? 0) - (change.decrement ?? 0);
          }
          return { ...state };
        }),
        updateMany: vi.fn(
          async ({
            data,
            where
          }: {
            data: Record<string, { decrement?: number }>;
            where: Record<string, { gte?: number } | string>;
          }) => {
            const fits = (["balanceCents", "bonusBalanceCents"] as const).every((key) => {
              const filter = where[key];
              return typeof filter === "object" && filter?.gte !== undefined
                ? state[key] >= filter.gte
                : true;
            });
            if (!fits) return { count: 0 };
            for (const [field, change] of Object.entries(data)) {
              state[field as "balanceCents" | "bonusBalanceCents"] -= change.decrement ?? 0;
            }
            return { count: 1 };
          }
        ),
        upsert: vi.fn(async () => ({ ...state }))
      },
      walletTransaction: {
        create: vi.fn(async ({ data }: { data: (typeof created)[number] }) => {
          created.push(data);
          return data;
        }),
        findUnique: vi.fn(async ({ where }: { where: { uniqueKey: string } }) =>
          created.find((row) => row.uniqueKey === where.uniqueKey)
        )
      }
    }
  };
}

const base = {
  description: "teste",
  type: "BET" as const,
  userId: "user-1"
};

describe("debito na carteira", () => {
  let wallet: ReturnType<typeof walletTx>;

  beforeEach(() => {
    wallet = walletTx({ balanceCents: 3_000, bonusBalanceCents: 1_000 });
  });

  it("gasta o bonus antes do saldo normal", async () => {
    await debitWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 400,
      uniqueKey: "k1"
    });

    expect(wallet.state).toEqual({ balanceCents: 3_000, bonusBalanceCents: 600 });
    expect(wallet.created[0]).toMatchObject({
      amountCents: -400,
      balanceAfterCents: 3_600,
      balanceBeforeCents: 4_000,
      bonusAmountCents: -400
    });
  });

  it("completa com o saldo normal quando o bonus nao cobre", async () => {
    await debitWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 2_500,
      uniqueKey: "k2"
    });

    expect(wallet.state).toEqual({ balanceCents: 1_500, bonusBalanceCents: 0 });
    expect(wallet.created[0]).toMatchObject({ bonusAmountCents: -1_000 });
  });

  it("ignora o bonus em operacao REAL_ONLY, como o saque", async () => {
    await debitWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 3_000,
      source: "REAL_ONLY",
      type: "WITHDRAWAL",
      uniqueKey: "k3"
    });

    expect(wallet.state).toEqual({ balanceCents: 0, bonusBalanceCents: 1_000 });
    expect(wallet.created[0]).toMatchObject({ bonusAmountCents: 0 });
  });

  it("recusa saque acima do saldo normal mesmo com bonus no total", async () => {
    await expect(
      debitWalletInTransaction(wallet.tx as never, {
        ...base,
        amountCents: 3_500,
        source: "REAL_ONLY",
        type: "WITHDRAWAL",
        uniqueKey: "k4"
      })
    ).rejects.toThrow("WALLET_INSUFFICIENT_BALANCE");
    expect(wallet.state).toEqual({ balanceCents: 3_000, bonusBalanceCents: 1_000 });
  });

  it("nao cobra duas vezes a mesma chave", async () => {
    await debitWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 500,
      uniqueKey: "k5"
    });
    await debitWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 500,
      uniqueKey: "k5"
    });

    expect(wallet.created).toHaveLength(1);
    expect(wallet.state.bonusBalanceCents).toBe(500);
  });
});

describe("credito na carteira", () => {
  it("separa o balde de destino e mantem o extrato no saldo total", async () => {
    const wallet = walletTx({ balanceCents: 1_000, bonusBalanceCents: 0 });

    await creditWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 500,
      bucket: "BONUS",
      type: "BONUS",
      uniqueKey: "c1"
    });

    expect(wallet.state).toEqual({ balanceCents: 1_000, bonusBalanceCents: 500 });
    expect(wallet.created[0]).toMatchObject({
      balanceAfterCents: 1_500,
      balanceBeforeCents: 1_000,
      bonusAmountCents: 500
    });
  });

  it("credita no saldo normal por padrao", async () => {
    const wallet = walletTx({ balanceCents: 0, bonusBalanceCents: 0 });

    await creditWalletInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 2_000,
      type: "DEPOSIT",
      uniqueKey: "c2"
    });

    expect(wallet.state).toEqual({ balanceCents: 2_000, bonusBalanceCents: 0 });
    expect(wallet.created[0]).toMatchObject({ bonusAmountCents: 0 });
  });

  it("estorna um credito do mesmo balde", async () => {
    const wallet = walletTx({ balanceCents: 0, bonusBalanceCents: 800 });

    await reverseWalletCreditInTransaction(wallet.tx as never, {
      ...base,
      amountCents: 800,
      bucket: "BONUS",
      type: "REFUND",
      uniqueKey: "r1"
    });

    expect(wallet.state).toEqual({ balanceCents: 0, bonusBalanceCents: 0 });
  });
});
