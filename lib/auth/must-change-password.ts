import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";
import { isPilotAllowedEmail } from "@/lib/pilot-whitelist";

export const MUST_CHANGE_PASSWORD_PATH = "/account/password";
export const MUST_CHANGE_PASSWORD_CODE = "MUST_CHANGE_PASSWORD";
export const MIN_NEW_PASSWORD_LENGTH = 8;

export const MUST_CHANGE_PASSWORD_MESSAGE =
  "Devi impostare una nuova password prima di continuare.";

const PROVISIONED_PLAN_TYPES = new Set(["INVITED", "BETA_TESTER"]);

type PasswordGateUser = {
  mustChangePassword?: boolean | null;
  passwordChangedAt?: Date | string | null;
  planType?: string | null;
  email?: string | null;
};

/** Admin-created accounts, beta testers, and the university pilot list. */
export function isProvisionedOrBetaTesterAccount(user: {
  planType?: string | null;
  email?: string | null;
}): boolean {
  if (isPlatformAdminEmail(user.email)) return false;
  const plan = (user.planType ?? "").trim().toUpperCase();
  if (PROVISIONED_PLAN_TYPES.has(plan)) return true;
  return isPilotAllowedEmail(user.email);
}

/**
 * Platform operators are never blocked.
 * After the user completes `/account/password`, `passwordChangedAt` keeps the gate off.
 * Everyone else with the flag, or an admin-provisioned / beta account, is blocked.
 */
export function shouldForcePasswordChange(user: PasswordGateUser): boolean {
  if (isPlatformAdminEmail(user.email)) return false;
  if (user.passwordChangedAt) return false;
  if (user.mustChangePassword === true) return true;
  return isProvisionedOrBetaTesterAccount(user);
}

export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_NEW_PASSWORD_LENGTH) {
    return "La nuova password deve avere almeno 8 caratteri.";
  }
  if (password !== confirm) {
    return "Le password non coincidono.";
  }
  return null;
}
