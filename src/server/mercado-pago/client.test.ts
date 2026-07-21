import { describe, expect, it } from "vitest";

import { getMercadoPagoErrorDescription } from "./client";

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
});
