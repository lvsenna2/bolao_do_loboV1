import type { LeagueBadgeCategory } from "@prisma/client";

type EmblemCrop = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type OfficialLeagueEmblem = {
  category: LeagueBadgeCategory;
  crop: EmblemCrop;
  description: string;
  key: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  recommendedScope: "CHAMPIONSHIP" | "UNIVERSAL";
  title: string;
};

export const officialLeagueEmblems = [
  {
    category: "ROUND_STAR",
    crop: { height: 400, width: 310, x: 8, y: 0 },
    description: "Para quem fez os melhores palpites da rodada.",
    key: "ROUND_HIGHLIGHT",
    rarity: "EPIC",
    recommendedScope: "CHAMPIONSHIP",
    title: "Destaque da Rodada"
  },
  {
    category: "CHAMPION",
    crop: { height: 400, width: 290, x: 315, y: 0 },
    description: "Para o grande campeao da Copa do Mundo 2026.",
    key: "WORLD_CUP_CHAMPION",
    rarity: "LEGENDARY",
    recommendedScope: "CHAMPIONSHIP",
    title: "Campeao da Copa do Mundo 2026"
  },
  {
    category: "CHAMPION",
    crop: { height: 400, width: 300, x: 600, y: 0 },
    description: "Para o campeao da Libertadores.",
    key: "LIBERTADORES_CHAMPION",
    rarity: "LEGENDARY",
    recommendedScope: "CHAMPIONSHIP",
    title: "Campeao da Libertadores"
  },
  {
    category: "CHAMPION",
    crop: { height: 400, width: 305, x: 895, y: 0 },
    description: "Para o campeao do Brasileirao Serie A.",
    key: "BRASILEIRAO_CHAMPION",
    rarity: "LEGENDARY",
    recommendedScope: "CHAMPIONSHIP",
    title: "Campeao do Brasileirao Serie A"
  },
  {
    category: "CUSTOM",
    crop: { height: 400, width: 320, x: 1200, y: 0 },
    description: "Para a elite do Bolao do Lobo.",
    key: "LOBAO_DO_BOLAO",
    rarity: "LEGENDARY",
    recommendedScope: "UNIVERSAL",
    title: "Lobao do Bolao"
  },
  {
    category: "MOST_EXACT_SCORES",
    crop: { height: 170, width: 185, x: 4, y: 510 },
    description: "Para quem acerta muitos placares exatos.",
    key: "SCORE_MASTER",
    rarity: "LEGENDARY",
    recommendedScope: "CHAMPIONSHIP",
    title: "Mestre dos Placares"
  },
  {
    category: "MOST_HITS",
    crop: { height: 170, width: 185, x: 195, y: 510 },
    description: "Para os mestres dos palpites estrategicos.",
    key: "BOLAO_BRAIN",
    rarity: "EPIC",
    recommendedScope: "UNIVERSAL",
    title: "Cerebro do Bolao"
  },
  {
    category: "CONSISTENCY",
    crop: { height: 170, width: 185, x: 385, y: 510 },
    description: "Para quem mantem a consistencia rodada apos rodada.",
    key: "REGULARITY",
    rarity: "RARE",
    recommendedScope: "CHAMPIONSHIP",
    title: "Regularidade"
  },
  {
    category: "CUSTOM",
    crop: { height: 170, width: 185, x: 575, y: 510 },
    description: "Para quem esta sempre subindo no ranking.",
    key: "EVOLUTION",
    rarity: "RARE",
    recommendedScope: "CHAMPIONSHIP",
    title: "Evolucao"
  },
  {
    category: "ROUND_STAR",
    crop: { height: 170, width: 185, x: 755, y: 510 },
    description: "Para quem mandou bem quando ninguem esperava.",
    key: "ROUND_SURPRISE",
    rarity: "EPIC",
    recommendedScope: "CHAMPIONSHIP",
    title: "Surpresa da Rodada"
  },
  {
    category: "CUSTOM",
    crop: { height: 170, width: 185, x: 940, y: 510 },
    description: "Para quem evita zebras como ninguem.",
    key: "UNBREAKABLE_DEFENSE",
    rarity: "EPIC",
    recommendedScope: "CHAMPIONSHIP",
    title: "Defesa Imbativel"
  },
  {
    category: "FAIR_PLAY",
    crop: { height: 170, width: 185, x: 1125, y: 510 },
    description: "Para quem joga com respeito e espirito esportivo.",
    key: "FAIR_PLAY",
    rarity: "EPIC",
    recommendedScope: "UNIVERSAL",
    title: "Fair Play"
  },
  {
    category: "PARTICIPATION",
    crop: { height: 170, width: 185, x: 1310, y: 510 },
    description: "Para os participantes mais leais e engajados.",
    key: "LOYAL_WOLF",
    rarity: "EPIC",
    recommendedScope: "UNIVERSAL",
    title: "Fiel ao Lobo"
  },
  {
    category: "PARTICIPATION",
    crop: { height: 150, width: 150, x: 15, y: 775 },
    description: "Para quem nao perde o prazo dos palpites.",
    key: "PUNCTUAL",
    rarity: "RARE",
    recommendedScope: "UNIVERSAL",
    title: "Pontual"
  },
  {
    category: "RUNNER_UP",
    crop: { height: 150, width: 150, x: 205, y: 775 },
    description: "Para quem vive entre os primeiros colocados.",
    key: "GUARANTEED_PODIUM",
    rarity: "EPIC",
    recommendedScope: "CHAMPIONSHIP",
    title: "Podio Garantido"
  },
  {
    category: "CUSTOM",
    crop: { height: 150, width: 150, x: 395, y: 775 },
    description: "Para quem usa os coringas com sabedoria.",
    key: "WILDCARD_KING",
    rarity: "EPIC",
    recommendedScope: "UNIVERSAL",
    title: "Rei dos Coringas"
  },
  {
    category: "CUSTOM",
    crop: { height: 150, width: 150, x: 585, y: 775 },
    description: "Para quem tem sorte nos palpites.",
    key: "LUCKY",
    rarity: "RARE",
    recommendedScope: "UNIVERSAL",
    title: "Sortudo"
  },
  {
    category: "MOST_HITS",
    crop: { height: 150, width: 150, x: 765, y: 775 },
    description: "Para quem analisa tudo e acerta com precisao.",
    key: "X_RAY",
    rarity: "EPIC",
    recommendedScope: "UNIVERSAL",
    title: "Raio X"
  },
  {
    category: "CUSTOM",
    crop: { height: 150, width: 155, x: 955, y: 775 },
    description: "Para quem ja fez historia no Bolao do Lobo.",
    key: "LEGENDARY",
    rarity: "LEGENDARY",
    recommendedScope: "UNIVERSAL",
    title: "Lendario"
  },
  {
    category: "CUSTOM",
    crop: { height: 150, width: 155, x: 1140, y: 775 },
    description: "Para os verdadeiros craques do Bolao.",
    key: "DIAMOND",
    rarity: "LEGENDARY",
    recommendedScope: "UNIVERSAL",
    title: "Diamante"
  },
  {
    category: "CUSTOM",
    crop: { height: 150, width: 145, x: 1300, y: 775 },
    description: "Para quem vai para cima sem medo.",
    key: "FIRE_BET",
    rarity: "EPIC",
    recommendedScope: "UNIVERSAL",
    title: "Fogo no Palpite"
  }
] as const satisfies readonly OfficialLeagueEmblem[];

