"use client";

import { Check, Clipboard, Clock3, QrCode, ShieldCheck } from "lucide-react";
import { useState } from "react";

type PixPaymentCardProps = {
  amountLabel: string;
  discountAmountLabel?: string;
  discountPercent?: number;
  finalAmountLabel?: string;
  leagueName: string;
  levelName?: string;
  minimumAmountLabel?: string;
  originalAmountLabel?: string;
  pixCode: string;
  pixKey: string;
  qrCodeDataUri: string;
  transactionId: string;
};

export function PixPaymentCard({
  amountLabel,
  discountAmountLabel,
  discountPercent = 0,
  finalAmountLabel,
  leagueName,
  levelName,
  minimumAmountLabel,
  originalAmountLabel,
  pixCode,
  pixKey,
  qrCodeDataUri,
  transactionId
}: PixPaymentCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyPixCode() {
    await navigator.clipboard.writeText(pixCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="overflow-hidden rounded-card border border-brand-gold/35 bg-[#11100d] text-white shadow-[0_24px_60px_-32px_rgba(0,0,0,0.75)]">
      <div className="relative p-5">
        <div className="absolute right-5 top-5 h-16 w-16 rounded-full border border-brand-gold/25 bg-brand-gold/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-gold">
              <Clock3 aria-hidden className="h-3.5 w-3.5" />
              Aguardando pagamento
            </span>
            <h3 className="mt-4 text-xl font-bold text-white">{leagueName}</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-amber-50/80">
              Entrada privada reservada. Assim que o pagamento for aprovado pelo administrador, a
              liga libera rodadas, ranking e palpites para sua conta.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-control border border-white/10 bg-white/[0.08] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100/70">
                  Valor final
                </p>
                <p className="mt-1 text-lg font-bold text-brand-gold">
                  {finalAmountLabel ?? amountLabel}
                </p>
              </div>
              <div className="rounded-control border border-white/10 bg-white/[0.08] p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100/70">
                  Chave Pix
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-white">{pixKey}</p>
              </div>
            </div>

            {discountPercent > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-control border border-brand-gold/25 bg-brand-gold/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100/70">
                    Valor original
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{originalAmountLabel}</p>
                </div>
                <div className="rounded-control border border-brand-gold/25 bg-brand-gold/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100/70">
                    Desconto {levelName ? `- ${levelName}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-brand-gold">
                    {discountPercent}% | {discountAmountLabel}
                  </p>
                </div>
                <div className="rounded-control border border-brand-gold/25 bg-brand-gold/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-100/70">
                    Minimo protegido
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">{minimumAmountLabel}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-card border border-white/15 bg-white p-3 text-slate-950 shadow-soft">
            <div
              aria-label={`QR Code Pix da liga ${leagueName}`}
              className="h-48 w-48 bg-contain bg-center bg-no-repeat"
              role="img"
              style={{ backgroundImage: `url("${qrCodeDataUri}")` }}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-brand-gold/15 bg-black p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold text-amber-50/80">
              <QrCode aria-hidden className="h-4 w-4 text-brand-gold" />
              Pix copia e cola
            </span>
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-control border border-brand-gold/20 bg-white/5 px-3 py-2 text-xs text-white outline-none ring-brand-gold/30 placeholder:text-amber-100/60 focus:border-brand-gold focus:ring-2"
              readOnly
              value={pixCode}
            />
          </label>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-brand-gold px-4 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
            onClick={copyPixCode}
            type="button"
          >
            {copied ? (
              <Check aria-hidden className="h-4 w-4" />
            ) : (
              <Clipboard aria-hidden className="h-4 w-4" />
            )}
            {copied ? "Copiado" : "Copiar Pix"}
          </button>
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs text-amber-100/70">
          <ShieldCheck aria-hidden className="h-4 w-4 text-brand-gold" />
          Identificador: {transactionId}
        </p>
      </div>
    </section>
  );
}
