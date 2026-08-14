import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, providerMock, sendPixMock } = vi.hoisted(() => {
  const sendPixMock = vi.fn();
  return {
    prismaMock: {
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (input: unknown) =>
        typeof input === "function" ? (input as (c: unknown) => Promise<unknown>)({}) : input
      ),
      notification: { upsert: vi.fn(async () => ({})) },
      walletWithdrawal: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          amountCents: 5_000,
          id: "w1",
          userId: "u1",
          ...data
        })),
        updateMany: vi.fn(async () => ({ count: 1 }))
      }
    },
    providerMock: vi.fn(),
    sendPixMock
  };
});

vi.mock("@/server/db", () => ({ prisma: prismaMock }));
vi.mock("./pix-payout-provider", () => ({
  getPixPayoutProvider: providerMock
}));
vi.mock("./wallet-service", () => ({
  creditWalletInTransaction: vi.fn(),
  debitWalletInTransaction: vi.fn(),
  formatCents: (value: number) => `R$ ${(value / 100).toFixed(2)}`
}));

import { approveWithdrawal, sendWithdrawalPix } from "./withdrawal-service";

const requested = {
  amountCents: 5_000,
  id: "w1",
  payoutIdempotencyKey: "withdrawal:abc",
  pixKey: "12345678901",
  pixKeyOwnerName: "Fulano",
  pixKeyType: "CPF" as const,
  status: "REQUESTED" as const,
  userId: "u1"
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.walletWithdrawal.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.walletWithdrawal.findUnique.mockResolvedValue(requested);
  prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue({
    ...requested,
    status: "APPROVED"
  });
});

describe("aprovacao sem provedor de Pix contratado", () => {
  beforeEach(() => providerMock.mockReturnValue(null));

  it("apenas aprova e deixa o saque aguardando o Pix manual", async () => {
    const result = await approveWithdrawal({ adminId: "admin-1", withdrawalId: "w1" });

    expect(result.status).toBe("APPROVED");
    expect(sendPixMock).not.toHaveBeenCalled();
  });

  it("registra quem aprovou", async () => {
    await approveWithdrawal({ adminId: "admin-1", withdrawalId: "w1" });

    expect(prismaMock.walletWithdrawal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ approvedById: "admin-1", status: "APPROVED" }),
        where: { id: "w1", status: "REQUESTED" }
      })
    );
  });
});

describe("aprovacao com provedor de Pix", () => {
  beforeEach(() => {
    providerMock.mockReturnValue({ name: "psp-teste", sendPix: sendPixMock });
  });

  it("envia o Pix com a chave de idempotencia do saque e marca como pago", async () => {
    sendPixMock.mockResolvedValue({ ok: true, providerStatus: "done", transferId: "tx-1" });

    const result = await approveWithdrawal({ adminId: "admin-1", withdrawalId: "w1" });

    expect(sendPixMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 5_000,
        idempotencyKey: "withdrawal:abc",
        pixKey: "12345678901"
      })
    );
    expect(result.status).toBe("PAID");
    expect(result.transferId).toBe("tx-1");
  });

  it("deixa o saque em PIX_FAILED com a mensagem do erro, sem marcar como pago", async () => {
    sendPixMock.mockResolvedValue({ error: "Chave Pix invalida", ok: false });

    const result = await approveWithdrawal({ adminId: "admin-1", withdrawalId: "w1" });

    expect(result.status).toBe("PIX_FAILED");
    expect(result.transferError).toBe("Chave Pix invalida");
    expect(result.paidAt).toBeUndefined();
  });

  it("trata erro inesperado do provedor como falha, nunca como pago", async () => {
    sendPixMock.mockRejectedValue(new Error("timeout na rede"));

    const result = await approveWithdrawal({ adminId: "admin-1", withdrawalId: "w1" });

    expect(result.status).toBe("PIX_FAILED");
    expect(result.transferError).toBe("timeout na rede");
  });

  it("nao dispara um segundo Pix quando o saque ja saiu de REQUESTED", async () => {
    prismaMock.walletWithdrawal.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      approveWithdrawal({ adminId: "admin-1", withdrawalId: "w1" })
    ).rejects.toThrow("WITHDRAWAL_NOT_REVIEWABLE");
    expect(sendPixMock).not.toHaveBeenCalled();
  });

  it("nao dispara um segundo Pix quando outra requisicao ja pegou o saque aprovado", async () => {
    prismaMock.walletWithdrawal.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      sendWithdrawalPix({ adminId: "admin-1", withdrawalId: "w1" })
    ).rejects.toThrow("WITHDRAWAL_PIX_ALREADY_RUNNING");
    expect(sendPixMock).not.toHaveBeenCalled();
  });

  it("recusa reenviar Pix de saque que ja esta pago", async () => {
    prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue({
      ...requested,
      status: "PAID"
    });

    await expect(
      sendWithdrawalPix({ adminId: "admin-1", withdrawalId: "w1" })
    ).rejects.toThrow("WITHDRAWAL_NOT_PAYABLE");
    expect(sendPixMock).not.toHaveBeenCalled();
  });

  it("reenvia um saque em PIX_FAILED com a mesma chave de idempotencia", async () => {
    prismaMock.walletWithdrawal.findUniqueOrThrow.mockResolvedValue({
      ...requested,
      status: "PIX_FAILED"
    });
    sendPixMock.mockResolvedValue({ ok: true, providerStatus: "done", transferId: "tx-2" });

    const result = await sendWithdrawalPix({ adminId: "admin-1", withdrawalId: "w1" });

    expect(sendPixMock).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "withdrawal:abc" })
    );
    expect(result.status).toBe("PAID");
  });
});
