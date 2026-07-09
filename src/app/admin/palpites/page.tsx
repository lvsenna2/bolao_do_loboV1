import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/layout/page-shell";
import { AdminAlert } from "@/features/admin/components/admin-alert";
import { AdminEmpty } from "@/features/admin/components/admin-empty";
import { AdminFilterForm } from "@/features/admin/components/admin-filter-form";
import { AdminPagination } from "@/features/admin/components/admin-pagination";
import {
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh
} from "@/features/admin/components/admin-table";
import { getAdminGuesses } from "@/features/admin/data/admin-data";

export const dynamic = "force-dynamic";

type AdminGuessesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getScoreLabel(guess: { awayPrediction: number | null; homePrediction: number | null }) {
  if (guess.homePrediction === null || guess.awayPrediction === null) {
    return "Sem placar";
  }

  return `${guess.homePrediction} x ${guess.awayPrediction}`;
}

function getRoundLabel(round: {
  name: string | null;
  number: number;
  season: {
    name: string | null;
    year: number;
  };
}) {
  const roundName = round.name || `Rodada ${round.number}`;
  const seasonName = round.season.name || String(round.season.year);

  return `${roundName} - ${seasonName}`;
}

export default async function AdminGuessesPage({ searchParams }: AdminGuessesPageProps) {
  const params = await searchParams;
  const result = await getAdminGuesses(params);
  const guesses = result.data.items;

  return (
    <PageShell
      description="Veja todos os palpites enviados pelos usuarios em ligas, rodadas e partidas."
      eyebrow="Administracao"
      title="Palpites"
    >
      <AdminAlert message={result.ok ? undefined : result.message} />

      <AdminFilterForm
        placeholder="Usuario, e-mail, liga ou time"
        query={String(params.q ?? "")}
      />

      {guesses.length === 0 ? (
        <AdminEmpty />
      ) : (
        <>
          <AdminTable>
            <AdminTableHead>
              <tr>
                <AdminTh>Usuario</AdminTh>
                <AdminTh>Liga / Rodada</AdminTh>
                <AdminTh>Partida</AdminTh>
                <AdminTh>Palpite</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Datas</AdminTh>
              </tr>
            </AdminTableHead>
            <AdminTableBody>
              {guesses.map((guess) => (
                <tr key={guess.id}>
                  <AdminTd>
                    <div className="flex items-center gap-3">
                      <Avatar name={guess.user.name} src={guess.user.avatarUrl} />
                      <div>
                        <p className="font-semibold">{guess.user.name}</p>
                        <p className="text-xs text-app-muted">{guess.user.email}</p>
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <p className="font-medium">{guess.league?.name ?? "Sem liga"}</p>
                    <p className="text-xs text-app-muted">
                      {guess.match.round.season.championship.name} |{" "}
                      {getRoundLabel(guess.match.round)}
                    </p>
                  </AdminTd>
                  <AdminTd>
                    <p className="font-semibold">
                      {guess.match.homeTeam.shortName || guess.match.homeTeam.name} x{" "}
                      {guess.match.awayTeam.shortName || guess.match.awayTeam.name}
                    </p>
                    <p className="text-xs text-app-muted">{formatDate(guess.match.kickoff)}</p>
                  </AdminTd>
                  <AdminTd>
                    <p className="text-xl font-bold">{getScoreLabel(guess)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone="info">{guess.prediction}</Badge>
                      {guess.joker ? <Badge tone="warning">Curinga</Badge> : null}
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{guess.match.status}</Badge>
                      {guess.score ? (
                        <Badge tone={guess.score.totalPoints > 0 ? "success" : "neutral"}>
                          {guess.score.totalPoints} pts
                        </Badge>
                      ) : (
                        <Badge tone="warning">Sem pontuacao</Badge>
                      )}
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <p>Enviado: {formatDate(guess.submittedAt)}</p>
                    <p className="text-xs text-app-muted">Atualizado: {formatDate(guess.updatedAt)}</p>
                  </AdminTd>
                </tr>
              ))}
            </AdminTableBody>
          </AdminTable>
          <AdminPagination
            page={result.data.page}
            pageSize={result.data.pageSize}
            pathname="/admin/palpites"
            searchParams={params}
            total={result.data.total}
          />
        </>
      )}
    </PageShell>
  );
}
