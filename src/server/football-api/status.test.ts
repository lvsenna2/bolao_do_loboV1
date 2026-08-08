import { describe, expect, it } from "vitest";

import { isApiFootballLiveStatus, mapApiFootballStatus } from "./status";

describe("isApiFootballLiveStatus", () => {
  it.each(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"])("reconhece %s como ao vivo", (status) => {
    expect(isApiFootballLiveStatus(status)).toBe(true);
  });

  it.each(["NS", "FT", "PST", "CANC", "SUSP"])("nao trata %s como ao vivo", (status) => {
    expect(isApiFootballLiveStatus(status)).toBe(false);
  });
});

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
