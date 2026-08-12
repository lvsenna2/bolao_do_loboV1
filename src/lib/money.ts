export type MoneyValue =
  | number
  | string
  | {
      toNumber?: () => number;
      toString: () => string;
    }
  | null
  | undefined;

export function toMoneyNumber(value: MoneyValue) {
  if (value == null) {
    return 0;
  }

  const amount =
    typeof value === "object" && typeof value.toNumber === "function"
      ? value.toNumber()
      : Number(value);

  return Number.isFinite(amount) ? amount : 0;
}

export function formatMoney(value: MoneyValue) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(toMoneyNumber(value));
}
