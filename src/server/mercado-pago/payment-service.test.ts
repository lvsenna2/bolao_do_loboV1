import { describe, expect, it } from "vitest";

import { mapMercadoPagoStatus, validateMercadoPagoWebhookSignature } from "./payment-service";

describe("Mercado Pago payment service", () => {
  it("maps provider statuses without approving pending payments", () => {
    expect(mapMercadoPagoStatus("approved")).toBe("APPROVED");
    expect(mapMercadoPagoStatus("pending")).toBe("PENDING");
    expect(mapMercadoPagoStatus("in_process")).toBe("PENDING");
    expect(mapMercadoPagoStatus("rejected")).toBe("FAILED");
    expect(mapMercadoPagoStatus("cancelled")).toBe("CANCELLED");
    expect(mapMercadoPagoStatus("refunded")).toBe("REFUNDED");
  });

  it("validates the official HMAC manifest format", async () => {
    const { createHmac } = await import("node:crypto");
    const secret = "test-secret";
    const dataId = "123456";
    const requestId = "request-1";
    const timestamp = "1704908010";
    const digest = createHmac("sha256", secret)
      .update(`id:${dataId};request-id:${requestId};ts:${timestamp};`)
      .digest("hex");

    expect(
      validateMercadoPagoWebhookSignature({
        dataId,
        requestId,
        secret,
        signature: `ts=${timestamp},v1=${digest}`
      })
    ).toBe(true);
    expect(
      validateMercadoPagoWebhookSignature({
        dataId,
        requestId,
        secret,
        signature: `ts=${timestamp},v1=${"0".repeat(64)}`
      })
    ).toBe(false);
  });
});
