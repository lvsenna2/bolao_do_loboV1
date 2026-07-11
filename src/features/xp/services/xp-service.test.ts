import { describe, expect, it } from "vitest";

import { getLevelForXp, getXpProgressFromLevels, type XpLevelView } from "./xp-service";

const levels: XpLevelView[] = [
  {
    active: true,
    benefits: null,
    color: "#94A3B8",
    discountPercent: 0,
    id: "iniciante",
    key: "iniciante",
    maxXp: 249,
    medal: "🥉",
    minXp: 0,
    name: "Iniciante",
    sortOrder: 1
  },
  {
    active: true,
    benefits: null,
    color: "#FBBF24",
    discountPercent: 5,
    id: "ouro",
    key: "ouro",
    maxXp: 4999,
    medal: "🥇",
    minXp: 2000,
    name: "Ouro",
    sortOrder: 4
  },
  {
    active: true,
    benefits: null,
    color: "#FACC15",
    discountPercent: 40,
    id: "lobo",
    key: "lobo-supremo",
    maxXp: null,
    medal: "🐺",
    minXp: 150000,
    name: "Lobo Supremo",
    sortOrder: 10
  }
];

describe("xp-service progressao", () => {
  it("seleciona a patente correta pelo XP acumulado", () => {
    expect(getLevelForXp(0, levels).name).toBe("Iniciante");
    expect(getLevelForXp(2200, levels).name).toBe("Ouro");
    expect(getLevelForXp(180000, levels).name).toBe("Lobo Supremo");
  });

  it("calcula progresso ate a proxima patente", () => {
    const progress = getXpProgressFromLevels(2250, levels);

    expect(progress.currentLevel.name).toBe("Ouro");
    expect(progress.nextLevel?.name).toBe("Lobo Supremo");
    expect(progress.remainingXp).toBe(147750);
    expect(progress.discountPercent).toBe(5);
  });
});
