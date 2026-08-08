import { describe, expect, it } from "vitest";

import { getPostLoginDestination, getPostLoginDestinationFromAuthResult } from "./login-destination";

describe("getPostLoginDestination", () => {
  it("returns the provided safe callback URL", () => {
    expect(getPostLoginDestination("/palpites")).toBe("/palpites");
  });

  it("routes admins to the admin area even when a default callback is present", () => {
    expect(getPostLoginDestination("/dashboard", "SUPER_ADMIN")).toBe("/admin");
    expect(getPostLoginDestination("/dashboard", "ADMIN")).toBe("/admin");
  });

  it("falls back to the dashboard for unsafe or missing values", () => {
    expect(getPostLoginDestination(undefined)).toBe("/dashboard");
    expect(getPostLoginDestination("//evil.com")).toBe("/dashboard");
    expect(getPostLoginDestination("https://example.com")).toBe("/dashboard");
  });

  it("prioritizes an admin redirect over the auth result URL", () => {
    expect(getPostLoginDestinationFromAuthResult("/dashboard", "SUPER_ADMIN", "/dashboard")).toBe(
      "/admin"
    );
  });
});
