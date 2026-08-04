"use server";

import { revalidatePath } from "next/cache";

import { serverNow } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getMercadoPagoPayment } from "@/server/mercado-pago/client";
import { apiFundingContributionSchema } from "./schemas";
import { createApiFundingPix, reconcileApiFundingPayment, toApiFundingPaymentView } from "./payment-service";
import type { ApiFundingActionResult, ApiFundingPaymentView } from "./types";

function revalidateFunding() {
  revalidatePath("/apoie-a-api");
  revalidatePath("/notificacoes");
}

export async function createApiFundingContributionAction(
  input: unknown
): Promise<ApiFundingActionResult<ApiFundingPaymentView>> {
  const user = await requireUser();
  const parsed = apiFundingContributionSchema.safeParse(input);
  if (!parsed.success) {
    return { message: "Escolha R$ 10, R$ 15 ou R$ 20 para contribuir.", ok: false };
  }

  const now = serverNow();
  const payer = await prisma.user.findUnique({ select: { email: true }, where: { id: user.id } });
  if (!payer) return { message: "Usuario nao encontrado.", ok: false };

  const activePending = await prisma.apiFundingContribution.findFirst({
    orderBy: { createdAt: "desc" },
    where: {
      paymentExpiresAt: { gt: now },
      qrCode: { not: null },
      qrCodeBase64: { not: null },
      status: "PENDING",
      transactionId: { not: null },
      userId: user.id
    }
  });
  const pendingView = activePending ? toApiFundingPaymentView(activePending) : null;
  if (pendingView) {
    return {
      data: pendingView,
      message: "Voce ja possui uma contribuicao aguardando pagamento.",
      ok: true
    };
  }

  const checkoutKey = `api-funding:${user.id}:${parsed.data.idempotencyKey}`;

  try {
    const contribution = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.apiFundingContribution.findUnique({ where: { checkoutKey } });
        if (existing) return existing;

        return tx.apiFundingContribution.create({
          data: {
            amount: parsed.data.amount,
            checkoutKey,
            userId: user.id
          }
        });
      },
      { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 }
    );

    const existingView = toApiFundingPaymentView(contribution);
    const payment =
      existingView ??
      (await createApiFundingPix({ contributionId: contribution.id, payerEmail: payer.email }));

    revalidateFunding();
    return { data: payment, message: "PIX gerado com seguranca.", ok: true };
  } catch (error) {
    console.error("API funding PIX creation failed", {
      message: error instanceof Error ? error.message : "unknown",
      userId: user.id
    });
    return { message: "Nao foi possivel gerar o PIX. Tente novamente.", ok: false };
  }
}

export async function checkApiFundingPaymentAction(
  contributionId: string
): Promise<ApiFundingActionResult<{ status: string }>> {
  const user = await requireUser();
  const contribution = await prisma.apiFundingContribution.findFirst({
    where: { id: contributionId, userId: user.id }
  });
  if (!contribution) return { message: "Contribuicao nao encontrada.", ok: false };
  if (contribution.status !== "PENDING" || !contribution.transactionId) {
    return {
      data: { status: contribution.status },
      message: "Status consultado.",
      ok: true
    };
  }

  try {
    const provider = await getMercadoPagoPayment(contribution.transactionId);
    const result = await reconcileApiFundingPayment(provider);
    if (!result) throw new Error("API_FUNDING_PAYMENT_NOT_FOUND");
    revalidateFunding();
    return { data: { status: result.status }, message: "Status atualizado.", ok: true };
  } catch (error) {
    console.error("API funding payment check failed", {
      contributionId,
      message: error instanceof Error ? error.message : "unknown",
      userId: user.id
    });
    return { message: "Ainda nao foi possivel confirmar a contribuicao.", ok: false };
  }
}
