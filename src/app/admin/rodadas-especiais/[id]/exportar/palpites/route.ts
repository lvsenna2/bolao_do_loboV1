import { createCsv, createCsvResponse } from "@/features/admin/data/csv";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const predictions = await prisma.specialRoundPrediction.findMany({
    include: {
      entry: { include: { user: { select: { email: true, name: true } } } },
      market: { select: { specialRoundId: true, title: true } }
    },
    orderBy: { submittedAt: "asc" },
    where: { market: { specialRoundId: id } }
  });
  return createCsvResponse(
    `rodada-especial-${id}-palpites.csv`,
    createCsv(
      ["Nome", "Email", "Mercado", "Palpite", "Enviado em"],
      predictions.map((prediction) => [
        prediction.entry.user.name,
        prediction.entry.user.email,
        prediction.market.title,
        JSON.stringify(prediction.answer),
        formatDateTimeInSaoPaulo(prediction.submittedAt)
      ])
    )
  );
}
