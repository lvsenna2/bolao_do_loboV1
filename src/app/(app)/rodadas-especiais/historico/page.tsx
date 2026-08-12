import { PageShell } from "@/components/layout/page-shell";
import { SpecialRoundCard } from "@/features/special-rounds/components/special-round-card";
import { getSpecialRoundsForUser } from "@/features/special-rounds/data/special-round-data";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SpecialRoundHistoryPage() {
  const user = await requireUser();
  const rounds = (await getSpecialRoundsForUser(user.id)).filter((round) =>
    ["FINALIZED", "CANCELLED"].includes(round.status)
  );
  return (
    <PageShell
      description="Resultados, vencedores e premios das disputas anteriores."
      title="Historico especial"
    >
      {rounds.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rounds.map((round) => (
            <SpecialRoundCard
              awayScore={round.match?.awayScore}
              awayTeamApiId={round.match?.awayTeam.apiId}
              awayTeamLogo={round.awayTeamLogo}
              awayTeamName={round.awayTeamName}
              champion={round.champion}
              elapsed={round.match?.elapsed}
              entryFee={Number(round.entryFee)}
              estimatedPrize={round.estimatedPrize}
              homeScore={round.match?.homeScore}
              homeTeamApiId={round.match?.homeTeam.apiId}
              homeTeamLogo={round.homeTeamLogo}
              homeTeamName={round.homeTeamName}
              id={round.id}
              key={round.id}
              matchStartsAt={round.matchStartsAt}
              matchStatus={round.match?.status}
              name={round.name}
              participants={round._count.entries}
              status={round.status}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-card border border-dashed border-app-border p-8 text-center text-app-muted">
          Nenhuma rodada encerrada.
        </p>
      )}
    </PageShell>
  );
}
