import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AdminSpecialRoundForm } from "@/features/special-rounds/components/admin-round-form";
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
