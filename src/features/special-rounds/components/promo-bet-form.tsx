"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useMemo, useState, useTransition } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { placePromoBetAction } from "../actions/promo-round-actions";
import { promoProfitCents, promoReturnCents } from "../services/promo-service";

type Props = {
  balanceCents: number;
  maxStakeCents: number;
  minStakeCents: number;
  odds: number;
  specialRoundId: string;
  stakedCents: number;
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" }).format(cents / 100);
}

/** Converte "5", "5,50" ou "5.50" em centavos. Vazio ou invalido vira 0. */
function parseStakeCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function PromoBetForm(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const remainingCents = Math.max(props.maxStakeCents - props.stakedCents, 0);
  const stakeCents = parseStakeCents(value);
  const preview = useMemo(
    () => ({
      bonusCents: promoProfitCents(stakeCents, props.odds),
      returnCents: promoReturnCents(stakeCents, props.odds)
    }),
    [props.odds, stakeCents]
  );

  const shortcutsCents = [200, 500, remainingCents].filter(
    (cents, index, list) =>
      cents > 0 && cents <= remainingCents && list.indexOf(cents) === index
  );

  const notEnoughBalance = stakeCents > props.balanceCents;
  const canSubmit =
    !isPending &&
    remainingCents > 0 &&
    stakeCents >= Math.min(props.minStakeCents, remainingCents) &&
    stakeCents <= remainingCents &&
    !notEnoughBalance;

  function onSubmit() {
    setFeedback(null);
    startTransition(() => {
      void placePromoBetAction({ specialRoundId: props.specialRoundId, stakeCents }).then(
        (result) => {
          setFeedback({ ok: result.ok, text: result.message });
          if (result.ok) {
            setValue("");
            router.refresh();
          }
        }
      );
    });
  }

  if (remainingCents <= 0) {
    return (
      <p className="rounded-control border border-brand-gold/40 bg-brand-gold/10 p-4 text-center text-sm font-semibold text-brand-gold">
        Voce ja usou os {formatBRL(props.maxStakeCents)} desta promocao. Boa sorte!
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-[0.14em] text-app-muted"
          htmlFor="promo-stake"
        >
          Valor da aposta
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-control border border-brand-gold/40 bg-black/40 px-4">
          <span className="text-lg font-semibold text-brand-gold">R$</span>
          <input
            autoComplete="off"
            className="h-14 w-full bg-transparent text-2xl font-bold tabular-nums text-app-foreground outline-none"
            id="promo-stake"
            inputMode="decimal"
            onChange={(event) => setValue(event.target.value)}
            placeholder="0,00"
            value={value}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {shortcutsCents.map((cents) => (
            <button
              className="rounded-button border border-brand-gold/40 px-3 py-1 text-sm font-semibold text-brand-gold transition hover:bg-brand-gold/10"
              key={cents}
              onClick={() => setValue((cents / 100).toFixed(2).replace(".", ","))}
              type="button"
            >
              {formatBRL(cents)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-app-muted">
          Minimo {formatBRL(props.minStakeCents)} | voce ainda pode apostar{" "}
          {formatBRL(remainingCents)} nesta promocao | saldo {formatBRL(props.balanceCents)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-control border border-app-border p-3">
          <dt className="text-xs uppercase tracking-wide text-app-muted">Retorno se bater</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-brand-gold">
            {formatBRL(preview.returnCents)}
          </dd>
        </div>
        <div className="rounded-control border border-app-border p-3">
          <dt className="text-xs uppercase tracking-wide text-app-muted">Bonus recebido</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-brand-gold">
            {formatBRL(preview.bonusCents)}
          </dd>
        </div>
      </dl>

      {notEnoughBalance ? (
        <p className="text-sm text-amber-300">
          Saldo insuficiente.{" "}
          <Link className="font-semibold underline" href={"/carteira" as Route}>
            Adicionar saldo
          </Link>
        </p>
      ) : null}
      {feedback ? (
        <p
          className={
            feedback.ok ? "text-sm font-semibold text-emerald-400" : "text-sm text-red-400"
          }
        >
          {feedback.text}
        </p>
      ) : null}

      <LoadingButton
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-button bg-brand-gold text-base font-bold uppercase tracking-wide text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canSubmit}
        icon={<Flame aria-hidden className="h-5 w-5" />}
        isLoading={isPending}
        loadingLabel="Confirmando..."
        onClick={onSubmit}
        type="button"
      >
        Confirmar aposta
      </LoadingButton>
      <p className="text-center text-xs text-app-muted">
        O lucro vira saldo bonus e exige rollover de 10x: e preciso apostar dez vezes o valor do
        bonus antes de libera-lo para saque.
      </p>
    </div>
  );
}
