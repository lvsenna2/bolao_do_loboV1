import type { SpecialRoundPromoSide, SpecialRoundStatus } from "@prisma/client";

/**
 * Regras financeiras da Rodada Especial Promocional de Selecao Unica.
 *
 * O usuario aposta um valor ate o limite configurado numa unica selecao com odd fixa. Se a
 * selecao bater, o valor apostado volta para o balde de onde saiu e o LUCRO (`stake * (odd - 1)`)
 * e creditado como saldo bonus. Nada aqui toca o banco: sao contas puras, para o backend e os
 * testes usarem os mesmos numeros que a tela mostra.
 */

export const PROMO_DEFAULT_MIN_STAKE_CENTS = 100;
export const PROMO_DEFAULT_MAX_STAKE_CENTS = 1_000;

export type PromoRoundConfig = {
  promoMaxStakeCents: number | null;
  promoMinStakeCents: number | null;
  promoOdds: number | null;
  promoSelectionLabel: string | null;
  promoSide: SpecialRoundPromoSide | null;
};

export function promoMinStakeCents(round: Pick<PromoRoundConfig, "promoMinStakeCents">) {
  return round.promoMinStakeCents ?? PROMO_DEFAULT_MIN_STAKE_CENTS;
}

export function promoMaxStakeCents(round: Pick<PromoRoundConfig, "promoMaxStakeCents">) {
  return round.promoMaxStakeCents ?? PROMO_DEFAULT_MAX_STAKE_CENTS;
}

/** Retorno total matematico da aposta (valor apostado + lucro), arredondado ao centavo. */
export function promoReturnCents(stakeCents: number, odds: number) {
  return Math.round(stakeCents * odds);
}

/** Lucro da aposta — e exatamente o que vira saldo bonus. */
export function promoProfitCents(stakeCents: number, odds: number) {
  return promoReturnCents(stakeCents, odds) - stakeCents;
}

export type PromoStakeCheck =
  | { ok: true; totalAfterCents: number }
  | { ok: false; reason: "BELOW_MIN" | "ABOVE_REMAINING" | "LIMIT_REACHED" };

/**
 * Valida uma nova entrada contra o limite individual. O limite vale para a SOMA de todas as
 * apostas do usuario na promocao, entao a conta usa o que ele ja apostou.
 */
export function checkPromoStake(input: {
  alreadyStakedCents: number;
  maxStakeCents: number;
  minStakeCents: number;
  stakeCents: number;
}): PromoStakeCheck {
  const remaining = input.maxStakeCents - input.alreadyStakedCents;
  if (remaining <= 0) return { ok: false, reason: "LIMIT_REACHED" };
  if (input.stakeCents < Math.min(input.minStakeCents, remaining)) {
    return { ok: false, reason: "BELOW_MIN" };
  }
  if (input.stakeCents > remaining) return { ok: false, reason: "ABOVE_REMAINING" };
  return { ok: true, totalAfterCents: input.alreadyStakedCents + input.stakeCents };
}

/**
 * Divide a devolucao do valor apostado entre os baldes de origem. Sem isso um usuario poderia
 * apostar com bonus, ganhar, receber tudo como saldo normal e sacar o bonus por fora.
 */
export function splitPromoPayout(input: {
  bonusStakeCents: number;
  odds: number;
  stakeCents: number;
}) {
  const bonusStakeCents = Math.min(Math.max(input.bonusStakeCents, 0), input.stakeCents);
  const realStakeCents = input.stakeCents - bonusStakeCents;
  const profitCents = promoProfitCents(input.stakeCents, input.odds);
  return {
    /** Volta para o saldo bonus: a parte da aposta paga com bonus + todo o lucro. */
    bonusCreditCents: bonusStakeCents + profitCents,
    profitCents,
    /** Volta para o saldo normal: so a parte da aposta paga com dinheiro real. */
    realCreditCents: realStakeCents,
    totalReturnCents: promoReturnCents(input.stakeCents, input.odds)
  };
}

/**
 * A promocao aceita aposta enquanto a rodada esta aberta, dentro da janela configurada e antes
 * de a partida terminar. Depois disso, nenhuma entrada nova.
 */
export function isPromoBettingOpen(input: {
  matchStatus?: string | null;
  now: Date;
  opensAt: Date;
  closesAt: Date;
  status: SpecialRoundStatus;
}) {
  if (!["REGISTRATION_OPEN", "PREDICTIONS_OPEN"].includes(input.status)) return false;
  if (input.now < input.opensAt || input.now >= input.closesAt) return false;
  return !["FINISHED", "CANCELLED", "ABANDONED", "POSTPONED"].includes(input.matchStatus ?? "");
}

export function promoSelectionText(round: {
  awayTeamName: string;
  homeTeamName: string;
  promoSelectionLabel: string | null;
  promoSide: SpecialRoundPromoSide | null;
}) {
  if (round.promoSelectionLabel) return round.promoSelectionLabel;
  const team = round.promoSide === "AWAY" ? round.awayTeamName : round.homeTeamName;
  return `${team} marcar pelo menos 1 gol`;
}

/** Slug estavel para a URL de trafego pago, no formato `flamengo-cruzeiro`. */
export function buildPromoSlug(value: string) {
  return value
    .normalize("NFD")
    // Depois do NFD os acentos viram caracteres proprios, todos fora do ASCII.
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}
