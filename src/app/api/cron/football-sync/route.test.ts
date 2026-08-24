import { afterEach, describe, expect, it } from "vitest";

import { isValidCronRequest } from "@/server/cron/auth";
import { shouldRunSpecialRoundSettlement } from "./route";

const previousSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = previousSecret;
});

describe("football cron authorization", () => {
  it("rejects requests when the secret is not configured", () => {
    delete process.env.CRON_SECRET;

    expect(isValidCronRequest(new Request("https://example.com/api/cron/football-sync"))).toBe(
      false
    );
  });

  it("accepts only the matching bearer token", () => {
    process.env.CRON_SECRET = "cron-test-secret";

    expect(
      isValidCronRequest(
        new Request("https://example.com/api/cron/football-sync", {
          headers: { authorization: "Bearer cron-test-secret" }
        })
      )
    ).toBe(true);
    expect(
      isValidCronRequest(
        new Request("https://example.com/api/cron/football-sync", {
          headers: { authorization: "Bearer incorreto" }
        })
      )
    ).toBe(false);
  });
});

describe("football cron settlement", () => {
  it("does not start another settlement while the automation lock is active", () => {
    expect(shouldRunSpecialRoundSettlement({ locked: true })).toBe(false);
    expect(shouldRunSpecialRoundSettlement({ locked: false })).toBe(true);
  });
});
