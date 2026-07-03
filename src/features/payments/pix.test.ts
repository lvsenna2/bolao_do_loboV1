import { describe, expect, it } from "vitest";

import { createPixPayload, createQrSvg, createQrSvgDataUri, getPixReceiverKey } from "./pix";

describe("pix helpers", () => {
  it("gera payload Pix com chave, valor, transacao e CRC", () => {
    const payload = createPixPayload({
      amount: 25,
      description: "Liga Teste",
      transactionId: "LOBO123"
    });

    expect(payload).toContain("br.gov.bcb.pix");
    expect(payload).toContain(getPixReceiverKey());
    expect(payload).toContain("540525.00");
    expect(payload).toContain("LOBO123");
    expect(payload).toMatch(/6304[A-F0-9]{4}$/);
  });

  it("renderiza QR em SVG local", () => {
    const payload = createPixPayload({
      amount: 10,
      description: "Bolao",
      transactionId: "LOBO456"
    });
    const svg = createQrSvg(payload);

    expect(svg).toContain("<svg");
    expect(svg).toContain("<rect");
    expect(createQrSvgDataUri(payload)).toMatch(/^data:image\/svg\+xml;utf8,/);
  });
});
