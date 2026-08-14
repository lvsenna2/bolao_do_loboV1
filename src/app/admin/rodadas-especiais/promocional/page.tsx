import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPromoRoundForm } from "@/features/special-rounds/components/admin-promo-round-form";
import { getSpecialRoundMatchOptions } from "@/features/special-rounds/data/special-round-data";
import { requireAdmin } from "@/server/auth/session";

export default async function NewPromoSpecialRoundPage() {
  await requireAdmin();
  const matches = await getSpecialRoundMatchOptions();
  return (
    <PageShell
      description="Uma selecao unica, odd fixa e limite por usuario para campanhas de trafego pago."
      title="Nova Rodada Especial Promocional"
    >
      <Card>
        <CardContent className="pt-5">
          <AdminPromoRoundForm matches={matches} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
