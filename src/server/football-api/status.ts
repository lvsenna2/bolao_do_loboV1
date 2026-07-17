import type { MatchStatus } from "@prisma/client";

export function mapApiFootballStatus(statusShort: string): MatchStatus {
  if (["1H", "2H", "ET", "BT", "P", "LIVE"].includes(statusShort)) {
    return "LIVE";
  }

  if (statusShort === "HT") {
    return "HALFTIME";
  }

  if (["FT", "AET", "PEN", "AWD", "WO"].includes(statusShort)) {
    return "FINISHED";
  }

  if (statusShort === "PST") {
    return "POSTPONED";
  }

  if (["SUSP", "INT"].includes(statusShort)) {
    return "SUSPENDED";
  }

  if (["CANC", "ABD"].includes(statusShort)) {
    return "CANCELLED";
  }

  return "SCHEDULED";
}

export function isApiFootballFinalStatus(statusShort: string) {
  return ["FT", "AET", "PEN", "AWD", "WO"].includes(statusShort);
}
