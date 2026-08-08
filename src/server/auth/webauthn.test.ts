import { describe, expect, it } from "vitest";

import { isChallengeUsable, normalizeTransports, resolveRelyingParty } from "./webauthn";

describe("passkey relying party", () => {
  it("deriva rpId e origin da URL de producao", () => {
    expect(resolveRelyingParty("https://bolaodolobo.com.br")).toEqual({
      origin: "https://bolaodolobo.com.br",
      rpId: "bolaodolobo.com.br"
    });
  });

  it("mantem localhost para desenvolvimento", () => {
    expect(resolveRelyingParty("http://localhost:3000")).toEqual({
      origin: "http://localhost:3000",
      rpId: "localhost"
    });
  });

  it("usa fallback seguro quando a URL e invalida ou ausente", () => {
    expect(resolveRelyingParty("nao-e-url")).toEqual({
      origin: "http://localhost:3000",
      rpId: "localhost"
    });
    expect(resolveRelyingParty(undefined)).toEqual({
      origin: "http://localhost:3000",
      rpId: "localhost"
    });
  });
});

describe("passkey challenge", () => {
  const now = new Date("2026-08-08T18:00:00.000Z");

  it("aceita challenge valido do tipo esperado", () => {
    expect(
      isChallengeUsable(
        { expiresAt: new Date("2026-08-08T18:04:00.000Z"), type: "authentication" },
        "authentication",
        now
      )
    ).toBe(true);
  });

  it("rejeita challenge expirado, de outro tipo ou inexistente", () => {
    expect(
      isChallengeUsable(
        { expiresAt: new Date("2026-08-08T17:59:59.000Z"), type: "authentication" },
        "authentication",
        now
      )
    ).toBe(false);
    expect(
      isChallengeUsable(
        { expiresAt: new Date("2026-08-08T18:04:00.000Z"), type: "registration" },
        "authentication",
        now
      )
    ).toBe(false);
    expect(isChallengeUsable(null, "authentication", now)).toBe(false);
  });
});

describe("passkey transports", () => {
  it("normaliza transportes ausentes ou invalidos", () => {
    expect(normalizeTransports(undefined)).toEqual([]);
    expect(normalizeTransports(["internal", "hybrid"])).toEqual(["internal", "hybrid"]);
  });
});
