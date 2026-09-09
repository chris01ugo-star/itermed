/**
 * Hard-coded platform operators. Always treated as ADMIN (beta + /admin).
 * Keep this list short — prefer promoting other users via the admin UI / scripts.
 *
 * Gmail dots are ignored for matching (dariobarbagallo46 ≡ dario.barbagallo46).
 */
export const PLATFORM_ADMIN_EMAILS = [
  "dariobarbagallo46@gmail.com",
  "dario.barbagallo46@gmail.com",
  "chris01.ugo@gmail.com",
  "chris01ugo@gmail.com",
] as const;

/** Normalize for admin match: lowercase, Gmail dots/+aliases collapsed. */
export function normalizeEmailForMatch(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0]?.replace(/\./g, "") ?? local;
  }
  return `${local}@${domain}`;
}

const PLATFORM_ADMIN_SET = new Set(
  PLATFORM_ADMIN_EMAILS.map((e) => normalizeEmailForMatch(e)),
);

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_SET.has(normalizeEmailForMatch(email));
}
