"use client";

import type {
  PaymentStatus,
  SpecialRoundAnswerType,
  SpecialRoundMarketKind,
  SpecialRoundStatus
} from "@prisma/client";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import {
  calculateSpecialRoundAction,
  confirmSpecialRoundEntryAction,
  createSpecialRoundMarketAction,
  deleteSpecialRoundAction,
  duplicateSpecialRoundAction,
  markSpecialRoundPrizePaidAction,
  refundSpecialRoundEntryAction,
  saveSpecialRoundResultsAction,
  toggleSpecialRoundEntryBlockAction,
  updateSpecialRoundTieBreakAction,
  updateSpecialRoundStatusAction
} from "../actions/special-round-actions";
import { specialRoundStatusLabels } from "./status-badge";

type Market = {
  answerType: SpecialRoundAnswerType;
  id: string;
  kind: SpecialRoundMarketKind;
  line: number | null;
  options: { label: string; value: string }[];
  points: number;
  required: boolean;
  result: { answer: unknown } | null;
  sortOrder: number;
  title: string;
};

type Entry = {
  blockedAt: Date | null;
  id: string;
  paymentStatus: PaymentStatus;
  predictions: { answer: unknown; marketId: string }[];
  prize: { amount: number; id: string; status: string } | null;
  standing: { manualTieBreak: number } | null;
  user: { email: string; name: string };
};

type Standing = {
  entry: { prize: { amount: number; status: string } | null; user: { name: string } };
  exactScoreHits: number;
  hits: number;
  id: string;
  position: number | null;
  totalPoints: number;
};

const nextStatuses: Partial<Record<SpecialRoundStatus, SpecialRoundStatus[]>> = {
  AWAITING_RESULT: ["CALCULATING", "CANCELLED"],
  CALCULATING: ["AWAITING_RESULT", "FINALIZED", "CANCELLED"],
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
  PREDICTIONS_CLOSED: ["AWAITING_RESULT", "CANCELLED"],
  PREDICTIONS_OPEN: ["PREDICTIONS_CLOSED", "CANCELLED"],
  REGISTRATION_OPEN: ["PREDICTIONS_OPEN", "CANCELLED"]
};

const inputClass =
  "h-10 w-full rounded-control border border-app-border bg-app-elevated px-3 text-sm";

