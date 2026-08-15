import { prisma } from "@/server/db";

/**
 * Dados publicos da vitrine da campanha. Nenhum saldo, aposta ou dado do usuario e carregado aqui.
 */
export function getPublicPromoRoundBySlug(slug: string) {
  return prisma.specialRound.findFirst({
    select: {
      awayTeamLogo: true,
      awayTeamName: true,
      homeTeamLogo: true,
      homeTeamName: true,
      id: true,
      match: {
        select: {
          awayScore: true,
          awayTeam: { select: { apiId: true, logo: true } },
          elapsed: true,
          homeScore: true,
          homeTeam: { select: { apiId: true, logo: true } },
          status: true
        }
      },
      matchStartsAt: true,
      name: true,
      promoBannerUrl: true,
      promoHeadline: true,
      promoMaxStakeCents: true,
      promoMinStakeCents: true,
      promoOdds: true,
      promoSelectionLabel: true,
      promoSide: true,
      registrationClosesAt: true,
      registrationOpensAt: true,
      rules: true,
      status: true
    },
    where: {
      format: "PROMO_SINGLE_SELECTION",
      promoSlug: slug,
      status: { not: "DRAFT" }
    }
  });
}
