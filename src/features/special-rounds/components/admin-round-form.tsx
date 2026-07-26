"use client";

import type { SpecialRoundPrizeMode } from "@prisma/client";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { formatDateTimeLocalForSaoPaulo } from "@/lib/date-time";
import {
  createSpecialRoundAction,
  updateSpecialRoundAction
} from "../actions/special-round-actions";

type MatchOption = {
  awayTeam: { logo: string | null; name: string };
  homeTeam: { logo: string | null; name: string };
  id: string;
  startsAt: Date;
};

type InitialRound = {
  adminFeePercent: number;
  awayTeamLogo: string | null;
  awayTeamName: string;
  description: string | null;
  entryFee: number;
  fixedPrize: number | null;
  homeTeamLogo: string | null;
  homeTeamName: string;
  id: string;
  matchId: string | null;
  matchStartsAt: Date;
  name: string;
  predictionsCloseAt: Date;
  predictionsOpenAt: Date;
  prizeDistribution: unknown;
  prizeMode: SpecialRoundPrizeMode;
  prizePoolPercent: number;
  registrationClosesAt: Date;
  registrationOpensAt: Date;
  rules: string | null;
};

const inputClass =
  "h-11 w-full rounded-control border border-app-border bg-app-elevated px-3 text-sm";

