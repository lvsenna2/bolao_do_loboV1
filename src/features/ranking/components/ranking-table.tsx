import { Medal } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LeagueEmblemList } from "@/features/xp/components/league-emblem";
import { SubscriptionBadge } from "@/features/subscriptions/components/subscription-badge";
import type { RankingRowView } from "../data/ranking-data";

type RankingTableProps = {
  myRanking: RankingRowView | null;
  rankings: RankingRowView[];
};

function formatAverageSubmit(seconds: number | null) {
  if (seconds === null) {
    return "-";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getPositionTone(position: number | null) {
  if (position === 1) {
    return "warning" as const;
  }

  if (position && position <= 3) {
    return "info" as const;
  }

  return "neutral" as const;
}

function RankingIdentity({ ranking }: { ranking: RankingRowView }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar alt={ranking.user.name} name={ranking.user.name} src={ranking.user.avatarUrl} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-app-foreground">{ranking.user.name}</p>
        <p className="truncate text-xs text-app-muted">@{ranking.user.username}</p>
        <SubscriptionBadge plan={ranking.subscriptionPlan} />
        <LeagueEmblemList emblems={ranking.emblems} />
      </div>
    </div>
  );
}

export function RankingTable({ myRanking, rankings }: RankingTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {myRanking ? (
          <div className="border-b border-app-border bg-brand-gold/10 p-4">
            <p className="text-sm font-semibold text-app-foreground">
              Minha posicao: #{myRanking.position ?? "-"} com {myRanking.points} pontos
            </p>
            <p className="mt-1 text-xs text-app-muted">
              {myRanking.exactScores} placares exatos, {myRanking.hits} acertos e sequencia atual de{" "}
              {myRanking.currentStreak}.
            </p>
          </div>
        ) : null}

        <div className="divide-y divide-app-border md:hidden">
          {rankings.map((ranking) => (
            <div key={ranking.id} className="bg-app-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <RankingIdentity ranking={ranking} />
                <Badge tone={getPositionTone(ranking.position)}>
                  <Medal aria-hidden className="mr-1 h-3.5 w-3.5" />#{ranking.position ?? "-"}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-app-elevated p-2">
                  <p className="text-[10px] uppercase tracking-wide text-app-muted">Pontos</p>
                  <p className="mt-1 font-bold text-app-foreground">{ranking.points}</p>
                </div>
                <div className="rounded-md bg-app-elevated p-2">
                  <p className="text-[10px] uppercase tracking-wide text-app-muted">Exatos</p>
                  <p className="mt-1 font-semibold text-app-foreground">{ranking.exactScores}</p>
                </div>
                <div className="rounded-md bg-app-elevated p-2">
                  <p className="text-[10px] uppercase tracking-wide text-app-muted">Acertos</p>
                  <p className="mt-1 font-semibold text-app-foreground">{ranking.hits}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-muted">
                <span>XP: {ranking.user.xp}</span>
                <span>Nivel: {ranking.user.level}</span>
                <span>Erros: {ranking.losses}</span>
                <span>Sequencia: {ranking.currentStreak}</span>
                <span>Tempo medio: {formatAverageSubmit(ranking.averageSubmitSeconds)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-app-border bg-app-elevated text-xs uppercase tracking-[0.12em] text-app-muted">
              <tr>
                <th className="px-4 py-3">Posicao</th>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Pontos</th>
                <th className="px-4 py-3">XP</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Exatos</th>
                <th className="px-4 py-3">Acertos</th>
                <th className="px-4 py-3">Erros</th>
                <th className="px-4 py-3">Sequencia</th>
                <th className="px-4 py-3">Tempo medio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {rankings.map((ranking) => (
                <tr key={ranking.id}>
                  <td className="px-4 py-3">
                    <Badge tone={getPositionTone(ranking.position)}>
                      <Medal aria-hidden className="mr-1 h-3.5 w-3.5" />#{ranking.position ?? "-"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <RankingIdentity ranking={ranking} />
                  </td>
                  <td className="px-4 py-3 font-bold text-app-foreground">{ranking.points}</td>
                  <td className="px-4 py-3">{ranking.user.xp}</td>
                  <td className="px-4 py-3">{ranking.user.level}</td>
                  <td className="px-4 py-3">{ranking.exactScores}</td>
                  <td className="px-4 py-3">{ranking.hits}</td>
                  <td className="px-4 py-3">{ranking.losses}</td>
                  <td className="px-4 py-3">{ranking.currentStreak}</td>
                  <td className="px-4 py-3">{formatAverageSubmit(ranking.averageSubmitSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
