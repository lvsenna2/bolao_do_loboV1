export type MatchLegRole = "IDA" | "VOLTA";

type TwoLegCandidate = {
  awayTeam: { id: string };
  homeTeam: { id: string };
  id: string;
  kickoff: Date | string;
};

function kickoffTime(match: TwoLegCandidate) {
  return new Date(match.kickoff).getTime();
}

export function identifyTwoLegMatches(matches: TwoLegCandidate[]) {
  const roles = new Map<string, MatchLegRole>();
  const paired = new Set<string>();
  const ordered = [...matches].sort(
    (left, right) => kickoffTime(left) - kickoffTime(right) || left.id.localeCompare(right.id)
  );

  for (const first of ordered) {
    if (paired.has(first.id)) continue;

    const returnLeg = ordered.find(
      (candidate) =>
        !paired.has(candidate.id) &&
        candidate.id !== first.id &&
        candidate.homeTeam.id === first.awayTeam.id &&
        candidate.awayTeam.id === first.homeTeam.id
    );

    if (!returnLeg) continue;

    roles.set(first.id, "IDA");
    roles.set(returnLeg.id, "VOLTA");
    paired.add(first.id);
    paired.add(returnLeg.id);
  }

  return roles;
}
