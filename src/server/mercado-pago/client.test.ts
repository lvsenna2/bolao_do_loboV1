import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelMercadoPagoPayment, getMercadoPagoErrorDescription } from "./client";

const previousAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

afterEach(() => {
  if (previousAccessToken === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  else process.env.MERCADO_PAGO_ACCESS_TOKEN = previousAccessToken;
  vi.unstubAllGlobals();
});

describe("Mercado Pago client", () => {
  it("extracts the provider cause without exposing the full response", () => {
    expect(
      getMercadoPagoErrorDescription({
        cause: [{ code: 13253, description: "Collector user without key enabled for QR render" }],
        error: "bad_request",
        message: "Invalid payment data"
      })
    ).toBe("Invalid payment data | Collector user without key enabled for QR render | bad_request");
  });

  it("uses a cause description when the response has no main message", () => {
    expect(
      getMercadoPagoErrorDescription({
        cause: [{ description: "Invalid notification_url" }]
      })
    ).toBe("Invalid notification_url");
  });

  it("ignores malformed error bodies", () => {
    expect(getMercadoPagoErrorDescription("bad request")).toBeNull();
  });

  it("cancels a pending payment with an idempotency key", async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "token-test";
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ id: 123, status: "cancelled" }),
      ok: true,
      status: 200
    });
    vi.stubGlobal("fetch", fetchMock);

    await cancelMercadoPagoPayment("123", "cancel:league:1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/123",
      expect.objectContaining({
        body: JSON.stringify({ status: "cancelled" }),
        headers: expect.objectContaining({ "X-Idempotency-Key": "cancel:league:1" }),
        method: "PUT"
      })
    );
  });
});
