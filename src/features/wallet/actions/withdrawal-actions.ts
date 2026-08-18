"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireUser } from "@/server/auth/session";
import { formatCents, getWalletBalance } from "../services/wallet-service";
import {
  approveWithdrawal,
  cancelWithdrawal,
  markWithdrawalPaid,
  MAX_WITHDRAWAL_CENTS,
  MIN_WITHDRAWAL_CENTS,
  normalizePixKey,
  rejectWithdrawal,
  requestWithdrawal,
  sendWithdrawalPix
} from "../services/withdrawal-service";

const pixKeyTypeSchema = z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]);

const requestSchema = z.object({
  amountCents: z.coerce.number().int().min(MIN_WITHDRAWAL_CENTS).max(MAX_WITHDRAWAL_CENTS),
  pixKey: z.string().trim().min(3).max(140),
  pixKeyOwnerName: z.string().trim().min(3).max(120),
  pixKeyType: pixKeyTypeSchema
});

function revalidateWallet() {
  revalidatePath("/carteira");
  revalidatePath("/dashboard");
  revalidatePath("/admin/saques");
}

export async function requestWithdrawalAction(input: unknown) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: "Confira o valor e os dados da chave Pix antes de enviar.",
      ok: false as const
    };
  }

  const pixKey = normalizePixKey(parsed.data.pixKeyType, parsed.data.pixKey);

  if (!pixKey) {
    return { message: "Essa chave Pix nao esta no formato certo.", ok: false as const };
  }

  const wallet = await getWalletBalance(user.id);

  // Saque so enxerga o saldo normal. O bonus vira normal ao concluir o rollover.
  if (wallet.balanceCents < parsed.data.amountCents) {
    return {
      message:
        wallet.bonusBalanceCents || wallet.bonusRolloverRemainingCents
          ? `Saldo insuficiente para esse saque. Falta apostar ${formatCents(wallet.bonusRolloverRemainingCents)} para concluir o rollover do bonus.`
          : "Saldo insuficiente para esse saque.",
      ok: false as const
    };
  }

  try {
    await requestWithdrawal({
      amountCents: parsed.data.amountCents,
      pixKey,
      pixKeyOwnerName: parsed.data.pixKeyOwnerName,
      pixKeyType: parsed.data.pixKeyType,
      userId: user.id
    });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";

    if (code === "WITHDRAWAL_ALREADY_PENDING") {
      return {
        message: "Voce ja tem um saque em andamento. Aguarde a conclusao para pedir outro.",
        ok: false as const
      };
    }

    if (code === "WALLET_INSUFFICIENT_BALANCE") {
      return { message: "Saldo insuficiente para esse saque.", ok: false as const };
    }

    console.error("[wallet] Falha ao pedir saque", cause);
    return { message: "Nao foi possivel registrar o saque agora.", ok: false as const };
  }

  revalidateWallet();
  return {
    message: "Saque solicitado. O valor sai da carteira e cai na sua chave Pix apos a conferencia.",
    ok: true as const
  };
}

export async function cancelWithdrawalAction(withdrawalId: string) {
  const user = await requireUser();

  try {
    await cancelWithdrawal({ userId: user.id, withdrawalId });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";

    if (code === "WITHDRAWAL_NOT_CANCELLABLE") {
      return {
        message: "Esse saque ja esta em processamento e nao pode mais ser cancelado.",
        ok: false as const
      };
    }

    return { message: "Saque nao encontrado.", ok: false as const };
  }

  revalidateWallet();
  return { message: "Saque cancelado e valor devolvido para a carteira.", ok: true as const };
}

function payoutResultMessage(status: string, transferError: string | null) {
  if (status === "PAID") return "Saque aprovado e Pix enviado.";
  if (status === "PIX_FAILED") {
    return `Saque aprovado, mas o Pix falhou: ${transferError ?? "erro nao informado"}. O valor segue retido.`;
  }
  if (status === "PIX_PROCESSING") return "Saque aprovado. O Pix esta em processamento.";
  return "Saque aprovado. Agora faca o Pix e marque como pago.";
}

