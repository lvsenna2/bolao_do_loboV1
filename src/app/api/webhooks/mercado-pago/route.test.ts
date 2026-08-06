import { describe, expect, it } from "vitest";

import { GET, POST } from "./route";

describe("Mercado Pago webhook route", () => {
  it("exposes a public health check", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "mercado-pago-webhook"
    });
  });

  it("acknowledges unrelated webhook topics without processing them", async () => {
    const response = await POST(
      new Request("https://example.com/api/webhooks/mercado-pago", {
        body: JSON.stringify({ type: "merchant_order" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, ignored: true });
  });

  it("rejects subscription webhooks without a valid signature", async () => {
    const previousSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    const response = await POST(
      new Request("https://example.com/api/webhooks/mercado-pago", {
        body: JSON.stringify({ data: { id: "subscription-id" }, type: "subscription_preapproval" }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = previousSecret;

    expect(response.status).toBe(401);
  });
});
