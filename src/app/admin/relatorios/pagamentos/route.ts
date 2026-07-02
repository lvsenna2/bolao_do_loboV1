import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createCsv, createCsvResponse } from "@/features/admin/data/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const payments = await prisma.payment.findMany({
    include: {
      league: {
        select: {
          name: true
        }
      },
      user: {
        select: {
          email: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const csv = createCsv(
    [
      "user",
      "email",
      "league",
      "gateway",
      "transaction_id",
      "amount",
      "status",
      "created_at",
      "paid_at"
    ],
    payments.map((payment) => [
      payment.user.name,
      payment.user.email,
      payment.league.name,
      payment.gateway,
      payment.transactionId ?? "",
      payment.amount.toString(),
      payment.status,
      payment.createdAt.toISOString(),
      payment.paidAt?.toISOString() ?? ""
    ])
  );

  return createCsvResponse("pagamentos.csv", csv);
}
