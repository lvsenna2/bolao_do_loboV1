/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, Shield, Timer, UserRound, Users } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoundStatusBadge } from "@/features/rounds/components/round-status-badge";
import { getMatchDetail } from "@/features/matches/data/match-detail-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { getTeamLogoSrc } from "@/lib/team-logo";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

type MatchPageProps = { params: Promise<{ id: string }> };

type RecentSummary = {
  awayWins?: number;
  draws?: number;
  goalsAgainst?: number;
  goalsFor?: number;
  homeWins?: number;
  losses?: number;
  sequence?: string;
  wins?: number;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nestedNumber(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) current = objectValue(current)[key];
  return typeof current === "number" ? current : 0;
}

function recentSummary(value: unknown): RecentSummary {
  return objectValue(value) as RecentSummary;
}

function TeamLogo({
  apiId,
  logo,
  name
}: {
  apiId: number | null;
  logo: string | null;
  name: string;
}) {
  const src = getTeamLogoSrc({ apiId, logo });
  return src ? (
    <img
      alt={`Escudo do ${name}`}
      className="h-16 w-16 object-contain sm:h-20 sm:w-20"
      referrerPolicy="no-referrer"
      src={src}
    />
  ) : (
    <span className="flex h-16 w-16 items-center justify-center rounded-full border border-app-border text-lg font-bold">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

function StatValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-control bg-app-background p-3 text-center">
      <p className="text-xs text-app-muted">{label}</p>
      <p className="mt-1 font-bold text-app-foreground">{value ?? "-"}</p>
    </div>
  );
}