export function AdminSpecialRoundWorkspace({
  entries,
  markets,
  specialRoundId,
  standings,
  status
}: {
  entries: Entry[];
  markets: Market[];
  specialRoundId: string;
  standings: Standing[];
  status: SpecialRoundStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const run = (action: () => Promise<{ message: string; ok: boolean }>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
      if (result.ok) router.refresh();
    });

  function createMarket(formData: FormData) {
    const options = String(formData.get("options") ?? "")
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean)
      .map((option) => ({ label: option, value: option.toUpperCase().replace(/\s+/g, "_") }));
    run(() =>
      createSpecialRoundMarketAction({
        active: true,
        answerType: formData.get("answerType"),
        description: formData.get("description"),
        kind: formData.get("kind"),
        line: formData.get("line") ? Number(formData.get("line")) : undefined,
        options,
        points: formData.get("points"),
        required: formData.get("required") === "on",
        sortOrder: formData.get("sortOrder"),
        specialRoundId,
        title: formData.get("title")
      })
    );
  }

  function saveResults(formData: FormData) {
    const answers = Object.fromEntries(
      markets.map((market) => {
        const raw = String(formData.get(`result-${market.id}`) ?? "").trim();
        if (market.kind === "EXACT_SCORE") {
          const [home, away] = raw.split(/[xX-]/).map(Number);
          return [market.id, { away, home }];
        }
        if (["TOTAL_GOALS", "TOTAL_CORNERS", "TOTAL_CARDS"].includes(market.kind)) {
          return [market.id, Number(raw)];
        }
        if (market.kind === "BOTH_TEAMS_SCORE") return [market.id, raw === "true"];
        return [market.id, raw];
      })
    );
    run(() => saveSpecialRoundResultsAction({ answers, specialRoundId }));
  }

  function formatOfficialAnswer(market: Market) {
    const answer = market.result?.answer;
    if (market.kind === "EXACT_SCORE" && answer && typeof answer === "object") {
      const score = answer as { away?: number; home?: number };
      return `${score.home ?? 0}x${score.away ?? 0}`;
    }
    return answer === null || answer === undefined ? "" : String(answer);
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p
          className="rounded-control border border-brand-gold/30 bg-brand-gold/10 p-3 text-sm"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-card border border-app-border bg-app-surface p-5">
        <h2 className="text-lg font-semibold">Operacao</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(nextStatuses[status] ?? []).map((next) => (
            <LoadingButton
              className="h-10 rounded-button border border-brand-gold/40 px-3 text-sm font-semibold text-brand-gold"
              disabled={pending}
              key={next}
              onClick={() =>
                run(() => updateSpecialRoundStatusAction({ specialRoundId, status: next }))
              }
            >
              {specialRoundStatusLabels[next]}
            </LoadingButton>
          ))}
          <LoadingButton
            className="h-10 rounded-button border border-app-border px-3 text-sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await duplicateSpecialRoundAction(specialRoundId);
                if (result.ok && result.data)
                  router.push(`/admin/rodadas-especiais/${result.data.id}` as Route);
                return result;
              })
            }
          >
            Duplicar
          </LoadingButton>
          {status === "DRAFT" ? (
            <LoadingButton
              className="h-10 rounded-button bg-red-600 px-3 text-sm font-semibold text-white"
              disabled={pending}
              onClick={() =>
                window.confirm("Excluir este rascunho?")
                  ? run(() => deleteSpecialRoundAction(specialRoundId))
                  : undefined
              }
            >
              Excluir rascunho
            </LoadingButton>
          ) : null}
          <a
            className="inline-flex h-10 items-center rounded-button border border-app-border px-3 text-sm"
            href={`/admin/rodadas-especiais/${specialRoundId}/exportar/inscritos`}
          >
            CSV inscritos
          </a>
          <a
            className="inline-flex h-10 items-center rounded-button border border-app-border px-3 text-sm"
            href={`/admin/rodadas-especiais/${specialRoundId}/exportar/palpites`}
          >
            CSV palpites
          </a>
          <a
            className="inline-flex h-10 items-center rounded-button border border-app-border px-3 text-sm"
            href={`/admin/rodadas-especiais/${specialRoundId}/exportar/classificacao`}
          >
            CSV classificacao
          </a>
        </div>
      </section>

      <section className="rounded-card border border-app-border bg-app-surface p-5" id="mercados">
        <h2 className="text-lg font-semibold">Mercados</h2>
        <form action={createMarket} className="mt-4 grid gap-3 md:grid-cols-4">
          <input className={inputClass} name="title" placeholder="Titulo" required />
          <select className={inputClass} name="kind">
            {[
              "EXACT_SCORE",
              "MATCH_RESULT",
              "TOTAL_GOALS",
              "TOTAL_CORNERS",
              "BOTH_TEAMS_SCORE",
              "TOTAL_CARDS",
              "FIRST_TEAM_TO_SCORE",
              "GOAL_SCORER",
              "CUSTOM"
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select className={inputClass} name="answerType">
            {["SINGLE_CHOICE", "INTEGER", "SCORE", "BOOLEAN", "SHORT_TEXT", "OPTION_LIST"].map(
              (value) => (
                <option key={value}>{value}</option>
              )
            )}
          </select>
          <input
            className={inputClass}
            min="0"
            name="points"
            placeholder="Pontos"
            required
            type="number"
          />
          <input
            className={inputClass}
            name="line"
            placeholder="Linha (ex.: 2.5)"
            step="0.1"
            type="number"
          />
          <input
            className={inputClass}
            name="sortOrder"
            placeholder="Ordem"
            type="number"
            defaultValue="0"
          />
          <input
            className={`${inputClass} md:col-span-2`}
            name="options"
            placeholder="Opcoes separadas por virgula"
          />
          <input
            className={`${inputClass} md:col-span-3`}
            name="description"
            placeholder="Descricao"
          />
          <label className="flex items-center gap-2 text-sm">
            <input defaultChecked name="required" type="checkbox" /> Obrigatorio
          </label>
          <LoadingButton
            className="h-11 rounded-button bg-brand-gold px-4 font-semibold text-black md:col-span-4"
            isLoading={pending}
            loadingLabel="Criando..."
            type="submit"
          >
            Adicionar mercado
          </LoadingButton>
        </form>
        <div className="mt-4 space-y-2">
          {markets.map((market) => (
            <div
              className="flex justify-between rounded-control border border-app-border p-3 text-sm"
              key={market.id}
            >
              <span>
                {market.sortOrder}. {market.title}
              </span>
              <strong>{market.points} pts</strong>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-card border border-app-border bg-app-surface p-5"
        id="participantes"
      >
        <h2 className="text-lg font-semibold">Participantes</h2>
        <div className="mt-4 space-y-2">
          {entries.length ? (
            entries.map((entry) => (
              <div
                className="flex flex-col gap-3 rounded-control border border-app-border p-3 sm:flex-row sm:items-center"
                key={entry.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{entry.user.name}</p>
                  <p className="truncate text-xs text-app-muted">
                    {entry.user.email} | {entry.paymentStatus} | {entry.predictions.length} palpites
                  </p>
                </div>
                {entry.paymentStatus !== "APPROVED" ? (
                  <LoadingButton
                    className="h-9 rounded-button bg-emerald-600 px-3 text-xs font-semibold text-white"
                    disabled={pending}
                    onClick={() => run(() => confirmSpecialRoundEntryAction(entry.id))}
                  >
                    Confirmar pagamento
                  </LoadingButton>
                ) : null}
                {entry.paymentStatus === "APPROVED" ? (
                  <LoadingButton
                    className="h-9 rounded-button border border-red-500/40 px-3 text-xs text-red-400"
                    disabled={pending}
                    onClick={() =>
                      window.confirm("Solicitar reembolso integral no Mercado Pago?")
                        ? run(() => refundSpecialRoundEntryAction(entry.id))
                        : undefined
                    }
                  >
                    Reembolsar
                  </LoadingButton>
                ) : null}
                <LoadingButton
                  className="h-9 rounded-button border border-app-border px-3 text-xs"
                  disabled={pending}
                  onClick={() =>
                    run(() => toggleSpecialRoundEntryBlockAction(entry.id, !entry.blockedAt))
                  }
                >
                  {entry.blockedAt ? "Desbloquear" : "Bloquear"}
                </LoadingButton>
                {entry.standing ? (
                  <form
                    action={(formData) =>
                      run(() =>
                        updateSpecialRoundTieBreakAction(
                          entry.id,
                          Number(formData.get("manualTieBreak"))
                        )
                      )
                    }
                    className="flex gap-1"
                  >
                    <input
                      aria-label="Desempate manual"
                      className="h-9 w-16 rounded-control border border-app-border bg-app-elevated px-2"
                      defaultValue={entry.standing.manualTieBreak}
                      name="manualTieBreak"
                      type="number"
                    />
                    <LoadingButton
                      className="h-9 rounded-button border border-app-border px-2 text-xs"
                      type="submit"
                    >
                      Desempate
                    </LoadingButton>
                  </form>
                ) : null}
                {entry.prize && entry.prize.status !== "PAID" ? (
                  <LoadingButton
                    className="h-9 rounded-button bg-brand-gold px-3 text-xs font-semibold text-black"
                    disabled={pending}
                    onClick={() => run(() => markSpecialRoundPrizePaidAction(entry.prize!.id))}
                  >
                    Premio pago
                  </LoadingButton>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-app-muted">Nenhum inscrito.</p>
          )}
        </div>
      </section>

      <section className="rounded-card border border-app-border bg-app-surface p-5" id="palpites">
        <h2 className="text-lg font-semibold">Todos os palpites</h2>
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <details className="rounded-control border border-app-border p-3" key={entry.id}>
              <summary className="cursor-pointer font-semibold">
                {entry.user.name} ({entry.predictions.length})
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                {markets.map((market) => {
                  const prediction = entry.predictions.find((item) => item.marketId === market.id);
                  return (
                    <p className="flex justify-between gap-3" key={market.id}>
                      <span className="text-app-muted">{market.title}</span>
                      <strong>
                        {prediction ? JSON.stringify(prediction.answer) : "Nao informado"}
                      </strong>
                    </p>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-app-border bg-app-surface p-5" id="resultados">
        <h2 className="text-lg font-semibold">Resultados e apuracao</h2>
        <form action={saveResults} className="mt-4 space-y-3">
          {markets.map((market) => (
            <label
              className="grid gap-1 text-sm sm:grid-cols-[1fr_16rem] sm:items-center"
              key={market.id}
            >
              <span>{market.title}</span>
              <input
                className={inputClass}
                defaultValue={formatOfficialAnswer(market)}
                name={`result-${market.id}`}
                placeholder={
                  market.kind === "EXACT_SCORE"
                    ? "2x1"
                    : ["TOTAL_GOALS", "TOTAL_CORNERS", "TOTAL_CARDS"].includes(market.kind)
                      ? "Total numerico"
                      : "Resultado oficial"
                }
                required
              />
            </label>
          ))}
          <LoadingButton
            className="h-11 rounded-button border border-brand-gold/40 px-4 font-semibold text-brand-gold"
            isLoading={pending}
            loadingLabel="Salvando..."
            type="submit"
          >
            Salvar resultados
          </LoadingButton>
          <LoadingButton
            className="ml-2 h-11 rounded-button bg-brand-gold px-4 font-semibold text-black"
            disabled={pending}
            onClick={() => run(() => calculateSpecialRoundAction(specialRoundId))}
          >
            Calcular ou recalcular
          </LoadingButton>
        </form>
      </section>

      <section
        className="rounded-card border border-app-border bg-app-surface p-5"
        id="classificacao"
      >
        <h2 className="text-lg font-semibold">Classificacao</h2>
        <div className="mt-4 space-y-2">
          {standings.length ? (
            standings.map((standing) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-control border border-app-border p-3 text-sm"
                key={standing.id}
              >
                <strong className="text-brand-gold">#{standing.position ?? "-"}</strong>
                <span className="min-w-0 flex-1 font-semibold">{standing.entry.user.name}</span>
                <span>{standing.totalPoints} pts</span>
                <span>{standing.hits} acertos</span>
                <span>{standing.exactScoreHits} exatos</span>
                {standing.entry.prize ? (
                  <span className="text-emerald-400">
                    {standing.entry.prize.amount.toLocaleString("pt-BR", {
                      currency: "BRL",
                      style: "currency"
                    })}{" "}
                    ({standing.entry.prize.status})
                  </span>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-app-muted">Execute a apuracao para gerar o ranking.</p>
          )}
        </div>
      </section>
    </div>
  );
}
