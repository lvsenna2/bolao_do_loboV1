import { requireUser } from "@/server/auth/session";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();

  try {
    const data = await prisma.user.findUnique({
      where: {
        id: user.id
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        xp: true,
        level: true,
        locale: true,
        theme: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          include: {
            league: {
              select: {
                id: true,
                name: true,
                status: true,
                visibility: true
              }
            }
          }
        },
        guesses: true,
        scores: true,
        notifications: true,
        achievements: {
          include: {
            badge: true
          }
        }
      }
    });

    return Response.json(data, {
      headers: {
        "Content-Disposition": 'attachment; filename="meus-dados-bolao-do-lobo.json"'
      }
    });
  } catch {
    return Response.json(
      {
        message: "Nao foi possivel exportar seus dados agora."
      },
      {
        status: 503
      }
    );
  }
}
