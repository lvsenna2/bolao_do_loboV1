import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPromoRoundForm } from "@/features/special-rounds/components/admin-promo-round-form";
import { AdminSpecialRoundForm } from "@/features/special-rounds/components/admin-round-form";
import type { PromoSelectionValue } from "@/features/special-rounds/services/promo-service";
import {
  getAdminSpecialRoundDetail,
  getSpecialRoundMatchOptions
} from "@/features/special-rounds/data/special-round-data";
import { requireAdmin } from "@/server/auth/session";

export default async function EditSpecialRoundPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [round, matches] = await Promise.all([
    getAdminSpecialRoundDetail(id),
    getSpecialRoundMatchOptions()
  ]);
  if (!round) notFound();

  if (round.format === "PROMO_SINGLE_SELECTION") {
    return (
      <PageShell
        description="Selecao, odd e limite travam assim que a primeira aposta entra."
        title={`Editar ${round.name}`}
      >
        <Card>
          <CardContent className="pt-5">
            <AdminPromoRoundForm
              initial={{
                awayTeamLogo: round.awayTeamLogo,
                awayTeamName: round.awayTeamName,
                description: round.description,
                hasEntries: round.entries.length > 0,
                homeTeamLogo: round.homeTeamLogo,
                homeTeamName: round.homeTeamName,
                id: round.id,
                matchId: round.matchId,
                matchStartsAt: round.matchStartsAt,
                name: round.name,
                promoBannerUrl: round.promoBannerUrl,
                promoBetsCloseAt: round.registrationClosesAt,
                promoBetsOpenAt: round.registrationOpensAt,
                promoHeadline: round.promoHeadline,
                promoMaxStakeCents: round.promoMaxStakeCents ?? 1000,
                promoMinStakeCents: round.promoMinStakeCents ?? 100,
                promoOdds: Number(round.promoOdds ?? 2),
                promoSelection:
                  round.markets[0]?.kind === "TEAM_TO_SCORE"
                    ? (`${round.promoSide ?? "HOME"}_TO_SCORE` as PromoSelectionValue)
                    : ((round.markets[0]?.options[0]?.value ??
                        "HOME_TO_SCORE") as PromoSelectionValue),
                promoSelectionLabel: round.promoSelectionLabel ?? "",
                promoSlug: round.promoSlug ?? "",
                rules: round.rules
              }}
              matches={matches}
            />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      description="Edicao permitida antes da abertura dos palpites."
      title={`Editar ${round.name}`}
    >
      <Card>
        <CardContent className="pt-5">
          <AdminSpecialRoundForm
            initial={{
              adminFeePercent: Number(round.adminFeePercent),
              awayTeamLogo: round.awayTeamLogo,
              awayTeamName: round.awayTeamName,
              description: round.description,
              entryFee: Number(round.entryFee),
              fixedPrize: round.fixedPrize ? Number(round.fixedPrize) : null,
              homeTeamLogo: round.homeTeamLogo,
              homeTeamName: round.homeTeamName,
              id: round.id,
              matchId: round.matchId,
              matchStartsAt: round.matchStartsAt,
              name: round.name,
              predictionsCloseAt: round.predictionsCloseAt,
              predictionsOpenAt: round.predictionsOpenAt,
              prizeDistribution: round.prizeDistribution,
              prizeMode: round.prizeMode,
              prizePoolPercent: Number(round.prizePoolPercent),
              registrationClosesAt: round.registrationClosesAt,
              registrationOpensAt: round.registrationOpensAt,
              rules: round.rules
            }}
            matches={matches}
          />
        </CardContent>
      </Card>
    </PageShell>
  );
}
