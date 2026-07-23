import { describe, expect, it } from "vitest";

import { formatBrazilianPhone, normalizeBrazilianPhone } from "./phone";

describe("Brazilian phone helpers", () => {
  it("normaliza celular com ou sem codigo do Brasil", () => {
    expect(normalizeBrazilianPhone("(21) 96469-6114")).toBe("5521964696114");
    expect(normalizeBrazilianPhone("+55 21 96469-6114")).toBe("5521964696114");
  });

  it("rejeita numeros incompletos", () => {
    expect(normalizeBrazilianPhone("21 9646-911")).toBeNull();
  });

  it("formata o telefone salvo para exibicao", () => {
    expect(formatBrazilianPhone("5521964696114")).toBe("+55 (21) 96469-6114");
    expect(formatBrazilianPhone(null)).toBe("Nao informado");
  });
});
