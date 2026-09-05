/** Compact accession printed under the barcode (Code 39-safe). */
export function reportAccessionCode(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
  return `AQ${compact || "REFERTO"}`;
}

export function reportSharePath(sessionId: string): string {
  return `/referto/${encodeURIComponent(sessionId)}`;
}

export function reportShareUrl(sessionId: string, origin?: string): string {
  const base = (origin || "").replace(/\/$/, "");
  return `${base}${reportSharePath(sessionId)}`;
}

export function reportWhatsAppShareHref(shareUrl: string): string {
  const text = `Ho appena completato un caso su AEQUAN. Ecco il Referto di valutazione:\n${shareUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
