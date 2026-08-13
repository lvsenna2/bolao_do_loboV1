import { NextResponse } from "next/server";

import { settleFinishedSpecialRounds } from "@/features/special-rounds/services/settlement-service";
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
    finalDetailLimit: 1,
    fixtureLimit: 20,
    historyBudget: 1,
    includeCatalog: false,
    liveDetailLimit: 2,
    pregameDetailLimit: 2
  });
  // Com a partida ja atualizada nesta execucao, apura e publica quem venceu cada
  // Rodada Especial encerrada. Falhas aqui nao invalidam a sincronizacao.
  const settlement = await settleFinishedSpecialRounds().catch((error: unknown) => {
    console.error("[football-cron] Falha na apuracao automatica de rodadas especiais", { error });
    return null;
  });
  const durationMs = Date.now() - startedAt;

  console.info("[football-cron] Execucao concluida", {
    durationMs,
    specialRoundsFinalized: settlement?.finalized ?? 0,
    specialRoundsPending: settlement?.pending.length ?? 0,
    specialRoundsScanned: settlement?.scanned ?? 0,
    locked: result.locked ?? false,
    ok: result.ok,
    ...("summary" in result
      ? {
          callsUsed: result.summary.callsUsed,
          detailsProcessed: result.summary.detailsProcessed,
          duplicateFixtureCallsAvoided: result.summary.duplicateFixtureCallsAvoided,
          finalDetailsProcessed: result.summary.finalDetailsProcessed,
          fixturesFetched: result.summary.fixturesFetched,
          fixturesFromIds: result.summary.fixturesFromIds,
          fixturesFromLiveEndpoint: result.summary.fixturesFromLiveEndpoint,
          liveDetailsProcessed: result.summary.liveDetailsProcessed,
          liveDiscoveredFromApi: result.summary.liveDiscoveredFromApi,
          liveMatches: result.summary.liveMatches,
          localLiveCandidates: result.summary.localLiveCandidates,
          localRecordsReviewed: result.summary.fixturesUpdated,
          pregameDetailsProcessed: result.summary.pregameDetailsProcessed,
          pregameWaitingForBudget: result.summary.pregameWaitingForBudget,
          specialRoundDetailsForced: result.summary.specialRoundDetailsForced,
          trackedMatches: result.summary.trackedMatches
        }
      : {})
  });

  return NextResponse.json(
    { ...result, durationMs, specialRounds: settlement },
    {
      headers: { "Cache-Control": "no-store" },
      status: result.ok ? 200 : 500
    }
  );
}

export const GET = runCron;
export const POST = runCron;
