import { describe, expect, it } from "vitest";

import { shouldProcessFixtureScores } from "./sync-service";

describe("API-Football score processing", () => {
  it("processes a newly homologated match with guesses", () => {
    expect(
      shouldProcessFixtureScores({
        guessCount: 3,
        hasMissingScore: true,
        needsHomologation: true,
        shouldHomologate: true
      })
    ).toBe(true);
  });

  it("backfills a missing score even when homologation was already copied to the league match", () => {
    expect(
      shouldProcessFixtureScores({
        guessCount: 1,
        hasMissingScore: true,
        needsHomologation: false,
        shouldHomologate: true
      })
    ).toBe(true);
  });

  it("does not reprocess a completed match whose guesses already have scores", () => {
    expect(
      shouldProcessFixtureScores({
        guessCount: 4,
        hasMissingScore: false,
        needsHomologation: false,
        shouldHomologate: true
      })
    ).toBe(false);
  });

  it("does not score live or unfinished matches", () => {
    expect(
      shouldProcessFixtureScores({
        guessCount: 2,
        hasMissingScore: true,
        needsHomologation: false,
        shouldHomologate: false
      })
    ).toBe(false);
  });
});
