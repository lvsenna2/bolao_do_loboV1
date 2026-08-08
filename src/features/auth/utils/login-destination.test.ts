import { describe, expect, it } from "vitest";

import { getPostLoginDestination } from "./login-destination";

describe("getPostLoginDestination", () => {
  it("returns the provided safe callback URL", () => {
    expect(getPostLoginDestination("/palpites")).toBe("/palpites");
  });

  it("falls back to the dashboard for unsafe or missing values", () => {
    expect(getPostLoginDestination(undefined)).toBe("/dashboard");
    expect(getPostLoginDestination("//evil.com")).toBe("/dashboard");
    expect(getPostLoginDestination("https://example.com")).toBe("/dashboard");
  });
});
