import type { SpecialRoundMarketKind } from "@prisma/client";

import type { SpecialRoundAnswer } from "../types";
import { getGoalScorerPlayerValue } from "./default-markets";

type CatalogEvent = {
  detail?: string | null;
  elapsed: number;
  extra: number | null;
  player: { id: string; name: string } | null;
  teamId: string | null;
  type: string;
};

type CatalogStatistic = {
  teamId?: string;
  type: string;
  value: string | null;
};

type ResultMarket = {
  answerType: string;
  id: string;
  kind: SpecialRoundMarketKind;
  options: readonly { value: string }[];
  title: string;
};

type CatalogMatch = {
  awayScore: number | null;
  awayTeamId: string;
  events: CatalogEvent[];
  homeScore: number | null;
  homeTeamId: string;
  statistics: CatalogStatistic[];
  status: string;
};

function numericStatistic(statistics: CatalogStatistic[], type: string) {
  const values = statistics
    .filter((row) => row.type.toLowerCase() === type.toLowerCase())
    .map((row) => Number.parseFloat(String(row.value ?? "").replace("%", "")));
  return values.length && values.every(Number.isFinite)
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function numericTeamStatistic(statistics: CatalogStatistic[], type: string, teamId: string) {
  const row = statistics.find(
    (statistic) =>
      statistic.teamId === teamId && statistic.type.toLowerCase() === type.toLowerCase()
  );
  if (!row || row.value === null) return null;
  const value = Number.parseFloat(String(row.value).replace("%", ""));
  return Number.isFinite(value) ? value : null;
}

function compareTeams(home: number | null, away: number | null) {
  if (home === null || away === null) return undefined;
  return home === away ? "DRAW" : home > away ? "HOME" : "AWAY";
}

function sumComplete(left: number | null, right: number | null) {
  return left === null || right === null ? null : left + right;
}

function firstGoal(events: CatalogEvent[]) {
  return [...events]
    .filter((event) => event.type.toLowerCase() === "goal")
    .sort(
      (left, right) => left.elapsed - right.elapsed || (left.extra ?? 0) - (right.extra ?? 0)
    )[0];
}

export function deriveCatalogResults(match: CatalogMatch, markets: readonly ResultMarket[]) {
  const answers: Record<string, SpecialRoundAnswer> = {};
  const missing: string[] = [];

  if (match.status !== "FINISHED" || match.homeScore === null || match.awayScore === null) {
    return { answers, missing: ["A partida ainda nao possui placar final confirmado."] };
  }

  const homeScore = match.homeScore;
  const awayScore = match.awayScore;
  const goal = firstGoal(match.events);
  const corners = numericStatistic(match.statistics, "Corner Kicks");
  const yellowCards = numericStatistic(match.statistics, "Yellow Cards");
  const redCards = numericStatistic(match.statistics, "Red Cards");
  const cardEvents = match.events.filter((event) => event.type.toLowerCase() === "card");
  const cards =
    yellowCards !== null && redCards !== null ? yellowCards + redCards : cardEvents.length || null;
  const homeShotsOnGoal = numericTeamStatistic(match.statistics, "Shots on Goal", match.homeTeamId);
  const awayShotsOnGoal = numericTeamStatistic(match.statistics, "Shots on Goal", match.awayTeamId);
  const homeCorners = numericTeamStatistic(match.statistics, "Corner Kicks", match.homeTeamId);
  const awayCorners = numericTeamStatistic(match.statistics, "Corner Kicks", match.awayTeamId);
  const homeShots = numericTeamStatistic(match.statistics, "Total Shots", match.homeTeamId);
  const awayShots = numericTeamStatistic(match.statistics, "Total Shots", match.awayTeamId);
  let homeCards = sumComplete(
    numericTeamStatistic(match.statistics, "Yellow Cards", match.homeTeamId),
    numericTeamStatistic(match.statistics, "Red Cards", match.homeTeamId)
  );
  let awayCards = sumComplete(
    numericTeamStatistic(match.statistics, "Yellow Cards", match.awayTeamId),
    numericTeamStatistic(match.statistics, "Red Cards", match.awayTeamId)
  );
  const cardEventsHaveTeams =
    cardEvents.length > 0 &&
    cardEvents.every(
      (event) => event.teamId === match.homeTeamId || event.teamId === match.awayTeamId
    );
  if ((homeCards === null || awayCards === null) && cardEventsHaveTeams) {
    homeCards = cardEvents.filter((event) => event.teamId === match.homeTeamId).length;
    awayCards = cardEvents.filter((event) => event.teamId === match.awayTeamId).length;
  }

  for (const market of markets) {
    let answer: SpecialRoundAnswer | undefined;
    switch (market.kind) {
      case "EXACT_SCORE":
        answer = { away: awayScore, home: homeScore };
        break;
      case "MATCH_RESULT":
        answer = homeScore === awayScore ? "DRAW" : homeScore > awayScore ? "HOME" : "AWAY";
        break;
      case "TOTAL_GOALS":
        answer = homeScore + awayScore;
        break;
      case "TOTAL_CORNERS":
        answer = corners ?? undefined;
        break;
      case "BOTH_TEAMS_SCORE":
        answer = homeScore > 0 && awayScore > 0;
        break;
      case "TOTAL_CARDS":
        answer = cards ?? undefined;
        break;
      case "FIRST_TEAM_TO_SCORE":
        answer =
          homeScore + awayScore === 0
            ? "NO_GOAL"
            : goal?.teamId === match.homeTeamId
              ? "HOME"
              : goal?.teamId === match.awayTeamId
                ? "AWAY"
                : undefined;
        break;
      case "GOAL_SCORER":
        if (homeScore + awayScore === 0) {
          answer = "NO_GOAL";
        } else if (goal?.player) {
          const playerValue = `PLAYER:${goal.player.id}`;
          answer =
            market.options.find((option) => getGoalScorerPlayerValue(option.value) === playerValue)
              ?.value ?? goal.player.name;
        }
        break;
      case "TEAM_MOST_SHOTS_ON_GOAL":
        answer = compareTeams(homeShotsOnGoal, awayShotsOnGoal);
        break;
      case "TEAM_MOST_CORNERS":
        answer = compareTeams(homeCorners, awayCorners);
        break;
      case "TEAM_MOST_CARDS":
        answer = compareTeams(homeCards, awayCards);
        break;
      case "TEAM_MOST_SHOTS":
        answer = compareTeams(homeShots, awayShots);
        break;
      default:
        break;
    }

    if (answer === undefined) {
      missing.push(market.title);
    } else {
      answers[market.id] = answer;
    }
  }

  return { answers, missing };
}
