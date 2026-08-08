import { NextResponse } from "next/server";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const cacheControl = "public, s-maxage=15, stale-while-revalidate=30";

export async function GET() {
  const startedAt = Date.now();
  const now = serverNow();
  try {
    const matches = await prisma.match.findMany({
      orderBy: {
        kickoff: "asc"
      },
      select: {
        awayScore: true,
        elapsed: true,
        homeScore: true,
        id: true,
        status: true,
        updatedAt: true
      },
      take: 100,
      where: {
        deletedAt: null,
        kickoff: {
          gte: new Date(now.getTime() - 6 * 60 * 60_000),
          lte: new Date(now.getTime() + 30 * 60_000)
        },
        status: {
          in: ["SCHEDULED", "LIVE", "HALFTIME", "SUSPENDED", "FINISHED"]
        }
      }
    });

    return NextResponse.json(
      {
        matches: matches.map((match) => ({
          ...match,
          updatedAt: match.updatedAt.toISOString()
        })),
        serverTime: now.toISOString()
      },
      {
        headers: {
          "Cache-Control": cacheControl,
          "Server-Timing": `db;dur=${Date.now() - startedAt}`
        }
      }
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error("[live-scores] Falha ao consultar placares salvos", {
      durationMs,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });

    return NextResponse.json(
      { matches: [], message: "Nao foi possivel atualizar os placares agora." },
      {
        headers: {
          "Cache-Control": "no-store",
          "Server-Timing": `db;dur=${durationMs}`
        },
        status: 503
      }
    );
  }
}
