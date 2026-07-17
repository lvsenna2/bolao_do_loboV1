export type FootballApiPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type FootballApiRateLimit = {
  dailyLimit: number | null;
  dailyRemaining: number | null;
  minuteLimit: number | null;
  minuteRemaining: number | null;
};

export type ApiFootballRequestResult<T> =
  | {
      callsUsed: number;
      data: T;
      durationMs: number;
      ok: true;
      rateLimit: FootballApiRateLimit;
      statusCode: number;
    }
  | {
      callsUsed: number;
      durationMs: number;
      message: string;
      ok: false;
      rateLimit: FootballApiRateLimit;
      statusCode: number | null;
    };

export type ExternalFootballCoverage = {
  events: boolean;
  lineups: boolean;
  players: boolean;
  standings: boolean;
  statisticsFixtures: boolean;
  statisticsPlayers: boolean;
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
  coverage?: ExternalFootballCoverage | null;
  logo?: string | null;
  name: string;
  seasons: number[];
  type: string;
};

export type ExternalFootballScore = {
  away: number | null;
  home: number | null;
};

export type ExternalFootballFixture = {
  apiId: number;
  awayScore?: number | null;
  awayTeam: ExternalFootballTeam;
  city?: string | null;
  country?: string | null;
  elapsed?: number | null;
  events: ExternalFootballEvent[];
  extra?: number | null;
  extraTime: ExternalFootballScore;
  fulltime: ExternalFootballScore;
  halftime: ExternalFootballScore;
  homeScore?: number | null;
  homeTeam: ExternalFootballTeam;
  kickoff: Date;
  penalty: ExternalFootballScore;
  lineups: ExternalFootballLineup[];
  playerStatistics: ExternalFootballPlayerStatistic[];
  referee?: string | null;
  round: string;
  secondHalf: ExternalFootballScore;
  stadium?: string | null;
  statusLong: string;
  statusShort: string;
  statistics: ExternalFootballStatistic[];
  venueId?: number | null;
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

export type ExternalFootballPlayer = {
  apiId: number;
  firstName?: string | null;
  lastName?: string | null;
  name: string;
  photo?: string | null;
  position?: string | null;
};

export type ExternalLineupPlayer = {
  grid?: string | null;
  number?: number | null;
  player: ExternalFootballPlayer;
  position?: string | null;
};

export type ExternalFootballLineup = {
  coach: {
    apiId?: number | null;
    name?: string | null;
    photo?: string | null;
  };
  formation?: string | null;
  starters: ExternalLineupPlayer[];
  substitutes: ExternalLineupPlayer[];
  team: ExternalFootballTeam;
};

export type ExternalFootballEvent = {
  assist?: ExternalFootballPlayer | null;
  comments?: string | null;
  detail?: string | null;
  elapsed: number;
  extra?: number | null;
  player?: ExternalFootballPlayer | null;
  team?: ExternalFootballTeam | null;
  type: string;
};

export type ExternalFootballStatistic = {
  team: ExternalFootballTeam;
  values: Array<{
    type: string;
    value: number | string | null;
  }>;
};

export type ExternalFootballPlayerStatistic = {
  player: ExternalFootballPlayer;
  statistics: Record<string, unknown>[];
  team: ExternalFootballTeam;
};

export type ExternalFootballVenue = {
  address?: string | null;
  apiId: number;
  capacity?: number | null;
  city?: string | null;
  country?: string | null;
  image?: string | null;
  name: string;
  surface?: string | null;
};

export type ExternalTeamSeasonStatistics = Record<string, unknown>;
