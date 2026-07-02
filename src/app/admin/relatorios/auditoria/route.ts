import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { createCsv, createCsvResponse } from "@/features/admin/data/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const logs = await prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          email: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 5000
  });

  const csv = createCsv(
    ["created_at", "user", "email", "entity", "entity_id", "action", "ip"],
    logs.map((log) => [
      log.createdAt.toISOString(),
      log.user?.name ?? "Sistema",
      log.user?.email ?? "",
      log.entity,
      log.entityId ?? "",
      log.action,
      log.ip ?? ""
    ])
  );

  return createCsvResponse("auditoria.csv", csv);
}
