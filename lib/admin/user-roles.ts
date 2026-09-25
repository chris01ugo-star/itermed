export const ADMIN_ASSIGNABLE_ROLES = [
  "STUDENT",
  "SPECIALIZZANDO",
  "MEDICO",
  "ADMIN",
] as const;

export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number];

export function isAdminAssignableRole(role: string): role is AdminAssignableRole {
  return (ADMIN_ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

export function userRoleLabel(role: string): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "MEDICO":
    case "INSTRUCTOR":
      return "Medico";
    case "SPECIALIZZANDO":
      return "Specializzando";
    default:
      return "Studente";
  }
}
