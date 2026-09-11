import type {
  LegalAuditResult,
  LegalComparativeRow,
  LegalFaultCategory,
} from "@/lib/services/legal-audit-service";
import { LEGAL_AUDIT_TECHNICAL_MARKER } from "@/lib/services/legal-audit-service";

export type FormattedLegalComparativeRow = {
  userAction: string;
  requiredAction: string;
  isProtected: boolean;
  explanation: string;
  sourceQuote: string;
  temporalRelevance?: string;
  faultCategory?: LegalFaultCategory;
};

export interface FormattedLegalReportDTO {
  isEvaluated: boolean;
  verdictBadge: {
    code:
      | "FULLY_PROTECTED"
      | "PARTIALLY_PROTECTED"
      | "LEGAL_RISK_EXPOSED"
      | "DEFENSIVE_MEDICINE_DETECTED"
      | "NOT_EVALUABLE";
    label: string;
    severity: "success" | "warning" | "danger" | "info";
  };
  compliancePercentage: number;
  summaryText: string;
  executiveSummary: string;
  comparativeAnalysis: FormattedLegalComparativeRow[];
  uncoveredAreas: string[];
}

type LegacyLegalAudit = LegalAuditResult & {
  compliantActions?: Array<{
    performedAction?: string;
    supportingGuidelineRef?: string;
  }>;
  legalOmissionsOrRisks?: Array<{
    missedOrErroneousAction?: string;
    legalRiskDescription?: string;
    educationalTakeaway?: string;
    violatedGuidelineRef?: string;
    exactQuote?: string;
  }>;
};

function isFormattedLegalReportDTO(value: object): value is FormattedLegalReportDTO {
  return (
    "verdictBadge" in value &&
    "comparativeAnalysis" in value &&
    "summaryText" in value &&
    Array.isArray((value as FormattedLegalReportDTO).comparativeAnalysis)
  );
}

function isLegalAuditResult(value: object): value is LegalAuditResult {
  return "overallVerdict" in value && "status" in value && "complianceScore" in value;
}

function clip(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > max ? text.slice(0, max) : text;
}

const FAULT_CATEGORIES: readonly LegalFaultCategory[] = [
  "OTTIMALE",
  "IMPERIZIA_LIEVE",
  "NEGLIGENZA_GRAVE",
  "DIFETTO_CONSENSO",
];

function normalizeFaultCategory(value: unknown): LegalFaultCategory | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toUpperCase().replace(/\s+/g, "_") as LegalFaultCategory;
  return FAULT_CATEGORIES.includes(key) ? key : undefined;
}

function normalizeComparativeRow(row: Partial<LegalComparativeRow> | null | undefined): FormattedLegalComparativeRow | null {
  if (!row || typeof row !== "object") return null;
  const userAction = clip(row.userAction, 400);
  const requiredAction = clip(row.requiredAction, 400);
  if (!userAction && !requiredAction) return null;
  const temporalRelevance = clip(
    "temporalRelevance" in row ? (row as { temporalRelevance?: unknown }).temporalRelevance : "",
    320,
  );
  const faultCategory = normalizeFaultCategory(
    "faultCategory" in row ? (row as { faultCategory?: unknown }).faultCategory : undefined,
  );
  return {
    userAction: userAction || "Non documentato.",
    requiredAction: requiredAction || "Obbligo normativo non esplicitato.",
    isProtected: Boolean(row.isProtected),
    explanation: clip(row.explanation, 600) || "Nessuna spiegazione fornita.",
    sourceQuote: clip(row.sourceQuote, 800),
    ...(temporalRelevance ? { temporalRelevance } : {}),
    ...(faultCategory ? { faultCategory } : {}),
  };
}

function comparativeFromLegacy(audit: LegacyLegalAudit): FormattedLegalComparativeRow[] {
  const rows: FormattedLegalComparativeRow[] = [];
  for (const action of audit.compliantActions ?? []) {
    const mapped = normalizeComparativeRow({
      userAction: action.performedAction,
      requiredAction: action.supportingGuidelineRef,
      isProtected: true,
      explanation: "Adempimento riconosciuto nella traccia precedente.",
      sourceQuote: action.supportingGuidelineRef,
    });
    if (mapped) rows.push(mapped);
  }
  for (const omission of audit.legalOmissionsOrRisks ?? []) {
    const mapped = normalizeComparativeRow({
      userAction: omission.missedOrErroneousAction,
      requiredAction: omission.violatedGuidelineRef,
      isProtected: false,
      explanation: omission.legalRiskDescription || omission.educationalTakeaway,
      sourceQuote: omission.exactQuote,
    });
    if (mapped) rows.push(mapped);
  }
  return rows;
}

