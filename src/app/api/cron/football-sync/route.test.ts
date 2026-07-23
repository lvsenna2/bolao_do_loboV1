import { afterEach, describe, expect, it, vi } from "vitest";

import { runFootballAutomation } from "@/server/football-api/automation-service";
import { POST } from "./route";

vi.mock("@/server/football-api/automation-service", () => ({
  runFootballAutomation: vi.fn()
}));

const mockedRun = vi.mocked(runFootballAutomation);
const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  mockedRun.mockReset();
  process.env.CRON_SECRET = originalSecret;
});

describe("football sync cron route", () => {
  it("rejects requests without the configured secret", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    const response = await POST(
      new Request("https://example.com/api/cron/football-sync", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("acknowledges a processed cycle even when it reports an internal failure", async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    mockedRun.mockResolvedValue({
      message: "Falha temporaria da API.",
      ok: false,
      runId: "run-test",
      summary: {
        callsUsed: 1,
        candidatesProcessed: 0,
        catalogsSynced: 0,
        errors: ["Falha temporaria da API."],
        fixturesUpdated: 0,
        liveMatches: 0,
        pendingFinalDetails: 0,
        pendingLineups: 0,
        remainingCandidates: 1,
        trackedMatches: 1
      }
    });

    const response = await POST(
      new Request("https://example.com/api/cron/football-sync", {
        headers: {
          "upstash-signature": "qstash-delivery",
          "x-cron-secret": "cron-test-secret"
        },
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: false, runId: "run-test" });
    expect(mockedRun).toHaveBeenCalledWith("qstash", {
      detailMode: "lineups-history",
      fixtureLimit: 2,
      historyBudget: 1,
      includeCatalog: false
    });
  });
});
