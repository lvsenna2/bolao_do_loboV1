import { describe, expect, it } from "vitest";

import { getPublicPromoSlug, isPublicPromoPath } from "./public-promo-path";

describe("public promo path", () => {
  it("aceita somente o slug direto de uma campanha", () => {
    expect(getPublicPromoSlug("/rodadas-especiais/flamengo-cruzeiro")).toBe(
      "flamengo-cruzeiro"
    );
    expect(getPublicPromoSlug("/rodadas-especiais/FLAMENGO-CRUZEIRO/")).toBe(
      "flamengo-cruzeiro"
    );
  });

  it("mantem rotas fixas, UUIDs e subrotas protegidas", () => {
    expect(getPublicPromoSlug("/rodadas-especiais/historico")).toBeNull();
    expect(getPublicPromoSlug("/rodadas-especiais/nova")).toBeNull();
    expect(getPublicPromoSlug("/rodadas-especiais/eleicoes-2026")).toBeNull();
    expect(
      getPublicPromoSlug("/rodadas-especiais/123e4567-e89b-12d3-a456-426614174000")
    ).toBeNull();
    expect(getPublicPromoSlug("/rodadas-especiais/flamengo-cruzeiro/meu-palpite")).toBeNull();
  });

  it("rejeita segmentos fora do formato seguro", () => {
    expect(isPublicPromoPath("/rodadas-especiais/flamengo_cruzeiro")).toBe(false);
    expect(isPublicPromoPath("/rodadas-especiais/flamengo%2Fcruzeiro")).toBe(false);
    expect(isPublicPromoPath("/rodadas-especiais/")).toBe(false);
  });
});
