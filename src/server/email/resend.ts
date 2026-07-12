type SendEmailInput = {
  html: string;
  subject: string;
  text: string;
  to: string | string[];
};

type SendEmailResult =
  | {
      id?: string;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 10_000;
const DEFAULT_FROM_EMAIL = "Bolao do Lobo <onboarding@resend.dev>";

function getFromEmail() {
  return process.env.RESEND_EMAIL_FROM ?? process.env.EMAIL_FROM ?? DEFAULT_FROM_EMAIL;
}

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function readResendResponse(response: Response) {
  try {
    return (await response.json()) as ResendResponse;
  } catch {
    return undefined;
  }
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      message: "Envio de e-mail nao configurado."
    };
  }

  try {
    const response = await fetch(RESEND_EMAIL_ENDPOINT, {
      body: JSON.stringify({
        from: getFromEmail(),
        html: input.html,
        subject: input.subject,
        text: input.text,
        to: Array.isArray(input.to) ? input.to : [input.to]
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS)
    });
    const responseBody = await readResendResponse(response);

    if (!response.ok) {
      return {
        ok: false,
        message:
          responseBody?.message ??
          responseBody?.name ??
          "Nao foi possivel enviar o e-mail pelo Resend."
      };
    }

    return {
      id: responseBody?.id,
      ok: true
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel conectar ao servico de e-mail."
    };
  }
}
