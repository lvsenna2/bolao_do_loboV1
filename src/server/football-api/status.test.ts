import { describe, expect, it } from "vitest";

import { mapApiFootballStatus } from "./status";

describe("mapApiFootballStatus", () => {
  it.each([
    ["NS", "SCHEDULED"],
    ["1H", "LIVE"],
    ["2H", "LIVE"],
    ["HT", "HALFTIME"],
    ["FT", "FINISHED"],
    ["AET", "FINISHED"],
    ["PEN", "FINISHED"],
    ["PST", "POSTPONED"],
    ["SUSP", "SUSPENDED"],
    ["INT", "SUSPENDED"],
    ["CANC", "CANCELLED"],
    ["ABD", "CANCELLED"]
  ] as const)("converte %s para %s", (external, internal) => {
    expect(mapApiFootballStatus(external)).toBe(internal);
  });
});
