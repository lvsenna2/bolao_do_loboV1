export const MAINTENANCE_ENDS_AT = new Date("2026-09-01T03:00:00.000Z");

export function isMaintenanceActive(now = new Date()) {
  return now < MAINTENANCE_ENDS_AT;
}
