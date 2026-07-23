import type { MatchStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canShowOtherGuesses } from "./comparison-data";

const now = new Date("2026-07-22T15:00:00.000Z");

function match(status: MatchStatus, kickoff: string) {
  return {
    kickoff: new Date(kickoff),
    status
  };
}

describe("comparison guess visibility", () => {
  it("keeps other guesses hidden before a scheduled match", () => {
    expect(canShowOtherGuesses(match("SCHEDULED", "2026-07-22T16:00:00.000Z"), now)).toBe(false);
  });

  it("releases guesses when kickoff is reached", () => {
    expect(canShowOtherGuesses(match("SCHEDULED", "2026-07-22T15:00:00.000Z"), now)).toBe(true);
  });

  it.each(["LIVE", "HALFTIME", "FINISHED"] as const)(
    "releases guesses for a %s match even if the provider kickoff changed",
    (status) => {
      expect(canShowOtherGuesses(match(status, "2026-07-22T16:00:00.000Z"), now)).toBe(true);
    }
  );

  it("does not reveal guesses for a postponed future match", () => {
    expect(canShowOtherGuesses(match("POSTPONED", "2026-07-22T16:00:00.000Z"), now)).toBe(false);
  });
});
