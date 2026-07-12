import { afterEach, describe, expect, it, vi } from "vitest";

import { isEmailDeliveryConfigured, sendTransactionalEmail } from "./resend";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("resend email delivery", () => {
  it("does not send without an API key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      html: "<p>Teste</p>",
      subject: "Teste",
      text: "Teste",
      to: "usuario@teste.com"
    });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isEmailDeliveryConfigured()).toBe(false);
  });

  it("sends through Resend with the configured sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_EMAIL_FROM", "Bolao do Lobo <noreply@example.com>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTransactionalEmail({
      html: "<p>Ola</p>",
      subject: "Boas vindas",
      text: "Ola",
      to: "usuario@teste.com"
    });

    expect(result).toEqual({
      id: "email_123",
      ok: true
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      from: "Bolao do Lobo <noreply@example.com>",
      subject: "Boas vindas",
      to: ["usuario@teste.com"]
    });
  });
});
