export type ApiFootballTeamSearch = {
  country?: string;
  leagueId?: number;
  season?: number;
};

export type ExternalFootballTeam = {
  apiId: number;
  country: string;
  logo?: string | null;
  name: string;
  shortName?: string | null;
};

type ApiFootballTeamResponse = {
  errors?: unknown;
  response?: Array<{
    team?: {
      code?: string | null;
      country?: string | null;
      id?: number;
      logo?: string | null;
      name?: string | null;
    };
  }>;
};

const DEFAULT_API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

export function isFootballApiConfigured() {
  return Boolean(process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY);
}

function getFootballApiConfig() {
  return {
    apiKey: process.env.API_FOOTBALL_KEY || process.env.FOOTBALL_API_KEY || "",
    baseUrl:
      process.env.API_FOOTBALL_BASE_URL ||
      process.env.FOOTBALL_API_BASE_URL ||
      DEFAULT_API_FOOTBALL_BASE_URL
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
    const messages = Object.values(errors as Record<string, unknown>)
      .map((value) => String(value))
      .filter(Boolean);

    return messages.join(", ");
  }

  return String(errors);
}

function normalizeTeam(item: NonNullable<ApiFootballTeamResponse["response"]>[number]) {
  const team = item.team;

  if (!team?.id || !team.name) {
    return null;
  }

  return {
    apiId: team.id,
    country: team.country || "Nao informado",
    logo: team.logo || null,
    name: team.name,
    shortName: team.code || null
  } satisfies ExternalFootballTeam;
}

export async function fetchApiFootballTeams(search: ApiFootballTeamSearch): Promise<
  | {
      ok: true;
      teams: ExternalFootballTeam[];
    }
  | {
      ok: false;
      message: string;
    }
> {
  const { apiKey, baseUrl } = getFootballApiConfig();

  if (!apiKey) {
    return {
      ok: false,
      message: "Configure API_FOOTBALL_KEY nas variaveis de ambiente."
    };
  }

  const params = new URLSearchParams();

  if (search.country) {
    params.set("country", search.country);
  }

  if (search.leagueId && search.season) {
    params.set("league", String(search.leagueId));
    params.set("season", String(search.season));
  }

  if (params.size === 0) {
    return {
      ok: false,
      message: "Informe um pais ou liga/temporada para buscar times."
    };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/teams?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const body = (await response.json()) as ApiFootballTeamResponse;

    if (!response.ok) {
      return {
        ok: false,
        message: `API retornou erro ${response.status}.`
      };
    }

    const apiErrors = describeApiErrors(body.errors);

    if (apiErrors) {
      return {
        ok: false,
        message: `API-Football: ${apiErrors}`
      };
    }

    const teams = (body.response || []).map(normalizeTeam).filter((team) => team !== null);

    return {
      ok: true,
      teams
    };
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel consultar a API de futebol agora."
    };
  }
}
