"use client";

import type { SpecialRoundAnswerType } from "@prisma/client";
import { Save } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { submitSpecialRoundPredictionsAction } from "../actions/special-round-actions";
import type { SpecialRoundAnswer } from "../types";

type Market = {
  answerType: SpecialRoundAnswerType;
  description: string | null;
  id: string;
  options: { label: string; value: string }[];
  points: number;
  required: boolean;
  title: string;
};

export function SpecialRoundPredictionForm({
  initialAnswers,
  markets,
  specialRoundId
}: {
  initialAnswers: Record<string, SpecialRoundAnswer>;
  markets: Market[];
  specialRoundId: string;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, SpecialRoundAnswer>>(initialAnswers);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function setAnswer(id: string, value: SpecialRoundAnswer) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await submitSpecialRoundPredictionsAction({ answers, specialRoundId });
      setMessage(result.message);
      if (result.ok) {
        router.push(`/rodadas-especiais/${specialRoundId}/meu-palpite` as Route);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {markets.map((market) => {
        const answer = answers[market.id];
        return (
          <section
            className="rounded-card border border-app-border bg-app-surface p-4"
            key={market.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-app-foreground">{market.title}</h3>
                {market.description ? (
                  <p className="mt-1 text-sm text-app-muted">{market.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-semibold text-brand-gold">
                {market.points} pts
              </span>
            </div>
            <div className="mt-4">
              {market.answerType === "SCORE" ? (
                <div className="flex items-center justify-center gap-3">
                  <input
                    aria-label="Gols do time da casa"
                    className="h-14 w-20 rounded-control border border-app-border bg-app-elevated text-center text-xl"
                    min="0"
                    onChange={(event) =>
                      setAnswer(market.id, {
                        home: Number(event.target.value),
                        away: typeof answer === "object" ? answer.away : 0
                      })
                    }
                    type="number"
                    value={typeof answer === "object" ? answer.home : ""}
                  />
                  <span className="font-bold">x</span>
                  <input
                    aria-label="Gols do time visitante"
                    className="h-14 w-20 rounded-control border border-app-border bg-app-elevated text-center text-xl"
                    min="0"
                    onChange={(event) =>
                      setAnswer(market.id, {
                        home: typeof answer === "object" ? answer.home : 0,
                        away: Number(event.target.value)
                      })
                    }
                    type="number"
                    value={typeof answer === "object" ? answer.away : ""}
                  />
                </div>
              ) : market.options.length ||
                ["SINGLE_CHOICE", "OPTION_LIST", "BOOLEAN"].includes(market.answerType) ? (
                <select
                  className="h-12 w-full rounded-control border border-app-border bg-app-elevated px-3"
                  onChange={(event) =>
                    setAnswer(
                      market.id,
                      market.answerType === "BOOLEAN"
                        ? event.target.value === "true"
                        : event.target.value
                    )
                  }
                  value={
                    typeof answer === "string" || typeof answer === "boolean" ? String(answer) : ""
                  }
                >
                  <option value="">Selecione</option>
                  {market.answerType === "BOOLEAN" ? (
                    <>
                      <option value="true">Sim</option>
                      <option value="false">Nao</option>
                    </>
                  ) : (
                    market.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <input
                  className="h-12 w-full rounded-control border border-app-border bg-app-elevated px-3"
                  onChange={(event) =>
                    setAnswer(
                      market.id,
                      market.answerType === "INTEGER"
                        ? Number(event.target.value)
                        : event.target.value
                    )
                  }
                  type={market.answerType === "INTEGER" ? "number" : "text"}
                  value={typeof answer === "number" || typeof answer === "string" ? answer : ""}
                />
              )}
            </div>
          </section>
        );
      })}
      <div className="sticky bottom-20 z-20 rounded-card border border-brand-gold/35 bg-black/95 p-3 lg:bottom-4">
        <LoadingButton
          className="h-12 w-full rounded-button bg-brand-gold font-semibold text-black"
          icon={<Save className="h-4 w-4" />}
          isLoading={pending}
          loadingLabel="Salvando..."
          onClick={save}
        >
          Salvar palpites
        </LoadingButton>
        {message ? (
          <p aria-live="polite" className="mt-2 text-center text-sm text-white">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
