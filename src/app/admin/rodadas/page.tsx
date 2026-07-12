import { MatchStatus, RoundStatus } from "@prisma/client";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createMatchAction,
  createRoundAction,
  deleteRoundAction,
  homologateMatchResultAction,
  openRoundAction,
  updateMatchStatusAction,
  updateRoundStatusAction
} from "@/features/admin/actions/admin-actions";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminDeleteButton } from "@/features/admin/components/admin-delete-button";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminFilterForm } from "@/features/admin/components/admin-filter-form";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import { AdminSelect } from "@/features/admin/components/admin-select";
import { AdminStatusBadge } from "@/features/admin/components/admin-status-badge";
import { AdminSubmitButton } from "@/features/admin/components/admin-submit-button";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminRounds } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => Promise<void>;
type AdminRoundsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const createRoundFormAction = createRoundAction as unknown as FormAction;
const createMatchFormAction = createMatchAction as unknown as FormAction;
const deleteRoundFormAction = deleteRoundAction as unknown as FormAction;
const homologateMatchResultFormAction = homologateMatchResultAction as unknown as FormAction;
const openRoundFormAction = openRoundAction as unknown as FormAction;
const updateRoundStatusFormAction = updateRoundStatusAction as unknown as FormAction;
const updateMatchStatusFormAction = updateMatchStatusAction as unknown as FormAction;

const inputClass =
  "h-10 rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

const textareaClass =
  "min-h-24 rounded-control border border-app-border bg-app-background px-3 py-2 text-sm text-app-foreground outline-none transition placeholder:text-app-muted focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getSeasonLabel(season: {
  championship: {
    name: string;
  };
  name: string | null;
  year: number;
}) {
  return `${season.championship.name} - ${season.name || season.year}`;
}

function getRoundOptionLabel(round: {
  name: string | null;
  number: number;
  season: {
    championship: {
      name: string;
    };
    name: string | null;
    year: number;
  };
}) {
  return `${round.name || `Rodada ${round.number}`} - ${round.season.championship.name} ${round.season.name || round.season.year}`;
}

function getTeamLabel(team: { country: string; name: string; shortName: string | null }) {
  return `${team.name}${team.shortName ? ` (${team.shortName})` : ""} - ${team.country}`;
}