export function AdminSpecialRoundForm({
  initial,
  matches
}: {
  initial?: InitialRound;
  matches: MatchOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const distribution = useMemo(() => {
    const value = initial?.prizeDistribution;
    return Array.isArray(value)
      ? value.map((item) => String((item as { percent: number }).percent)).join(",")
      : "100";
  }, [initial]);

  function submit(formData: FormData) {
    const percents = String(formData.get("distribution"))
      .split(",")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0);
    const payload = {
      adminFeePercent: formData.get("adminFeePercent"),
      awayTeamLogo: formData.get("awayTeamLogo"),
      awayTeamName: formData.get("awayTeamName"),
      description: formData.get("description"),
      entryFee: formData.get("entryFee"),
      fixedPrize: formData.get("fixedPrize") || undefined,
      homeTeamLogo: formData.get("homeTeamLogo"),
      homeTeamName: formData.get("homeTeamName"),
      matchId: formData.get("matchId"),
      matchStartsAt: formData.get("matchStartsAt"),
      name: formData.get("name"),
      predictionsCloseAt: formData.get("predictionsCloseAt"),
      predictionsOpenAt: formData.get("predictionsOpenAt"),
      prizeDistribution: percents.map((percent, index) => ({ percent, position: index + 1 })),
      prizeMode: formData.get("prizeMode"),
      prizePoolPercent: formData.get("prizePoolPercent"),
      registrationClosesAt: formData.get("registrationClosesAt"),
      registrationOpensAt: formData.get("registrationOpensAt"),
      rules: formData.get("rules"),
      winnerCount: percents.length
    };
    startTransition(async () => {
      const result = initial
        ? await updateSpecialRoundAction(initial.id, payload)
        : await createSpecialRoundAction(payload);
      setMessage(result.message);
      if (result.ok) {
        router.push(`/admin/rodadas-especiais/${result.data?.id ?? initial?.id}` as Route);
        router.refresh();
      }
    });
  }

  function selectMatch(event: React.ChangeEvent<HTMLSelectElement>) {
    const match = matches.find((item) => item.id === event.target.value);
    if (!match) return;
    const form = event.currentTarget.form;
    if (!form) return;
    (form.elements.namedItem("homeTeamName") as HTMLInputElement).value = match.homeTeam.name;
    (form.elements.namedItem("awayTeamName") as HTMLInputElement).value = match.awayTeam.name;
    (form.elements.namedItem("homeTeamLogo") as HTMLInputElement).value = match.homeTeam.logo ?? "";
    (form.elements.namedItem("awayTeamLogo") as HTMLInputElement).value = match.awayTeam.logo ?? "";
    (form.elements.namedItem("matchStartsAt") as HTMLInputElement).value =
      formatDateTimeLocalForSaoPaulo(match.startsAt);
  }

  const dateDefault = (date?: Date) => (date ? formatDateTimeLocalForSaoPaulo(date) : "");
  return (
    <form action={submit} className="grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2">
        Nome
        <input className={inputClass} defaultValue={initial?.name} name="name" required />
      </label>
      <label className="md:col-span-2">
        Partida existente (opcional)
        <select
          className={inputClass}
          defaultValue={initial?.matchId ?? ""}
          name="matchId"
          onChange={selectMatch}
        >
          <option value="">Informar manualmente</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.homeTeam.name} x {match.awayTeam.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Time da casa
        <input
          className={inputClass}
          defaultValue={initial?.homeTeamName}
          name="homeTeamName"
          required
        />
      </label>
      <label>
        Time visitante
        <input
          className={inputClass}
          defaultValue={initial?.awayTeamName}
          name="awayTeamName"
          required
        />
      </label>
      <label>
        Escudo da casa
        <input
          className={inputClass}
          defaultValue={initial?.homeTeamLogo ?? ""}
          name="homeTeamLogo"
          type="url"
        />
      </label>
      <label>
        Escudo visitante
        <input
          className={inputClass}
          defaultValue={initial?.awayTeamLogo ?? ""}
          name="awayTeamLogo"
          type="url"
        />
      </label>
      <label>
        Inicio da partida
        <input
          className={inputClass}
          defaultValue={dateDefault(initial?.matchStartsAt)}
          name="matchStartsAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Valor da inscricao
        <input
          className={inputClass}
          defaultValue={initial?.entryFee ?? 10}
          min="0"
          name="entryFee"
          required
          step="0.01"
          type="number"
        />
      </label>
      <label>
        Abertura das inscricoes
        <input
          className={inputClass}
          defaultValue={dateDefault(initial?.registrationOpensAt)}
          name="registrationOpensAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Fechamento das inscricoes
        <input
          className={inputClass}
          defaultValue={dateDefault(initial?.registrationClosesAt)}
          name="registrationClosesAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Abertura dos palpites
        <input
          className={inputClass}
          defaultValue={dateDefault(initial?.predictionsOpenAt)}
          name="predictionsOpenAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Fechamento dos palpites
        <input
          className={inputClass}
          defaultValue={dateDefault(initial?.predictionsCloseAt)}
          name="predictionsCloseAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        Modelo de premio
        <select className={inputClass} defaultValue={initial?.prizeMode ?? "POOL"} name="prizeMode">
          <option value="POOL">Arrecadacao</option>
          <option value="FIXED">Valor fixo</option>
        </select>
      </label>
      <label>
        Premio fixo
        <input
          className={inputClass}
          defaultValue={initial?.fixedPrize ?? ""}
          min="0"
          name="fixedPrize"
          step="0.01"
          type="number"
        />
      </label>
      <label>
        Percentual para o premio
        <input
          className={inputClass}
          defaultValue={initial?.prizePoolPercent ?? 100}
          max="100"
          min="0"
          name="prizePoolPercent"
          step="0.01"
          type="number"
        />
      </label>
      <label>
        Taxa administrativa
        <input
          className={inputClass}
          defaultValue={initial?.adminFeePercent ?? 0}
          max="100"
          min="0"
          name="adminFeePercent"
          step="0.01"
          type="number"
        />
      </label>
      <label className="md:col-span-2">
        Distribuicao por posicao (percentuais separados por virgula)
        <input
          className={inputClass}
          defaultValue={distribution}
          name="distribution"
          placeholder="70,20,10"
          required
        />
      </label>
      <label className="md:col-span-2">
        Descricao
        <textarea
          className="min-h-24 w-full rounded-control border border-app-border bg-app-elevated p-3"
          defaultValue={initial?.description ?? ""}
          name="description"
        />
      </label>
      <label className="md:col-span-2">
        Regulamento
        <textarea
          className="min-h-32 w-full rounded-control border border-app-border bg-app-elevated p-3"
          defaultValue={initial?.rules ?? ""}
          name="rules"
        />
      </label>
      <div className="md:col-span-2">
        <LoadingButton
          className="h-12 rounded-button bg-brand-gold px-6 font-semibold text-black"
          isLoading={pending}
          loadingLabel="Salvando..."
          type="submit"
        >
          {initial ? "Salvar alteracoes" : "Criar rodada"}
        </LoadingButton>
        {message ? <p className="mt-2 text-sm text-app-muted">{message}</p> : null}
      </div>
    </form>
  );
}