export type OfficialLeagueEmblemKey = (typeof officialLeagueEmblems)[number]["key"];
export type LeagueEmblemScope = "CHAMPIONSHIP" | "UNIVERSAL";

export function getOfficialLeagueEmblem(key: string | null | undefined) {
  return officialLeagueEmblems.find((emblem) => emblem.key === key);
}

export function resolveLeagueEmblem(
  key: string | null | undefined,
  title: string,
  championship: string
) {
  const official = getOfficialLeagueEmblem(key);

  if (official) {
    return official;
  }

  const normalized = `${title} ${championship}`.toLocaleLowerCase("pt-BR");

  if (normalized.includes("libertadores")) return getOfficialLeagueEmblem("LIBERTADORES_CHAMPION")!;
  if (normalized.includes("copa do mundo")) return getOfficialLeagueEmblem("WORLD_CUP_CHAMPION")!;
  if (normalized.includes("brasileir")) return getOfficialLeagueEmblem("BRASILEIRAO_CHAMPION")!;
  if (normalized.includes("placar")) return getOfficialLeagueEmblem("SCORE_MASTER")!;
  if (normalized.includes("acerto") || normalized.includes("mira"))
    return getOfficialLeagueEmblem("X_RAY")!;
  if (normalized.includes("vice")) return getOfficialLeagueEmblem("GUARANTEED_PODIUM")!;
  if (normalized.includes("rodada") || normalized.includes("craque"))
    return getOfficialLeagueEmblem("ROUND_HIGHLIGHT")!;
  if (normalized.includes("const")) return getOfficialLeagueEmblem("REGULARITY")!;
  if (normalized.includes("fair")) return getOfficialLeagueEmblem("FAIR_PLAY")!;
  if (normalized.includes("particip")) return getOfficialLeagueEmblem("LOYAL_WOLF")!;

  return getOfficialLeagueEmblem("LOBAO_DO_BOLAO")!;
}
