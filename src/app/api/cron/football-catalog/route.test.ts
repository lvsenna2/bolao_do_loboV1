import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runFootballAutomationMock } = vi.hoisted(() => ({
  runFootballAutomationMock: vi.fn()
}));

vi.mock("@/server/football-api/automation-service", () => ({
  runFootballAutomation: runFootballAutomationMock
}));

import { GET } from "./route";

const previousSecret = process.env.CRON_SECRET;

function request(token?: string) {
  return new Request("https://example.com/api/cron/football-catalog", {
    headers: token ? { authorization: `Bearer ${token}` } : undefined
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-test-secret";
});

afterEach(() => {
  process.env.CRON_SECRET = previousSecret;
  vi.restoreAllMocks();
});

describe("football catalog cron", () => {
  it("rejeita requisicoes sem o segredo correto", async () => {
    const response = await GET(request("incorreto"));

    expect(response.status).toBe(401);
    expect(runFootballAutomationMock).not.toHaveBeenCalled();
  });

  it("registra e retorna uma execucao concluida", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    runFootballAutomationMock.mockResolvedValue({
      message: "Catalogo atualizado.",
      ok: true,
      runId: "run-1",
      summary: {
        callsUsed: 5,
        catalogsSynced: 1,
        errors: []
      }
    });

    const response = await GET(request("cron-test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ durationMs: expect.any(Number), ok: true });
    expect(runFootballAutomationMock).toHaveBeenCalledWith("vercel-catalog", {
      fixtureLimit: 0,
      historyBudget: 0,
      includeCatalog: true
    });
    expect(info).toHaveBeenCalledWith(
      "[football-catalog] Execucao concluida",
      expect.objectContaining({ callsUsed: 5, catalogsSynced: 1, ok: true })
    );
  });
});
