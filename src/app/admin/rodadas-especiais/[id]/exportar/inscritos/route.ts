import { createCsv, createCsvResponse } from "@/features/admin/data/csv";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const entries = await prisma.specialRoundEntry.findMany({
    include: { user: { select: { email: true, name: true, phone: true } } },
    orderBy: { registeredAt: "asc" },
    where: { specialRoundId: id }
  });
  return createCsvResponse(
    `rodada-especial-${id}-inscritos.csv`,
    createCsv(
      ["Nome", "Email", "Telefone", "Valor", "Pagamento", "Inscricao", "Confirmacao"],
      entries.map((entry) => [
        entry.user.name,
        entry.user.email,
        entry.user.phone,
        entry.amount,
        entry.paymentStatus,
        formatDateTimeInSaoPaulo(entry.registeredAt),
        formatDateTimeInSaoPaulo(entry.confirmedAt)
      ])
    )
  );
}
