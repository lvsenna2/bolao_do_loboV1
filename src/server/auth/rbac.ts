import type { UserRole } from "@prisma/client";

const roleWeights: Record<UserRole, number> = {
  USER: 10,
  ORGANIZER: 20,
  MODERATOR: 30,
  ADMIN: 40,
  SUPER_ADMIN: 50
};

export function hasRole(userRole: UserRole, requiredRole: UserRole) {
  return roleWeights[userRole] >= roleWeights[requiredRole];
}

export function canAccessAdmin(userRole: UserRole) {
  return hasRole(userRole, "ADMIN");
}
