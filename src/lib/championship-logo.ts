type ChampionshipLogoSource = {
  apiId?: number | null;
  logo?: string | null;
};

export function getChampionshipLogoSrc(championship: ChampionshipLogoSource) {
  if (championship.apiId) {
    return `/api/championship-logo/${championship.apiId}`;
  }

  const logo = championship.logo?.trim();

  return logo || null;
}
