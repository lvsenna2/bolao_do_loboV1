"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getMercadoPagoPayment } from "@/server/mercado-pago/client";
import { createWalletDepositPix, reconcileWalletDepositPayment } from "../services/deposit-service";
import { formatCents } from "../services/wallet-service";

const amountSchema = z.coerce.number().int().min(500).max(50_000);

export async function createWalletDepositAction(input: unknown) {
  const user = await requireUser();
  const parsed = amountSchema.safeParse(input);
  if (!parsed.success)
    return { message: "Escolha um valor entre R$ 5 e R$ 500.", ok: false as const };
  const payer = await prisma.user.findUnique({ select: { email: true }, where: { id: user.id } });
  if (!payer) return { message: "Usuario nao encontrado.", ok: false as const };

  const id = randomUUID();
  const deposit = await prisma.walletDeposit.create({
    data: {
      amountCents: parsed.data,
      checkoutKey: `wallet:${user.id}:${id}`,
      id,
      userId: user.id
    }
  });
  try {
    const payment = await createWalletDepositPix({
      amountCents: deposit.amountCents,
      depositId: deposit.id,
      payerEmail: payer.email
    });
    return {
      data: {
        amountLabel: formatCents(payment.amountCents),
        paymentId: payment.id,
        pixCode: payment.qrCode!,
        qrCodeDataUri: `data:image/png;base64,${payment.qrCodeBase64}`,
        ticketUrl: payment.ticketUrl,
        transactionId: payment.transactionId!
      },
      message: "Pix gerado.",
      ok: true as const
    };
  } catch {
    await prisma.walletDeposit.update({ data: { status: "FAILED" }, where: { id: deposit.id } });
    return { message: "Nao foi possivel gerar o Pix.", ok: false as const };
  }
}

export async function checkWalletDepositAction(depositId: string) {
  const user = await requireUser();
  const deposit = await prisma.walletDeposit.findFirst({
    where: { id: depositId, userId: user.id }
  });
  if (!deposit) return { message: "Deposito nao encontrado.", ok: false as const };
  if (deposit.status !== "PENDING" || !deposit.transactionId) {
    return { data: { status: deposit.status }, ok: true as const };
  }
  const result = await reconcileWalletDepositPayment(
    await getMercadoPagoPayment(deposit.transactionId)
  );
  revalidatePath("/carteira");
  revalidatePath("/dashboard");
  return { data: { status: result?.status ?? "PENDING" }, ok: true as const };
}
