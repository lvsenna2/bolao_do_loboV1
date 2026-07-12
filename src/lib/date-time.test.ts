import { describe, expect, it } from "vitest";

import {
  formatDateInSaoPaulo,
  formatDateTimeInSaoPaulo,
  formatDateTimeLocalForSaoPaulo,
  getSaoPauloDayRangeUtc,
  isBeforeOrEqualNow,
  isWithinServerWindow,
  parseSaoPauloDateTimeLocalToUtc
} from "./date-time";

describe("date-time helpers", () => {
  it("keeps an action made at 20:35 in Brasilia displayed as 20:35", () => {
    const utcDate = parseSaoPauloDateTimeLocalToUtc("2026-07-12T20:35");

    expect(utcDate.toISOString()).toBe("2026-07-12T23:35:00.000Z");
    expect(formatDateTimeInSaoPaulo(utcDate, { seconds: true })).toBe("12/07/2026 as 20:35:00");
  });

  it("displays a UTC value in Brasilia time", () => {
    expect(formatDateTimeInSaoPaulo("2026-07-12T23:35:00.000Z")).toBe("12/07/2026 as 20:35");
  });

  it("saves a datetime-local value typed as Brasilia time in UTC", () => {
    expect(parseSaoPauloDateTimeLocalToUtc("2026-07-12T18:00").toISOString()).toBe(
      "2026-07-12T21:00:00.000Z"
    );
  });

  it("fills datetime-local fields from UTC using Brasilia time", () => {
    expect(formatDateTimeLocalForSaoPaulo("2026-07-12T21:00:00.000Z")).toBe("2026-07-12T18:00");
  });

  it("blocks exactly at the configured deadline using server time", () => {
    const deadline = new Date("2026-07-12T21:00:00.000Z");

    expect(isBeforeOrEqualNow(deadline, new Date("2026-07-12T20:59:59.000Z"))).toBe(false);
    expect(isBeforeOrEqualNow(deadline, new Date("2026-07-12T21:00:00.000Z"))).toBe(true);
  });

  it("keeps dates near midnight on the correct Brasilia day", () => {
    const lateNightUtc = new Date("2026-07-13T02:50:00.000Z");
    const dayRange = getSaoPauloDayRangeUtc(lateNightUtc);

    expect(formatDateInSaoPaulo(lateNightUtc)).toBe("12/07/2026");
    expect(dayRange.start.toISOString()).toBe("2026-07-12T03:00:00.000Z");
    expect(dayRange.end.toISOString()).toBe("2026-07-13T03:00:00.000Z");
  });

  it("checks server windows without manual hour offsets", () => {
    expect(
      isWithinServerWindow(
        new Date("2026-07-12T20:00:00.000Z"),
        new Date("2026-07-12T22:00:00.000Z"),
        new Date("2026-07-12T21:00:00.000Z")
      )
    ).toBe(true);
  });
});
