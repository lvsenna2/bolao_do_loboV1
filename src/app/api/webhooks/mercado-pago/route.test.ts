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
});
