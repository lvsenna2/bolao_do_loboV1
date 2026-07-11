import { Medal } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

export function RankingTable({ myRanking, rankings }: RankingTableProps) {
  return (
    <Card>
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

        <div className="overflow-x-auto">
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
                    <div className="flex items-center gap-3">
                      <Avatar
                        alt={ranking.user.name}
                        name={ranking.user.name}
                        src={ranking.user.avatarUrl}
                      />
                      <div>
                        <p className="font-semibold text-app-foreground">{ranking.user.name}</p>
                        <p className="text-xs text-app-muted">@{ranking.user.username}</p>
                      </div>
                    </div>
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
