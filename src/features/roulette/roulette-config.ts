export type RoulettePrize = {
  id: string;
  name: string;
  probabilityUnits: number;
  value: number;
};

// 100.000 unidades: jackpot = 1 unidade = 0,001%.
export const DAILY_ROULETTE_PRIZES: RoulettePrize[] = [
  { id: "none", name: "Nenhum premio hoje", probabilityUnits: 50_000, value: 0 },
  { id: "fragment", name: "1 Fragmento de Vale Especial", probabilityUnits: 20_000, value: 1 },
  { id: "balance_200", name: "R$ 2,00 de saldo", probabilityUnits: 10_000, value: 200 },
  {
    id: "promo",
    name: "5% de desconto na proxima participacao",
    probabilityUnits: 10_000,
    value: 5
  },
  { id: "special_voucher", name: "1 Vale para Rodada Especial", probabilityUnits: 5_000, value: 1 },
  { id: "bonus_spin", name: "Giro bonus", probabilityUnits: 3_000, value: 1 },
  { id: "league_voucher", name: "1 Vale para Liga", probabilityUnits: 1_000, value: 1 },
  { id: "surprise", name: "3 Fragmentos de Vale Especial", probabilityUnits: 999, value: 3 },
  { id: "jackpot", name: "JACKPOT: R$ 50,00 de saldo", probabilityUnits: 1, value: 5_000 }
];

export const BONUS_ROULETTE_PRIZES = DAILY_ROULETTE_PRIZES.filter(
  (prize) => prize.id !== "bonus_spin"
);

export const ROULETTE_EXPECTED_DIRECT_COST_CENTS = 20.05;
