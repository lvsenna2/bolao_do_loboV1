type TeamLogoSource = {
  apiId?: number | null;
  logo?: string | null;
};

export function getTeamLogoSrc(team: TeamLogoSource) {
  if (team.apiId) {
    return `/api/team-logo/${team.apiId}`;
  }

  const logo = team.logo?.trim();

  return logo || null;
}
