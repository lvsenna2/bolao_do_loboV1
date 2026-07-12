import { createCsv, createCsvResponse } from "@/features/admin/data/csv";
import { formatDateTimeInSaoPaulo } from "@/lib/date-time";
import { requireAdmin } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      name: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true
    }
  });

  const csv = createCsv(
    ["name", "username", "email", "role", "status", "created_at", "last_login_at"],
    users.map((user) => [
      user.name,
      user.username,
      user.email,
      user.role,
      user.status,
      formatDateTimeInSaoPaulo(user.createdAt, { seconds: true }),
      user.lastLoginAt ? formatDateTimeInSaoPaulo(user.lastLoginAt, { seconds: true }) : ""
    ])
  );

  return createCsvResponse("usuarios.csv", csv);
}
