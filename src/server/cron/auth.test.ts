// @vitest-environment node
import { generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ publicKey: null as CryptoKey | null }));
vi.mock("jose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jose")>()),
  createRemoteJWKSet: () => async () => state.publicKey
}));

import { isValidScheduledCronRequest } from "./auth";

let privateKey: CryptoKey;
beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  state.publicKey = keys.publicKey;
  privateKey = keys.privateKey;
});
afterEach(() => vi.unstubAllEnvs());

const claims = {
  repository: "lvsenna2/bolao_do_loboV1",
  repository_id: "1287563515",
  repository_owner_id: "206237160",
  ref: "refs/heads/main",
  sub: "repo:lvsenna2/bolao_do_loboV1:ref:refs/heads/main",
  workflow_ref: "lvsenna2/bolao_do_loboV1/.github/workflows/football-cron.yml@refs/heads/main",
  runner_environment: "github-hosted",
  event_name: "schedule",
  iss: "https://token.actions.githubusercontent.com",
  aud: "https://www.simuladorcopa2026.com.br/api/cron"
};

async function token(overrides: Record<string, unknown> = {}, key = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...claims, iat: now, nbf: now, exp: now + 300, ...overrides })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .sign(key);
}

function request(bearer?: string) {
  return new Request("https://www.simuladorcopa2026.com.br/api/cron/football-sync", {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : undefined
  });
}

describe("scheduled cron authentication", () => {
  it.each(["schedule", "workflow_dispatch"])(
    "accepts signed %s tokens without a shared secret",
    async (event_name) => {
      vi.stubEnv("CRON_SECRET", "");
      expect(await isValidScheduledCronRequest(request(await token({ event_name })))).toBe(true);
    }
  );

  it.each([
    { repository: "attacker/fork" },
    { repository_id: "1" },
    { repository_owner_id: "1" },
    { ref: "refs/heads/feature" },
    { sub: "repo:attacker/fork:ref:refs/heads/main" },
    { workflow_ref: "lvsenna2/bolao_do_loboV1/.github/workflows/other.yml@refs/heads/main" },
    { runner_environment: "self-hosted" },
    { event_name: "pull_request_target" },
    { iss: "https://attacker.example" },
    { aud: "https://github.com/lvsenna2" },
    { exp: 1 },
    { iat: 1 },
    { nbf: 9999999999 },
    { exp: undefined }
  ])("rejects incorrect claims %j", async (overrides) => {
    expect(await isValidScheduledCronRequest(request(await token(overrides)))).toBe(false);
  });

  it("rejects a token signed with an untrusted key", async () => {
    const otherKeys = await generateKeyPair("RS256");
    expect(await isValidScheduledCronRequest(request(await token({}, otherKeys.privateKey)))).toBe(
      false
    );
  });

  it("rejects malformed and missing credentials", async () => {
    vi.stubEnv("CRON_SECRET", "");
    for (const bearer of [undefined, "undefined", "bad.token.value", "a".repeat(17000)]) {
      expect(await isValidScheduledCronRequest(request(bearer))).toBe(false);
    }
  });

  it("preserves the existing shared secret authentication", async () => {
    vi.stubEnv("CRON_SECRET", "legacy-secret");
    expect(await isValidScheduledCronRequest(request("legacy-secret"))).toBe(true);
    expect(await isValidScheduledCronRequest(request("wrong-secret"))).toBe(false);
  });
});
