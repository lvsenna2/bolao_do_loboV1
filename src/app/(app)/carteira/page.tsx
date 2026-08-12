import { ArrowDownLeft, ArrowUpRight, WalletCards } from "lucide-react";

import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DepositForm } from "@/features/wallet/components/deposit-form";
import { getWalletPageData } from "@/features/wallet/data/wallet-data";
import { formatCents } from "@/features/wallet/services/wallet-service";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await requireUser();
  const data = await getWalletPageData(user.id);

  return (
    <PageShell
      description="Adicione saldo e acompanhe cada movimentacao."
      eyebrow="Sua conta"
      title="Carteira"
    >
      <Card className="border-brand-gold/40 bg-black">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-app-muted">Saldo disponivel</p>
            <p className="mt-1 text-3xl font-semibold text-brand-gold">
              {formatCents(data.balanceCents)}
            </p>
          </div>
          <WalletCards className="h-9 w-9 text-brand-gold" aria-hidden />
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Adicionar saldo via Pix</CardTitle>
        </CardHeader>
        <CardContent>
          <DepositForm />
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Movimentacoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.transactions.length ? (
            data.transactions.map((item) => (
              <div
                className="flex items-center justify-between gap-3 rounded-control border border-app-border p-3"
                key={item.id}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {item.amountCents >= 0 ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-400" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-app-foreground">
                      {item.description}
                    </p>
                    <p className="text-xs text-app-muted">
                      {formatDateTimeInSaoPaulo(item.createdAt)}
                    </p>
                  </div>
                </div>
                <Badge tone={item.amountCents >= 0 ? "success" : "warning"}>
                  {item.amountCents >= 0 ? "+" : ""}
                  {formatCents(item.amountCents)}
                </Badge>
              </div>
            ))
          ) : (
            <EmptyState
              title="Sem movimentacoes"
              description="Seus depositos e pagamentos aparecerao aqui."
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
