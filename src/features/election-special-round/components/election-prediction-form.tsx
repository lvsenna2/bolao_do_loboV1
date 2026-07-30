"use client";

import type { ElectionTurn } from "@prisma/client";
import { CheckCircle2, Vote } from "lucide-react";
import { useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { submitElectionPredictionAction } from "../actions";
import { marginRangeOptions, winnerRangeOptions } from "../constants";

type Candidate = {
  id: string;
  name: string;
  party: string;
};

type InitialPrediction = {
  marginRange: string;
  runnerUpCandidateId: string;
  turn: ElectionTurn;
  winnerCandidateId: string;
  winnerRange: string;
} | null;

const fieldClass =
  "mt-2 h-12 w-full rounded-control border border-app-border bg-app-elevated px-3 text-app-foreground outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

export function ElectionPredictionForm({
  candidates,
  initialPrediction,
  roundId
}: {
  candidates: Candidate[];
  initialPrediction: InitialPrediction;
  roundId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await submitElectionPredictionAction({
        marginRange: formData.get("marginRange"),
        roundId,
        runnerUpCandidateId: formData.get("runnerUpCandidateId"),
        turn: formData.get("turn"),
        winnerCandidateId: formData.get("winnerCandidateId"),
        winnerRange: formData.get("winnerRange")
      });
      setMessage(result.message);
    });
  }

  return (
    <form action={submit} className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium">
          1. Presidente eleito
          <select
            className={fieldClass}
            defaultValue={initialPrediction?.winnerCandidateId ?? ""}
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
          2. Turno da vitória
          <select
            className={fieldClass}
            defaultValue={initialPrediction?.turn ?? ""}
            name="turn"
            required
          >
            <option value="">Selecione</option>
            <option value="FIRST">1º Turno</option>
            <option value="SECOND">2º Turno</option>
          </select>
        </label>

        <label className="text-sm font-medium">
          3. Faixa percentual do vencedor
          <select
            className={fieldClass}
            defaultValue={initialPrediction?.winnerRange ?? ""}
            name="winnerRange"
            required
          >
            <option value="">Selecione</option>
            {winnerRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          4. Diferença entre primeiro e segundo
          <select
            className={fieldClass}
            defaultValue={initialPrediction?.marginRange ?? ""}
            name="marginRange"
            required
          >
            <option value="">Selecione</option>
            {marginRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium lg:col-span-2">
          5. Segundo colocado
          <select
            className={fieldClass}
            defaultValue={initialPrediction?.runnerUpCandidateId ?? ""}
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
      </div>

      <div className="rounded-control border border-brand-gold/25 bg-brand-gold/10 p-4 text-sm text-app-muted">
        <p className="flex items-start gap-2">
          <Vote className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
          Você pode atualizar este palpite enquanto as inscrições estiverem abertas. Após o prazo,
          todas as respostas ficam bloqueadas.
        </p>
      </div>

      <LoadingButton
        className="h-12 w-full rounded-button bg-brand-gold font-semibold text-black"
        icon={<CheckCircle2 className="h-4 w-4" />}
        isLoading={pending}
        loadingLabel="Confirmando..."
        type="submit"
      >
        {initialPrediction ? "Atualizar palpite" : "Confirmar palpite"}
      </LoadingButton>
      {message ? (
        <p aria-live="polite" className="text-center text-sm text-app-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