export default async function AdminRoundsPage({ searchParams }: AdminRoundsPageProps) {
  const params = await searchParams;
  const result = await getAdminRounds(params);
  const { items, leagues, roundOptions, seasons, teams } = result.data;
  const championshipOptions = Array.from(
    new Map(seasons.map((season) => [season.championship.id, season.championship.name])).entries()
  );
  const canCreateMatch = roundOptions.length > 0 && teams.length >= 2;

  return (
    <PageShell
      description="Cadastre rodadas e partidas para liberar o fluxo de acompanhamento e palpites."
      eyebrow="Administracao"
      title="Rodadas"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nova rodada</CardTitle>
            <CardDescription>Uma rodada pertence a uma temporada de campeonato.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createRoundFormAction} className="grid gap-3">
              <AdminSelect name="seasonId" required>
                <option value="">Temporada</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {getSeasonLabel(season)}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect name="leagueId" required>
                <option value="">Liga do bolao</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name} - {league.championship.name} - {league.status}
                  </option>
                ))}
              </AdminSelect>
              <input
                className={inputClass}
                min="1"
                name="number"
                placeholder="Numero"
                required
                type="number"
              />
              <input className={inputClass} name="name" placeholder="Nome opcional" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} name="startsAt" required type="datetime-local" />
                <input className={inputClass} name="endsAt" required type="datetime-local" />
              </div>
              <AdminSelect defaultValue="SCHEDULED" name="status">
                {Object.values(RoundStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </AdminSelect>
              <textarea className={textareaClass} name="description" placeholder="Descricao" />
              <button
                className="h-10 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                disabled={seasons.length === 0}
                type="submit"
              >
                Cadastrar rodada
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova partida</CardTitle>
            <CardDescription>Partidas ficam vinculadas a uma rodada cadastrada.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createMatchFormAction} className="grid gap-3">
              <AdminSelect name="roundId" required>
                <option value="">Rodada</option>
                {roundOptions.map((round) => (
                  <option key={round.id} value={round.id}>
                    {getRoundOptionLabel(round)}
                  </option>
                ))}
              </AdminSelect>
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminSelect name="homeTeamId" required>
                  <option value="">Mandante</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {getTeamLabel(team)}
                    </option>
                  ))}
                </AdminSelect>
                <AdminSelect name="awayTeamId" required>
                  <option value="">Visitante</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {getTeamLabel(team)}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <input className={inputClass} name="kickoff" required type="datetime-local" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} name="stadium" placeholder="Estadio" />
                <input className={inputClass} name="city" placeholder="Cidade" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} name="country" placeholder="Pais" />
                <input className={inputClass} name="referee" placeholder="Arbitro" />
              </div>
              <input className={inputClass} name="broadcast" placeholder="Transmissao" />
              <AdminSelect defaultValue="SCHEDULED" name="status">
                {Object.values(MatchStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </AdminSelect>
              <button
                className="h-10 rounded-button bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                disabled={!canCreateMatch}
                type="submit"
              >
                Cadastrar partida
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AdminFilterForm placeholder="Rodada, descricao ou campeonato" query={String(params.q ?? "")}>
        <AdminSelect
          defaultValue={String(params.championship ?? "")}
          label="Campeonato"
          name="championship"
        >
          <option value="">Todos</option>
          {championshipOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect defaultValue={String(params.league ?? "")} label="Liga" name="league">
          <option value="">Todas</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name} - {league.championship.name}
            </option>
          ))}
        </AdminSelect>
        <AdminSelect defaultValue={String(params.status ?? "")} label="Status" name="status">
          <option value="">Todos</option>
          {Object.values(RoundStatus).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </AdminSelect>
      </AdminFilterForm>

      {items.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Rodada</AdminTh>
                <AdminTh>Periodo</AdminTh>
                <AdminTh>Jogos</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Partidas</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {items.map((round) => (
                <tr key={round.id}>
                  <AdminTd>
                    <div>
                      <p className="font-semibold">
                        {round.name || `Rodada ${round.number}`} - {round.season.championship.name}
                      </p>
                      <p className="text-xs text-app-muted">
                        {round.season.name || round.season.year}
                        {round.league ? ` | Liga: ${round.league.name}` : ""}
                      </p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <p>{formatDate(round.startsAt)}</p>
                    <p className="text-xs text-app-muted">{formatDate(round.endsAt)}</p>
                  </AdminTd>
                  <AdminTd>
                    <p>{round._count.matches} cadastrados</p>
                    <p className="text-xs text-app-muted">{round._count.rankings} rankings</p>
                  </AdminTd>
                  <AdminTd>
                    <form
                      action={updateRoundStatusFormAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input name="roundId" type="hidden" value={round.id} />
                      <AdminStatusBadge value={round.status} />
                      <AdminSelect defaultValue={round.status} name="status">
                        {Object.values(RoundStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </AdminSelect>
                      <button
                        className="h-9 rounded-button border border-app-border px-3 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                        type="submit"
                      >
                        Salvar
                      </button>
                    </form>
                    <form action={openRoundFormAction} className="mt-2">
                      <input name="roundId" type="hidden" value={round.id} />
                      <button
                        className="h-9 rounded-button bg-brand-gold px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={round.status === "OPEN"}
                        type="submit"
                      >
                        {round.status === "OPEN" ? "Aberta" : "Abrir"}
                      </button>
                    </form>
                    <form action={deleteRoundFormAction} className="mt-2">
                      <input name="roundId" type="hidden" value={round.id} />
                      <AdminDeleteButton
                        confirmMessage={`Excluir a rodada "${round.name || `Rodada ${round.number}`}"? Partidas, palpites, pontuacoes e rankings vinculados tambem serao removidos.`}
                      />
                    </form>
                  </AdminTd>
                  <AdminTd>
                    <div className="space-y-3">
                      {round.matches.length > 0 ? (
                        round.matches.map((match) => (
                          <div
                            className="rounded-control border border-app-border bg-app-background p-3"
                            key={match.id}
                          >
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="font-semibold">
                                  {match.homeTeam.shortName || match.homeTeam.name} x{" "}
                                  {match.awayTeam.shortName || match.awayTeam.name}
                                </p>
                                <p className="text-xs text-app-muted">
                                  {formatDate(match.kickoff)}
                                </p>
                                <p className="text-xs text-app-muted">
                                  Palpites: {match._count.guesses} | Pontuacoes:{" "}
                                  {match._count.scores}
                                </p>
                                {match.homologatedAt ? (
                                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                    Homologado em {formatDate(match.homologatedAt)}
                                  </p>
                                ) : null}
                              </div>
                              <form
                                action={updateMatchStatusFormAction}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <input name="matchId" type="hidden" value={match.id} />
                                <AdminStatusBadge value={match.status} />
                                <AdminSelect defaultValue={match.status} name="status">
                                  {Object.values(MatchStatus).map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </AdminSelect>
                                <button
                                  className="h-9 rounded-button border border-app-border px-3 text-sm font-semibold text-app-foreground transition hover:border-brand-gold hover:text-brand-gold"
                                  type="submit"
                                >
                                  Salvar
                                </button>
                              </form>
                            </div>

                            <form
                              action={homologateMatchResultFormAction}
                              className="mt-3 grid gap-2 border-t border-app-border pt-3 sm:grid-cols-[1fr_1fr_auto]"
                            >
                              <input name="matchId" type="hidden" value={match.id} />
                              <label className="space-y-1">
                                <span className="text-xs font-medium text-app-muted">
                                  Placar mandante
                                </span>
                                <input
                                  className={inputClass}
                                  defaultValue={match.homeScore ?? ""}
                                  max="99"
                                  min="0"
                                  name="homeScore"
                                  required
                                  type="number"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="text-xs font-medium text-app-muted">
                                  Placar visitante
                                </span>
                                <input
                                  className={inputClass}
                                  defaultValue={match.awayScore ?? ""}
                                  max="99"
                                  min="0"
                                  name="awayScore"
                                  required
                                  type="number"
                                />
                              </label>
                              <AdminSubmitButton
                                className="h-10 rounded-button bg-brand-gold px-4 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 sm:self-end"
                                pendingLabel={
                                  match.homologatedAt ? "Retificando..." : "Homologando..."
                                }
                              >
                                {match.homologatedAt ? "Retificar" : "Homologar"}
                              </AdminSubmitButton>
                            </form>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-app-muted">Nenhuma partida cadastrada.</p>
                      )}
                    </div>
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            pathname="/admin/rodadas"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
