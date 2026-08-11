import type { GuessMatchView } from "./data/guess-data";

export type GuessQuickFilter = "ALL" | "PENDING" | "SAVED" | "STARTING_SOON" | "LIVE" | "FINISHED";

export type GuessCardState = "BLOCKED" | "FINISHED" | "LIVE" | "PENDING" | "SAVED";

export function isLiveGuessMatch(match: GuessMatchView) {
  return match.status === "LIVE" || match.status === "HALFTIME";
}

export function isFinishedGuessMatch(match: GuessMatchView) {
  return match.status === "FINISHED" || match.status === "CANCELLED";
}

export function isStartingSoon(match: GuessMatchView, nowMs: number) {
  const remaining = new Date(match.kickoff).getTime() - nowMs;

  return match.canEdit && remaining > 0 && remaining <= 60 * 60_000;
}

export function hasCompleteGuess(match: GuessMatchView) {
  return Boolean(
    match.existingGuess &&
    match.existingGuess.homePrediction !== null &&
    match.existingGuess.awayPrediction !== null
  );
}

export function getGuessCardState(match: GuessMatchView): GuessCardState {
  if (isLiveGuessMatch(match)) return "LIVE";
  if (isFinishedGuessMatch(match)) return "FINISHED";
  if (!match.canEdit) return "BLOCKED";

  return hasCompleteGuess(match) ? "SAVED" : "PENDING";
}

export function matchesGuessFilter(match: GuessMatchView, filter: GuessQuickFilter, nowMs: number) {
  const state = getGuessCardState(match);

  if (filter === "ALL") return true;
  if (filter === "PENDING") return state === "PENDING";
  if (filter === "SAVED") return hasCompleteGuess(match);
  if (filter === "STARTING_SOON") return isStartingSoon(match, nowMs);
  if (filter === "LIVE") return state === "LIVE";

  return state === "FINISHED" || state === "BLOCKED";
}

export function formatGuessTimeRemaining(kickoff: string, nowMs: number) {
  const remainingMs = new Date(kickoff).getTime() - nowMs;

  if (remainingMs <= 0) return "Prazo encerrado";

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h restantes`;
  if (hours > 0) return `${hours}h ${minutes}min restantes`;

  return `${minutes}min restantes`;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
  year: "numeric"
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo"
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "America/Sao_Paulo"
});

export function formatGuessKickoff(kickoff: string, nowMs: number) {
  const kickoffDate = new Date(kickoff);
  const time = timeFormatter.format(kickoffDate);

  if (!nowMs) {
    return `${shortDateFormatter.format(kickoffDate)} · ${time}`;
  }

  const today = new Date(nowMs);
  const tomorrow = new Date(nowMs + 24 * 60 * 60_000);
  const kickoffDay = dayFormatter.format(kickoffDate);

  if (kickoffDay === dayFormatter.format(today)) return `Hoje · ${time}`;
  if (kickoffDay === dayFormatter.format(tomorrow)) return `Amanha · ${time}`;

  return `${shortDateFormatter.format(kickoffDate)} · ${time}`;
}

export function formatGuessDeadline(kickoff: string, nowMs: number) {
  return `fecha em ${formatGuessTimeRemaining(kickoff, nowMs).replace(" restantes", "")}`;
}
