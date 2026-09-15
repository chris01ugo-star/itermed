/**
 * Structured prescription log injected into chat / rawTrace for LLM evaluation.
 */

export const PRESCRIPTION_TRACE_PREFIX = "[AZIONE_MEDICA: PRESCRIZIONE]";

export const ADMINISTRATION_ROUTES = [
  "orale",
  "endovenosa",
  "intramuscolare",
  "sottocutanea",
  "inalatoria",
  "sublinguale",
  "transdermica",
  "rettale",
  "topica",
] as const;

export type AdministrationRoute = (typeof ADMINISTRATION_ROUTES)[number];

export type PrescriptionMedicationFields = {
  commercialName: string;
  activeIngredient: string;
  dosageForm: string;
  price: number;
  route: string;
  posology: string;
};

export type SessionPrescription = PrescriptionMedicationFields & {
  id: string;
  category: string;
  route: AdministrationRoute;
  aifaBand?: string;
  trace: string;
  prescribedAt: string;
};

export function isAdministrationRoute(value: string): value is AdministrationRoute {
  return (ADMINISTRATION_ROUTES as readonly string[]).includes(value);
}

export function formatSsnPrice(price: number): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
}

/** Canonical chronological log line sent to the evaluation LLM / rawTrace. */
export function formatPrescriptionTrace(med: PrescriptionMedicationFields): string {
  return (
    `${PRESCRIPTION_TRACE_PREFIX} L'utente ha prescritto ${med.commercialName.trim()} ` +
    `(${med.activeIngredient.trim()}) ${med.dosageForm.trim()} - ` +
    `Via: ${med.route.trim()} - Posologia: ${med.posology.trim()} - ` +
    `Costo SSN impattato: ${formatSsnPrice(med.price)}€.`
  );
}

export function isPrescriptionTrace(content: string | null | undefined): boolean {
  return typeof content === "string" && content.trim().startsWith(PRESCRIPTION_TRACE_PREFIX);
}

export function parseSessionPrescriptions(raw: unknown): SessionPrescription[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionPrescription[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const route = typeof r.route === "string" ? r.route : "";
    if (!isAdministrationRoute(route)) continue;
    if (typeof r.id !== "string" || !r.id.trim()) continue;
    if (typeof r.commercialName !== "string" || !r.commercialName.trim()) continue;
    if (typeof r.activeIngredient !== "string") continue;
    if (typeof r.dosageForm !== "string") continue;
    const price = Number(r.price);
    if (!Number.isFinite(price)) continue;
    const posology =
      typeof r.posology === "string" && r.posology.trim() ? r.posology.trim() : "n.p.";
    const fields = {
      commercialName: r.commercialName.trim(),
      activeIngredient: String(r.activeIngredient).trim(),
      dosageForm: String(r.dosageForm).trim(),
      price,
      route,
      posology,
    };
    const trace =
      typeof r.trace === "string" && r.trace.trim()
        ? r.trace.trim()
        : formatPrescriptionTrace(fields);
    out.push({
      id: r.id.trim(),
      ...fields,
      route,
      category: typeof r.category === "string" ? r.category : "",
      aifaBand: typeof r.aifaBand === "string" ? r.aifaBand : undefined,
      trace,
      prescribedAt:
        typeof r.prescribedAt === "string" && r.prescribedAt
          ? r.prescribedAt
          : new Date().toISOString(),
    });
  }
  return out;
}

export function mergePrescriptionTracesIntoChat(
  chatHistory: Array<{ role: string; content: string }>,
  prescriptions: SessionPrescription[],
): Array<{ role: "user" | "assistant"; content: string }> {
  const existing = new Set(
    chatHistory
      .filter((m) => typeof m.content === "string")
      .map((m) => m.content.trim()),
  );
  const merged: Array<{ role: "user" | "assistant"; content: string }> = chatHistory
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content }));

  for (const rx of prescriptions) {
    if (!rx.trace || existing.has(rx.trace)) continue;
    merged.push({ role: "user", content: rx.trace });
    existing.add(rx.trace);
  }
  return merged;
}
