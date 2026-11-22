/**
 * Canonical simulation trace for every evaluator.
 * Persisted session fields win over the closing client payload.
 * The gold diagnosis is used only to set a boolean and is never copied out.
 */

export type TraceChatTurn = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type TracePhysicalExam = {
  id: string;
  name: string;
  finding: string;
};

export type TraceDiagnosticExam = {
  id: string;
  name: string;
  costEuro: number;
  summary: string;
  isAbnormal: boolean | null;
  formattedText: string;
  classification: "indicato" | "appropriato" | "ridondante" | "inappropriato" | "controindicato";
};

export type TracePrescription = {
  commercialName: string;
  activeIngredient: string;
  route: string;
  posology: string;
  price: number;
  valid: boolean;
};

export type TraceStressEvent = {
  atMinute: number;
  stress: number;
  delta: number;
  reason: string;
  category: string;
};

export type UnifiedSimulationTrace = {
  transcript: string;
  physicalExams: TracePhysicalExam[];
  diagnosticExams: TraceDiagnosticExam[];
  omittedIndicatedExams: string[];
  prescriptions: TracePrescription[];
  informedConsent: { collected: boolean; evidence: string };
  dischargeNote: { text: string; valid: boolean };
  diagnosis: {
    entered: string;
    failedAttempts: number;
    matchesReference: boolean | null;
  };
  timing: { elapsedMinutes: number | null; timeLimitMinutes: number | null };
  stress: {
    initialStress: number | null;
    finalStress: number | null;
    peakStress: number | null;
    timeline: TraceStressEvent[];
  };
};

export type ClinicalMatrix = {
  physicalExams: {
    performed: TracePhysicalExam[];
    omittedKey: string[];
  };
  diagnosticExams: {
    requested: TraceDiagnosticExam[];
    omittedIndicated: string[];
  };
  therapies: {
    prescribed: TracePrescription[];
    omittedIndicated: string[];
  };
  stressSummary: UnifiedSimulationTrace["stress"] & { empathyImpact: string };
};

const DISCHARGE_MIN_CHARS = 15;

function clean(value: unknown, max = 400): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function formatTraceTranscript(chat: TraceChatTurn[]): string {
  return chat
    .filter((turn) => turn.role === "user" || turn.role === "assistant")
    .map((turn) => {
      const speaker = turn.role === "user" ? "[MEDICO]" : "[PAZIENTE]";
      return `${speaker} ${clean(turn.content, 1500)}`;
    })
    .filter((line) => line.length > speakerMin())
    .join("\n");
}

function speakerMin(): number {
  return "[MEDICO] ".length;
}

function readOverrides(
  raw: unknown,
): Map<string, { summary: string; isAbnormal: boolean | null; formattedText: string }> {
  const map = new Map<string, { summary: string; isAbnormal: boolean | null; formattedText: string }>();
  const record = asRecord(raw);
  if (!record) return map;
  for (const [id, value] of Object.entries(record)) {
    const row = asRecord(value);
    if (!row) continue;
    const summary = clean(row.summary, 360);
    const formatted = clean(row.formattedText, 360);
    map.set(id, {
      summary,
      isAbnormal: typeof row.isAbnormal === "boolean" ? row.isAbnormal : null,
      formattedText: formatted || summary,
    });
  }
  return map;
}

function readTimeline(raw: unknown): TraceStressEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: TraceStressEvent[] = [];
  for (const row of raw) {
    const item = asRecord(row);
    if (!item) continue;
    const stress = Number(item.stress);
    if (!Number.isFinite(stress)) continue;
    events.push({
      atMinute: Number.isFinite(Number(item.atMinute)) ? Number(item.atMinute) : 0,
      stress: Math.max(0, Math.min(100, Math.round(stress))),
      delta: Number.isFinite(Number(item.delta)) ? Number(item.delta) : 0,
      reason: clean(item.reason, 180),
      category: clean(item.category, 40) || "communication",
    });
  }
  return events.slice(-40);
}

function classifyExam(id: string, indicated: Set<string>, inappropriate: Set<string>, fatal: Set<string>): TraceDiagnosticExam["classification"] {
  const key = id.trim().toLowerCase();
  if (fatal.has(key)) return "controindicato";
  if (inappropriate.has(key)) return "inappropriato";
  if (indicated.has(key)) return "indicato";
  return "appropriato";
}

function norm(id: string): string {
  return id.trim().toLowerCase().replace(/_/g, "-");
}

