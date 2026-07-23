import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runFootballAutomation } from "@/server/football-api/automation-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  return (
    (authorization?.startsWith("Bearer ") && safeEquals(authorization.slice(7), secret)) ||
    (headerSecret ? safeEquals(headerSecret, secret) : false)
  );
}

async function handler(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET nao configurado no servidor." },
      { status: 503 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const result = await runFootballAutomation(
    request.headers.get("upstash-signature") ? "qstash" : "cron",
    {
      detailMode: "lineups-history",
      fixtureLimit: 2,
      historyBudget: 1,
      includeCatalog: false
    }
  );
  // Scheduled retries happen on the next cycle. Returning 500 here makes QStash
  // overlap retries with the two-minute schedule and can keep the sync lock busy.
  return NextResponse.json(result);
}

export const GET = handler;
export const POST = handler;
