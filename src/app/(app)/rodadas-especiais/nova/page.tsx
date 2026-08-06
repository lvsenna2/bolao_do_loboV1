import type { Route } from "next";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AdminSpecialRoundForm } from "@/features/special-rounds/components/admin-round-form";
import { getSpecialRoundMatchOptions } from "@/features/special-rounds/data/special-round-data";
import { canCreateSpecialRound } from "@/features/subscriptions/service";
import { requireUser } from "@/server/auth/session";

export default async function SubscriberSpecialRoundPage() {
  const user = await requireUser();
  if (!(await canCreateSpecialRound(user.id))) redirect("/planos" as Route);
  const matches = await getSpecialRoundMatchOptions();
  return (
    <PageShell
      description="Escolha uma partida catalogada e abra sua Rodada Especial Platinum."
      eyebrow="Beneficio Platinum"
      title="Criar Rodada Especial"
    >
      <Card>
        <CardContent className="pt-5">
          <AdminSpecialRoundForm matches={matches} redirectBase="/rodadas-especiais" />
        </CardContent>
      </Card>
    </PageShell>
  );
}
