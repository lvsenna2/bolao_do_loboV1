import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getPendingGuessRounds } from "../data/guess-data";

export async function PendingGuessesAlert({ userId }: { userId: string }) {
  const rounds = await getPendingGuessRounds(userId);

  if (rounds.length === 0) return null;

  const pendingMatches = rounds.reduce((total, round) => total + round.pendingMatches, 0);
  const visibleRounds = rounds.slice(0, 3);
  const hiddenRounds = rounds.length - visibleRounds.length;

  return (
    <aside
      aria-label="Palpites pendentes"
      className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-3 rounded-card border border-amber-400/40 bg-amber-400/10 p-4 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-gold" />
          <div className="min-w-0">
            <p className="font-semibold text-white">
              Voce ainda tem {pendingMatches}{" "}
              {pendingMatches === 1 ? "palpite pendente" : "palpites pendentes"}.
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-amber-100/85">
              {visibleRounds.map((round) => (
                <span key={round.id}>
                  {round.label} · {round.leagueName}: {round.pendingMatches}
                </span>
              ))}
              {hiddenRounds > 0 ? <span>+ {hiddenRounds} rodada(s)</span> : null}
            </div>
          </div>
        </div>
        <Link className={buttonVariants({ size: "sm", variant: "accent" })} href="/palpites">
          Completar palpites
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </aside>
  );
}