export async function approveWithdrawalAction(withdrawalId: string) {
  const admin = await requireAdmin();

  try {
    const result = await approveWithdrawal({ adminId: admin.id, withdrawalId });
    revalidateWallet();
    return {
      message: payoutResultMessage(result.status, result.transferError),
      ok: result.status !== "PIX_FAILED"
    };
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";

    if (code === "WITHDRAWAL_NOT_REVIEWABLE" || code === "WITHDRAWAL_PIX_ALREADY_RUNNING") {
      revalidateWallet();
      return {
        message: "Esse saque ja foi aprovado. Atualize a pagina para ver o status atual.",
        ok: false as const
      };
    }

    console.error("[wallet] Falha ao aprovar saque", cause);
    return { message: "Nao foi possivel aprovar esse saque.", ok: false as const };
  }
}

/** Reenvia o Pix de um saque que ficou em PIX_FAILED, com a mesma chave de idempotencia. */
export async function retryWithdrawalPixAction(withdrawalId: string) {
  const admin = await requireAdmin();

  try {
    const result = await sendWithdrawalPix({ adminId: admin.id, withdrawalId });
    revalidateWallet();
    return {
      message: payoutResultMessage(result.status, result.transferError),
      ok: result.status !== "PIX_FAILED"
    };
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";

    if (code === "WITHDRAWAL_PIX_ALREADY_RUNNING") {
      return { message: "Ja existe um Pix em processamento para esse saque.", ok: false as const };
    }
    if (code === "WITHDRAWAL_NOT_PAYABLE") {
      return { message: "Esse saque nao esta em um estado que permita reenvio.", ok: false as const };
    }

    console.error("[wallet] Falha ao reenviar Pix do saque", cause);
    return { message: "Nao foi possivel reenviar o Pix.", ok: false as const };
  }
}

export async function markWithdrawalPaidAction(input: {
  receiptRef?: string;
  withdrawalId: string;
}) {
  const admin = await requireAdmin();

  try {
    await markWithdrawalPaid({
      adminId: admin.id,
      receiptRef: input.receiptRef,
      withdrawalId: input.withdrawalId
    });
  } catch (cause) {
    console.error("[wallet] Falha ao marcar saque como pago", cause);
    return { message: "Nao foi possivel marcar como pago.", ok: false as const };
  }

  revalidateWallet();
  return { message: "Saque marcado como pago.", ok: true as const };
}

/** Versoes para `<form action={...}>` do painel admin, que sempre entrega FormData. */
export async function approveWithdrawalFormAction(formData: FormData) {
  await approveWithdrawalAction(String(formData.get("withdrawalId") ?? ""));
}

export async function retryWithdrawalPixFormAction(formData: FormData) {
  await retryWithdrawalPixAction(String(formData.get("withdrawalId") ?? ""));
}

export async function markWithdrawalPaidFormAction(formData: FormData) {
  await markWithdrawalPaidAction({
    receiptRef: String(formData.get("receiptRef") ?? ""),
    withdrawalId: String(formData.get("withdrawalId") ?? "")
  });
}

export async function rejectWithdrawalFormAction(formData: FormData) {
  await rejectWithdrawalAction({
    reason: String(formData.get("reason") ?? ""),
    withdrawalId: String(formData.get("withdrawalId") ?? "")
  });
}

export async function rejectWithdrawalAction(input: { reason: string; withdrawalId: string }) {
  const admin = await requireAdmin();
  const reason = input.reason?.trim();

  if (!reason || reason.length < 5) {
    return { message: "Escreva o motivo da recusa (o usuario vai ver).", ok: false as const };
  }

  try {
    await rejectWithdrawal({
      adminId: admin.id,
      reason: reason.slice(0, 240),
      withdrawalId: input.withdrawalId
    });
  } catch (cause) {
    console.error("[wallet] Falha ao recusar saque", cause);
    return { message: "Nao foi possivel recusar esse saque.", ok: false as const };
  }

  revalidateWallet();
  return { message: "Saque recusado e valor devolvido ao usuario.", ok: true as const };
}
