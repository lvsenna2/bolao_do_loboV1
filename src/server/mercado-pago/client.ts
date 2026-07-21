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
};

type MercadoPagoErrorCause = {
  code?: number | string;
  description?: string;
};

type MercadoPagoErrorBody = {
  cause?: MercadoPagoErrorCause[] | MercadoPagoErrorCause | string;
  error?: string;
  message?: string;
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? process.env.NEXTAUTH_URL?.trim() ?? "";
  const candidates = [
    configured,
    appUrl && !appUrl.includes("localhost")
      ? `${appUrl.replace(/\/$/, "")}/api/webhooks/mercado-pago`
      : undefined
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    try {
      const url = new URL(candidate);

      if (url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

export function getMercadoPagoErrorDescription(details: unknown) {
  if (!details || typeof details !== "object") {
    return null;
  }

  const body = details as MercadoPagoErrorBody;
  const causes = Array.isArray(body.cause) ? body.cause : body.cause ? [body.cause] : [];
  const causeDescriptions = causes.flatMap((cause) => {
    if (typeof cause === "string") {
      return cause;
    }

    return cause.description ? cause.description : [];
  });
  const messages = [body.message, ...causeDescriptions, body.error]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
  const message = [...new Set(messages)].join(" | ");

  return message ? message.slice(0, 300) : null;
}

function getMercadoPagoUserMessage(status: number, details: unknown) {
  const description = getMercadoPagoErrorDescription(details);
  const normalized = description?.toLowerCase() ?? "";

  if (normalized.includes("without key enabled") || normalized.includes("qr render")) {
    return "A conta Mercado Pago recebedora ainda nao possui uma chave Pix habilitada. Ative uma chave Pix no aplicativo do Mercado Pago e tente novamente.";
  }

  if (normalized.includes("test") && normalized.includes("credential")) {
    return "O Mercado Pago recusou a cobranca porque a credencial configurada e de teste. Use o Access Token de producao para gerar um Pix real.";
  }

  if (normalized.includes("notification_url") || normalized.includes("notification url")) {
    return "A URL de notificacao configurada no Mercado Pago e invalida. Revise MERCADO_PAGO_NOTIFICATION_URL na Vercel.";
  }

  if (normalized.includes("payer") && normalized.includes("collector")) {
    return "O pagador nao pode ser a mesma conta Mercado Pago que recebera o pagamento.";
  }

  if (normalized.includes("transaction_amount") || normalized.includes("transaction amount")) {
    return "O Mercado Pago recusou o valor da cobranca. Revise o valor de entrada da liga.";
  }

  if (description) {
    return `O Mercado Pago recusou a cobranca: ${description}`;
  }

  return `Mercado Pago respondeu com status ${status}. Verifique o Access Token de producao e se o Pix esta ativo na conta recebedora.`;
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
      const message = getMercadoPagoUserMessage(response.status, body);

      console.error("Mercado Pago API request rejected", {
        detail: getMercadoPagoErrorDescription(body),
        path,
        status: response.status
      });
      throw new MercadoPagoApiError(message, response.status, body);
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

export async function createMercadoPagoPixPayment(input: CreatePixPaymentInput) {
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
          email: input.payerEmail.trim().toLowerCase()
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
