import { NextResponse } from "next/server";

import {
  reconcileMercadoPagoPaymentById,
  validateMercadoPagoWebhookSignature
} from "@/server/mercado-pago/payment-service";

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

  if (body.type && body.type !== "payment") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const dataId = getDataId(request, body);
  const requestId = request.headers.get("x-request-id") ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";

  if (!dataId || !/^\d+$/.test(dataId)) {
    return NextResponse.json({ ok: false, message: "Pagamento invalido." }, { status: 400 });
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
    const result = await reconcileMercadoPagoPaymentById(dataId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Mercado Pago webhook reconciliation failed", {
      dataId,
      message: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
