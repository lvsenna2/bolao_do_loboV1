import { describe, expect, it } from "vitest";

import { isMaintenanceActive, MAINTENANCE_ENDS_AT } from "./maintenance";

describe("maintenance window", () => {
  it("stays active until September 1 in Sao Paulo", () => {
    expect(isMaintenanceActive(new Date("2026-09-01T02:59:59.999Z"))).toBe(true);
    expect(MAINTENANCE_ENDS_AT.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("ends automatically at the configured instant", () => {
    expect(isMaintenanceActive(new Date("2026-09-01T03:00:00.000Z"))).toBe(false);
  });
});