function resolveExecutiveSummary(
  audit: LegalAuditResult | LegacyLegalAudit | FormattedLegalReportDTO | null | undefined,
  fallback: string,
): string {
  const fromAudit =
    audit && "executiveSummary" in audit ? clip((audit as { executiveSummary?: unknown }).executiveSummary, 600) : "";
  if (fromAudit) return fromAudit;
  const fromDto =
    audit && "summaryText" in audit ? clip((audit as { summaryText?: unknown }).summaryText, 600) : "";
  return fromDto || fallback;
}

/** Accepts the persisted LLM payload or the API DTO. */
export function coerceLegalReportDto(
  input: FormattedLegalReportDTO | LegalAuditResult | null | undefined,
): FormattedLegalReportDTO | null {
  if (!input || typeof input !== "object") return null;
  if (isFormattedLegalReportDTO(input)) {
    const executiveSummary = resolveExecutiveSummary(input, input.summaryText);
    return { ...input, executiveSummary, summaryText: executiveSummary || input.summaryText };
  }
  if (isLegalAuditResult(input)) return mapLegalAuditToDTO(input);
  return null;
}

export function legalCompliancePercentFromAudit(
  input: FormattedLegalReportDTO | LegalAuditResult | null | undefined,
): number | null {
  const dto = coerceLegalReportDto(input);
  if (!dto) return null;
  const n = Number(dto.compliancePercentage);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

export function mapLegalAuditToDTO(
  legalAudit?: LegalAuditResult | LegacyLegalAudit | null,
): FormattedLegalReportDTO {
  if (
    !legalAudit ||
    legalAudit.status === "NOT_EVALUABLE_NO_SOURCES" ||
    legalAudit.overallVerdict === "NOT_EVALUABLE"
  ) {
    return {
      isEvaluated: false,
      verdictBadge: {
        code: "NOT_EVALUABLE",
        label: legalAudit?.uncoveredAreas?.includes(LEGAL_AUDIT_TECHNICAL_MARKER)
          ? "NON VALUTABILE (indisponibilità tecnica)"
          : "NON VALUTABILE (Fonti non presenti per la specialità)",
        severity: "info",
      },
      compliancePercentage: 0,
      summaryText: resolveExecutiveSummary(
        legalAudit,
        "Per questa specialità/caso non sono stati ancora caricati documenti di tutela legale o linee guida accreditate sul database di sistema.",
      ),
      executiveSummary: resolveExecutiveSummary(
        legalAudit,
        "Perizia non eseguibile: manca il corpus normativo di riferimento. Nessuna tutela Gelli-Bianco può essere certificata.",
      ),
      comparativeAnalysis: Array.isArray(legalAudit?.comparativeAnalysis)
        ? legalAudit.comparativeAnalysis
            .map((row) => normalizeComparativeRow(row))
            .filter((row): row is FormattedLegalComparativeRow => Boolean(row))
        : [],
      uncoveredAreas: legalAudit?.uncoveredAreas || [
        "Nessuna fonte di riferimento trovata con soglia di pertinenza >= 0.70.",
      ],
    };
  }

  let badgeLabel = "TUTELATO";
  let severity: "success" | "warning" | "danger" | "info" = "success";

  if (legalAudit.overallVerdict === "PARTIALLY_PROTECTED") {
    badgeLabel = "PARZIALMENTE TUTELATO";
    severity = "warning";
  } else if (legalAudit.overallVerdict === "LEGAL_RISK_EXPOSED") {
    badgeLabel = "ESPOSTO A RISCHIO LEGALE";
    severity = "danger";
  } else if (legalAudit.overallVerdict === "DEFENSIVE_MEDICINE_DETECTED") {
    badgeLabel = "MEDICINA DIFENSIVA RILEVATA";
    severity = "warning";
  }

  const comparativeAnalysis =
    Array.isArray(legalAudit.comparativeAnalysis) && legalAudit.comparativeAnalysis.length > 0
      ? legalAudit.comparativeAnalysis
          .map((row) => normalizeComparativeRow(row))
          .filter((row): row is FormattedLegalComparativeRow => Boolean(row))
      : comparativeFromLegacy(legalAudit);

  const score = Math.max(0, Math.min(100, Number(legalAudit.complianceScore) || 0));
  const protectedCount = comparativeAnalysis.filter((row) => row.isProtected).length;
  const fallbackSummary = `Aderenza ${score}% al corpus Gelli-Bianco (${protectedCount}/${comparativeAnalysis.length || 0} confronti tutelati).`;
  const executiveSummary = resolveExecutiveSummary(legalAudit, fallbackSummary);

  return {
    isEvaluated: true,
    verdictBadge: {
      code: legalAudit.overallVerdict,
      label: badgeLabel,
      severity,
    },
    compliancePercentage: score,
    summaryText: executiveSummary,
    executiveSummary,
    comparativeAnalysis,
    uncoveredAreas: legalAudit.uncoveredAreas || [],
  };
}
