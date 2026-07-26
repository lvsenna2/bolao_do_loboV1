import { createCsv, createCsvResponse } from "@/features/admin/data/csv";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const standings = await prisma.specialRoundStanding.findMany({
    include: {
      entry: {
        include: {
          prize: true,
          user: { select: { email: true, name: true } }
        }
      }
    },
    orderBy: { position: "asc" },
    where: { specialRoundId: id }
  });
  return createCsvResponse(
    `rodada-especial-${id}-classificacao.csv`,
    createCsv(
      ["Posicao", "Nome", "Email", "Pontos", "Acertos", "Placares exatos", "Premio"],
      standings.map((standing) => [
        standing.position,
        standing.entry.user.name,
        standing.entry.user.email,
        standing.totalPoints,
        standing.hits,
        standing.exactScoreHits,
        standing.entry.prize?.amount ?? 0
      ])
    )
  );
}
