/**
 * Closed university pilot — single source of truth for tester emails.
 * Access is case-insensitive (trim + lowercase). Platform admins are gated separately.
 */

export const UNAUTHORIZED_PILOT_EMAIL_CODE = "UNAUTHORIZED_PILOT_EMAIL";

export const PILOT_ACCESS_DENIED_MESSAGE =
  "Accesso riservato. La tua email non è inclusa nella lista dei partecipanti.";

/** Lifetime CaseSession cap for authorized university testers (not admins). */
export const PILOT_SIMULATION_CAP = 3;

export const PILOT_CAP_CODE = "PILOT_CAP";

export const PILOT_CAP_MESSAGE =
  "Hai raggiunto il limite di 3 simulazioni previsto per il pilota universitario.";

export const PILOT_ALLOWED_EMAILS = [
  "pirozzi.ludmilla@gmail.com",
  "feras.elballouz@edu.unito.it",
  "shamsadnan654@gmail.com",
  "ilariadema8@gmail.com",
  "taranom.poursartip@studenti.unipr.it",
  "michaelgsantonocito@gmail.com",
  "ariannaallegretti2003@gmail.com",
  "alessiocuri2003@gmail.com",
  "chiaramartino28@gmail.com",
  "aristidedifuccia003@gmail.com",
  "fpisani2005@gmail.com",
  "chinosialessandro@gmail.com",
  "m.berardi2002@gmail.com",
  "davide.merlo02@gmail.com",
].map((email) => email.toLowerCase().trim());

const PILOT_ALLOWED_SET = new Set(PILOT_ALLOWED_EMAILS);

export function normalizePilotEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}

export function isPilotAllowedEmail(email: string | null | undefined): boolean {
  const normalized = normalizePilotEmail(email);
  return normalized.length > 0 && PILOT_ALLOWED_SET.has(normalized);
}
