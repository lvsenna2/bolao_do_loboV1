import { prisma } from "@/server/db";

import type { ApiFootballRequestResult, FootballApiPriority, FootballApiRateLimit } from "./types";

type ApiFootballEnvelope<T> = {
  errors?: unknown;
  response?: T;
};

type RequestOptions = {
  priority?: FootballApiPriority;
  retries?: number;
  timeoutMs?: number;
};

const DEFAULT_API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const EMPTY_RATE_LIMIT: FootballApiRateLimit = {
  dailyLimit: null,
  dailyRemaining: null,
  minuteLimit: null,
  minuteRemaining: null
};
const inFlightRequests = new Map<string, Promise<ApiFootballRequestResult<unknown>>>();

export function isFootballApiConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY);
}

function getFootballApiConfig() {
  const configuredTimeout = Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? "8000");
  const configuredRetries = Number(process.env.API_FOOTBALL_RETRIES ?? "1");
  const configuredReserve = Number(process.env.API_FOOTBALL_DAILY_RESERVE ?? "250");

  return {
    apiKey: process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "",
    baseUrl:
      process.env.API_FOOTBALL_BASE_URL ||
      process.env.FOOTBALL_API_BASE_URL ||
      DEFAULT_API_FOOTBALL_BASE_URL,
    dailyReserve:
      Number.isFinite(configuredReserve) && configuredReserve >= 0 ? configuredReserve : 250,
    retries:
      Number.isFinite(configuredRetries) && configuredRetries >= 0
        ? Math.min(configuredRetries, 2)
        : 1,
    timeoutMs:
      Number.isFinite(configuredTimeout) && configuredTimeout >= 1000
        ? Math.min(configuredTimeout, 20_000)
        : 8_000
  };
}

function describeApiErrors(errors: unknown) {
  if (!errors) {
    return "";
  }

  if (Array.isArray(errors) && errors.length > 0) {
    return errors.join(", ");
  }

  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .map((value) => String(value))
      .filter(Boolean)
      .join(", ");
  }

  return String(errors);
}

function readHeaderNumber(headers: Headers, name: string) {
  const parsed = Number(headers.get(name));
  return Number.isFinite(parsed) ? parsed : null;
}

function readRateLimit(headers: Headers): FootballApiRateLimit {
  return {
    dailyLimit: readHeaderNumber(headers, "x-ratelimit-requests-limit"),
    dailyRemaining: readHeaderNumber(headers, "x-ratelimit-requests-remaining"),
    minuteLimit: readHeaderNumber(headers, "x-ratelimit-limit"),
    minuteRemaining: readHeaderNumber(headers, "x-ratelimit-remaining")
  };
}

function utcStartOfDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function getKnownDailyRemaining() {
  try {
    const latest = await prisma.footballApiRequestLog.findFirst({
      orderBy: {
        createdAt: "desc"
      },
      select: {
        dailyRemaining: true
      },
      where: {
        createdAt: {
          gte: utcStartOfDay()
        },
        dailyRemaining: {
          not: null
        }
      }
    });

    return latest?.dailyRemaining ?? null;
  } catch {
    return null;
  }
}

export async function getFootballApiUsageSnapshot() {
  try {
    const dayStart = utcStartOfDay();
    const [callsToday, latest, recentErrors] = await Promise.all([
      prisma.footballApiRequestLog.count({
        where: {
          createdAt: {
            gte: dayStart
          }
        }
      }),
      prisma.footballApiRequestLog.findFirst({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          createdAt: {
            gte: dayStart
          }
        }
      }),
      prisma.footballApiRequestLog.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        where: {
          ok: false
        }
      })
    ]);

    return {
      callsToday,
      dailyLimit: latest?.dailyLimit ?? null,
      dailyRemaining: latest?.dailyRemaining ?? null,
      recentErrors
    };
  } catch {
    return {
      callsToday: 0,
      dailyLimit: null,
      dailyRemaining: null,
      recentErrors: []
    };
  }
}

function quotaThreshold(priority: FootballApiPriority, reserve: number) {
  if (priority === "CRITICAL") {
    return 0;
  }

  if (priority === "HIGH") {
    return Math.min(reserve, 2);
  }

  if (priority === "LOW") {
    return reserve + 8;
  }

  return reserve;
}

function shouldRetry(statusCode: number | null) {
  return statusCode === null || [499, 500, 502, 503, 504].includes(statusCode);
}

function waitBeforeRetry(attempt: number) {
  return new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
}

