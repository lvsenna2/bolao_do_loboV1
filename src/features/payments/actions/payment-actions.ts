"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { reconcileMercadoPagoPaymentById } from "@/server/mercado-pago/payment-service";

export type PaymentStatusResult =
  | { ok: true; status: "APPROVED" | "PENDING" | "FAILED" | "REFUNDED" | "CANCELLED" }
  | { ok: false; message: string };

export async function checkMercadoPagoPaymentAction(
  paymentId: string
): Promise<PaymentStatusResult> {
  const user = await requireUser();
  const payment = await prisma.payment.findFirst({
    select: {
      id: true,
      status: true,
      transactionId: true
    },
    where: {
      id: paymentId,
      userId: user.id
    }
  });

  if (!payment) {
    return { ok: false, message: "Pagamento nao encontrado." };
  }

  if (payment.status === "APPROVED") {
    return { ok: true, status: "APPROVED" };
  }

  if (!payment.transactionId || payment.status !== "PENDING") {
    return { ok: true, status: payment.status };
  }

  try {
    const result = await reconcileMercadoPagoPaymentById(payment.transactionId);

    if (result.status === "APPROVED") {
      revalidatePath("/dashboard");
      revalidatePath("/ligas");
      revalidatePath("/minhas-ligas");
      revalidatePath("/palpites");
      revalidatePath("/ranking");
      revalidatePath("/rodadas");
    }

    return { ok: true, status: result.status };
  } catch (error) {
    console.error("Mercado Pago payment status check failed", {
      message: error instanceof Error ? error.message : "unknown",
      paymentId: payment.id,
      userId: user.id
    });
    return { ok: false, message: "Ainda nao foi possivel confirmar o pagamento." };
  }
}
