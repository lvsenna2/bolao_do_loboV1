import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requestLog } = vi.hoisted(() => ({
  requestLog: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn()
  }
}));

vi.mock("@/server/db", () => ({
  prisma: {
    footballApiRequestLog: requestLog
  }
}));

import { apiFootballRequest } from "./request";
import { fetchApiFootballHeadToHead } from "./client";

describe("apiFootballRequest", () => {
  beforeEach(() => {
    process.env.API_FOOTBALL_KEY = "test-key";
    requestLog.findFirst.mockResolvedValue(null);
    requestLog.create.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    delete process.env.API_FOOTBALL_KEY;
    vi.restoreAllMocks();
  });

  it("retorna erro controlado quando a API esta fora do ar", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));

    const result = await apiFootballRequest<unknown[]>("fixtures", new URLSearchParams(), {
      retries: 0
    });

    expect(result.ok).toBe(false);
    expect(result.callsUsed).toBe(1);
  });

  it("preserva a reserva diaria antes de fazer chamada normal", async () => {
    requestLog.findFirst.mockResolvedValue({ dailyRemaining: 5 });

    const result = await apiFootballRequest<unknown[]>("standings", new URLSearchParams(), {
      priority: "NORMAL",
      retries: 0
    });

    expect(result.ok).toBe(false);
    expect(result.callsUsed).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deduplica duas requisicoes simultaneas identicas", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const first = apiFootballRequest<unknown[]>("fixtures", new URLSearchParams({ ids: "1-2" }));
    const second = apiFootballRequest<unknown[]>("fixtures", new URLSearchParams({ ids: "1-2" }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    resolveFetch?.(
      new Response(JSON.stringify({ errors: [], response: [] }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("consulta confrontos diretos no endpoint headtohead", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ errors: [], response: [] }), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    const result = await fetchApiFootballHeadToHead(127, 121);

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/fixtures/headtohead?h2h=127-121&last=5"),
      expect.any(Object)
    );
  });
});
