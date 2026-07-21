const MERCADO_PAGO_BASE_URL = "https://api.mercadopago.com";
const DEFAULT_TIMEOUT_MS = 10_000;

type MercadoPagoPixTransactionData = {
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
};

export type MercadoPagoPayment = {
  date_of_expiration?: string | null;
  external_reference?: string | null;
  id: number | string;
  point_of_interaction?: {
    transaction_data?: MercadoPagoPixTransactionData;
  } | null;
  status?: string | null;
  status_detail?: string | null;
  transaction_amount?: number | null;
};

type CreatePixPaymentInput = {
  amount: number;
  description: string;
  expiresAt: Date;
  idempotencyKey: string;
  internalPaymentId: string;
  payerEmail: string;
  payerName?: string | null;
};

export class MercadoPagoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "MercadoPagoApiError";
  }
}

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim());
}

function getAccessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

  if (!token) {
    throw new MercadoPagoApiError(
      "O Mercado Pago ainda nao foi configurado pelo administrador.",
      503
    );
  }

  return token;
}

function getNotificationUrl() {
  const configured = process.env.MERCADO_PAGO_NOTIFICATION_URL?.trim();

  if (configured) {
    return configured;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? process.env.NEXTAUTH_URL?.trim() ?? "";

  if (!appUrl || appUrl.includes("localhost")) {
    return undefined;
  }

  return `${appUrl.replace(/\/$/, "")}/api/webhooks/mercado-pago`;
}

async function mercadoPagoRequest<T>(
  path: string,
  init: RequestInit,
  idempotencyKey?: string
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${MERCADO_PAGO_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
        ...init.headers
      },
      signal: controller.signal
    });
    const body = (await response.json().catch(() => null)) as T | null;

    if (!response.ok || !body) {
      throw new MercadoPagoApiError(
        `Mercado Pago respondeu com status ${response.status}.`,
        response.status,
        body
      );
    }

    return body;
  } catch (error) {
    if (error instanceof MercadoPagoApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new MercadoPagoApiError("Tempo limite ao comunicar com o Mercado Pago.", 504);
    }

    throw new MercadoPagoApiError("Falha ao comunicar com o Mercado Pago.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function splitName(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];

  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined
  };
}

export async function createMercadoPagoPixPayment(input: CreatePixPaymentInput) {
  const { firstName, lastName } = splitName(input.payerName);
  const notificationUrl = getNotificationUrl();

  return mercadoPagoRequest<MercadoPagoPayment>(
    "/v1/payments",
    {
      body: JSON.stringify({
        date_of_expiration: input.expiresAt.toISOString(),
        description: input.description.slice(0, 120),
        external_reference: input.internalPaymentId,
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        payer: {
          email: input.payerEmail,
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {})
        },
        payment_method_id: "pix",
        transaction_amount: Number(input.amount.toFixed(2))
      }),
      method: "POST"
    },
    input.idempotencyKey
  );
}

export function getMercadoPagoPayment(providerPaymentId: string) {
  if (!/^\d+$/.test(providerPaymentId)) {
    throw new MercadoPagoApiError("Identificador de pagamento invalido.", 400);
  }

  return mercadoPagoRequest<MercadoPagoPayment>(
    `/v1/payments/${encodeURIComponent(providerPaymentId)}`,
    { method: "GET" }
  );
}

export function getMercadoPagoPixData(payment: MercadoPagoPayment) {
  const data = payment.point_of_interaction?.transaction_data;

  if (!data?.qr_code || !data.qr_code_base64) {
    throw new MercadoPagoApiError(
      "O Mercado Pago nao retornou um QR Code Pix valido.",
      502,
      payment
    );
  }

  return {
    expiresAt: payment.date_of_expiration ? new Date(payment.date_of_expiration) : null,
    providerPaymentId: String(payment.id),
    providerStatus: payment.status ?? "pending",
    providerStatusDetail: payment.status_detail ?? null,
    qrCode: data.qr_code,
    qrCodeBase64: data.qr_code_base64,
    ticketUrl: data.ticket_url ?? null
  };
}
