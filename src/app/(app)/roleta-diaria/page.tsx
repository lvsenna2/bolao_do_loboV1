import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouletteWheel } from "@/features/roulette/roulette-wheel";
import { getRouletteData } from "@/features/roulette/roulette-service";
import { formatDateInSaoPaulo } from "@/lib/date-time";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function DailyRoulettePage() {
  const user = await requireUser();
  const data = await getRouletteData(user.id);
  return (
    <PageShell
      description="Um giro diario, premios internos e chances reais de saldo."
      eyebrow="Recompensa diaria"
      title="Roleta Diaria"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-brand-gold/40 bg-black">
          <CardContent className="p-6">
            <RouletteWheel
              bonusAvailable={data.bonusAvailable}
              dailyAvailable={data.dailyAvailable}
            />
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Seus premios</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>{data.rewards?.specialFragments ?? 0} fragmentos</Badge>
              <Badge>{data.rewards?.specialRoundVouchers ?? 0} vales especiais</Badge>
              <Badge>{data.rewards?.leagueVouchers ?? 0} vales de liga</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ultimos premios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentSpins.length ? (
                data.recentSpins.map((spin) => (
                  <div
                    className="flex justify-between gap-3 border-b border-app-border py-2 text-sm last:border-0"
                    key={spin.id}
                  >
                    <span>{spin.prizeName}</span>
                    <span className="shrink-0 text-app-muted">
                      {formatDateInSaoPaulo(spin.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-app-muted">Nenhum giro registrado.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
