/**
 * Hard-coded platform operators. Always treated as ADMIN (beta + /admin).
 * Keep this list short — prefer promoting other users via the admin UI / scripts.
 */
export const PLATFORM_ADMIN_EMAILS = [
  "dario.barbagallo46@gmail.com",
  "chris01.ugo@gmail.com",
] as const;

const PLATFORM_ADMIN_SET = new Set(
  PLATFORM_ADMIN_EMAILS.map((e) => e.toLowerCase()),
);

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_SET.has(email.trim().toLowerCase());
}
