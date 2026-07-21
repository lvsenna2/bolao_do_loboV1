export const leagueEmblemCategories = [
  { key: "CHAMPION", badgeKey: "LEAGUE_CHAMPION", label: "Campeao", defaultTitle: "Campeao" },
  {
    key: "RUNNER_UP",
    badgeKey: "LEAGUE_RUNNER_UP",
    label: "Vice-campeao",
    defaultTitle: "Vice-campeao"
  },
  { key: "MOST_HITS", badgeKey: "MOST_HITS", label: "Mais acertos", defaultTitle: "Mira Certeira" },
  {
    key: "MOST_EXACT_SCORES",
    badgeKey: "MOST_EXACT_SCORES",
    label: "Mais placares exatos",
    defaultTitle: "Mestre do Placar"
  },
  {
    key: "ROUND_STAR",
    badgeKey: "ROUND_STAR",
    label: "Destaque da rodada",
    defaultTitle: "Craque da Rodada"
  },
  {
    key: "CONSISTENCY",
    badgeKey: "CONSISTENCY",
    label: "Maior constancia",
    defaultTitle: "Constancia de Ouro"
  },
  {
    key: "PARTICIPATION",
    badgeKey: "PARTICIPATION",
    label: "Participacao",
    defaultTitle: "Presenca Marcante"
  },
  { key: "FAIR_PLAY", badgeKey: "FAIR_PLAY", label: "Fair play", defaultTitle: "Fair Play" },
  {
    key: "CUSTOM",
    badgeKey: "CUSTOM_RECOGNITION",
    label: "Premio personalizado",
    defaultTitle: "Reconhecimento Especial"
  }
] as const;

export const leagueEmblemStyles = [
  { key: "MEDAL", label: "Medalha" },
  { key: "SHIELD", label: "Escudo" },
  { key: "SEAL", label: "Selo" },
  { key: "RIBBON", label: "Faixa" }
] as const;

export const leagueEmblemIcons = [
  { key: "TROPHY", label: "Taca" },
  { key: "CROWN", label: "Coroa" },
  { key: "TARGET", label: "Alvo" },
  { key: "STAR", label: "Estrela" },
  { key: "AWARD", label: "Premio" },
  { key: "SHIELD", label: "Escudo" }
] as const;

export const leagueEmblemColors = [
  { value: "#F4B41A", label: "Dourado" },
  { value: "#D8DEE9", label: "Prata" },
  { value: "#CD7F32", label: "Bronze" },
  { value: "#22C55E", label: "Esmeralda" },
  { value: "#38BDF8", label: "Safira" },
  { value: "#A855F7", label: "Ametista" },
  { value: "#EF4444", label: "Rubi" }
] as const;

export type LeagueEmblemCategory = (typeof leagueEmblemCategories)[number]["key"];
export type LeagueEmblemStyle = (typeof leagueEmblemStyles)[number]["key"];
export type LeagueEmblemIcon = (typeof leagueEmblemIcons)[number]["key"];

export function getLeagueEmblemCategory(category: LeagueEmblemCategory) {
  return leagueEmblemCategories.find((item) => item.key === category) ?? leagueEmblemCategories[8];
}
