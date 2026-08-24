/**
 * Pilastro 2 — Accuratezza Clinica & Decision-Making Deterministico
 * Matrice Classi di Raccomandazione ESC/AHA (I / IIa / IIb / III)
 * + registro immutabile `executedActionIds` (zero fuzzy / zero falsi positivi).
 */

import type {
  CaseExamDefinition,
  ClinicalCase,
  RagLegalReference,
} from "@/lib/data/cases/types";
import { getCachedCaseById } from "@/lib/data/cases/registry-store";

export type ClinicalScoreMotivation = {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef?: string;
  scoreImpact: number;
};

export type EscRecommendationClass = "I" | "IIa" | "IIb" | "III";

export type ClinicalDimensionScore = {
  id: "class_i_adherence" | "class_iii_avoidance" | "diagnostic_sequencing";
  label: string;
  score: number;
  weight: number;
  met: number;
  expected: number;
  evidence: string[];
  deficits: string[];
};

export type EscClinicalResult = {
  score: number;
  qualitativeLabel: string;
  expertAnalysis: string;
  framework: "esc-aha-recommendation-matrix";
  iatrogenicCritical: boolean;
  iatrogenicEvents: Array<{ actionId: string; name: string; rationale: string }>;
  classI: { executed: number; expected: number; omittedIds: string[]; executedIds: string[] };
  classIII: { executed: number; expectedAvoid: number; executedIds: string[] };
  executedActionIds: string[];
  dimensions: {
    classIAdherence: ClinicalDimensionScore;
    classIIIAvoidance: ClinicalDimensionScore;
    diagnosticSequencing: ClinicalDimensionScore;
  };
  motivations: ClinicalScoreMotivation[];
  primarySourceRef: string;
  /** Legacy fields for ScoreBreakdown.clinical */
  legacy: {
    missedHigh: number;
    missedMedium: number;
    earnedWeight: number;
    totalWeight: number;
  };
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Canonical clinical RAG citation templates (anchored to rag_knowledge_base). */
export const CLINICAL_RAG_REFS = {
  escClassI: (specialty: string) =>
    `Rif. Linee Guida ESC ${specialty} - Classe di Indicazione I`,
  escClassIII: (specialty: string) =>
    `Rif. Linee Guida ESC ${specialty} - Classe di Indicazione III`,
  protocol: (caseName: string) =>
    `Rif. Protocollo di Gestione dell'Emergenza ${caseName}`,
  escGeneric: "Rif. Linee Guida ESC/AHA — Classi di Raccomandazione (I / IIa / IIb / III)",
} as const;

const NON_ACTION_GOLD_STEPS = new Set([
  "anamnesi",
  "anamnesi_completa",
  "esame_obiettivo",
  "diagnosi",
  "diagnosi_differenziale",
  "piano_terapeutico",
  "stabilizzazione",
  "abc",
]);

/**
 * Builds the immutable session action registry.
 * An action counts as executed ONLY if its exact ID appears here — no fuzzy matching.
 */
export function buildExecutedActionIds(params: {
  requestedExamIds?: string[] | null;
  exams?: Array<{ id?: string | null; name?: string | null }> | null;
  /** Optional explicit override (already-normalized immutable list). */
  executedActionIds?: string[] | null;
}): string[] {
  if (Array.isArray(params.executedActionIds) && params.executedActionIds.length > 0) {
    return dedupePreserveOrder(
      params.executedActionIds.map((id) => String(id).trim()).filter(Boolean),
    );
  }

  const fromSession = Array.isArray(params.requestedExamIds)
    ? params.requestedExamIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const fromExams = Array.isArray(params.exams)
    ? params.exams
        .map((e) => (typeof e?.id === "string" ? e.id.trim() : ""))
        .filter(Boolean)
    : [];

  return dedupePreserveOrder([...fromSession, ...fromExams]);
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function resolveRecommendationClass(exam: CaseExamDefinition): EscRecommendationClass {
  if (exam.recommendationClass) return exam.recommendationClass;
  if (exam.inappropriate) return "III";
  if (exam.mandatory) return "I";
  if (exam.level === "III") return "III";
  if (exam.level === "II") return "IIa";
  return "I";
}

export function isIatrogenicCriticalExam(exam: CaseExamDefinition): boolean {
  if (exam.iatrogenicCritical === true) return true;
  const penalty = exam.inappropriatePenaltyPercent ?? 0;
  return exam.inappropriate === true && penalty >= 40;
}

/**
 * Exact-ID membership only. Panel algebra: a required component is executed if
 * its own ID is present OR a parent panel that lists it as componentExamId is present.
 * A required panel is executed if its ID is present OR every component ID is present.
 */
export function isActionIdExecuted(
  actionId: string,
  executed: ReadonlySet<string>,
  catalog: CaseExamDefinition[],
): boolean {
  if (executed.has(actionId)) return true;

  for (const exam of catalog) {
    if (!executed.has(exam.examId)) continue;
    if (exam.componentExamIds?.includes(actionId)) return true;
  }

  const panel = catalog.find((e) => e.examId === actionId);
  if (panel?.componentExamIds && panel.componentExamIds.length > 0) {
    return panel.componentExamIds.every((c) => executed.has(c));
  }

  return false;
}

function specialtyLabel(registered?: Pick<ClinicalCase, "specialtyLabel" | "specialty"> | null): string {
  return registered?.specialtyLabel ?? registered?.specialty ?? "Cardiologia";
}

function pickPrimarySourceRef(
  registered: Pick<ClinicalCase, "title" | "code" | "specialty" | "specialtyLabel" | "legalConformity"> | undefined,
  kind: "I" | "III",
): string {
  const refs = registered?.legalConformity?.ragReferences ?? [];
  const esc = refs.find((r) => /ESC|AHA|linea.?guida|guideline/i.test(r.sourceRef));
  if (esc) {
    const articles = esc.articles?.join("; ");
    return articles
      ? `${esc.sourceRef} — ${articles}`
      : `${esc.sourceRef} — Classe ${kind}`;
  }
  const name = registered?.title ?? registered?.code ?? "caso clinico";
  if (kind === "III") {
    return CLINICAL_RAG_REFS.escClassIII(specialtyLabel(registered));
  }
  return (
    CLINICAL_RAG_REFS.escClassI(specialtyLabel(registered)) +
    ` · ${CLINICAL_RAG_REFS.protocol(name)}`
  );
}

function formatRagRef(ref: RagLegalReference): string {
  const arts = ref.articles?.length ? ` — ${ref.articles.join("; ")}` : "";
  return `${ref.sourceRef}${arts}`;
}

/** Class I mandatories: gold path action ids ∪ mandatoryExams (unique). */
export function resolveClassIActions(
  registered: Pick<ClinicalCase, "mandatoryExams" | "goldStandardPath" | "inappropriateExams">,
): CaseExamDefinition[] {
  const byId = new Map<string, CaseExamDefinition>();

  for (const exam of registered.mandatoryExams ?? []) {
    byId.set(exam.examId, {
      ...exam,
      recommendationClass: resolveRecommendationClass(exam),
      mandatory: true,
    });
  }

  for (const step of registered.goldStandardPath ?? []) {
    const id = String(step).trim();
    if (!id) continue;
    const slugKey = id.replace(/-/g, "_").toLowerCase();
    if (NON_ACTION_GOLD_STEPS.has(slugKey) || NON_ACTION_GOLD_STEPS.has(id)) continue;
    if (byId.has(id)) continue;

    const fromInappropriate = (registered.inappropriateExams ?? []).find(
      (e) => e.examId === id,
    );
    if (fromInappropriate) continue;

    byId.set(id, {
      examId: id,
      name: id,
      level: "I",
      mandatory: true,
      recommendationClass: "I",
      finding: "",
      priceEuro: 0,
    });
  }

  return [...byId.values()].filter((e) => resolveRecommendationClass(e) !== "III");
}

export function resolveClassIIIActions(
  registered: Pick<ClinicalCase, "inappropriateExams">,
): CaseExamDefinition[] {
  return (registered.inappropriateExams ?? [])
    .filter((e) => e.inappropriate || resolveRecommendationClass(e) === "III")
    .map((e) => ({
      ...e,
      recommendationClass: "III" as const,
      inappropriate: true,
    }));
}

function scoreClassIAdherence(params: {
  classI: CaseExamDefinition[];
  executed: ReadonlySet<string>;
  catalog: CaseExamDefinition[];
  sourceRef: string;
  weight: number;
}): ClinicalDimensionScore & { motivations: ClinicalScoreMotivation[] } {
  const { classI, executed, catalog, sourceRef, weight } = params;
  const motivations: ClinicalScoreMotivation[] = [];
  const evidence: string[] = [];
  const deficits: string[] = [];
  let met = 0;

  for (const action of classI) {
    const done = isActionIdExecuted(action.examId, executed, catalog);
    if (done) {
      met += 1;
      evidence.push(action.name || action.examId);
      motivations.push({
        id: `clin_class_i_ok_${action.examId}`,
        type: "positive",
        text: `Classe I eseguita — «${action.name || action.examId}»`,
        sourceRef,
        scoreImpact: classI.length > 0 ? Math.round(100 / classI.length) : 0,
      });
    } else {
      deficits.push(`Omessa Classe I: ${action.name || action.examId}`);
      motivations.push({
        id: `clin_class_i_miss_${action.examId}`,
        type: "negative",
        text: `Omessa azione mandatoria Classe I — «${action.name || action.examId}»`,
        sourceRef,
        scoreImpact: classI.length > 0 ? -Math.round(100 / classI.length) : 0,
      });
    }
  }

  const expected = classI.length;
  const score = expected > 0 ? clampScore((met / expected) * 100) : 0;

  return {
    id: "class_i_adherence",
    label: "Azioni mandatorie Classe I (Gold Standard)",
    score,
    weight,
    met,
    expected,
    evidence,
    deficits,
    motivations,
  };
}

function scoreClassIIIAvoidance(params: {
  classIII: CaseExamDefinition[];
  executed: ReadonlySet<string>;
  catalog: CaseExamDefinition[];
  sourceRef: string;
  weight: number;
}): ClinicalDimensionScore & {
  motivations: ClinicalScoreMotivation[];
  iatrogenicCritical: boolean;
  iatrogenicEvents: Array<{ actionId: string; name: string; rationale: string }>;
  executedIds: string[];
} {
  const { classIII, executed, catalog, sourceRef, weight } = params;
  const motivations: ClinicalScoreMotivation[] = [];
  const evidence: string[] = [];
  const deficits: string[] = [];
  const iatrogenicEvents: Array<{ actionId: string; name: string; rationale: string }> = [];
  const executedIds: string[] = [];

  for (const action of classIII) {
    const done = isActionIdExecuted(action.examId, executed, catalog);
    if (!done) {
      evidence.push(`Evitata Classe III: ${action.name || action.examId}`);
      continue;
    }
    executedIds.push(action.examId);
    const rationale =
      action.wasteRationale ||
      "Intervento di Classe III (controindicazione / danno potenziale) eseguito.";
    deficits.push(`Eseguita Classe III: ${action.name || action.examId}`);
    motivations.push({
      id: `clin_class_iii_${action.examId}`,
      type: "negative",
      text: `Errore di Classe III — «${action.name || action.examId}»: ${rationale}`,
      sourceRef,
      scoreImpact: isIatrogenicCriticalExam(action) ? -100 : -40,
    });
    if (isIatrogenicCriticalExam(action)) {
      iatrogenicEvents.push({
        actionId: action.examId,
        name: action.name || action.examId,
        rationale,
      });
    }
  }

  const iatrogenicCritical = iatrogenicEvents.length > 0;
  const expectedAvoid = classIII.length;
  const executedCount = executedIds.length;
  let score: number;
  if (iatrogenicCritical) {
    score = 0;
  } else if (executed.size === 0) {
    // No free credit for "avoidance" when the doctor did nothing — no arbitrary offset.
    score = 0;
    motivations.push({
      id: "clin_class_iii_empty_registry",
      type: "neutral",
      text: "Registro esecutivo vuoto — nessun credito per evitamento Classe III (nessuna azione documentata)",
      sourceRef,
      scoreImpact: 0,
    });
  } else if (expectedAvoid === 0) {
    score = 100;
  } else if (executedCount === 0) {
    score = 100;
    motivations.push({
      id: "clin_class_iii_clear",
      type: "positive",
      text: "Nessun intervento di Classe III eseguito — rispetto delle controindicazioni ESC/AHA",
      sourceRef,
      scoreImpact: 20,
    });
  } else {
    // Non-fatal Class III (waste / delay): drastic penalty
    score = clampScore(Math.max(0, 100 - executedCount * 40));
  }

  return {
    id: "class_iii_avoidance",
    label: "Evitamento errori Classe III",
    score,
    weight,
    met: expectedAvoid - executedCount,
    expected: expectedAvoid,
    evidence,
    deficits,
    motivations,
    iatrogenicCritical,
    iatrogenicEvents,
    executedIds,
  };
}

/**
 * Sequenza: esami di I livello / Class I devono precedere procedure invasive
 * o inappropriate di II/III livello nell'ordine del registro.
 */
function scoreDiagnosticSequencing(params: {
  classI: CaseExamDefinition[];
  classIII: CaseExamDefinition[];
  executedOrder: string[];
  executed: ReadonlySet<string>;
  catalog: CaseExamDefinition[];
  sourceRef: string;
  weight: number;
}): ClinicalDimensionScore & { motivations: ClinicalScoreMotivation[] } {
  const { classI, classIII, executedOrder, executed, catalog, sourceRef, weight } = params;
  const motivations: ClinicalScoreMotivation[] = [];
  const evidence: string[] = [];
  const deficits: string[] = [];

  if (executedOrder.length === 0) {
    return {
      id: "diagnostic_sequencing",
      label: "Sequenziamento e tempistica diagnostica",
      score: 0,
      weight,
      met: 0,
      expected: 1,
      evidence,
      deficits: ["Nessuna azione clinica registrata nel registro esecutivo."],
      motivations: [
        {
          id: "clin_seq_empty",
          type: "negative",
          text: "Registro esecutivo vuoto — impossibile valutare sequenza diagnostica",
          sourceRef,
          scoreImpact: 0,
        },
      ],
    };
  }

  const indexOfFirst = (predicate: (id: string) => boolean): number => {
    for (let i = 0; i < executedOrder.length; i += 1) {
      if (predicate(executedOrder[i]!)) return i;
    }
    return -1;
  };

  const classIIds = new Set(classI.map((a) => a.examId));
  const classIIIIds = new Set(classIII.map((a) => a.examId));
  const levelIIds = new Set(
    [...classI, ...catalog.filter((e) => e.level === "I")].map((e) => e.examId),
  );

  const firstClassIIdx = indexOfFirst((id) => {
    if (classIIds.has(id) || levelIIds.has(id)) return true;
    return classI.some((a) => isActionIdExecuted(a.examId, new Set([id]), catalog));
  });

  const firstInvasiveIdx = indexOfFirst((id) => {
    if (classIIIIds.has(id)) return true;
    const def = catalog.find((e) => e.examId === id);
    return def?.level === "III" || def?.level === "II";
  });

  let score = 100;

  // Time-critical Class I with maxLatencyMinutes: presence in registry = timely enough for this model
  // (latency minutes are enforced by clinical-time-engine elsewhere; here we score order).
  const timeCritical = classI.filter((a) => typeof a.maxLatencyMinutes === "number");
  let timeCriticalMet = 0;
  for (const action of timeCritical) {
    if (isActionIdExecuted(action.examId, executed, catalog)) {
      timeCriticalMet += 1;
      evidence.push(
        `${action.name || action.examId} entro finestra (≤${action.maxLatencyMinutes} min — registro)`,
      );
    } else {
      deficits.push(
        `Azione time-critical omessa: ${action.name || action.examId} (max ${action.maxLatencyMinutes} min)`,
      );
      score -= 25;
      motivations.push({
        id: `clin_seq_latency_${action.examId}`,
        type: "negative",
        text: `Tempistica: omesso «${action.name || action.examId}» (finestra ≤${action.maxLatencyMinutes} min)`,
        sourceRef,
        scoreImpact: -25,
      });
    }
  }

  if (
    firstInvasiveIdx >= 0 &&
    (firstClassIIdx < 0 || firstInvasiveIdx < firstClassIIdx)
  ) {
    score -= 35;
    deficits.push(
      "Procedura di II/III livello o Classe III richiesta prima delle indagini di I livello / Classe I",
    );
    motivations.push({
      id: "clin_seq_invasive_first",
      type: "negative",
      text: "Sequenza invertita: esame invasivo/inappropriato prima del work-up di I livello",
      sourceRef,
      scoreImpact: -35,
    });
  } else if (firstClassIIdx >= 0) {
    evidence.push("Work-up di I livello / Classe I anteposto alle procedure avanzate");
    motivations.push({
      id: "clin_seq_ok",
      type: "positive",
      text: "Sequenza corretta: priorità a esami di I livello / azioni Classe I",
      sourceRef,
      scoreImpact: 15,
    });
  }

  const expected = Math.max(1, timeCritical.length);
  const met =
    timeCritical.length > 0
      ? timeCriticalMet
      : firstClassIIdx >= 0 && !(firstInvasiveIdx >= 0 && firstInvasiveIdx < firstClassIIdx)
        ? 1
        : 0;

  return {
    id: "diagnostic_sequencing",
    label: "Sequenziamento e tempistica diagnostica",
    score: clampScore(score),
    weight,
    met,
    expected,
    evidence,
    deficits,
    motivations,
  };
}

function buildExpertAnalysis(params: {
  final: number;
  classIMet: number;
  classIExpected: number;
  classIIIExecuted: string[];
  iatrogenic: EscClinicalResult["iatrogenicEvents"];
  A: ClinicalDimensionScore;
  B: ClinicalDimensionScore;
  C: ClinicalDimensionScore;
  caseTitle: string;
  sourceRef: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `Giudizio di Clinica (matrice ESC/AHA) sul caso «${params.caseTitle}». ` +
      `Sintesi ponderata: Adesione Classe I ${params.A.score}/100 (peso ${(params.A.weight * 100).toFixed(0)}%), ` +
      `Evitamento Classe III ${params.B.score}/100 (peso ${(params.B.weight * 100).toFixed(0)}%), ` +
      `Sequenziamento/tempistica ${params.C.score}/100 (peso ${(params.C.weight * 100).toFixed(0)}%) ` +
      `→ Accuratezza Clinica ${params.final}/100. Azioni critiche Classe I: ${params.classIMet}/${params.classIExpected}.`,
  );

  if (params.A.evidence.length > 0) {
    parts.push(
      `Decisioni allineate al Gold Standard: ${params.A.evidence
        .slice(0, 5)
        .map((e) => `«${e}»`)
        .join(" · ")}.`,
    );
  }

  if (params.iatrogenic.length > 0) {
    parts.push(
      `DANNO IATROGENO CRITICO: esecuzione di interventi di Classe III ad alto rischio — ` +
        `${params.iatrogenic.map((e) => `«${e.name}» (${e.rationale})`).join("; ")}. ` +
        `Lo score di accuratezza è azzerato per imperizia decisionale.`,
    );
  } else if (params.classIIIExecuted.length > 0) {
    parts.push(
      `Critica: interventi di Classe III registrati (${params.classIIIExecuted.join(", ")}) — ` +
        `controindicazione relativa/assoluta rispetto al protocollo del caso.`,
    );
  }

  if (params.A.deficits.length > 0) {
    parts.push(`Omissioni di Classe I: ${params.A.deficits.slice(0, 4).join(" ")}`);
  }
  if (params.C.deficits.length > 0) {
    parts.push(`Criticità di sequenza/tempistica: ${params.C.deficits.slice(0, 3).join(" ")}`);
  }

  parts.push(`Ancoraggio: ${params.sourceRef}.`);
  return parts.join(" ");
}

function qualitativeLabel(params: {
  score: number;
  iatrogenicCritical: boolean;
  classIMet: number;
  classIExpected: number;
}): string {
  if (params.iatrogenicCritical) {
    return "Danno Iatrogeno Critico — errore di Classe III (Accuratezza 0)";
  }
  if (params.classIExpected > 0 && params.classIMet === params.classIExpected && params.score >= 85) {
    return "Decision-making allineato al Gold Standard ESC (Classe I completa)";
  }
  if (params.score >= 70) return "Accuratezza clinica buona — gap minori su sequenza o Classe I";
  if (params.score >= 45) return "Accuratezza clinica insufficiente — omissioni di Classe I rilevanti";
  return "Decision-making inadeguato rispetto al protocollo ESC/AHA del caso";
}

/**
 * ESC/AHA recommendation-matrix clinical accuracy.
 * Uses ONLY `executedActionIds` for performance claims (zero fuzzy inference).
 */
export function computeEscAhaClinicalAccuracy(params: {
  caseId?: string | null;
  caseTitle?: string | null;
  executedActionIds?: string[] | null;
  requestedExamIds?: string[] | null;
  exams?: Array<{ id?: string | null; name?: string | null }> | null;
  mandatoryExams?: CaseExamDefinition[] | null;
  inappropriateExams?: CaseExamDefinition[] | null;
  goldStandardPath?: string[] | null;
  ragReferences?: RagLegalReference[] | null;
}): EscClinicalResult {
  const registered = params.caseId ? getCachedCaseById(params.caseId) : undefined;

  type CaseMatrix = Pick<
    ClinicalCase,
    | "id"
    | "code"
    | "title"
    | "specialty"
    | "specialtyLabel"
    | "goldStandardPath"
    | "mandatoryExams"
    | "inappropriateExams"
    | "legalConformity"
  >;

  const syntheticCase: CaseMatrix | undefined = registered
    ? registered
    : params.goldStandardPath || params.mandatoryExams
      ? {
          id: params.caseId ?? "unknown",
          code: params.caseId ?? "unknown",
          title: params.caseTitle ?? "Caso clinico",
          specialty: "cardiologia",
          specialtyLabel: "Cardiologia",
          goldStandardPath: params.goldStandardPath ?? [],
          mandatoryExams: params.mandatoryExams ?? [],
          inappropriateExams: params.inappropriateExams ?? [],
          legalConformity: {
            statusWhenMet: "CONFORME",
            statusWhenUnmet: "NON_CONFORME",
            criteria: [],
            ragReferences: params.ragReferences ?? [],
          },
        }
      : undefined;

  const executedActionIds = buildExecutedActionIds({
    executedActionIds: params.executedActionIds,
    requestedExamIds: params.requestedExamIds,
    exams: params.exams,
  });
  const executed = new Set(executedActionIds);

  if (!syntheticCase) {
    const emptyDim = (
      id: ClinicalDimensionScore["id"],
      label: string,
      weight: number,
    ): ClinicalDimensionScore => ({
      id,
      label,
      score: 0,
      weight,
      met: 0,
      expected: 0,
      evidence: [],
      deficits: ["Matrice clinica del caso non disponibile."],
    });
    return {
      score: 0,
      qualitativeLabel: "Accuratezza non valutabile — matrice caso assente",
      expertAnalysis:
        "Impossibile applicare la matrice ESC/AHA: caso non registrato e assenza di Gold Standard / esami mandatori.",
      framework: "esc-aha-recommendation-matrix",
      iatrogenicCritical: false,
      iatrogenicEvents: [],
      classI: { executed: 0, expected: 0, omittedIds: [], executedIds: [] },
      classIII: { executed: 0, expectedAvoid: 0, executedIds: [] },
      executedActionIds,
      dimensions: {
        classIAdherence: emptyDim("class_i_adherence", "Azioni mandatorie Classe I (Gold Standard)", 0.55),
        classIIIAvoidance: emptyDim("class_iii_avoidance", "Evitamento errori Classe III", 0.25),
        diagnosticSequencing: emptyDim(
          "diagnostic_sequencing",
          "Sequenziamento e tempistica diagnostica",
          0.2,
        ),
      },
      motivations: [
        {
          id: "clin_no_matrix",
          type: "negative",
          text: "Matrice decisionale ESC/AHA non disponibile per il caso",
          sourceRef: CLINICAL_RAG_REFS.escGeneric,
          scoreImpact: 0,
        },
      ],
      primarySourceRef: CLINICAL_RAG_REFS.escGeneric,
      legacy: { missedHigh: 0, missedMedium: 0, earnedWeight: 0, totalWeight: 0 },
    };
  }

  const catalog: CaseExamDefinition[] = [
    ...(syntheticCase.mandatoryExams ?? []),
    ...(syntheticCase.inappropriateExams ?? []),
  ];
  const classI = resolveClassIActions(syntheticCase);
  const classIII = resolveClassIIIActions(syntheticCase);
  const sourceI = pickPrimarySourceRef(syntheticCase, "I");
  const sourceIII = pickPrimarySourceRef(syntheticCase, "III");
  const primarySourceRef =
    (syntheticCase.legalConformity?.ragReferences?.[0]
      ? formatRagRef(syntheticCase.legalConformity.ragReferences[0])
      : null) ?? sourceI;

  const weights = { classI: 0.55, classIII: 0.25, sequencing: 0.2 };

  const Afull = scoreClassIAdherence({
    classI,
    executed,
    catalog,
    sourceRef: sourceI,
    weight: weights.classI,
  });
  const Bfull = scoreClassIIIAvoidance({
    classIII,
    executed,
    catalog,
    sourceRef: sourceIII,
    weight: weights.classIII,
  });
  const Cfull = scoreDiagnosticSequencing({
    classI,
    classIII,
    executedOrder: executedActionIds,
    executed,
    catalog,
    sourceRef: primarySourceRef,
    weight: weights.sequencing,
  });

  const { motivations: motA, ...A } = Afull;
  const {
    motivations: motB,
    iatrogenicCritical,
    iatrogenicEvents,
    executedIds: classIIIExecutedIds,
    ...B
  } = Bfull;
  const { motivations: motC, ...C } = Cfull;

  let final = clampScore(
    Math.round(A.score * A.weight + B.score * B.weight + C.score * C.weight),
  );
  // Empty registry → clinical accuracy must be zero (no Class I credit, no Class III free points).
  if (executedActionIds.length === 0 && !iatrogenicCritical) {
    final = 0;
  }
  if (iatrogenicCritical) {
    final = 0;
  }

  const omittedIds = classI
    .filter((a) => !isActionIdExecuted(a.examId, executed, catalog))
    .map((a) => a.examId);
  const executedClassIIds = classI
    .filter((a) => isActionIdExecuted(a.examId, executed, catalog))
    .map((a) => a.examId);

  const motivations: ClinicalScoreMotivation[] = [
    {
      id: "clin_registry",
      type: "neutral",
      text: `Registro esecutivo deterministico: ${executedActionIds.length} action ID (zero fuzzy matching)${
        executedActionIds.length > 0
          ? ` — [${executedActionIds.slice(0, 12).join(", ")}${executedActionIds.length > 12 ? "…" : ""}]`
          : " — vuoto → score 0"
      }`,
      sourceRef: CLINICAL_RAG_REFS.protocol(syntheticCase.title || syntheticCase.code),
      scoreImpact: 0,
    },
    {
      id: "clin_score_audit",
      type: "neutral",
      text: `Derivazione score: Classe I ${A.score}/100 × ${(A.weight * 100).toFixed(0)}% (${A.met}/${A.expected} azioni) + Classe III ${B.score}/100 × ${(B.weight * 100).toFixed(0)}% + Sequenza ${C.score}/100 × ${(C.weight * 100).toFixed(0)}% → ${final}/100${
        executedClassIIds.length > 0
          ? `. Classe I conteggiate: ${executedClassIIds.join(", ")}`
          : A.expected > 0
            ? ". Nessuna azione di Classe I eseguita"
            : ""
      }`,
      sourceRef: primarySourceRef,
      scoreImpact: final,
    },
    ...motA,
    ...motB,
    ...motC,
  ];

  if (iatrogenicCritical) {
    motivations.unshift({
      id: "clin_iatrogenic_critical",
      type: "negative",
      text: `Danno Iatrogeno Critico — Accuratezza Clinica azzerata (${iatrogenicEvents
        .map((e) => e.name)
        .join(", ")})`,
      sourceRef: sourceIII,
      scoreImpact: -100,
    });
  }

  const label = qualitativeLabel({
    score: final,
    iatrogenicCritical,
    classIMet: A.met,
    classIExpected: A.expected,
  });

  const expertAnalysis = buildExpertAnalysis({
    final,
    classIMet: A.met,
    classIExpected: A.expected,
    classIIIExecuted: classIIIExecutedIds,
    iatrogenic: iatrogenicEvents,
    A,
    B,
    C,
    caseTitle: params.caseTitle || syntheticCase.title || syntheticCase.code,
    sourceRef: primarySourceRef,
  });

  return {
    score: final,
    qualitativeLabel: label,
    expertAnalysis,
    framework: "esc-aha-recommendation-matrix",
    iatrogenicCritical,
    iatrogenicEvents,
    classI: {
      executed: A.met,
      expected: A.expected,
      omittedIds,
      executedIds: executedClassIIds,
    },
    classIII: {
      executed: classIIIExecutedIds.length,
      expectedAvoid: classIII.length,
      executedIds: classIIIExecutedIds,
    },
    executedActionIds,
    dimensions: {
      classIAdherence: A,
      classIIIAvoidance: B,
      diagnosticSequencing: C,
    },
    motivations,
    primarySourceRef,
    legacy: {
      missedHigh: omittedIds.length,
      missedMedium: 0,
      earnedWeight: A.met,
      totalWeight: A.expected,
    },
  };
}
