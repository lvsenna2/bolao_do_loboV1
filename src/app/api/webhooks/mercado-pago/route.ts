import { NextResponse } from "next/server";

import {
  reconcileMercadoPagoPaymentById,
  validateMercadoPagoWebhookSignature
} from "@/server/mercado-pago/payment-service";
import {
  reconcileSubscriptionAuthorizedPaymentById,
  reconcileSubscriptionPreapprovalById
} from "@/features/subscriptions/payment-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MercadoPagoWebhookBody = {
  action?: string;
  data?: {
    id?: number | string;
  };
  type?: string;
};

function getDataId(request: Request, body: MercadoPagoWebhookBody) {
  const url = new URL(request.url);
  return String(
    url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? body.data?.id ?? ""
  );
}

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "mercado-pago-webhook"
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as MercadoPagoWebhookBody;
  const topic = body.type ?? new URL(request.url).searchParams.get("type") ?? "payment";

  if (!["payment", "subscription_preapproval", "subscription_authorized_payment"].includes(topic)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const dataId = getDataId(request, body);
  const requestId = request.headers.get("x-request-id") ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";

  const validId =
    topic === "subscription_preapproval" ? /^[A-Za-z0-9-]+$/.test(dataId) : /^\d+$/.test(dataId);
  if (!dataId || !validId) {
    return NextResponse.json({ ok: false, message: "Recurso invalido." }, { status: 400 });
  }

  if (
    !secret ||
    !requestId ||
    !signature ||
    !validateMercadoPagoWebhookSignature({ dataId, requestId, secret, signature })
  ) {
    return NextResponse.json({ ok: false, message: "Assinatura invalida." }, { status: 401 });
  }

  try {
    const result =
      topic === "subscription_preapproval"
        ? await reconcileSubscriptionPreapprovalById(dataId)
        : topic === "subscription_authorized_payment"
          ? await reconcileSubscriptionAuthorizedPaymentById(dataId)
          : await reconcileMercadoPagoPaymentById(dataId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Mercado Pago webhook reconciliation failed", {
      dataId,
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