export default async function MatchPage({ params }: MatchPageProps) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const match = await getMatchDetail(id, user);
  if (!match) notFound();

  const homeStats = new Map(
    match.statistics
      .filter((row) => row.teamId === match.homeTeam.id)
      .map((row) => [row.type, row.value])
  );
  const awayStats = new Map(
    match.statistics
      .filter((row) => row.teamId === match.awayTeam.id)
      .map((row) => [row.type, row.value])
  );
  const statisticTypes = [
    "Ball Possession",
    "Total Shots",
    "Shots on Goal",
    "Shots off Goal",
    "Blocked Shots",
    "Corner Kicks",
    "Offsides",
    "Fouls",
    "Yellow Cards",
    "Red Cards",
    "Goalkeeper Saves",
    "Total passes",
    "Passes accurate",
    "Passes %",
    "Dangerous Attacks"
  ];
  const homeRecent = recentSummary(match.insight?.homeRecent);
  const awayRecent = recentSummary(match.insight?.awayRecent);
  const headToHead = objectValue(match.insight?.headToHead);
  const homeStanding = match.standings.find((row) => row.teamId === match.homeTeam.id);
  const awayStanding = match.standings.find((row) => row.teamId === match.awayTeam.id);
  const homeSeason = match.insight?.homeSeasonStats;
  const awaySeason = match.insight?.awaySeasonStats;

  return (
    <PageShell
      description={`${match.round.season.championship.name} | ${match.round.name || `Rodada ${match.round.number}`}`}
      eyebrow={match.round.league?.name || "Partida"}
      title="Detalhes da partida"
    >
      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-sm text-app-muted">
            <RoundStatusBadge type="match" value={match.status} />
            {match.elapsed !== null ? (
              <span className="flex items-center gap-1">
                <Timer className="h-4 w-4 text-brand-gold" />
                {match.elapsed}
                {match.extraTime ? `+${match.extraTime}` : ""}&apos;
              </span>
            ) : null}
            <span>{match.statusLong || match.apiStatus}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
            <div className="flex min-w-0 flex-col items-center gap-3 text-center">
              <TeamLogo {...match.homeTeam} />
              <h2 className="break-words text-base font-bold sm:text-xl">{match.homeTeam.name}</h2>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-app-foreground sm:text-5xl">
                {match.homeScore ?? "-"} <span className="text-app-muted">x</span>{" "}
                {match.awayScore ?? "-"}
              </p>
              {match.penaltyHome !== null && match.penaltyAway !== null ? (
                <p className="mt-2 text-xs text-app-muted">
                  Penaltis: {match.penaltyHome} x {match.penaltyAway}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col items-center gap-3 text-center">
              <TeamLogo {...match.awayTeam} />
              <h2 className="break-words text-base font-bold sm:text-xl">{match.awayTeam.name}</h2>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-app-border pt-5 text-sm text-app-muted">
            <span className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-gold" />
              {formatDateTimeInSaoPaulo(match.kickoff)}
            </span>
            {match.stadium || match.city ? (
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-gold" />
                {[match.stadium, match.city].filter(Boolean).join(" - ")}
              </span>
            ) : null}
            {match.referee ? (
              <span className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-brand-gold" />
                {match.referee}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Placar por periodo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatValue
              label="Intervalo"
              value={
                match.halftimeHome !== null && match.halftimeAway !== null
                  ? `${match.halftimeHome} x ${match.halftimeAway}`
                  : null
              }
            />
            <StatValue
              label="Segundo tempo"
              value={
                match.secondHalfHome !== null && match.secondHalfAway !== null
                  ? `${match.secondHalfHome} x ${match.secondHalfAway}`
                  : null
              }
            />
            <StatValue
              label="Prorrogacao"
              value={
                match.extraTimeHome !== null && match.extraTimeAway !== null
                  ? `${match.extraTimeHome} x ${match.extraTimeAway}`
                  : null
              }
            />
            <StatValue
              label="Penaltis"
              value={
                match.penaltyHome !== null && match.penaltyAway !== null
                  ? `${match.penaltyHome} x ${match.penaltyAway}`
                  : null
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estadio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">
              {match.footballVenue?.name || match.stadium || "Nao informado"}
            </p>
            <p className="text-app-muted">
              {[
                match.footballVenue?.address,
                match.footballVenue?.city || match.city,
                match.footballVenue?.country
              ]
                .filter(Boolean)
                .join(" - ") || "Local ainda nao informado."}
            </p>
            {match.footballVenue?.capacity ? (
              <p className="text-app-muted">
                Capacidade: {match.footballVenue.capacity.toLocaleString("pt-BR")}
              </p>
            ) : null}
            {match.footballVenue?.surface ? (
              <p className="text-app-muted">Gramado: {match.footballVenue.surface}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Eventos da partida</CardTitle>
        </CardHeader>
        <CardContent>
          {match.events.length === 0 ? (
            <p className="text-sm text-app-muted">Eventos ainda nao disponiveis.</p>
          ) : (
            <div className="space-y-2">
              {match.events.map((event) => (
                <div
                  className="grid grid-cols-[48px_1fr] gap-3 rounded-control border border-app-border bg-app-background p-3 text-sm"
                  key={event.id}
                >
                  <strong className="text-brand-gold">
                    {event.elapsed}
                    {event.extra ? `+${event.extra}` : ""}&apos;
                  </strong>
                  <div>
                    <p className="font-semibold">
                      {event.type}
                      {event.detail ? ` - ${event.detail}` : ""}
                    </p>
                    <p className="text-app-muted">
                      {event.team?.name || ""}
                      {event.player?.name ? ` | ${event.player.name}` : ""}
                      {event.assistPlayer?.name ? ` (assistencia: ${event.assistPlayer.name})` : ""}
                    </p>
                    {event.comments ? (
                      <p className="text-xs text-app-muted">{event.comments}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Estatisticas dos times</CardTitle>
        </CardHeader>
        <CardContent>
          {match.statistics.length === 0 ? (
            <p className="text-sm text-app-muted">
              Estatisticas ainda nao disponiveis para esta partida.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-app-border text-app-muted">
                    <th className="p-3 text-left">
                      {match.homeTeam.shortName || match.homeTeam.name}
                    </th>
                    <th className="p-3 text-center">Estatistica</th>
                    <th className="p-3 text-right">
                      {match.awayTeam.shortName || match.awayTeam.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statisticTypes
                    .filter((type) => homeStats.has(type) || awayStats.has(type))
                    .map((type) => (
                      <tr className="border-b border-app-border/60" key={type}>
                        <td className="p-3 font-semibold">{homeStats.get(type) ?? "-"}</td>
                        <td className="p-3 text-center text-app-muted">{type}</td>
                        <td className="p-3 text-right font-semibold">
                          {awayStats.get(type) ?? "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        {match.lineups.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="p-5 text-sm text-app-muted">
              Escalacoes ainda nao divulgadas.
            </CardContent>
          </Card>
        ) : (
          match.lineups.map((lineup) => (
            <Card key={lineup.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-gold" />
                  {lineup.team.name}
                </CardTitle>
                <p className="text-sm text-app-muted">
                  Formacao: {lineup.formation || "Nao informada"} | Tecnico:{" "}
                  {lineup.coachName || "Nao informado"}
                </p>
              </CardHeader>
              <CardContent>
                <h3 className="mb-2 text-xs font-bold uppercase text-brand-gold">Titulares</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {lineup.players
                    .filter((entry) => entry.role === "STARTER")
                    .map((entry) => (
                      <div
                        className="flex items-center gap-2 rounded-control bg-app-background p-2 text-sm"
                        key={entry.id}
                      >
                        {entry.player.photoUrl ? (
                          <img
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                            src={entry.player.photoUrl}
                          />
                        ) : (
                          <Shield className="h-5 w-5 text-app-muted" />
                        )}
                        <span className="min-w-0 truncate">
                          <strong>{entry.shirtNumber ?? "-"}</strong> {entry.player.name}{" "}
                          <small className="text-app-muted">{entry.position}</small>
                        </span>
                      </div>
                    ))}
                </div>
                <h3 className="mb-2 mt-5 text-xs font-bold uppercase text-app-muted">Reservas</h3>
                <div className="flex flex-wrap gap-2">
                  {lineup.players
                    .filter((entry) => entry.role === "SUBSTITUTE")
                    .map((entry) => (
                      <span
                        className="rounded-full border border-app-border px-3 py-1 text-xs"
                        key={entry.id}
                      >
                        {entry.shirtNumber ?? "-"} {entry.player.name}
                      </span>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Historico e momento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          {[
            {
              team: match.homeTeam,
              recent: homeRecent,
              standing: homeStanding,
              season: homeSeason
            },
            { team: match.awayTeam, recent: awayRecent, standing: awayStanding, season: awaySeason }
          ].map(({ team, recent, standing, season }) => (
            <div
              className="rounded-control border border-app-border bg-app-background p-4"
              key={team.id}
            >
              <h3 className="font-bold">{team.name}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <StatValue label="Vitorias" value={String(recent.wins ?? 0)} />
                <StatValue label="Empates" value={String(recent.draws ?? 0)} />
                <StatValue label="Derrotas" value={String(recent.losses ?? 0)} />
              </div>
              <p className="mt-3 text-sm text-app-muted">
                Sequencia: <strong className="text-app-foreground">{recent.sequence || "-"}</strong>
              </p>
              <p className="text-sm text-app-muted">
                Gols: {recent.goalsFor ?? 0} marcados, {recent.goalsAgainst ?? 0} sofridos
              </p>
              <p className="text-sm text-app-muted">
                Vitorias casa/fora: {recent.homeWins ?? 0} / {recent.awayWins ?? 0}
              </p>
              <p className="text-sm text-app-muted">
                Posicao atual:{" "}
                {standing ? `${standing.rank}o (${standing.points} pts)` : "Nao disponivel"}
              </p>
              <p className="text-sm text-app-muted">
                Temporada: {nestedNumber(season, ["fixtures", "played", "total"])} jogos,{" "}
                {nestedNumber(season, ["fixtures", "wins", "total"])} vitorias
              </p>
            </div>
          ))}
          <div className="rounded-control border border-brand-gold/30 bg-brand-gold/5 p-4 lg:col-span-2">
            <h3 className="font-bold text-brand-gold">Confrontos diretos</h3>
            <p className="mt-2 text-sm text-app-muted">
              Ultimos jogos: {typeof headToHead.games === "number" ? headToHead.games : 0} | Media
              de gols: {typeof headToHead.averageGoals === "number" ? headToHead.averageGoals : 0}
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-app-muted">
        Dados salvos no banco. Ultima atualizacao:{" "}
        {match.lastSyncedAt
          ? formatDateTimeInSaoPaulo(match.lastSyncedAt)
          : "aguardando sincronizacao"}
        .
      </p>
    </PageShell>
  );
}