export function buildUnifiedSimulationTrace(input: {
  chatHistory: TraceChatTurn[];
  physicalExams?: TracePhysicalExam[] | null;
  requestedExamIds?: string[] | null;
  exams?: Array<{ id?: string; name?: string; cost?: number }> | null;
  examOverrides?: unknown;
  indicatedExamIds?: string[] | null;
  inappropriateExamIds?: string[] | null;
  fatalExamIds?: string[] | null;
  prescriptions?: Array<{
    commercialName?: string;
    activeIngredient?: string;
    route?: string;
    posology?: string;
    price?: number;
  }> | null;
  informedConsent?: boolean;
  consentEvidence?: string | null;
  dischargeNote?: string | null;
  diagnosisEntered?: string | null;
  failedDiagnosisAttempts?: number | null;
  correctSolution?: string | null;
  elapsedMinutes?: number | null;
  timeLimitMinutes?: number | null;
  initialStress?: number | null;
  finalStress?: number | null;
  stressTimeline?: unknown;
}): UnifiedSimulationTrace {
  const indicated = new Set((input.indicatedExamIds ?? []).map(norm));
  const inappropriate = new Set((input.inappropriateExamIds ?? []).map(norm));
  const fatal = new Set((input.fatalExamIds ?? []).map(norm));
  const overrides = readOverrides(input.examOverrides);
  const catalog = new Map(
    (input.exams ?? [])
      .filter((exam) => exam.id)
      .map((exam) => [norm(String(exam.id)), exam] as const),
  );

  const requestedIds = [...new Set((input.requestedExamIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const diagnosticExams: TraceDiagnosticExam[] = requestedIds.map((id) => {
    const key = norm(id);
    const exam = catalog.get(key);
    const report = overrides.get(id) ?? overrides.get(key);
    return {
      id,
      name: clean(exam?.name, 160) || id,
      costEuro: Number.isFinite(Number(exam?.cost)) ? Number(exam?.cost) : 0,
      summary: report?.summary ?? "",
      isAbnormal: report?.isAbnormal ?? null,
      formattedText: report?.formattedText ?? "",
      classification: classifyExam(key, indicated, inappropriate, fatal),
    };
  });

  const requestedKeys = new Set(requestedIds.map(norm));
  const omittedIndicatedExams = [...indicated].filter((id) => !requestedKeys.has(id));

  const physicalExams = (input.physicalExams ?? [])
    .map((exam) => ({
      id: clean(exam.id, 80),
      name: clean(exam.name, 160) || clean(exam.id, 80),
      finding: clean(exam.finding, 400),
    }))
    .filter((exam) => exam.id);

  const prescriptions: TracePrescription[] = (input.prescriptions ?? [])
    .map((rx) => ({
      commercialName: clean(rx.commercialName, 120),
      activeIngredient: clean(rx.activeIngredient, 120),
      route: clean(rx.route, 40),
      posology: clean(rx.posology, 120),
      price: Number.isFinite(Number(rx.price)) ? Number(rx.price) : 0,
      valid: Boolean(clean(rx.commercialName, 120) && clean(rx.posology, 120) && clean(rx.route, 40)),
    }))
    .filter((rx) => rx.commercialName);

  const discharge = clean(input.dischargeNote, 4000);
  const entered = clean(input.diagnosisEntered, 400);
  const reference = clean(input.correctSolution, 400);
  const matchesReference = !entered || !reference ? null : norm(entered) === norm(reference);
  const timeline = readTimeline(input.stressTimeline);
  const stresses = timeline.map((event) => event.stress);
  const finalStress =
    input.finalStress == null || !Number.isFinite(input.finalStress)
      ? stresses.length > 0
        ? stresses[stresses.length - 1]
        : null
      : Math.round(input.finalStress);
  const initialStress =
    input.initialStress == null || !Number.isFinite(input.initialStress)
      ? stresses.length > 0
        ? stresses[0]
        : null
      : Math.round(input.initialStress);

  return {
    transcript: formatTraceTranscript(input.chatHistory),
    physicalExams,
    diagnosticExams,
    omittedIndicatedExams,
    prescriptions,
    informedConsent: {
      collected: input.informedConsent === true,
      evidence: clean(input.consentEvidence, 240) || (input.informedConsent ? "Modulo o milestone di consenso registrati." : "Consenso non registrato."),
    },
    dischargeNote: {
      text: discharge,
      valid: discharge.length >= DISCHARGE_MIN_CHARS,
    },
    diagnosis: {
      entered,
      failedAttempts: Math.max(0, Math.floor(Number(input.failedDiagnosisAttempts) || 0)),
      matchesReference,
    },
    timing: {
      elapsedMinutes:
        input.elapsedMinutes == null || !Number.isFinite(input.elapsedMinutes)
          ? null
          : Math.max(0, Math.round(input.elapsedMinutes)),
      timeLimitMinutes:
        input.timeLimitMinutes == null || !Number.isFinite(input.timeLimitMinutes)
          ? null
          : Math.max(0, Math.round(input.timeLimitMinutes)),
    },
    stress: {
      initialStress,
      finalStress,
      peakStress: stresses.length > 0 ? Math.max(...stresses) : finalStress,
      timeline,
    },
  };
}

export function formatUnifiedTraceForPrompt(trace: UnifiedSimulationTrace): string {
  const exams = trace.diagnosticExams
    .map((exam) => {
      const flag = exam.isAbnormal == null ? "" : exam.isAbnormal ? " alterato" : " nei limiti";
      const report = exam.summary || exam.formattedText || "referto non disponibile";
      return `- ${exam.name} (${exam.classification}${flag}): ${report}`;
    })
    .join("\n");
  const maneuvers = trace.physicalExams
    .map((exam) => `- ${exam.name}: ${exam.finding || "reperto non descritto"}`)
    .join("\n");
  const drugs = trace.prescriptions
    .map((rx) => `- ${rx.commercialName} via ${rx.route}, ${rx.posology}, SSN ${rx.price.toFixed(2)}€`)
    .join("\n");
  return [
    "TRASCRIZIONE",
    trace.transcript || "Nessun dialogo persistito.",
    "ESAME OBIETTIVO",
    maneuvers || "Nessuna manovra registrata.",
    "ESAMI E REFERTI",
    exams || "Nessun esame richiesto.",
    "PRESCRIZIONI",
    drugs || "Nessun farmaco prescritto.",
    "DIARIO DI DIMISSIONE",
    trace.dischargeNote.valid ? trace.dischargeNote.text : "Diario assente o più corto di 15 caratteri.",
    `CONSENSO: ${trace.informedConsent.collected ? "raccolto" : "non raccolto"}`,
    `TEMPO: ${trace.timing.elapsedMinutes ?? "n.d."} min / limite ${trace.timing.timeLimitMinutes ?? "n.d."}`,
    `STRESS: iniziale ${trace.stress.initialStress ?? "n.d."}, finale ${trace.stress.finalStress ?? "n.d."}, picco ${trace.stress.peakStress ?? "n.d."}`,
  ].join("\n");
}

export function buildClinicalMatrix(
  trace: UnifiedSimulationTrace,
  options?: { omittedTherapies?: string[]; omittedManeuvers?: string[]; empathyImpact?: string },
): ClinicalMatrix {
  return {
    physicalExams: {
      performed: trace.physicalExams,
      omittedKey: options?.omittedManeuvers ?? [],
    },
    diagnosticExams: {
      requested: trace.diagnosticExams,
      omittedIndicated: trace.omittedIndicatedExams,
    },
    therapies: {
      prescribed: trace.prescriptions,
      omittedIndicated: options?.omittedTherapies ?? [],
    },
    stressSummary: {
      ...trace.stress,
      empathyImpact:
        options?.empathyImpact ??
        (trace.stress.finalStress != null && trace.stress.finalStress >= 80
          ? "Stress finale ≥ 80: penalità relazionale critica."
          : "Stress sotto la soglia critica: nessuna penalità di crisi."),
    },
  };
}

/** Public referto fields. The reference diagnosis is not part of this view. */
export function toPublicRefertoFields(trace: Record<string, unknown>): {
  scoreWaterfall: unknown;
  clinicalMatrix: unknown;
  guidelineEvidence: unknown;
  helpTelemetry: unknown;
} {
  return {
    scoreWaterfall: trace.scoreWaterfall ?? null,
    clinicalMatrix: trace.clinicalMatrix ?? null,
    guidelineEvidence: trace.guidelineEvidence ?? null,
    helpTelemetry: trace.helpTelemetry ?? null,
  };
}

export function containsCorrectSolutionKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsCorrectSolutionKey);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "correctSolution") return true;
    if (containsCorrectSolutionKey(child)) return true;
  }
  return false;
}
