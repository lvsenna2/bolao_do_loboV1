import { PageShell } from "@/components/layout/page-shell";
import { getSpecialRoundsForUser } from "@/features/special-rounds/data/special-round-data";
import { SpecialRoundCard } from "@/features/special-rounds/components/special-round-card";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SpecialRoundsPage() {
  const user = await requireUser();
  const rounds = await getSpecialRoundsForUser(user.id);
  const active = rounds.filter((round) => !["FINALIZED", "CANCELLED"].includes(round.status));
  const closed = rounds.filter((round) => ["FINALIZED", "CANCELLED"].includes(round.status));

  return (
    <PageShell
      description="Disputas independentes com inscricao, mercados e premiacao proprios."
      eyebrow="Competicao especial"
      title="Rodadas Especiais"
    >
      {active.length ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Abertas e futuras</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {active.map((round) => (
              <SpecialRoundCard
                awayTeamLogo={round.awayTeamLogo}
                awayTeamName={round.awayTeamName}
                entryFee={Number(round.entryFee)}
                estimatedPrize={round.estimatedPrize}
                homeTeamLogo={round.homeTeamLogo}
                homeTeamName={round.homeTeamName}
                id={round.id}
                key={round.id}
                matchStartsAt={round.matchStartsAt}
                name={round.name}
                participants={round._count.entries}
                status={round.status}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-card border border-dashed border-app-border p-8 text-center text-app-muted">
          Nenhuma rodada especial disponivel no momento.
        </div>
      )}
      {closed.length ? (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Encerradas</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {closed.slice(0, 6).map((round) => (
              <SpecialRoundCard
                awayTeamLogo={round.awayTeamLogo}
                awayTeamName={round.awayTeamName}
                entryFee={Number(round.entryFee)}
                estimatedPrize={round.estimatedPrize}
                homeTeamLogo={round.homeTeamLogo}
                homeTeamName={round.homeTeamName}
                id={round.id}
                key={round.id}
                matchStartsAt={round.matchStartsAt}
                name={round.name}
                participants={round._count.entries}
                status={round.status}
              />
            ))}
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}
