export type ApiFootballTeamSearch = {
  country?: string;
  leagueId?: number;
  season?: number;
};

export type ApiFootballLeagueSearch = {
  id?: number;
  search?: string;
};

export type ExternalFootballTeam = {
  apiId: number;
  country: string;
  logo?: string | null;
  name: string;
  shortName?: string | null;
};

export type ExternalFootballLeague = {
  apiId: number;
  country: string;
  logo?: string | null;
  name: string;
  seasons: number[];
  type: string;
};

export type ExternalFootballFixture = {
  apiId: number;
  awayScore?: number | null;
  awayTeam: ExternalFootballTeam;
  city?: string | null;
  country?: string | null;
  homeScore?: number | null;
  homeTeam: ExternalFootballTeam;
  kickoff: Date;
  referee?: string | null;
  round: string;
  stadium?: string | null;
  statusLong: string;
  statusShort: string;
};

export type ExternalFootballStanding = {
  description?: string | null;
  draws: number;
  form?: string | null;
  goalsAgainst: number;
  goalsFor: number;
  goalDiff: number;
  groupName: string;
  losses: number;
  played: number;
  points: number;
  rank: number;
  status?: string | null;
  team: ExternalFootballTeam;
  wins: number;
};

export type ApiFootballRequestResult<T> =
  | {
      callsUsed: number;
      data: T;
      ok: true;
    }
  | {
      callsUsed: number;
      message: string;
      ok: false;
    };

type ApiFootballEnvelope<T> = {
  errors?: unknown;
  response?: T;
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

type ApiFootballLeagueResponse = Array<{
  country?: {
    name?: string | null;
  };
  league?: {
    id?: number;
    logo?: string | null;
    name?: string | null;
    type?: string | null;
  };
  seasons?: Array<{
    year?: number;
  }>;
}>;

type ApiFootballFixtureResponse = Array<{
  fixture?: {
    id?: number;
    date?: string;
    referee?: string | null;
    status?: {
      long?: string | null;
      short?: string | null;
    };
    venue?: {
      city?: string | null;
      name?: string | null;
    };
  };
  goals?: {
    away?: number | null;
    home?: number | null;
  };
  league?: {
    country?: string | null;
    round?: string | null;
  };
  teams?: {
    away?: {
      code?: string | null;
      country?: string | null;
      id?: number;
      logo?: string | null;
      name?: string | null;
    };
    home?: {
      code?: string | null;
      country?: string | null;
      id?: number;
      logo?: string | null;
      name?: string | null;
    };
  };
}>;

type ApiFootballStandingsResponse = Array<{
  league?: {
    standings?: Array<
      Array<{
        all?: {
          draw?: number;
          goals?: {
            against?: number;
            for?: number;
          };
          lose?: number;
          played?: number;
          win?: number;
        };
        description?: string | null;
        form?: string | null;
        goalsDiff?: number;
        group?: string | null;
        points?: number;
        rank?: number;
        status?: string | null;
        team?: {
          id?: number;
          logo?: string | null;
          name?: string | null;
        };
      }>
    >;
  };
}>;

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

function normalizeTeamFields(team: {
  code?: string | null;
  country?: string | null;
  id?: number;
  logo?: string | null;
  name?: string | null;
}) {
  if (!team.id || !team.name) {
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

async function apiFootballRequest<T>(
  endpoint: string,
  params: URLSearchParams
): Promise<ApiFootballRequestResult<T>> {
  const { apiKey, baseUrl } = getFootballApiConfig();

  if (!apiKey) {
    return {
      callsUsed: 0,
      ok: false,
      message: "Configure API_FOOTBALL_KEY nas variaveis de ambiente."
    };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${endpoint}?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "x-apisports-key": apiKey
      }
    });

    const body = (await response.json()) as ApiFootballEnvelope<T>;

    if (!response.ok) {
      return {
        callsUsed: 1,
        ok: false,
        message: `API retornou erro ${response.status}.`
      };
    }

    const apiErrors = describeApiErrors(body.errors);

    if (apiErrors) {
      return {
        callsUsed: 1,
        ok: false,
        message: `API-Football: ${apiErrors}`
      };
    }

    return {
      callsUsed: 1,
      data: (body.response || []) as T,
      ok: true
    };
  } catch {
    return {
      callsUsed: 1,
      ok: false,
      message: "Nao foi possivel consultar a API de futebol agora."
    };
  }
}

export async function fetchApiFootballLeagues(search: ApiFootballLeagueSearch): Promise<
  ApiFootballRequestResult<ExternalFootballLeague[]>
