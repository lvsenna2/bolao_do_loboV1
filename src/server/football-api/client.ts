import { apiFootballRequest, isFootballApiConfigured } from "./request";
import type {
  ApiFootballRequestResult,
  ExternalFootballCoverage,
  ExternalFootballEvent,
  ExternalFootballFixture,
  ExternalFootballLeague,
  ExternalFootballLineup,
  ExternalFootballPlayer,
  ExternalFootballPlayerStatistic,
  ExternalFootballStanding,
  ExternalFootballStatistic,
  ExternalFootballTeam,
  ExternalFootballVenue,
  ExternalTeamSeasonStatistics,
  FootballApiPriority
} from "./types";

export { isFootballApiConfigured } from "./request";
export type {
  ApiFootballRequestResult,
  ExternalFootballCoverage,
  ExternalFootballEvent,
  ExternalFootballFixture,
  ExternalFootballLeague,
  ExternalFootballLineup,
  ExternalFootballPlayer,
  ExternalFootballPlayerStatistic,
  ExternalFootballStanding,
  ExternalFootballStatistic,
  ExternalFootballTeam,
  ExternalFootballVenue,
  ExternalTeamSeasonStatistics,
  FootballApiPriority
} from "./types";

export type ApiFootballTeamSearch = {
  country?: string;
  leagueId?: number;
  season?: number;
};

export type ApiFootballLeagueSearch = {
  id?: number;
  search?: string;
  season?: number;
};

type ApiTeam = {
  code?: string | null;
  country?: string | null;
  id?: number;
  logo?: string | null;
  name?: string | null;
};

type ApiPlayer = {
  firstname?: string | null;
  id?: number;
  lastname?: string | null;
  name?: string | null;
  photo?: string | null;
};

type ApiFootballTeamResponse = Array<{
  team?: ApiTeam;
}>;

type ApiCoverage = {
  fixtures?: {
    events?: boolean;
    lineups?: boolean;
    statistics_fixtures?: boolean;
    statistics_players?: boolean;
  };
  players?: boolean;
  standings?: boolean;
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
    coverage?: ApiCoverage;
    year?: number;
  }>;
}>;

type ApiFixtureItem = {
  events?: ApiFootballEventResponse;
  fixture?: {
    date?: string;
    id?: number;
    periods?: {
      first?: number | null;
      second?: number | null;
    };
    referee?: string | null;
    status?: {
      elapsed?: number | null;
      extra?: number | null;
      long?: string | null;
      short?: string | null;
    };
    venue?: {
      city?: string | null;
      id?: number | null;
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
  lineups?: ApiFootballLineupResponse;
  players?: ApiFootballPlayerStatisticResponse;
  score?: {
    extratime?: ApiScore;
    fulltime?: ApiScore;
    halftime?: ApiScore;
    penalty?: ApiScore;
    secondhalf?: ApiScore;
  };
  teams?: {
    away?: ApiTeam;
    home?: ApiTeam;
  };
  statistics?: ApiFootballStatisticResponse;
};

type ApiScore = {
  away?: number | null;
  home?: number | null;
};

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
        team?: ApiTeam;
      }>
    >;
  };
}>;

type ApiLineupPlayerItem = {
  player?: ApiPlayer & {
    grid?: string | null;
    number?: number | null;
    pos?: string | null;
  };
};

type ApiFootballLineupResponse = Array<{
  coach?: {
    id?: number | null;
    name?: string | null;
    photo?: string | null;
  };
  formation?: string | null;
  startXI?: ApiLineupPlayerItem[];
  substitutes?: ApiLineupPlayerItem[];
  team?: ApiTeam;
}>;

type ApiFootballEventResponse = Array<{
  assist?: ApiPlayer | null;
  comments?: string | null;
  detail?: string | null;
  player?: ApiPlayer | null;
  team?: ApiTeam | null;
  time?: {
    elapsed?: number;
    extra?: number | null;
  };
  type?: string | null;
}>;

type ApiFootballStatisticResponse = Array<{
  statistics?: Array<{
    type?: string | null;
    value?: number | string | null;
  }>;
  team?: ApiTeam;
}>;

type ApiFootballPlayerStatisticResponse = Array<{
  players?: Array<{
    player?: ApiPlayer;
    statistics?: Record<string, unknown>[];
  }>;
  team?: ApiTeam;
}>;

type ApiFootballVenueResponse = Array<{
  address?: string | null;
  capacity?: number | null;
  city?: string | null;
  country?: string | null;
  id?: number;
  image?: string | null;
  name?: string | null;
  surface?: string | null;
}>;

