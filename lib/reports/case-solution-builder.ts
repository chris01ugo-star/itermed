/**
 * Soluzione completa del caso per il solo report post-simulazione autenticato.
 * Non va mai inserita nel payload di gioco né nel referto pubblico.
 */

export type CaseSolutionExam = {
  examId?: string;
  id?: string;
  name?: string;
};

export type CaseSolutionSource = {
  id?: string | null;
  title?: string | null;
  diagnosis?: string | null;
  condition?: string | null;
  correctSolution?: string | null;
  goldPathNarrative?: string | null;
  goldStandardPath?: string[] | null;
  mandatoryExams?: CaseSolutionExam[] | null;
  escCitations?: Array<{ source?: string; title?: string; quote?: string; chunkId?: string }> | null;
  auditMetrics?: {
    mandatoryExams?: CaseSolutionExam[] | null;
    escCitations?: Array<{ source?: string; title?: string; quote?: string }> | null;
    gelliBiancoShield?: {
      art5Adherence?: string;
      legalCriteria?: string[];
    } | null;
  } | null;
  legalConformity?: {
    criteria?: Array<{ description?: string }> | null;
    ragReferences?: Array<{ sourceRef?: string; articles?: string | string[] }> | null;
  } | null;
  baselineExamFindings?: {
    goldTherapy?: unknown;
    therapyMatrix?: unknown;
  } | null;
};

export type CaseSolutionPayload = {
  diagnosis: string;
  rationale: string;
  goldSteps: string[];
  keyExams: string[];
  therapy: string;
  legalReferences: string[];
};

function tidy(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function examLabel(exam: CaseSolutionExam): string {
  return tidy(exam.name) || tidy(exam.examId) || tidy(exam.id);
}

function therapyText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return tidy(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return tidy(item);
        if (!item || typeof item !== "object") return "";
        const row = item as Record<string, unknown>;
        return [row.drug, row.name, row.principle, row.dose, row.posology, row.note]
          .map(tidy)
          .filter(Boolean)
          .join(" ");
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    const lines = Object.entries(row)
      .map(([key, item]) => {
        const text = therapyText(item);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean);
    return lines.join("; ");
  }
  return "";
}

export function buildCaseSolutionPayload(
  source: CaseSolutionSource | null | undefined,
  traceFallback?: string | null,
): CaseSolutionPayload {
  const row = source ?? {};
  const fallback = tidy(traceFallback);
  const diagnosis =
    tidy(row.diagnosis) ||
    tidy(row.condition) ||
    tidy(row.correctSolution).split(/[.]/)[0]?.trim() ||
    fallback.split(/[.]/)[0]?.trim() ||
    tidy(row.title) ||
    tidy(row.id) ||
    "Diagnosi di riferimento non indicata nel fascicolo";

  const steps = (row.goldStandardPath ?? []).map((step) => tidy(step)).filter(Boolean);
  const narrative = tidy(row.goldPathNarrative) || tidy(row.correctSolution) || fallback;
  const rationale = [narrative, steps.length ? `Passi: ${steps.join(" → ")}` : ""]
    .filter(Boolean)
    .join(" ")
    .trim() || diagnosis;

  const exams = [
    ...(row.mandatoryExams ?? []),
    ...(row.auditMetrics?.mandatoryExams ?? []),
  ]
    .map(examLabel)
    .filter(Boolean);

  const therapy =
    therapyText(row.baselineExamFindings?.therapyMatrix) ||
    therapyText(row.baselineExamFindings?.goldTherapy);

  const citations = [
    ...(row.escCitations ?? []),
    ...(row.auditMetrics?.escCitations ?? []),
  ].map((item) => [tidy(item.title), tidy(item.source), tidy(item.quote)].filter(Boolean).join(" — "));
  const shield = row.auditMetrics?.gelliBiancoShield;
  const legal = [
    tidy(shield?.art5Adherence),
    ...(shield?.legalCriteria ?? []).map(tidy),
    ...(row.legalConformity?.criteria ?? []).map((item) => tidy(item.description)),
      ...(row.legalConformity?.ragReferences ?? []).map((item) =>
      [tidy(item.sourceRef), Array.isArray(item.articles) ? item.articles.map(tidy).filter(Boolean).join(", ") : tidy(item.articles)]
        .filter(Boolean)
        .join(" "),
    ),
    ...citations,
  ].filter(Boolean);

  return {
    diagnosis,
    rationale,
    goldSteps: [...new Set(steps)],
    keyExams: [...new Set(exams)],
    therapy,
    legalReferences: [...new Set(legal)].slice(0, 8),
  };
}

export function caseSolutionIsComplete(payload: CaseSolutionPayload): boolean {
  return payload.diagnosis.trim().length >= 2 && payload.rationale.trim().length >= 2;
}
