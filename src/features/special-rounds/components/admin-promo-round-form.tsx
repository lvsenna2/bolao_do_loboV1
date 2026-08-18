"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { formatDateTimeLocalForSaoPaulo } from "@/lib/date-time";
import {
  createPromoSpecialRoundAction,
  updatePromoSpecialRoundAction
} from "../actions/promo-round-actions";
import {
  buildPromoSlug,
  promoSelectionDefaultLabel,
  promoSelectionOptions,
  type PromoSelectionValue
} from "../services/promo-service";

type MatchOption = {
  awayTeam: { logo: string | null; name: string };
  homeTeam: { logo: string | null; name: string };
  id: string;
  round: {
    name: string | null;
    number: number;
    season: { championship: { name: string }; name: string | null };
  };
  startsAt: Date;
};

export type InitialPromoRound = {
  awayTeamLogo: string | null;
  awayTeamName: string;
  description: string | null;
  hasEntries: boolean;
  homeTeamLogo: string | null;
  homeTeamName: string;
  id: string;
  matchId: string | null;
  matchStartsAt: Date;
  name: string;
  promoBannerUrl: string | null;
  promoBetsCloseAt: Date;
  promoBetsOpenAt: Date;
  promoHeadline: string | null;
  promoMaxStakeCents: number;
  promoMinStakeCents: number;
  promoOdds: number;
  promoSelection: PromoSelectionValue;
  promoSelectionLabel: string;
  promoSlug: string;
  rules: string | null;
};

const inputClass =
  "h-11 w-full rounded-control border border-app-border bg-app-elevated px-3 text-sm";

