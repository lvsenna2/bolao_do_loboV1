import type { MatchStatus } from "@prisma/client";

import { FootballLogo } from "@/components/football/football-logo";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { cn } from "@/lib/utils";

export type SpecialRoundMatchView = {
  awayScore: number | null;
  awayTeamApiId?: number | null;
  awayTeamLogo: string | null;
  awayTeamName: string;
  elapsed?: number | null;
  homeScore: number | null;
  homeTeamApiId?: number | null;
  homeTeamLogo: string | null;
  homeTeamName: string;
  matchStartsAt: Date;
  penaltyAway?: number | null;
  penaltyHome?: number | null;
  status: MatchStatus | null;
};

const liveStatuses: MatchStatus[] = ["LIVE", "HALFTIME"];

export function isSpecialRoundMatchStarted(status: MatchStatus | null) {
  return status !== null && status !== "SCHEDULED" && status !== "POSTPONED";
}

function StatusBadge({ elapsed, status }: { elapsed?: number | null; status: MatchStatus | null }) {
  if (status === "LIVE") {
    return (
      <Badge className="gap-1.5" tone="danger">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        {typeof elapsed === "number" ? `${elapsed}'` : "Ao vivo"}
      </Badge>
    );
  }
  if (status === "HALFTIME") return <Badge tone="warning">Intervalo</Badge>;
  if (status === "FINISHED") return <Badge tone="success">Jogo encerrado</Badge>;
  if (status === "SUSPENDED") return <Badge tone="warning">Interrompido</Badge>;
  if (status === "POSTPONED") return <Badge tone="warning">Adiado</Badge>;
  if (status === "CANCELLED") return <Badge tone="danger">Cancelado</Badge>;
  return <Badge>A comecar</Badge>;
}

function Side({
  apiId,
  logo,
  name,
  size
}: {
  apiId?: number | null;
  logo: string | null;
  name: string;
  size: number;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <FootballLogo
        apiId={apiId}
        containerClassName="border-brand-gold/25"
        kind="team"
        logo={logo}
        name={name}
        size={size}
      />
      <span className="line-clamp-2 text-sm font-semibold">{name}</span>
    </div>
  );
}

/**
 * Placar oficial da partida da Rodada Especial. Antes do apito inicial mostra a data;
 * depois mostra o resultado, para que quem palpitou consiga conferir o proprio acerto.
 */
export function SpecialRoundMatchScoreboard({
  className,
  compact = false,
  match
}: {
  className?: string;
  compact?: boolean;
  match: SpecialRoundMatchView;
}) {
  const started = isSpecialRoundMatchStarted(match.status);
  const isLive = match.status !== null && liveStatuses.includes(match.status);
  const hasPenalties =
    typeof match.penaltyHome === "number" && typeof match.penaltyAway === "number";

  return (
    <div
      className={cn(
        "rounded-control border border-brand-gold/25 bg-black/20",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side
          apiId={match.homeTeamApiId}
          logo={match.homeTeamLogo}
          name={match.homeTeamName}
          size={compact ? 40 : 56}
        />
        <div className="flex flex-col items-center gap-1">
          {started ? (
            <span
              aria-label={`Placar ${match.homeScore ?? 0} a ${match.awayScore ?? 0}`}
              className={cn(
                "whitespace-nowrap font-bold tabular-nums",
                compact ? "text-2xl" : "text-3xl",
                isLive ? "text-red-400" : "text-brand-gold"
              )}
            >
              {match.homeScore ?? 0}
              <span aria-hidden className="mx-2 text-app-muted">
                x
              </span>
              {match.awayScore ?? 0}
            </span>
          ) : (
            <span className="text-xl font-semibold text-app-muted">x</span>
          )}
          {started && hasPenalties ? (
            <span className="whitespace-nowrap text-xs text-app-muted">
              Penaltis {match.penaltyHome} x {match.penaltyAway}
            </span>
          ) : null}
        </div>
        <Side
          apiId={match.awayTeamApiId}
          logo={match.awayTeamLogo}
          name={match.awayTeamName}
          size={compact ? 40 : 56}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-app-muted">
        <StatusBadge elapsed={match.elapsed} status={match.status} />
        <span>{formatDateTimeInSaoPaulo(match.matchStartsAt)}</span>
      </div>
    </div>
  );
}
