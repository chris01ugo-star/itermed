import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const REFERRAL_CODE_PREFIX = "AEQUAN-";
export const REFERRAL_CODE_BODY_LENGTH = 5;
export const REFERRAL_CODE_PATTERN = /^AEQUAN-[A-Z2-9]{5}$/;

export function generateReferralCode(): string {
  const bytes = randomBytes(REFERRAL_CODE_BODY_LENGTH);
  let body = "";
  for (let i = 0; i < REFERRAL_CODE_BODY_LENGTH; i += 1) {
    body += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `${REFERRAL_CODE_PREFIX}${body}`;
}

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return null;
  const withPrefix = trimmed.startsWith("AEQUAN-") ? trimmed : `AEQUAN-${trimmed}`;
  if (!REFERRAL_CODE_PATTERN.test(withPrefix)) return null;
  return withPrefix;
}
