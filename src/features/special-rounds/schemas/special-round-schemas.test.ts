import { describe, expect, it } from "vitest";

import {
  automaticSpecialRoundSchema,
  promoSpecialRoundSchema,
  promoStakeSchema
} from "./special-round-schemas";

describe("automatic special round schema", () => {
  it("accepts a catalog match and converts the configured entry fee", () => {
    const result = automaticSpecialRoundSchema.parse({
      entryFee: "15.50",
      matchId: "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0"
    });

    expect(result.entryFee).toBe(15.5);
  });

  it("allows free rounds and rejects negative entry fees", () => {
    expect(
      automaticSpecialRoundSchema.safeParse({
        entryFee: 0,
        matchId: "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0"
      }).success
    ).toBe(true);
    expect(
      automaticSpecialRoundSchema.safeParse({
        entryFee: -1,
        matchId: "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0"
      }).success
    ).toBe(false);
  });
});

describe("promo special round schema", () => {
  const valid = {
    awayTeamName: "Cruzeiro",
    homeTeamName: "Flamengo",
    matchStartsAt: "2026-08-20T21:30",
    name: "Flamengo x Cruzeiro",
    promoBetsCloseAt: "2026-08-20T23:30",
    promoBetsOpenAt: "2026-08-18T09:00",
    promoMaxStakeCents: 1_000,
    promoMinStakeCents: 100,
    promoOdds: "2.00",
    promoSelection: "HOME_TO_SCORE",
    promoSelectionLabel: "Flamengo marcar pelo menos 1 gol",
    promoSlug: "flamengo-cruzeiro"
  };

  it("aceita a promocao de referencia e converte a odd", () => {
    const result = promoSpecialRoundSchema.parse(valid);

    expect(result.promoOdds).toBe(2);
    expect(result.promoMaxStakeCents).toBe(1_000);
  });

  it("aceita apostas que fecham depois do inicio da partida", () => {
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoBetsCloseAt: "2026-08-20T23:59" }).success
    ).toBe(true);
  });

  it("recusa encerramento antes da abertura", () => {
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoBetsCloseAt: "2026-08-17T09:00" }).success
    ).toBe(false);
  });

  it("recusa minimo maior que o limite por usuario", () => {
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoMinStakeCents: 2_000 }).success
    ).toBe(false);
  });

  it("recusa odd menor ou igual a 1 e link fora do padrao", () => {
    expect(promoSpecialRoundSchema.safeParse({ ...valid, promoOdds: "1.00" }).success).toBe(false);
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoSlug: "Flamengo Cruzeiro" }).success
    ).toBe(false);
  });

  it("aceita os novos mercados promocionais e recusa preset desconhecido", () => {
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoSelection: "BOTH_TEAMS_SCORE" }).success
    ).toBe(true);
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoSelection: "HOME_TO_QUALIFY" }).success
    ).toBe(true);
    expect(
      promoSpecialRoundSchema.safeParse({ ...valid, promoSelection: "INVALID" }).success
    ).toBe(false);
  });
});

describe("promo stake schema", () => {
  it("recusa valor fracionado de centavo e aceita centavos inteiros", () => {
    const roundId = "d7f2dbf4-e26d-4d7a-bde4-74acd546a0c0";
    expect(promoStakeSchema.safeParse({ specialRoundId: roundId, stakeCents: 500 }).success).toBe(
      true
    );
    expect(promoStakeSchema.safeParse({ specialRoundId: roundId, stakeCents: 50.5 }).success).toBe(
      false
    );
    expect(promoStakeSchema.safeParse({ specialRoundId: roundId, stakeCents: 0 }).success).toBe(
      false
    );
  });
});
