import { describe, expect, it } from "vitest";

import {
  describePasskeyError,
  isCancelledPasskeyError,
  isHostAllowedForRpId
} from "./passkey-errors";

function errorNamed(name: string) {
  const error = new Error("falha");
  error.name = name;
  return error;
}

describe("describePasskeyError", () => {
  it("trata cancelamento do usuario sem virar mensagem de erro", () => {
    expect(isCancelledPasskeyError(describePasskeyError(errorNamed("NotAllowedError"), "login"))).toBe(
      true
    );
    expect(
      isCancelledPasskeyError(describePasskeyError(errorNamed("AbortError"), "registration"))
    ).toBe(true);
  });

  it("explica dominio incompativel citando o endereco correto", () => {
    const message = describePasskeyError(
      errorNamed("SecurityError"),
      "registration",
      "simuladorcopa2026.com.br"
    );

    expect(message).toContain("simuladorcopa2026.com.br");
  });

  it("diferencia aparelho ja cadastrado por contexto", () => {
    expect(describePasskeyError(errorNamed("InvalidStateError"), "registration")).toContain(
      "ja esta cadastrado"
    );
    expect(describePasskeyError(errorNamed("InvalidStateError"), "login")).toContain(
      "nao reconhecida"
    );
  });

  it("orienta a ativar o bloqueio de tela quando falta credencial no aparelho", () => {
    expect(describePasskeyError(errorNamed("ConstraintError"), "registration")).toContain(
      "bloqueio de tela"
    );
  });

  it("sugere abrir fora do navegador embutido no erro generico de cadastro", () => {
    expect(describePasskeyError(new Error("qualquer"), "registration")).toContain("WhatsApp");
  });

  it("avisa quando o aparelho nao suporta biometria", () => {
    expect(describePasskeyError(errorNamed("NotSupportedError"), "login")).toContain(
      "nao oferece biometria"
    );
  });
});

describe("isHostAllowedForRpId", () => {
  it("aceita o proprio dominio e subdominios", () => {
    expect(isHostAllowedForRpId("simuladorcopa2026.com.br", "simuladorcopa2026.com.br")).toBe(true);
    expect(isHostAllowedForRpId("www.simuladorcopa2026.com.br", "simuladorcopa2026.com.br")).toBe(
      true
    );
  });

  it("recusa dominio diferente como o preview da Vercel", () => {
    expect(isHostAllowedForRpId("bolaodolobo.vercel.app", "simuladorcopa2026.com.br")).toBe(false);
    expect(isHostAllowedForRpId("outrosimuladorcopa2026.com.br", "simuladorcopa2026.com.br")).toBe(
      false
    );
  });
});
