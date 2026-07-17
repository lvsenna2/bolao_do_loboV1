import { History, PlusCircle, RefreshCw, Trophy } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adjustLeagueRankingAction,
  recalculateLeagueRankingAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminSelect } from "@/features/admin/components/admin-select";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminLeagueRankings } from "@/features/admin/data/admin-data";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type AdminRankingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const recalculateLeagueRankingFormAction = recalculateLeagueRankingAction as unknown as FormAction;
const adjustLeagueRankingFormAction = adjustLeagueRankingAction as unknown as FormAction;

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function formatDate(date: Date) {
  return formatDateTimeInSaoPaulo(date);
}

export default async function AdminRankingsPage({ searchParams }: AdminRankingsPageProps) {
  const params = await searchParams;
  const result = await getAdminLeagueRankings(params);
  const { adjustments, leagues, participants, rankings, selectedLeague, selectedLeagueId } =
    result.data;

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
              <AdminSubmitButton
                className="h-10 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold disabled:opacity-60"
                disabled={leagues.length === 0}
                pendingLabel="Carregando..."
              >
                Ver ranking
              </AdminSubmitButton>
            </form>

            <form action={recalculateLeagueRankingFormAction}>
              <input name="leagueId" type="hidden" value={selectedLeagueId} />
              <AdminSubmitButton
                className="inline-flex h-10 items-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
                disabled={!selectedLeagueId}
                pendingLabel="Recalculando..."
              >
                <RefreshCw aria-hidden className="h-4 w-4" />
                Recalcular liga
              </AdminSubmitButton>
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

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle aria-hidden className="h-5 w-5 text-brand-gold" />
            Ajuste manual de pontos
          </CardTitle>
          <CardDescription>
            Use valor negativo para descontar pontos e positivo para bonificar. O motivo fica
            registrado no historico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={adjustLeagueRankingFormAction}
            className="grid gap-3 lg:grid-cols-[1fr_160px_1.2fr_auto] lg:items-end"
          >
            <input name="leagueId" type="hidden" value={selectedLeagueId} />
            <AdminSelect label="Participante" name="userId" required>
              <option value="">Selecione</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name} | {participant.email}
                </option>
              ))}
            </AdminSelect>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Pontos</span>
              <input
                className={inputClass}
                name="pointsDelta"
                placeholder="-10 ou 5"
                required
                type="number"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-app-foreground">Motivo</span>
              <input
                className={inputClass}
                maxLength={240}
                name="reason"
                placeholder="Ex: ajuste por palpite duplicado"
                required
              />
            </label>
            <AdminSubmitButton
              className="h-10 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
              disabled={!selectedLeagueId || participants.length === 0}
              pendingLabel="Aplicando..."
            >
              Aplicar
            </AdminSubmitButton>
          </form>
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
              <AdminTh>Ajuste</AdminTh>
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
                <AdminTd>
                  <Badge tone={ranking.adjustmentPoints === 0 ? "neutral" : "warning"}>
                    {ranking.adjustmentPoints > 0 ? "+" : ""}
                    {ranking.adjustmentPoints}
                  </Badge>
                </AdminTd>
                <AdminTd>{ranking.user.xp}</AdminTd>
                <AdminTd>{ranking.user.level}</AdminTd>
                <AdminTd>{ranking.hits}</AdminTd>
                <AdminTd>{ranking.exactScores}</AdminTd>
              </tr>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History aria-hidden className="h-5 w-5 text-brand-gold" />
            Historico de ajustes
          </CardTitle>
          <CardDescription>Ultimos ajustes manuais aplicados nesta liga.</CardDescription>
        </CardHeader>
        <CardContent>
          {adjustments.length === 0 ? (
            <p className="text-sm text-app-muted">Nenhum ajuste manual registrado.</p>
          ) : (
            <div className="space-y-3">
              {adjustments.map((adjustment) => (
                <article
                  className="rounded-control border border-app-border bg-app-background p-3"
                  key={adjustment.id}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar
                        alt={adjustment.user.name}
                        name={adjustment.user.name}
                        src={adjustment.user.avatarUrl}
                      />
                      <div>
                        <p className="font-semibold text-app-foreground">{adjustment.user.name}</p>
                        <p className="text-xs text-app-muted">
                          @{adjustment.user.username} | {adjustment.user.email}
                        </p>
                      </div>
                    </div>
                    <Badge tone={adjustment.pointsDelta < 0 ? "warning" : "success"}>
                      {adjustment.pointsDelta > 0 ? "+" : ""}
                      {adjustment.pointsDelta} pts
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-app-foreground">{adjustment.reason}</p>
                  <p className="mt-1 text-xs text-app-muted">
                    Por {adjustment.admin.name} | {adjustment.admin.email} |{" "}
                    {formatDate(adjustment.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
