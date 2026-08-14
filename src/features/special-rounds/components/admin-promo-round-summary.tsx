import { Flame } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/features/wallet/services/wallet-service";
import { promoProfitCents } from "../services/promo-service";

type Props = {
  entries: { amount: number; bonusAmount: number; paymentStatus: string }[];
  maxStakeCents: number;
  odds: number;
  selectionLabel: string;
  slug: string;
};

/**
 * Painel de leitura da promocao: link da campanha, exposicao em bonus e quanto ja entrou.
 * A operacao (status, resultado, apuracao) continua no workspace padrao da Rodada Especial.
 */
export function AdminPromoRoundSummary(props: Props) {
  const approved = props.entries.filter((entry) => entry.paymentStatus === "APPROVED");
  const stakedCents = approved.reduce((total, entry) => total + Math.round(entry.amount * 100), 0);
  const bonusStakedCents = approved.reduce(
    (total, entry) => total + Math.round(entry.bonusAmount * 100),
    0
  );
  // Pior caso para o caixa: todo mundo acerta e todo o lucro vira saldo bonus.
  const bonusExposureCents = approved.reduce(
    (total, entry) => total + promoProfitCents(Math.round(entry.amount * 100), props.odds),
    0
  );

  return (
    <Card className="mb-6 border-brand-gold/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-brand-gold" /> Promocao de selecao unica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          <span className="text-app-muted">Selecao: </span>
          <strong>{props.selectionLabel}</strong>
        </p>
        <p>
          <span className="text-app-muted">Odd: </span>
          <strong>{props.odds.toFixed(2)}</strong>
          <span className="text-app-muted"> | limite por usuario: </span>
          <strong>{formatCents(props.maxStakeCents)}</strong>
        </p>
        <p>
          <span className="text-app-muted">Link da campanha: </span>
          <code className="rounded bg-app-elevated px-2 py-0.5">/rodadas-especiais/{props.slug}</code>
        </p>
        <dl className="grid gap-3 border-t border-app-border pt-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-app-muted">Apostas</dt>
            <dd className="mt-1 text-lg font-semibold">{approved.length}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-app-muted">Total apostado</dt>
            <dd className="mt-1 text-lg font-semibold">{formatCents(stakedCents)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-app-muted">Pago com bonus</dt>
            <dd className="mt-1 text-lg font-semibold">{formatCents(bonusStakedCents)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-app-muted">Bonus se todos ganharem</dt>
            <dd className="mt-1 text-lg font-semibold text-brand-gold">
              {formatCents(bonusExposureCents)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
