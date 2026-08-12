import { describe, expect, it } from "vitest";

import { identifyTwoLegMatches } from "./two-leg";

const teamA = { id: "team-a" };
const teamB = { id: "team-b" };
const teamC = { id: "team-c" };

describe("identifyTwoLegMatches", () => {
  it("marca confronto invertido anterior como ida e posterior como volta", () => {
    const roles = identifyTwoLegMatches([
      {
        awayTeam: teamA,
        homeTeam: teamB,
        id: "return",
        kickoff: "2026-08-20T20:00:00.000Z"
      },
      {
        awayTeam: teamB,
        homeTeam: teamA,
        id: "first",
        kickoff: "2026-08-13T20:00:00.000Z"
      }
    ]);

    expect(roles.get("first")).toBe("IDA");
    expect(roles.get("return")).toBe("VOLTA");
  });

  it("nao marca partidas sem confronto reverso", () => {
    const roles = identifyTwoLegMatches([
      {
        awayTeam: teamB,
        homeTeam: teamA,
        id: "one",
        kickoff: "2026-08-13T20:00:00.000Z"
      },
      {
        awayTeam: teamC,
        homeTeam: teamA,
        id: "two",
        kickoff: "2026-08-20T20:00:00.000Z"
      }
    ]);

    expect(roles.size).toBe(0);
  });
});
