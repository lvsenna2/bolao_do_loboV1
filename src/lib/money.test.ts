import { describe, expect, it } from "vitest";

import { formatMoney, toMoneyNumber } from "./money";

describe("money helpers", () => {
  it("aceita valores serializados pelo cache", () => {
    expect(toMoneyNumber("29.90")).toBe(29.9);
    expect(formatMoney("29.90")).toMatch(/29,90/);
  });

  it("aceita numeros e objetos Decimal", () => {
    expect(toMoneyNumber(12.5)).toBe(12.5);
    expect(toMoneyNumber({ toNumber: () => 42, toString: () => "42" })).toBe(42);
  });

  it("usa zero para valores ausentes ou invalidos", () => {
    expect(toMoneyNumber(null)).toBe(0);
    expect(toMoneyNumber("invalido")).toBe(0);
  });
});