async function logRequest(input: {
  durationMs: number;
  endpoint: string;
  error?: string | null;
  ok: boolean;
  params: URLSearchParams;
  rateLimit: FootballApiRateLimit;
  statusCode: number | null;
}) {
  try {
    await prisma.footballApiRequestLog.create({
      data: {
        dailyLimit: input.rateLimit.dailyLimit,
        dailyRemaining: input.rateLimit.dailyRemaining,
        durationMs: input.durationMs,
        endpoint: input.endpoint,
        error: input.error?.slice(0, 2_000) || null,
        minuteLimit: input.rateLimit.minuteLimit,
        minuteRemaining: input.rateLimit.minuteRemaining,
        ok: input.ok,
        params: Object.fromEntries(input.params.entries()),
        statusCode: input.statusCode
      }
    });
  } catch (error) {
    console.error("[API-Football] Falha ao registrar consumo", {
      endpoint: input.endpoint,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
}

function makeRequestKey(endpoint: string, params: URLSearchParams) {
  const sorted = new URLSearchParams(
    Array.from(params.entries()).sort(([left], [right]) => left.localeCompare(right))
  );
  return `${endpoint}?${sorted.toString()}`;
}

async function executeRequest<T>(
  endpoint: string,
  params: URLSearchParams,
  options: RequestOptions
): Promise<ApiFootballRequestResult<T>> {
  const config = getFootballApiConfig();
  const priority = options.priority ?? "NORMAL";

  if (!config.apiKey) {
    return {
      callsUsed: 0,
      durationMs: 0,
      message: "Configure API_FOOTBALL_KEY nas variaveis de ambiente.",
      ok: false,
      rateLimit: EMPTY_RATE_LIMIT,
      statusCode: null
    };
  }

  const knownRemaining = await getKnownDailyRemaining();
  const threshold = quotaThreshold(priority, config.dailyReserve);

  if (knownRemaining !== null && knownRemaining <= threshold) {
    return {
      callsUsed: 0,
      durationMs: 0,
      message: `Chamada ${endpoint} adiada para preservar a cota diaria da API-Football.`,
      ok: false,
      rateLimit: {
        ...EMPTY_RATE_LIMIT,
        dailyRemaining: knownRemaining
      },
      statusCode: null
    };
  }

  const retries = options.retries ?? config.retries;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  let callsUsed = 0;
  let totalDurationMs = 0;
  let lastMessage = "Nao foi possivel consultar a API de futebol agora.";
  let lastRateLimit = EMPTY_RATE_LIMIT;
  let lastStatusCode: number | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const startedAt = Date.now();
    let response: Response | null = null;

    try {
      response = await fetch(
        `${config.baseUrl.replace(/\/$/, "")}/${endpoint}?${params.toString()}`,
        {
          cache: "no-store",
          headers: {
            "x-apisports-key": config.apiKey
          },
          signal: AbortSignal.timeout(timeoutMs)
        }
      );
      callsUsed += 1;
      lastStatusCode = response.status;
      lastRateLimit = readRateLimit(response.headers);
      const body = (await response.json()) as ApiFootballEnvelope<T>;
      const apiErrors = describeApiErrors(body.errors);
      const durationMs = Date.now() - startedAt;
      totalDurationMs += durationMs;

      if (response.ok && !apiErrors) {
        await logRequest({
          durationMs,
          endpoint,
          ok: true,
          params,
          rateLimit: lastRateLimit,
          statusCode: response.status
        });

        return {
          callsUsed,
          data: body.response as T,
          durationMs: totalDurationMs,
          ok: true,
          rateLimit: lastRateLimit,
          statusCode: response.status
        };
      }

      lastMessage = apiErrors
        ? `API-Football: ${apiErrors}`
        : `API-Football retornou erro ${response.status}.`;
      await logRequest({
        durationMs,
        endpoint,
        error: lastMessage,
        ok: false,
        params,
        rateLimit: lastRateLimit,
        statusCode: response.status
      });
    } catch (error) {
      callsUsed += 1;
      const durationMs = Date.now() - startedAt;
      totalDurationMs += durationMs;
      lastMessage = error instanceof Error ? error.message : lastMessage;
      await logRequest({
        durationMs,
        endpoint,
        error: lastMessage,
        ok: false,
        params,
        rateLimit: lastRateLimit,
        statusCode: response?.status ?? null
      });
    }

    if (attempt >= retries || !shouldRetry(lastStatusCode)) {
      break;
    }

    await waitBeforeRetry(attempt);
  }

  return {
    callsUsed,
    durationMs: totalDurationMs,
    message: lastMessage,
    ok: false,
    rateLimit: lastRateLimit,
    statusCode: lastStatusCode
  };
}

export async function apiFootballRequest<T>(
  endpoint: string,
  params: URLSearchParams,
  options: RequestOptions = {}
): Promise<ApiFootballRequestResult<T>> {
  const requestKey = makeRequestKey(endpoint, params);
  const existing = inFlightRequests.get(requestKey);

  if (existing) {
    return existing as Promise<ApiFootballRequestResult<T>>;
  }

  const request = executeRequest<T>(endpoint, params, options).finally(() => {
    inFlightRequests.delete(requestKey);
  });
  inFlightRequests.set(requestKey, request as Promise<ApiFootballRequestResult<unknown>>);

  return request;
}
