"use client";

import type { ElectionRoundStatus, ElectionTurn, PaymentStatus } from "@prisma/client";
import { Plus, Save, Trash2, Trophy, UserRoundCog } from "lucide-react";
import { useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { formatDateTimeLocalForSaoPaulo } from "@/lib/date-time";
import {
  createElectionCandidateAction,
  removeElectionCandidateAction,
  saveElectionResultAction,
  saveElectionSettingsAction,
  updateElectionCandidateAction
} from "../actions";

type Candidate = {
  active: boolean;
  id: string;
  name: string;
  party: string;
  sortOrder: number;
};

type Entry = {
  id: string;
  paymentStatus: PaymentStatus;
  prediction: {
    marginRange: string;
    runnerUpCandidate: { name: string };
    turn: ElectionTurn;
    winnerCandidate: { name: string };
    winnerRange: string;
  } | null;
  user: { email: string; name: string };
  winner: { amount: number } | null;
};

type Result = {
  runnerUpCandidateId: string;
  runnerUpPercent: number;
  turn: ElectionTurn;
  winnerCandidateId: string;
  winnerPercent: number;
} | null;

const inputClass =
  "mt-1 h-11 w-full rounded-control border border-app-border bg-app-elevated px-3 text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

export function AdminElectionWorkspace({
  candidates,
  entries,
  result,
  round
}: {
  candidates: Candidate[];
  entries: Entry[];
  result: Result;
  round: {
    description: string | null;
    id: string;
    name: string;
    noWinnerDestination: string | null;
    registrationClosesAt: Date;
    registrationOpensAt: Date;
    rules: string | null;
    status: ElectionRoundStatus;
  };
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const activeCandidates = candidates.filter((candidate) => candidate.active);

  function run(action: () => Promise<{ message: string }>) {
    startTransition(async () => {
      const response = await action();
      setMessage(response.message);
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          aria-live="polite"
          className="rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm"
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-card border border-app-border bg-app-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Configuração do evento</h2>
        <form
          action={(formData) =>
            run(() =>
              saveElectionSettingsAction({
                description: formData.get("description"),
                name: formData.get("name"),
                noWinnerDestination: formData.get("noWinnerDestination"),
                registrationClosesAt: formData.get("registrationClosesAt"),
                registrationOpensAt: formData.get("registrationOpensAt"),
                roundId: round.id,
                rules: formData.get("rules"),
                status: formData.get("status")
              })
            )
          }
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <label className="text-sm font-medium md:col-span-2">
            Nome
            <input className={inputClass} defaultValue={round.name} name="name" required />
          </label>
          <label className="text-sm font-medium">
            Abertura
            <input
              className={inputClass}
              defaultValue={formatDateTimeLocalForSaoPaulo(round.registrationOpensAt)}
              name="registrationOpensAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="text-sm font-medium">
            Encerramento
            <input
              className={inputClass}
              defaultValue={formatDateTimeLocalForSaoPaulo(round.registrationClosesAt)}
              name="registrationClosesAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select className={inputClass} defaultValue={round.status} name="status">
              <option value="DRAFT">Rascunho</option>
              <option value="REGISTRATION_OPEN">Inscrições abertas</option>
              <option value="CLOSED">Inscrições encerradas</option>
              <option value="RESULT_PENDING">Aguardando resultado</option>
              <option value="FINALIZED">Finalizada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Destino do prêmio se não houver vencedor
            <input
              className={inputClass}
              defaultValue={round.noWinnerDestination ?? ""}
              name="noWinnerDestination"
              placeholder="Definir posteriormente"
            />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Descrição
            <textarea
              className="mt-1 min-h-24 w-full rounded-control border border-app-border bg-app-elevated p-3"
              defaultValue={round.description ?? ""}
              name="description"
            />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Regulamento
            <textarea
              className="mt-1 min-h-32 w-full rounded-control border border-app-border bg-app-elevated p-3"
              defaultValue={round.rules ?? ""}
              name="rules"
            />
          </label>
          <LoadingButton
            className="h-11 rounded-button bg-brand-gold px-4 font-semibold text-black md:col-span-2"
            icon={<Save className="h-4 w-4" />}
            isLoading={pending}
            loadingLabel="Salvando..."
            type="submit"
          >
            Salvar configurações
          </LoadingButton>
        </form>
      </section>

      <section className="rounded-card border border-app-border bg-app-surface p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <UserRoundCog className="h-5 w-5 text-brand-gold" />
          <h2 className="text-lg font-semibold">Candidatos</h2>
        </div>
        <div className="mt-4 space-y-3">
          {candidates.map((candidate) => (
            <form
              action={(formData) =>
                run(() =>
                  updateElectionCandidateAction({
                    candidateId: candidate.id,
                    name: formData.get("name"),
                    party: formData.get("party"),
                    roundId: round.id,
                    sortOrder: formData.get("sortOrder")
                  })
                )
              }
              className="grid gap-3 rounded-control border border-app-border p-3 sm:grid-cols-[minmax(0,1fr)_8rem_5rem_auto]"
              key={candidate.id}
            >
              <input
                className={inputClass}
                defaultValue={candidate.name}
                disabled={!candidate.active}
                name="name"
                required
              />
              <input
                className={inputClass}
                defaultValue={candidate.party}
                disabled={!candidate.active}
                name="party"
                required
              />
              <input
                className={inputClass}
                defaultValue={candidate.sortOrder}
                disabled={!candidate.active}
                min="0"
                name="sortOrder"
                type="number"
              />
              <div className="flex items-end gap-2">
                {candidate.active ? (
                  <>
                    <LoadingButton
                      aria-label={`Salvar ${candidate.name}`}
                      className="h-11 rounded-button border border-brand-gold/40 px-3 text-brand-gold"
                      isLoading={pending}
                      loadingLabel="..."
                      type="submit"
                    >
                      Salvar
                    </LoadingButton>
                    <LoadingButton
                      aria-label={`Remover ${candidate.name}`}
                      className="h-11 rounded-button border border-red-500/40 px-3 text-red-400"
                      isLoading={pending}
                      loadingLabel="..."
                      onClick={() =>
                        run(() => removeElectionCandidateAction(round.id, candidate.id))
                      }
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </LoadingButton>
                  </>
                ) : (
                  <span className="pb-3 text-xs text-app-muted">Removido</span>
                )}
              </div>
            </form>
          ))}
        </div>

        <form
          action={(formData) =>
            run(() =>
              createElectionCandidateAction({
                name: formData.get("name"),
                party: formData.get("party"),
                roundId: round.id,
                sortOrder: formData.get("sortOrder")
              })
            )
          }
          className="mt-4 grid gap-3 rounded-control border border-dashed border-brand-gold/40 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_5rem_auto]"
        >
          <input className={inputClass} name="name" placeholder="Nome do candidato" required />
          <input className={inputClass} name="party" placeholder="Partido" required />
          <input
            className={inputClass}
            defaultValue={activeCandidates.length + 1}
            min="0"
            name="sortOrder"
            type="number"
          />
          <LoadingButton
            className="h-11 self-end rounded-button bg-brand-gold px-4 font-semibold text-black"
            icon={<Plus className="h-4 w-4" />}
            isLoading={pending}
            loadingLabel="..."
            type="submit"
          >
            Adicionar
          </LoadingButton>
        </form>
      </section>

      <section className="rounded-card border border-app-border bg-app-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Participantes ({entries.length})</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {entries.length ? (
            entries.map((entry) => (
              <article className="rounded-control border border-app-border p-3" key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{entry.user.name}</p>
                    <p className="text-xs text-app-muted">{entry.user.email}</p>
                  </div>
                  <span className="text-xs font-semibold text-brand-gold">
                    {entry.paymentStatus}
                  </span>
                </div>
                <p className="mt-3 text-sm text-app-muted">
                  {entry.prediction
                    ? `${entry.prediction.winnerCandidate.name} / ${entry.prediction.runnerUpCandidate.name} / ${entry.prediction.turn === "FIRST" ? "1º turno" : "2º turno"}`
                    : "Palpite ainda não enviado"}
                </p>
                {entry.winner ? (
                  <p className="mt-2 text-sm font-semibold text-emerald-400">
                    Vencedor:{" "}
                    {entry.winner.amount.toLocaleString("pt-BR", {
                      currency: "BRL",
                      style: "currency"
                    })}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-app-muted">Nenhum participante inscrito.</p>
          )}
        </div>
      </section>

      <section className="rounded-card border border-brand-gold/30 bg-app-surface p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-gold" />
          <h2 className="text-lg font-semibold">Resultado oficial</h2>
        </div>
        <form
          action={(formData) =>
            run(() =>
              saveElectionResultAction({
                roundId: round.id,
                runnerUpCandidateId: formData.get("runnerUpCandidateId"),
                runnerUpPercent: formData.get("runnerUpPercent"),
                turn: formData.get("turn"),
                winnerCandidateId: formData.get("winnerCandidateId"),
                winnerPercent: formData.get("winnerPercent")
              })
            )
          }
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <label className="text-sm font-medium">
            Presidente eleito
            <select
              className={inputClass}
              defaultValue={result?.winnerCandidateId ?? ""}
              name="winnerCandidateId"
              required
            >
              <option value="">Selecione</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.party})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Segundo colocado
            <select
              className={inputClass}
              defaultValue={result?.runnerUpCandidateId ?? ""}
              name="runnerUpCandidateId"
              required
            >
              <option value="">Selecione</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.party})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Turno
            <select className={inputClass} defaultValue={result?.turn ?? ""} name="turn" required>
              <option value="">Selecione</option>
              <option value="FIRST">1º Turno</option>
              <option value="SECOND">2º Turno</option>
            </select>
          </label>
          <div className="hidden md:block" />
          <label className="text-sm font-medium">
            Percentual do vencedor
            <input
              className={inputClass}
              defaultValue={result?.winnerPercent ?? ""}
              max="100"
              min="0"
              name="winnerPercent"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="text-sm font-medium">
            Percentual do segundo colocado
            <input
              className={inputClass}
              defaultValue={result?.runnerUpPercent ?? ""}
              max="100"
              min="0"
              name="runnerUpPercent"
              required
              step="0.01"
              type="number"
            />
          </label>
          <LoadingButton
            className="h-11 rounded-button bg-brand-gold px-4 font-semibold text-black md:col-span-2"
            icon={<Trophy className="h-4 w-4" />}
            isLoading={pending}
            loadingLabel="Apurando..."
            type="submit"
          >
            Publicar resultado e apurar
          </LoadingButton>
        </form>
      </section>
    </div>
  );
}
