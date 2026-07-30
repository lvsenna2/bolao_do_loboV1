import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { AdminElectionWorkspace } from "@/features/election-special-round/components/admin-election-workspace";
import { getAdminElectionRound } from "@/features/election-special-round/data";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminElectionSpecialRoundPage() {
  await requireAdmin();
  const round = await getAdminElectionRound();
  if (!round) notFound();

  return (
    <PageShell
      description="Módulo temporário e independente do Bolão do Lobo."
      eyebrow="Administração"
      title="Eleições Presidenciais 2026"
    >
      <AdminElectionWorkspace
        candidates={round.candidates}
        entries={round.entries.map((entry) => ({
          id: entry.id,
          paymentStatus: entry.paymentStatus,
          prediction: entry.prediction,
          user: entry.user,
          winner: entry.winner ? { amount: Number(entry.winner.amount) } : null
        }))}
        result={
          round.result
            ? {
                runnerUpCandidateId: round.result.runnerUpCandidateId,
                runnerUpPercent: Number(round.result.runnerUpPercent),
                turn: round.result.turn,
                winnerCandidateId: round.result.winnerCandidateId,
                winnerPercent: Number(round.result.winnerPercent)
              }
            : null
        }
        round={{
          description: round.description,
          id: round.id,
          name: round.name,
          noWinnerDestination: round.noWinnerDestination,
          registrationClosesAt: round.registrationClosesAt,
          registrationOpensAt: round.registrationOpensAt,
          rules: round.rules,
          status: round.status
        }}
      />
    </PageShell>
  );
}
