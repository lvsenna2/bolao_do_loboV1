"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LoadingButton } from "@/components/ui/loading-button";
import { cancelWithdrawalAction, requestWithdrawalAction } from "../actions/withdrawal-actions";

const PIX_KEY_TYPES = [
  { hint: "Somente numeros", label: "CPF", value: "CPF" },
  { hint: "Somente numeros", label: "CNPJ", value: "CNPJ" },
  { hint: "seu@email.com", label: "E-mail", value: "EMAIL" },
  { hint: "DDD + numero", label: "Celular", value: "PHONE" },
  { hint: "Chave aleatoria do banco", label: "Aleatoria", value: "RANDOM" }
] as const;

type PixKeyType = (typeof PIX_KEY_TYPES)[number]["value"];

export type OpenWithdrawal = {
  amountLabel: string;
  id: string;
  isCancellable: boolean;
  statusLabel: string;
};

type WithdrawalFormProps = {
  balanceLabel: string;
  maxCents: number;
  minCents: number;
  minLabel: string;
  openWithdrawal: OpenWithdrawal | null;
};

const inputClass =
  "h-11 w-full rounded-control border border-app-border bg-app-background px-3 text-sm text-app-foreground outline-none focus:border-brand-gold";

export function WithdrawalForm({
  balanceLabel,
  maxCents,
  minCents,
  minLabel,
  openWithdrawal
}: WithdrawalFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("CPF");
  const [pixKey, setPixKey] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onCancel() {
    if (!openWithdrawal || loading) return;
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const result = await cancelWithdrawalAction(openWithdrawal.id);
      if (result.ok) setMessage(result.message);
      else setError(result.message);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (loading) return;
    // O usuario digita em reais; o backend so trabalha com centavos.
    const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);

    if (!Number.isFinite(amountCents) || amountCents < minCents) {
      setError(`O saque minimo e de ${minLabel}.`);
      return;
    }

    if (amountCents > maxCents) {
      setError(`Voce tem ${balanceLabel} disponivel.`);
      return;
    }

    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const result = await requestWithdrawalAction({
        amountCents,
        pixKey,
        pixKeyOwnerName: ownerName,
        pixKeyType
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage(result.message);
      setAmount("");
      setPixKey("");
      setOwnerName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (openWithdrawal) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-app-foreground">
          Saque de <strong className="text-brand-gold">{openWithdrawal.amountLabel}</strong> em
          andamento — {openWithdrawal.statusLabel}.
        </p>
        <p className="text-xs text-app-muted">
          O valor ja saiu da carteira. Voce recebe uma notificacao assim que o Pix for enviado. So e
          possivel ter um saque por vez.
        </p>
        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {openWithdrawal.isCancellable ? (
          <LoadingButton
            className="h-10 rounded-button border border-app-border px-4 text-sm font-semibold text-app-foreground"
            isLoading={loading}
            loadingLabel="Cancelando..."
            onClick={onCancel}
            type="button"
          >
            Cancelar saque
          </LoadingButton>
        ) : null}
      </div>
    );
  }

  const selectedType = PIX_KEY_TYPES.find((type) => type.value === pixKeyType);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-app-foreground">Valor do saque</span>
          <input
            className={inputClass}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder={minLabel.replace("R$ ", "")}
            value={amount}
          />
          <span className="block text-xs text-app-muted">
            Disponivel: {balanceLabel} | Minimo: {minLabel}
          </span>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-app-foreground">Tipo da chave Pix</span>
          <select
            className={inputClass}
            onChange={(event) => setPixKeyType(event.target.value as PixKeyType)}
            value={pixKeyType}
          >
            {PIX_KEY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <span className="block text-xs text-app-muted">{selectedType?.hint}</span>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-app-foreground">Chave Pix</span>
          <input
            className={inputClass}
            onChange={(event) => setPixKey(event.target.value)}
            value={pixKey}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-app-foreground">Nome do dono da chave</span>
          <input
            className={inputClass}
            onChange={(event) => setOwnerName(event.target.value)}
            value={ownerName}
          />
        </label>
      </div>

      <p className="text-xs text-app-muted">
        A chave precisa estar no seu nome. Saques para terceiros sao recusados e o valor volta para
        a carteira.
      </p>

      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <LoadingButton
        className="h-11 w-full rounded-button bg-brand-gold px-5 text-sm font-semibold text-black disabled:opacity-70 sm:w-auto"
        disabled={maxCents < minCents}
        isLoading={loading}
        loadingLabel="Enviando pedido..."
        onClick={onSubmit}
        type="button"
      >
        Solicitar saque
      </LoadingButton>

      {maxCents < minCents ? (
        <p className="text-xs text-app-muted">
          Voce precisa de pelo menos {minLabel} na carteira para sacar.
        </p>
      ) : null}
    </div>
  );
}
