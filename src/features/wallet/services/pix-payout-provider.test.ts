import { afterEach, describe, expect, it } from "vitest";

import { getPixPayoutProvider, isAutomaticPixPayoutEnabled } from "./pix-payout-provider";

const original = process.env.PIX_PAYOUT_PROVIDER;

afterEach(() => {
  if (original === undefined) delete process.env.PIX_PAYOUT_PROVIDER;
  else process.env.PIX_PAYOUT_PROVIDER = original;
});

describe("provedor de Pix de saida", () => {
  it("fica desligado por padrao, mantendo o Pix manual", () => {
    delete process.env.PIX_PAYOUT_PROVIDER;

    expect(getPixPayoutProvider()).toBeNull();
    expect(isAutomaticPixPayoutEnabled()).toBe(false);
  });

  it("aceita desligar explicitamente", () => {
    process.env.PIX_PAYOUT_PROVIDER = "none";
    expect(getPixPayoutProvider()).toBeNull();

    process.env.PIX_PAYOUT_PROVIDER = "manual";
    expect(getPixPayoutProvider()).toBeNull();
  });

  it("cai no fluxo manual quando o provedor configurado nao existe, em vez de quebrar", () => {
    process.env.PIX_PAYOUT_PROVIDER = "psp-que-nao-existe";

    expect(getPixPayoutProvider()).toBeNull();
  });
});
