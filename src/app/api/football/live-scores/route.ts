import { NextResponse } from "next/server";
import type { MatchStatus } from "@prisma/client";

import { serverNow } from "@/lib/date-time";
import { prisma } from "@/server/db";
import { runFootballAutomation } from "@/server/football-api/automation-service";
import { isFootballApiConfigured } from "@/server/football-api/client";
import { shouldSyncFixture } from "@/server/football-api/sync-decision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const cacheControl = "public, s-maxage=15, stale-while-revalidate=30";
const activeStatuses = new Set<MatchStatus>(["SCHEDULED", "LIVE", "HALFTIME", "SUSPENDED"]);

type LiveRefreshCandidate = {
  kickoff: Date;
  lastSyncedAt: Date | null;
  liveSyncedAt: Date | null;
  status: MatchStatus;
};

function shouldRefreshLiveScores(matches: LiveRefreshCandidate[], now: Date) {
  return matches.some(
    (match) => activeStatuses.has(match.status) && shouldSyncFixture(match, now).fixture
  );
}

function loadLiveScores(now: Date) {
  return prisma.match.findMany({
    orderBy: {
      kickoff: "asc"
    },
    select: {
      awayScore: true,
      elapsed: true,
      homeScore: true,
      id: true,
      kickoff: true,
      lastSyncedAt: true,
      liveSyncedAt: true,
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
}

export async function GET() {
  const startedAt = Date.now();
  const now = serverNow();
  try {
    let matches = await loadLiveScores(now);

    if (isFootballApiConfigured() && shouldRefreshLiveScores(matches, now)) {
      await runFootballAutomation("live-score-poll", {
        detailLimit: 2,
        fixtureLimit: 20,
        historyBudget: 0,
        includeCatalog: false
      });
      matches = await loadLiveScores(serverNow());
    }

    return NextResponse.json(
      {
        matches: matches.map((match) => ({
          awayScore: match.awayScore,
          elapsed: match.elapsed,
          homeScore: match.homeScore,
          id: match.id,
          status: match.status,
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
