const LINEUP_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function shouldReuseSpecialRoundLineup({
  complete,
  now,
  syncedAt
}: {
  complete: boolean;
  now: Date;
  syncedAt: Date | null;
}) {
  return (
    complete && syncedAt !== null && now.getTime() - syncedAt.getTime() < LINEUP_REFRESH_INTERVAL_MS
  );
}
