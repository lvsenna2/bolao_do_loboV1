const BRAZIL_COUNTRY_CODE = "55";

export function normalizeBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(BRAZIL_COUNTRY_CODE.length);
  }

  if (!/^\d{10,11}$/.test(digits) || digits.startsWith("0")) {
    return null;
  }

  return `${BRAZIL_COUNTRY_CODE}${digits}`;
}

export function formatBrazilianPhone(value: string | null | undefined) {
  if (!value) {
    return "Nao informado";
  }

  const normalized = normalizeBrazilianPhone(value);

  if (!normalized) {
    return value;
  }

  const national = normalized.slice(BRAZIL_COUNTRY_CODE.length);
  const areaCode = national.slice(0, 2);
  const localNumber = national.slice(2);
  const splitAt = localNumber.length === 9 ? 5 : 4;

  return `+55 (${areaCode}) ${localNumber.slice(0, splitAt)}-${localNumber.slice(splitAt)}`;
}
