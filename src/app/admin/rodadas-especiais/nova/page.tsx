import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AdminSpecialRoundForm } from "@/features/special-rounds/components/admin-round-form";
import { getSpecialRoundMatchOptions } from "@/features/special-rounds/data/special-round-data";
import { requireAdmin } from "@/server/auth/session";

export default async function NewSpecialRoundPage() {
  await requireAdmin();
  const matches = await getSpecialRoundMatchOptions();
  return (
    <PageShell
      description="Defina partida, prazos, entrada e premiacao."
      title="Nova Rodada Especial"
    >
      <Card>
        <CardContent className="pt-5">
          <AdminSpecialRoundForm matches={matches} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
