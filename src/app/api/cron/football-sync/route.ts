import { NextResponse } from "next/server";

import { isValidCronRequest } from "@/server/cron/auth";
import { runFootballAutomation } from "@/server/football-api/automation-service";

export const dynamic = "force-dynamic";
export const maxDuration = 240;
export const runtime = "nodejs";

async function runCron(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { message: "CRON_SECRET nao esta configurado.", ok: false },
      { status: 503 }
    );
  }

  if (!isValidCronRequest(request)) {
    return NextResponse.json({ message: "Cron nao autorizado.", ok: false }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await runFootballAutomation("vercel-cron", {
    detailLimit: 2,
    fixtureLimit: 20,
    historyBudget: 1,
    includeCatalog: false
  });
  const durationMs = Date.now() - startedAt;

  console.info("[football-cron] Execucao concluida", {
    durationMs,
    locked: result.locked ?? false,
    ok: result.ok,
    ...("summary" in result
      ? {
          callsUsed: result.summary.callsUsed,
          fixturesUpdated: result.summary.fixturesUpdated,
          liveMatches: result.summary.liveMatches,
          trackedMatches: result.summary.trackedMatches
        }
      : {})
  });

  return NextResponse.json(
    { ...result, durationMs },
    {
      headers: { "Cache-Control": "no-store" },
      status: result.ok ? 200 : 500
    }
  );
}

export const GET = runCron;
export const POST = runCron;