function centsFromReais(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/**
 * Formulario da Rodada Especial Promocional. Fica separado do formulario padrao de proposito:
 * a rodada normal continua exatamente como era, e aqui so aparecem os campos da promocao.
 */
export function AdminPromoRoundForm({
  initial,
  matches
}: {
  initial?: InitialPromoRound;
  matches: MatchOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const locked = Boolean(initial?.hasEntries);

  function submit(formData: FormData) {
    const payload = {
      awayTeamLogo: formData.get("awayTeamLogo"),
      awayTeamName: formData.get("awayTeamName"),
      description: formData.get("description"),
      homeTeamLogo: formData.get("homeTeamLogo"),
      homeTeamName: formData.get("homeTeamName"),
      matchId: formData.get("matchId"),
      matchStartsAt: formData.get("matchStartsAt"),
      name: formData.get("name"),
      promoBannerUrl: formData.get("promoBannerUrl"),
      promoBetsCloseAt: formData.get("promoBetsCloseAt"),
      promoBetsOpenAt: formData.get("promoBetsOpenAt"),
      promoHeadline: formData.get("promoHeadline"),
      promoMaxStakeCents: centsFromReais(formData.get("promoMaxStake")),
      promoMinStakeCents: centsFromReais(formData.get("promoMinStake")),
      promoOdds: formData.get("promoOdds"),
      promoSelection: formData.get("promoSelection"),
      promoSelectionLabel: formData.get("promoSelectionLabel"),
      promoSlug: buildPromoSlug(String(formData.get("promoSlug") ?? "")),
      rules: formData.get("rules")
    };
    startTransition(async () => {
      const result = initial
        ? await updatePromoSpecialRoundAction(initial.id, payload)
        : await createPromoSpecialRoundAction(payload);
      setMessage(result.message);
      setErrors(result.fieldErrors ?? {});
      if (result.ok) {
        router.push(
          `/admin/rodadas-especiais/${(result.data as { id?: string } | undefined)?.id ?? initial?.id}` as Route
        );
        router.refresh();
      }
    });
  }

  function selectMatch(event: React.ChangeEvent<HTMLSelectElement>) {
    const match = matches.find((item) => item.id === event.target.value);
    const form = event.currentTarget.form;
    if (!match || !form) return;
    const set = (name: string, value: string) => {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement) field.value = value;
    };
    set("homeTeamName", match.homeTeam.name);
    set("awayTeamName", match.awayTeam.name);
    set("homeTeamLogo", match.homeTeam.logo ?? "");
    set("awayTeamLogo", match.awayTeam.logo ?? "");
    set("matchStartsAt", formatDateTimeLocalForSaoPaulo(match.startsAt));
    set("promoSlug", buildPromoSlug(`${match.homeTeam.name} ${match.awayTeam.name}`));
    const selectionField = form.elements.namedItem("promoSelection");
    const selection =
      selectionField instanceof HTMLSelectElement || selectionField instanceof HTMLInputElement
        ? (selectionField.value as PromoSelectionValue)
        : "HOME_TO_SCORE";
    set(
      "promoSelectionLabel",
      promoSelectionDefaultLabel(selection, match.homeTeam.name, match.awayTeam.name)
    );
    set("name", `${match.homeTeam.name} x ${match.awayTeam.name}`);
  }

  function selectPromoSelection(event: React.ChangeEvent<HTMLSelectElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const home = form.elements.namedItem("homeTeamName");
    const away = form.elements.namedItem("awayTeamName");
    const label = form.elements.namedItem("promoSelectionLabel");
    if (
      home instanceof HTMLInputElement &&
      away instanceof HTMLInputElement &&
      label instanceof HTMLInputElement
    ) {
      label.value = promoSelectionDefaultLabel(
        event.target.value as PromoSelectionValue,
        home.value,
        away.value
      );
    }
  }

  const dateDefault = (date?: Date) => (date ? formatDateTimeLocalForSaoPaulo(date) : "");
  const fieldError = (name: string) =>
    errors[name]?.length ? (
      <span className="mt-1 block text-xs text-red-400">{errors[name][0]}</span>
    ) : null;

  return (
    <form action={submit} className="space-y-5">
      <div className="rounded-control border border-brand-gold/30 bg-brand-gold/5 p-4">
        <h2 className="font-semibold text-brand-gold">Rodada Especial Promocional</h2>
        <p className="mt-1 text-sm text-app-muted">
          Uma unica selecao, odd fixa e limite por usuario. O lucro e pago em saldo bonus com
          rollover de 10x, e a rodada encerra sozinha quando a partida termina.
        </p>
      </div>

      <label className="block">
        Partida do catalogo
        <select
          className={inputClass}
          defaultValue={initial?.matchId ?? ""}
          name="matchId"
          onChange={selectMatch}
        >
          <option value="">Sem vinculo (apuracao manual)</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.round.season.championship.name} | {match.homeTeam.name} x{" "}
              {match.awayTeam.name} |{" "}
              {formatDateTimeLocalForSaoPaulo(match.startsAt).replace("T", " ")}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-app-muted">
          Sem partida vinculada a apuracao automatica nao roda.
        </span>
      </label>

      <label className="block">
        Titulo promocional
        <input
          className={inputClass}
          defaultValue={initial?.name}
          maxLength={140}
          name="name"
          required
        />
        {fieldError("name")}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          Time mandante
          <input
            className={inputClass}
            defaultValue={initial?.homeTeamName}
            name="homeTeamName"
            required
          />
        </label>
        <label className="block">
          Time visitante
          <input
            className={inputClass}
            defaultValue={initial?.awayTeamName}
            name="awayTeamName"
            required
          />
        </label>
        <label className="block">
          Escudo do mandante (URL)
          <input className={inputClass} defaultValue={initial?.homeTeamLogo ?? ""} name="homeTeamLogo" />
        </label>
        <label className="block">
          Escudo do visitante (URL)
          <input className={inputClass} defaultValue={initial?.awayTeamLogo ?? ""} name="awayTeamLogo" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          Selecao unica
          {/* Campo travado usa readOnly/hidden, nunca `disabled`: input desabilitado nao envia
              valor e o backend rejeitaria o formulario inteiro. */}
          {locked ? (
            <>
              <input className={inputClass} readOnly value={initial?.promoSelectionLabel} />
              <input
                name="promoSelection"
                type="hidden"
                value={initial?.promoSelection ?? "HOME_TO_SCORE"}
              />
            </>
          ) : (
            <select
              className={inputClass}
              defaultValue={initial?.promoSelection ?? "HOME_TO_SCORE"}
              name="promoSelection"
              onChange={selectPromoSelection}
            >
              {promoSelectionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="block">
          Odd promocional
          <input
            className={inputClass}
            defaultValue={initial?.promoOdds ?? "2.00"}
            inputMode="decimal"
            min="1.01"
            name="promoOdds"
            readOnly={locked}
            required
            step="0.01"
            type="number"
          />
          {fieldError("promoOdds")}
        </label>
      </div>

      <label className="block">
        Texto da selecao (aparece em destaque)
        <input
          className={inputClass}
          defaultValue={initial?.promoSelectionLabel}
          maxLength={160}
          name="promoSelectionLabel"
          placeholder="Flamengo marcar pelo menos 1 gol"
          required
        />
        {fieldError("promoSelectionLabel")}
      </label>

      <label className="block">
        Texto de chamada
        <input
          className={inputClass}
          defaultValue={initial?.promoHeadline ?? ""}
          maxLength={160}
          name="promoHeadline"
          placeholder="Bolao do Lobo - Libertadores"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          Aposta minima (R$)
          <input
            className={inputClass}
            defaultValue={((initial?.promoMinStakeCents ?? 100) / 100).toFixed(2)}
            inputMode="decimal"
            min="1"
            name="promoMinStake"
            required
            step="0.01"
            type="number"
          />
          {fieldError("promoMinStakeCents")}
        </label>
        <label className="block">
          Limite por usuario (R$)
          <input
            className={inputClass}
            defaultValue={((initial?.promoMaxStakeCents ?? 1000) / 100).toFixed(2)}
            inputMode="decimal"
            min="1"
            name="promoMaxStake"
            readOnly={locked}
            required
            step="0.01"
            type="number"
          />
          <span className="mt-1 block text-xs text-app-muted">
            Vale para a soma de todas as apostas do usuario nesta promocao.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          Inicio das apostas
          <input
            className={inputClass}
            defaultValue={dateDefault(initial?.promoBetsOpenAt)}
            name="promoBetsOpenAt"
            required
            type="datetime-local"
          />
        </label>
        <label className="block">
          Encerramento das apostas
          <input
            className={inputClass}
            defaultValue={dateDefault(initial?.promoBetsCloseAt)}
            name="promoBetsCloseAt"
            required
            type="datetime-local"
          />
          {fieldError("promoBetsCloseAt")}
        </label>
        <label className="block">
          Inicio da partida
          <input
            className={inputClass}
            defaultValue={dateDefault(initial?.matchStartsAt)}
            name="matchStartsAt"
            required
            type="datetime-local"
          />
        </label>
        <label className="block">
          Link da campanha
          <input
            className={inputClass}
            defaultValue={initial?.promoSlug}
            name="promoSlug"
            placeholder="flamengo-cruzeiro"
            required
          />
          <span className="mt-1 block text-xs text-app-muted">
            URL de trafego pago: /rodadas-especiais/&lt;link&gt;
          </span>
          {fieldError("promoSlug")}
        </label>
      </div>

      <label className="block">
        Banner da campanha (URL)
        <input
          className={inputClass}
          defaultValue={initial?.promoBannerUrl ?? ""}
          name="promoBannerUrl"
          placeholder="https://..."
        />
      </label>

      <label className="block">
        Descricao
        <textarea
          className="min-h-24 w-full rounded-control border border-app-border bg-app-elevated p-3 text-sm"
          defaultValue={initial?.description ?? ""}
          name="description"
        />
      </label>

      <label className="block">
        Regulamento
        <textarea
          className="min-h-32 w-full rounded-control border border-app-border bg-app-elevated p-3 text-sm"
          defaultValue={initial?.rules ?? ""}
          name="rules"
        />
      </label>

      {locked ? (
        <p className="rounded-control border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          Esta promocao ja tem apostas: selecao, odd e limite por usuario nao podem mais mudar.
        </p>
      ) : null}

      <LoadingButton
        className="h-12 w-full rounded-button bg-brand-gold px-4 font-semibold text-black"
        isLoading={pending}
        loadingLabel="Salvando..."
        type="submit"
      >
        {initial ? "Salvar promocao" : "Criar promocao"}
      </LoadingButton>
      {message ? (
        <p aria-live="polite" className="text-sm text-app-muted">
          {message}
        </p>
      ) : null}
    </form>
  );
}
