import { describe, expect, it } from "vitest";

import { normalizePixKey } from "./withdrawal-service";

describe("normalizePixKey", () => {
  it("guarda CPF e CNPJ apenas com digitos", () => {
    expect(normalizePixKey("CPF", "123.456.789-09")).toBe("12345678909");
    expect(normalizePixKey("CNPJ", "12.345.678/0001-95")).toBe("12345678000195");
  });

  it("recusa CPF e CNPJ com quantidade errada de digitos", () => {
    expect(normalizePixKey("CPF", "1234567890")).toBeNull();
    expect(normalizePixKey("CNPJ", "1234567800019")).toBeNull();
  });

  it("normaliza celular para o formato internacional", () => {
    expect(normalizePixKey("PHONE", "(21) 98765-4321")).toBe("+5521987654321");
    expect(normalizePixKey("PHONE", "5521987654321")).toBe("+5521987654321");
    expect(normalizePixKey("PHONE", "98765-4321")).toBeNull();
  });

  it("aceita e-mail valido em minusculas", () => {
    expect(normalizePixKey("EMAIL", " Fulano@Email.COM ")).toBe("fulano@email.com");
    expect(normalizePixKey("EMAIL", "fulano@email")).toBeNull();
  });

  it("aceita apenas UUID na chave aleatoria", () => {
    expect(normalizePixKey("RANDOM", "3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    );
    expect(normalizePixKey("RANDOM", "chave-qualquer")).toBeNull();
  });
});
