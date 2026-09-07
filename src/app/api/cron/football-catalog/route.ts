import { NextResponse } from "next/server";

import { isValidScheduledCronRequest } from "@/server/cron/auth";
import { runFootballAutomation } from "@/server/football-api/automation-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isValidScheduledCronRequest(request))) {
    return NextResponse.json({ message: "Cron nao autorizado.", ok: false }, { status: 401 });
  }

  const startedAt = Date.now();
  const result = await runFootballAutomation("vercel-catalog", {
    fixtureLimit: 0,
    historyBudget: 0,
    includeCatalog: true
  });
  const durationMs = Date.now() - startedAt;

  console.info("[football-catalog] Execucao concluida", {
    durationMs,
    locked: result.locked ?? false,
    ok: result.ok,
    ...("summary" in result
      ? {
          callsUsed: result.summary.callsUsed,
          catalogsSynced: result.summary.catalogsSynced,
          errors: result.summary.errors
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