function normalizeUrl(value: string | null | undefined) {
  const url = value?.trim();
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function normalizeTeamFields(team: ApiTeam | null | undefined) {
  if (!team?.id || !team.name) {
    return null;
  }

  return {
    apiId: team.id,
    country: team.country || "Nao informado",
    logo: normalizeUrl(team.logo),
    name: team.name,
    shortName: team.code || null
  } satisfies ExternalFootballTeam;
}

function normalizePlayer(player: ApiPlayer | null | undefined, position?: string | null) {
  if (!player?.id || !player.name) {
    return null;
  }

  return {
    apiId: player.id,
    firstName: player.firstname || null,
    lastName: player.lastname || null,
    name: player.name,
    photo: normalizeUrl(player.photo),
    position: position || null
  } satisfies ExternalFootballPlayer;
}

function normalizeScore(score: ApiScore | null | undefined) {
  return {
    away: typeof score?.away === "number" ? score.away : null,
    home: typeof score?.home === "number" ? score.home : null
  };
}

function normalizeFixture(item: ApiFixtureItem) {
  const homeTeam = normalizeTeamFields(item.teams?.home);
  const awayTeam = normalizeTeamFields(item.teams?.away);

  if (!item.fixture?.id || !item.fixture.date || !homeTeam || !awayTeam) {
    return null;
  }

  return {
    apiId: item.fixture.id,
    awayScore: item.goals?.away ?? null,
    awayTeam,
    city: item.fixture.venue?.city || null,
    country: item.league?.country || null,
    elapsed: item.fixture.status?.elapsed ?? null,
    events: (item.events || []).map(normalizeEventItem).filter((event) => event !== null),
    extra: item.fixture.status?.extra ?? null,
    extraTime: normalizeScore(item.score?.extratime),
    fulltime: normalizeScore(item.score?.fulltime),
    halftime: normalizeScore(item.score?.halftime),
    homeScore: item.goals?.home ?? null,
    homeTeam,
    kickoff: new Date(item.fixture.date),
    lineups: (item.lineups || []).map(normalizeLineupItem).filter((lineup) => lineup !== null),
    penalty: normalizeScore(item.score?.penalty),
    playerStatistics: (item.players || []).flatMap(normalizePlayerStatisticTeam),
    referee: item.fixture.referee || null,
    round: item.league?.round || "Rodada",
    secondHalf: normalizeScore(item.score?.secondhalf),
    stadium: item.fixture.venue?.name || null,
    statusLong: item.fixture.status?.long || "Not Started",
    statusShort: item.fixture.status?.short || "NS",
    statistics: (item.statistics || [])
      .map(normalizeStatisticItem)
      .filter((statistic) => statistic !== null),
    venueId: item.fixture.venue?.id ?? null
  } satisfies ExternalFootballFixture;
}

function normalizeCoverage(coverage: ApiCoverage): ExternalFootballCoverage {
  return {
    events: coverage?.fixtures?.events === true,
    lineups: coverage?.fixtures?.lineups === true,
    players: coverage?.players === true,
    standings: coverage?.standings === true,
    statisticsFixtures: coverage?.fixtures?.statistics_fixtures === true,
    statisticsPlayers: coverage?.fixtures?.statistics_players === true
  };
}

function normalizeLineupPlayer(item: ApiLineupPlayerItem) {
  const player = normalizePlayer(item?.player, item?.player?.pos);
  if (!player) return null;
  return {
    grid: item?.player?.grid || null,
    number: item?.player?.number ?? null,
    player,
    position: item?.player?.pos || null
  };
}

function normalizeLineupItem(item: ApiFootballLineupResponse[number]) {
  const team = normalizeTeamFields(item.team);
  if (!team) return null;
  return {
    coach: {
      apiId: item.coach?.id ?? null,
      name: item.coach?.name || null,
      photo: normalizeUrl(item.coach?.photo)
    },
    formation: item.formation || null,
    starters: (item.startXI || []).map(normalizeLineupPlayer).filter((row) => row !== null),
    substitutes: (item.substitutes || []).map(normalizeLineupPlayer).filter((row) => row !== null),
    team
  } satisfies ExternalFootballLineup;
}

function normalizeEventItem(item: ApiFootballEventResponse[number]) {
  if (typeof item.time?.elapsed !== "number" || !item.type) return null;
  return {
    assist: normalizePlayer(item.assist),
    comments: item.comments || null,
    detail: item.detail || null,
    elapsed: item.time.elapsed,
    extra: item.time.extra ?? null,
    player: normalizePlayer(item.player),
    team: normalizeTeamFields(item.team),
    type: item.type
  } satisfies ExternalFootballEvent;
}

function normalizeStatisticItem(item: ApiFootballStatisticResponse[number]) {
  const team = normalizeTeamFields(item.team);
  if (!team) return null;
  return {
    team,
    values: (item.statistics || [])
      .filter((statistic) => Boolean(statistic.type))
      .map((statistic) => ({
        type: statistic.type as string,
        value: statistic.value ?? null
      }))
  } satisfies ExternalFootballStatistic;
}

function normalizePlayerStatisticTeam(item: ApiFootballPlayerStatisticResponse[number]) {
  const team = normalizeTeamFields(item.team);
  if (!team) return [];
  return (item.players || [])
    .map((row) => {
      const position = row.statistics?.[0]?.games;
      const player = normalizePlayer(
        row.player,
        typeof position === "object" && position
          ? String((position as Record<string, unknown>).position || "") || null
          : null
      );
      if (!player) return null;
      return {
        player,
        statistics: row.statistics || [],
        team
      } satisfies ExternalFootballPlayerStatistic;
    })
    .filter((row) => row !== null);
}

function mapRequestData<T, U>(
  result: ApiFootballRequestResult<T>,
  mapper: (data: T) => U
): ApiFootballRequestResult<U> {
  if (!result.ok) {
    return result;
  }

  return {
    ...result,
    data: mapper(result.data)
  };
}

export async function fetchApiFootballLeagues(
  search: ApiFootballLeagueSearch
): Promise<ApiFootballRequestResult<ExternalFootballLeague[]>> {
  const params = new URLSearchParams();

  if (search.id) params.set("id", String(search.id));
  if (search.search) params.set("search", search.search);
  if (search.season) params.set("season", String(search.season));

  const result = await apiFootballRequest<ApiFootballLeagueResponse>("leagues", params, {
    priority: "LOW"
  });

  return mapRequestData(result, (items) =>
    items
      .map((item) => {
        const league = item.league;
        if (!league?.id || !league.name) return null;
        const selectedSeason = search.season
          ? item.seasons?.find((season) => season.year === search.season)
          : item.seasons?.at(-1);

        return {
          apiId: league.id,
          country: item.country?.name || "World",
          coverage: selectedSeason?.coverage ? normalizeCoverage(selectedSeason.coverage) : null,
          logo: normalizeUrl(league.logo),
          name: league.name,
          seasons: (item.seasons || [])
            .map((season) => season.year)
            .filter((year): year is number => typeof year === "number"),
          type: league.type || "League"
        } satisfies ExternalFootballLeague;
      })
      .filter((league) => league !== null)
  );
}

export async function fetchApiFootballTeams(search: ApiFootballTeamSearch): Promise<
  | {
      callsUsed: number;
      ok: true;
      teams: ExternalFootballTeam[];
    }
  | {
      callsUsed: number;
      message: string;
      ok: false;
    }
> {
  const params = new URLSearchParams();
  if (search.country) params.set("country", search.country);
  if (search.leagueId && search.season) {
    params.set("league", String(search.leagueId));
    params.set("season", String(search.season));
  }

  if (params.size === 0) {
    return {
      callsUsed: 0,
      message: "Informe um pais ou liga/temporada para buscar times.",
      ok: false
    };
  }

  const result = await apiFootballRequest<ApiFootballTeamResponse>("teams", params, {
    priority: "LOW"
  });

  if (!result.ok) return result;

  return {
    callsUsed: result.callsUsed,
    ok: true,
    teams: result.data.map((item) => normalizeTeamFields(item.team)).filter((team) => team !== null)
  };
}

export function fetchApiFootballRounds(leagueId: number, season: number) {
  return apiFootballRequest<string[]>(
    "fixtures/rounds",
    new URLSearchParams({ league: String(leagueId), season: String(season) }),
    { priority: "LOW" }
  );
}

async function fetchFixtures(
  params: URLSearchParams,
  priority: FootballApiPriority
): Promise<ApiFootballRequestResult<ExternalFootballFixture[]>> {
  const result = await apiFootballRequest<ApiFixtureItem[]>("fixtures", params, { priority });
  return mapRequestData(result, (items) =>
    items.map(normalizeFixture).filter((fixture) => fixture !== null)
  );
}

export function fetchApiFootballFixtures(leagueId: number, season: number) {
  return fetchFixtures(
    new URLSearchParams({ league: String(leagueId), season: String(season) }),
    "NORMAL"
  );
}

export function fetchApiFootballFixturesByIds(
  fixtureIds: number[],
  priority: FootballApiPriority = "HIGH"
) {
  if (fixtureIds.length === 0 || fixtureIds.length > 20) {
    throw new Error("A API-Football aceita entre 1 e 20 fixtureIds por chamada.");
  }

  return fetchFixtures(new URLSearchParams({ ids: fixtureIds.join("-") }), priority);
}

export function fetchApiFootballLiveFixtures(leagueIds: number[]) {
  return fetchFixtures(
    new URLSearchParams({ live: leagueIds.length > 0 ? leagueIds.join("-") : "all" }),
    "CRITICAL"
  );
}

export function fetchApiFootballTeamFixtures(
  teamId: number,
  options: { last?: number; leagueId?: number; season?: number } = {}
) {
  const params = new URLSearchParams({ team: String(teamId) });
  if (options.last) params.set("last", String(Math.min(options.last, 99)));
  if (options.leagueId) params.set("league", String(options.leagueId));
  if (options.season) params.set("season", String(options.season));
  return fetchFixtures(params, "LOW");
}

export function fetchApiFootballHeadToHead(homeTeamId: number, awayTeamId: number, last = 5) {
  return fetchFixtures(
    new URLSearchParams({ h2h: `${homeTeamId}-${awayTeamId}`, last: String(last) }),
    "LOW"
  );
}

export async function fetchApiFootballStandings(
  leagueId: number,
  season: number
): Promise<ApiFootballRequestResult<ExternalFootballStanding[]>> {
  const result = await apiFootballRequest<ApiFootballStandingsResponse>(
    "standings",
    new URLSearchParams({ league: String(leagueId), season: String(season) }),
    { priority: "LOW" }
  );

  return mapRequestData(result, (items) =>
    items.flatMap((item) =>
      (item.league?.standings || []).flatMap((group) =>
        group
          .map((row) => {
            const team = normalizeTeamFields(row.team);
            if (!team || typeof row.rank !== "number") return null;
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
          .filter((row) => row !== null)
      )
    )
  );
}

export async function fetchApiFootballLineups(fixtureId: number) {
  const result = await apiFootballRequest<ApiFootballLineupResponse>(
    "fixtures/lineups",
    new URLSearchParams({ fixture: String(fixtureId) }),
    { priority: "HIGH", retries: 0 }
  );

  return mapRequestData(result, (items) =>
    items.map(normalizeLineupItem).filter((lineup) => lineup !== null)
  );
}

export async function fetchApiFootballEvents(fixtureId: number) {
  const result = await apiFootballRequest<ApiFootballEventResponse>(
    "fixtures/events",
    new URLSearchParams({ fixture: String(fixtureId) }),
    { priority: "CRITICAL", retries: 0 }
  );

  return mapRequestData(result, (items) =>
    items.map(normalizeEventItem).filter((event) => event !== null)
  );
}

export async function fetchApiFootballStatistics(fixtureId: number) {
  const result = await apiFootballRequest<ApiFootballStatisticResponse>(
    "fixtures/statistics",
    new URLSearchParams({ fixture: String(fixtureId) }),
    { priority: "HIGH", retries: 0 }
  );

  return mapRequestData(result, (items) =>
    items.map(normalizeStatisticItem).filter((statistic) => statistic !== null)
  );
}

export async function fetchApiFootballFixturePlayers(fixtureId: number) {
  const result = await apiFootballRequest<ApiFootballPlayerStatisticResponse>(
    "fixtures/players",
    new URLSearchParams({ fixture: String(fixtureId) }),
    { priority: "NORMAL", retries: 0 }
  );

  return mapRequestData(result, (items) => items.flatMap(normalizePlayerStatisticTeam));
}

export function fetchApiFootballTeamStatistics(leagueId: number, season: number, teamId: number) {
  return apiFootballRequest<ExternalTeamSeasonStatistics>(
    "teams/statistics",
    new URLSearchParams({
      league: String(leagueId),
      season: String(season),
      team: String(teamId)
    }),
    { priority: "LOW", retries: 0 }
  );
}

export async function fetchApiFootballVenue(venueId: number) {
  const result = await apiFootballRequest<ApiFootballVenueResponse>(
    "venues",
    new URLSearchParams({ id: String(venueId) }),
    { priority: "LOW", retries: 0 }
  );

  return mapRequestData(result, (items) =>
    items
      .map((item) => {
        if (!item.id || !item.name) return null;
        return {
          address: item.address || null,
          apiId: item.id,
          capacity: item.capacity ?? null,
          city: item.city || null,
          country: item.country || null,
          image: normalizeUrl(item.image),
          name: item.name,
          surface: item.surface || null
        } satisfies ExternalFootballVenue;
      })
      .filter((venue) => venue !== null)
  );
}

export function assertFootballApiConfigured() {
  if (!isFootballApiConfigured()) {
    throw new Error("API_FOOTBALL_KEY nao configurada no servidor.");
  }
}
