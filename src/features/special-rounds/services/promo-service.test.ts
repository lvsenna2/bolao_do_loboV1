import { describe, expect, it } from "vitest";

import {
  buildPromoSlug,
  checkPromoStake,
  isPromoBettingOpen,
  isUuid,
  promoProfitCents,
  promoReturnCents,
  promoSelectionDefaultLabel,
  promoSelectionText,
  splitPromoPayout
} from "./promo-service";

describe("retorno e lucro da promocao", () => {
  it("paga o retorno da odd e transforma so o lucro em bonus", () => {
    expect(promoReturnCents(500, 2)).toBe(1_000);
    expect(promoProfitCents(500, 2)).toBe(500);
    expect(promoReturnCents(1_000, 2)).toBe(2_000);
    expect(promoProfitCents(1_000, 2)).toBe(1_000);
  });

  it("arredonda ao centavo em odd quebrada", () => {
    expect(promoReturnCents(333, 1.75)).toBe(583);
    expect(promoProfitCents(333, 1.75)).toBe(250);
  });
});

describe("limite por usuario", () => {
  const limits = { maxStakeCents: 1_000, minStakeCents: 100 };

  it("aceita a primeira aposta dentro do teto", () => {
    expect(checkPromoStake({ ...limits, alreadyStakedCents: 0, stakeCents: 600 })).toEqual({
      ok: true,
      totalAfterCents: 600
    });
  });

  it("aceita a segunda aposta ate completar o teto", () => {
    expect(checkPromoStake({ ...limits, alreadyStakedCents: 600, stakeCents: 400 })).toEqual({
      ok: true,
      totalAfterCents: 1_000
    });
  });

  it("recusa o que passar da soma de R$ 10", () => {
    expect(checkPromoStake({ ...limits, alreadyStakedCents: 600, stakeCents: 500 })).toEqual({
      ok: false,
      reason: "ABOVE_REMAINING"
    });
  });

  it("recusa qualquer aposta depois do limite atingido", () => {
    expect(checkPromoStake({ ...limits, alreadyStakedCents: 1_000, stakeCents: 100 })).toEqual({
      ok: false,
      reason: "LIMIT_REACHED"
    });
  });

  it("recusa abaixo do minimo", () => {
    expect(checkPromoStake({ ...limits, alreadyStakedCents: 0, stakeCents: 50 })).toEqual({
      ok: false,
      reason: "BELOW_MIN"
    });
  });

  it("permite fechar o teto mesmo com resto menor que o minimo", () => {
    expect(checkPromoStake({ ...limits, alreadyStakedCents: 950, stakeCents: 50 })).toEqual({
      ok: true,
      totalAfterCents: 1_000
    });
  });
});

describe("divisao do pagamento entre saldo normal e bonus", () => {
  it("devolve a aposta feita com dinheiro real ao saldo normal e paga o lucro em bonus", () => {
    expect(splitPromoPayout({ bonusStakeCents: 0, odds: 2, stakeCents: 500 })).toEqual({
      bonusCreditCents: 500,
      profitCents: 500,
      realCreditCents: 500,
      totalReturnCents: 1_000
    });
  });

  it("nao transforma bonus apostado em saldo sacavel", () => {
    expect(splitPromoPayout({ bonusStakeCents: 500, odds: 2, stakeCents: 500 })).toEqual({
      bonusCreditCents: 1_000,
      profitCents: 500,
      realCreditCents: 0,
      totalReturnCents: 1_000
    });
  });

  it("divide aposta mista de volta para cada balde de origem", () => {
    expect(splitPromoPayout({ bonusStakeCents: 300, odds: 2, stakeCents: 1_000 })).toEqual({
      bonusCreditCents: 1_300,
      profitCents: 1_000,
      realCreditCents: 700,
      totalReturnCents: 2_000
    });
  });
});

describe("janela de apostas", () => {
  const base = {
    closesAt: new Date("2026-08-20T23:00:00Z"),
    now: new Date("2026-08-20T21:00:00Z"),
    opensAt: new Date("2026-08-20T12:00:00Z"),
    status: "REGISTRATION_OPEN" as const
  };

  it("aceita aposta com a rodada aberta e o jogo em andamento", () => {
    expect(isPromoBettingOpen({ ...base, matchStatus: "LIVE" })).toBe(true);
  });

  it("fecha assim que a partida termina, mesmo dentro da janela", () => {
    expect(isPromoBettingOpen({ ...base, matchStatus: "FINISHED" })).toBe(false);
  });

  it("fecha depois do horario configurado", () => {
    expect(
      isPromoBettingOpen({ ...base, now: new Date("2026-08-21T00:00:00Z"), matchStatus: "LIVE" })
    ).toBe(false);
  });

  it("nao aceita aposta em rodada finalizada", () => {
    expect(isPromoBettingOpen({ ...base, status: "FINALIZED" })).toBe(false);
  });
});

describe("texto e link da campanha", () => {
  it("monta rotulos dos novos mercados com os times da partida", () => {
    expect(promoSelectionDefaultLabel("BOTH_TEAMS_SCORE", "Flamengo", "Cruzeiro")).toBe(
      "Ambas as equipes marcam"
    );
    expect(promoSelectionDefaultLabel("AWAY_TO_QUALIFY", "Flamengo", "Cruzeiro")).toBe(
      "Cruzeiro se classificar"
    );
  });

  it("usa o rotulo configurado pelo admin", () => {
    expect(
      promoSelectionText({
        awayTeamName: "Cruzeiro",
        homeTeamName: "Flamengo",
        promoSelectionLabel: "Flamengo marcar pelo menos 1 gol",
        promoSide: "HOME"
      })
    ).toBe("Flamengo marcar pelo menos 1 gol");
  });

  it("monta o texto pelo lado quando nao ha rotulo", () => {
    expect(
      promoSelectionText({
        awayTeamName: "Cruzeiro",
        homeTeamName: "Flamengo",
        promoSelectionLabel: null,
        promoSide: "AWAY"
      })
    ).toBe("Cruzeiro marcar pelo menos 1 gol");
  });

  it("gera slug sem acento nem espaco", () => {
    expect(buildPromoSlug("Flamengo x Cruzeiro")).toBe("flamengo-x-cruzeiro");
    expect(buildPromoSlug("Grêmio  x  Atlético-MG")).toBe("gremio-x-atletico-mg");
  });

  it("separa uuid de slug", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("flamengo-cruzeiro")).toBe(false);
  });
});
