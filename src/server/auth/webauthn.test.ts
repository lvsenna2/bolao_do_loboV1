import { describe, expect, it } from "vitest";

import { isChallengeUsable, normalizeTransports, resolveRelyingParty } from "./webauthn";

describe("passkey relying party", () => {
  it("aceita apex e www quando a URL configurada e o apex", () => {
    // NEXTAUTH_URL sem www, usuarios acessando com www: as duas origens precisam valer.
    const { origins, rpId } = resolveRelyingParty("https://simuladorcopa2026.com.br", "");

    expect(rpId).toBe("simuladorcopa2026.com.br");
    expect(origins).toContain("https://simuladorcopa2026.com.br");
    expect(origins).toContain("https://www.simuladorcopa2026.com.br");
  });

  it("normaliza o rpId quando a URL configurada tem www", () => {
    const { origins, rpId } = resolveRelyingParty("https://www.simuladorcopa2026.com.br", "");

    expect(rpId).toBe("simuladorcopa2026.com.br");
    expect(origins).toContain("https://www.simuladorcopa2026.com.br");
    expect(origins).toContain("https://simuladorcopa2026.com.br");
  });

  it("inclui origens extras configuradas por ambiente", () => {
    const { origins } = resolveRelyingParty(
      "https://simuladorcopa2026.com.br",
      "https://bolaodolobo.vercel.app, https://preview.exemplo.app"
    );

    expect(origins).toContain("https://bolaodolobo.vercel.app");
    expect(origins).toContain("https://preview.exemplo.app");
  });

  it("mantem localhost com porta para desenvolvimento", () => {
    const { origins, rpId } = resolveRelyingParty("http://localhost:3000", "");

    expect(rpId).toBe("localhost");
    expect(origins).toContain("http://localhost:3000");
  });

  it("usa fallback seguro quando a URL e invalida ou ausente", () => {
    expect(resolveRelyingParty("nao-e-url", "").rpId).toBe("localhost");
    expect(resolveRelyingParty(undefined, "").origins).toContain("http://localhost:3000");
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
