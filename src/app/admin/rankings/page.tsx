import { RefreshCw, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { recalculateLeagueRankingAction } from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminSelect } from "@/features/admin/components/admin-select";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminLeagueRankings } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type AdminRankingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const recalculateLeagueRankingFormAction = recalculateLeagueRankingAction as unknown as FormAction;

export default async function AdminRankingsPage({ searchParams }: AdminRankingsPageProps) {
  const params = await searchParams;
  const result = await getAdminLeagueRankings(params);
  const { leagues, rankings, selectedLeague, selectedLeagueId } = result.data;

  return (
    <PageShell
      description="Visualize e recalcule a classificacao independente de cada liga."
      eyebrow="Administracao"
      title="Rankings por liga"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy aria-hidden className="h-5 w-5 text-brand-gold" />
            Liga selecionada
          </CardTitle>
          <CardDescription>O recalculo abaixo afeta somente a liga escolhida.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <form className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <AdminSelect defaultValue={selectedLeagueId} label="Liga" name="league">
                <option value="">Selecione uma liga</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.label}
                  </option>
                ))}
              </AdminSelect>
              <button
                className="h-10 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold disabled:opacity-60"
                disabled={leagues.length === 0}
                type="submit"
              >
                Ver ranking
              </button>
            </form>

            <form action={recalculateLeagueRankingFormAction}>
              <input name="leagueId" type="hidden" value={selectedLeagueId} />
              <button
                className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                disabled={!selectedLeagueId}
                type="submit"
              >
                <RefreshCw aria-hidden className="h-4 w-4" />
                Recalcular liga
              </button>
            </form>
          </div>

          {selectedLeague ? (
            <p className="mt-3 text-sm text-app-muted">
              {selectedLeague.name} | {selectedLeague.championshipName} |{" "}
              {selectedLeague.membersCount} participantes
            </p>
          ) : null}
        </CardContent>
      </Card>

      {rankings.length === 0 ? (
        <AdminEmpty
          description="Homologue partidas ou recalcule a liga depois que houver pontuacoes."
          title="Nenhuma pontuacao processada para esta liga"
        />
      ) : (
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTh>Posicao</AdminTh>
              <AdminTh>Participante</AdminTh>
              <AdminTh>Pontos</AdminTh>
              <AdminTh>XP</AdminTh>
              <AdminTh>Nivel</AdminTh>
              <AdminTh>Acertos</AdminTh>
              <AdminTh>Exatos</AdminTh>
            </tr>
          </AdminTableHead>
          <AdminTableBody>
            {rankings.map((ranking) => (
              <tr key={ranking.id}>
                <AdminTd>
                  <Badge tone={ranking.position === 1 ? "warning" : "neutral"}>
                    #{ranking.position ?? "-"}
                  </Badge>
                </AdminTd>
                <AdminTd>
                  <div className="flex items-center gap-3">
                    <Avatar
                      alt={ranking.user.name}
                      name={ranking.user.name}
                      src={ranking.user.avatarUrl}
                    />
                    <div>
                      <p className="font-semibold">{ranking.user.name}</p>
                      <p className="text-xs text-app-muted">
                        @{ranking.user.username} | {ranking.user.email}
                      </p>
                    </div>
                  </div>
                </AdminTd>
                <AdminTd className="font-bold text-app-foreground">{ranking.points}</AdminTd>
                <AdminTd>{ranking.user.xp}</AdminTd>
                <AdminTd>{ranking.user.level}</AdminTd>
                <AdminTd>{ranking.hits}</AdminTd>
                <AdminTd>{ranking.exactScores}</AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </PageShell>
  );
}
