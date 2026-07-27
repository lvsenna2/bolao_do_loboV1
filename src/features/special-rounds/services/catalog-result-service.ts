import type { SpecialRoundMarketKind } from "@prisma/client";

import type { SpecialRoundAnswer } from "../types";

type CatalogEvent = {
  detail?: string | null;
  elapsed: number;
  extra: number | null;
  player: { id: string; name: string } | null;
  teamId: string | null;
  type: string;
};

type CatalogStatistic = {
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
    yellowCards === null && redCards === null
      ? cardEvents.length || null
      : (yellowCards ?? 0) + (redCards ?? 0);

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
          answer = market.options.some((option) => option.value === playerValue)
            ? playerValue
            : goal.player.name;
        }
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