> {
  const params = new URLSearchParams();

  if (search.id) {
    params.set("id", String(search.id));
  }

  if (search.search) {
    params.set("search", search.search);
  }

  const result = await apiFootballRequest<ApiFootballLeagueResponse>("leagues", params);

  if (!result.ok) {
    return result;
  }

  return {
    callsUsed: result.callsUsed,
    data: result.data
      .map((item) => {
        const league = item.league;

        if (!league?.id || !league.name) {
          return null;
        }

        return {
          apiId: league.id,
          country: item.country?.name || "World",
          logo: league.logo || null,
          name: league.name,
          seasons: (item.seasons || [])
            .map((season) => season.year)
            .filter((year): year is number => typeof year === "number"),
          type: league.type || "League"
        } satisfies ExternalFootballLeague;
      })
      .filter((league) => league !== null),
      ok: true,
    };
}

export async function fetchApiFootballTeams(search: ApiFootballTeamSearch): Promise<
  | {
      callsUsed: number;
      ok: true;
      teams: ExternalFootballTeam[];
    }
  | {
      callsUsed: number;
      ok: false;
      message: string;
    }
> {
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
      callsUsed: 0,
      ok: false,
      message: "Informe um pais ou liga/temporada para buscar times."
    };
  }

  const result = await apiFootballRequest<NonNullable<ApiFootballTeamResponse["response"]>>(
    "teams",
    params
  );

  if (!result.ok) {
    return result;
  }

  return {
    callsUsed: result.callsUsed,
    ok: true,
    teams: result.data.map(normalizeTeam).filter((team) => team !== null)
  };
}

export async function fetchApiFootballRounds(
  leagueId: number,
  season: number
): Promise<ApiFootballRequestResult<string[]>> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season)
  });

  return apiFootballRequest<string[]>("fixtures/rounds", params);
}

export async function fetchApiFootballFixtures(
  leagueId: number,
  season: number
): Promise<ApiFootballRequestResult<ExternalFootballFixture[]>> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season)
  });
  const result = await apiFootballRequest<ApiFootballFixtureResponse>("fixtures", params);

  if (!result.ok) {
    return result;
  }

  const fixtures = result.data
    .map((item) => {
      const homeTeam = item.teams?.home ? normalizeTeamFields(item.teams.home) : null;
      const awayTeam = item.teams?.away ? normalizeTeamFields(item.teams.away) : null;

      if (!item.fixture?.id || !item.fixture.date || !homeTeam || !awayTeam) {
        return null;
      }

      return {
        apiId: item.fixture.id,
        awayScore: item.goals?.away ?? null,
        awayTeam,
        city: item.fixture.venue?.city || null,
        country: item.league?.country || null,
        homeScore: item.goals?.home ?? null,
        homeTeam,
        kickoff: new Date(item.fixture.date),
        referee: item.fixture.referee || null,
        round: item.league?.round || "Rodada",
        stadium: item.fixture.venue?.name || null,
        statusLong: item.fixture.status?.long || "Not Started",
        statusShort: item.fixture.status?.short || "NS"
      } satisfies ExternalFootballFixture;
    })
    .filter((fixture) => fixture !== null);

  return {
    callsUsed: result.callsUsed,
    data: fixtures,
    ok: true
  };
}

export async function fetchApiFootballStandings(
  leagueId: number,
  season: number
): Promise<ApiFootballRequestResult<ExternalFootballStanding[]>> {
  const params = new URLSearchParams({
    league: String(leagueId),
    season: String(season)
  });
  const result = await apiFootballRequest<ApiFootballStandingsResponse>("standings", params);

  if (!result.ok) {
    return result;
  }

  const standings = result.data.flatMap((item) => {
    return (item.league?.standings || []).flatMap((group) => {
      return group
        .map((row) => {
          const team = row.team
            ? normalizeTeamFields({
                id: row.team.id,
                logo: row.team.logo,
                name: row.team.name
              })
            : null;

          if (!team || typeof row.rank !== "number") {
            return null;
          }

          return {
            description: row.description || null,
            draws: row.all?.draw ?? 0,
            form: row.form || null,
            goalsAgainst: row.all?.goals?.against ?? 0,
            goalsFor: row.all?.goals?.for ?? 0,
            goalDiff: row.goalsDiff ?? 0,
            groupName: row.group || "Geral",
            losses: row.all?.lose ?? 0,
            played: row.all?.played ?? 0,
            points: row.points ?? 0,
            rank: row.rank,
            status: row.status || null,
            team,
            wins: row.all?.win ?? 0
          } satisfies ExternalFootballStanding;
        })
        .filter((row) => row !== null);
    });
  });

  return {
    callsUsed: result.callsUsed,
    data: standings,
    ok: true
  };
}
