import { isPlatformAdminEmail } from "@/lib/auth/platform-admins";

export const MUST_CHANGE_PASSWORD_PATH = "/account/password";
export const MUST_CHANGE_PASSWORD_CODE = "MUST_CHANGE_PASSWORD";
export const MIN_NEW_PASSWORD_LENGTH = 8;

export const MUST_CHANGE_PASSWORD_MESSAGE =
  "Devi impostare una nuova password prima di continuare.";

type PasswordGateUser = {
  mustChangePassword?: boolean | null;
  email?: string | null;
};

/** Platform operators are never blocked; everyone else is gated by the DB flag. */
export function shouldForcePasswordChange(user: PasswordGateUser): boolean {
  if (isPlatformAdminEmail(user.email)) return false;
  return user.mustChangePassword === true;
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
