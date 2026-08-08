"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { FootballLogo } from "@/components/football/football-logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveMatchView } from "../data/live-matches-data";

const REFRESH_INTERVAL_MS = 30_000;

type LiveScoreUpdate = {
  awayScore: number | null;
  elapsed: number | null;
  homeScore: number | null;
  id: string;
  status: string;
};

type LiveMatchesCardProps = {
  matches: LiveMatchView[];
};

function statusBadge(status: string, elapsed: number | null) {
  if (status === "LIVE") {
    return (
      <Badge className="gap-1.5" tone="danger">
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        {typeof elapsed === "number" ? `${elapsed}'` : "Ao vivo"}
      </Badge>
    );
  }
  if (status === "HALFTIME") return <Badge tone="warning">Intervalo</Badge>;
  if (status === "FINISHED") return <Badge>Encerrada</Badge>;
  if (status === "SUSPENDED") return <Badge tone="warning">Interrompida</Badge>;
  return <Badge>{status}</Badge>;
}

function scoreText(value: number | null) {
  return typeof value === "number" ? String(value) : "-";
}

function TeamSide({
  team,
  align
}: {
  align: "left" | "right";
  team: LiveMatchView["homeTeam"];
}) {
  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      <FootballLogo
        apiId={team.apiId}
        kind="team"
        logo={team.logo}
        name={team.shortName || team.name}
        size={28}
      />
      <span className="truncate text-sm font-semibold text-app-foreground">
        {team.shortName || team.name}
      </span>
    </span>
  );
}

export function LiveMatchesCard({ matches: initialMatches }: LiveMatchesCardProps) {
  const [matches, setMatches] = useState(initialMatches);

  useEffect(() => {
    let cancelled = false;

    async function refreshLiveScores() {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch("/api/football/live-scores");
        if (!response.ok || cancelled) return;

        const payload = (await response.json()) as { matches: LiveScoreUpdate[] };
        const updates = new Map(payload.matches.map((match) => [match.id, match]));

        setMatches((current) =>
          current.map((match) => {
            const update = updates.get(match.id);
            if (!update) return match;

            return {
              ...match,
              awayScore: update.awayScore,
              elapsed: update.elapsed,
              homeScore: update.homeScore,
              status: update.status
            };
          })
        );
      } catch {
        // O placar renderizado no servidor continua visivel se a atualizacao falhar.
      }
    }

    const interval = window.setInterval(refreshLiveScores, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  if (matches.length === 0) return null;

  return (
    <Card className="mb-5">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <span aria-hidden className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Jogos ao vivo
          </CardTitle>
          <CardDescription>Placar atualizado automaticamente.</CardDescription>
        </div>
        <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/palpites">
          Palpites
        </Link>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {matches.map((match) => (
          <div
            className="rounded-control border border-app-border bg-app-background p-3"
            key={match.id}
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamSide align="left" team={match.homeTeam} />
              <span
                aria-label={`Placar ${scoreText(match.homeScore)} a ${scoreText(match.awayScore)}`}
                className="whitespace-nowrap text-base font-bold tabular-nums text-app-foreground"
              >
                {scoreText(match.homeScore)}
                <span aria-hidden className="mx-1 text-app-muted">
                  x
                </span>
                {scoreText(match.awayScore)}
              </span>
              <TeamSide align="right" team={match.awayTeam} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-app-muted">
              <span className="truncate">{match.championshipName}</span>
              {statusBadge(match.status, match.elapsed)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
