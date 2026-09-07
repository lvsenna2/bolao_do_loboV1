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

  const result = await runFootballAutomation("vercel-catalog", {
    fixtureLimit: 0,
    historyBudget: 0,
    includeCatalog: true
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
    status: result.ok ? 200 : 500
  });
}
