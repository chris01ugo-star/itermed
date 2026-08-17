/**
 * Pilastro 4 — Sostenibilità ed Economia SSN
 * Nomenclatore Tariffario SSN × Note AIFA × Art. 13 CdM (appropriatezza prescrittiva).
 * Rigore matematico: zero divisioni per zero, clamp [0, 100] su efficienza/scostamento.
 */

import type { CaseExamDefinition, RagLegalReference } from "@/lib/data/cases/types";
import { getCaseById } from "@/lib/data/cases/registry";
import type { ExamClinicalMeta } from "@/lib/exam-default-values";
import { resolveSsnTariffEuro } from "@/lib/services/exam-ssn-tariff-resolver";

export type EconomyScoreMotivation = {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef?: string;
  scoreImpact: number;
};

export type EconomyPrescriptionItem = {
  examId: string;
  name: string;
  costEuro: number;
  kind: "virtuous" | "inappropriate" | "omission";
  sourceRef: string;
};

export type EconomySsnResult = {
  score: number;
  qualitativeLabel: string;
  expertAnalysis: string;
  framework: "economy-ssn-hta";
  /** Spesa effettiva utente (€). */
  actualSpendEuro: number;
  /** Spesa ideale Gold Standard (€). */
  idealSpendEuro: number;
  /** Delta = effettiva − ideale (€). */
  deltaSpendEuro: number;
  /** Budget sessione / difficoltà (€) — riferimento operativo. */
  budgetEuro: number;
  /** Scostamento % vs ideale — sempre in [0, 100]. */
  scostamentoPercent: number;
  /** Efficienza prescrittiva % — sempre in [0, 100]. */
  efficiencyPercent: number;
  wasteEuro: number;
  virtuousSpendEuro: number;
  omissionEuro: number;
  prescriptions: {
    virtuous: EconomyPrescriptionItem[];
    inappropriate: EconomyPrescriptionItem[];
    omissions: EconomyPrescriptionItem[];
  };
  motivations: EconomyScoreMotivation[];
  primarySourceRef: string;
  appropriatenessCouplingApplied: boolean;
  underPrescriptionApplied: boolean;
};

export const ECONOMY_RAG_REFS = {
  nomenclatore: (examId: string) =>
    `Rif. Nomenclatore Tariffario SSN - Codice Prestazione [${examId || "n/d"}]`,
  nomenclatoreGeneric: "Rif. Nomenclatore Tariffario SSN - Codice Prestazione",
  noteAifa: (nota?: string) =>
    nota
      ? `Rif. Note AIFA / Regolamento di Prescrittività Farmacologica [Nota ${nota}]`
      : "Rif. Note AIFA / Regolamento di Prescrittività Farmacologica",
  art13:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Appropriatezza prescrittiva)",
} as const;

/** Clamp percentuale/score al range chiuso [0, 100]. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeEuro(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

/**
 * Scostamento % = |effettiva − ideale| / ideale × 100.
 * Guard: entrambe 0 → 0%. Ideale 0 e effettiva > 0 → 100% (deviazione totale).
 */
export function computeScostamentoPercent(actualEuro: number, idealEuro: number): number {
  const actual = safeEuro(actualEuro);
  const ideal = safeEuro(idealEuro);
  if (actual === 0 && ideal === 0) return 0;
  if (ideal === 0) return actual > 0 ? 100 : 0;
  return clampPercent((Math.abs(actual - ideal) / ideal) * 100);
}

/**
 * Efficienza prescrittiva %.
 * Guard: entrambe 0 → 100%. Effettiva 0 e ideale > 0 → 0%.
 * Altrimenti 100 − scostamento, clamp [0, 100].
 */
export function computeEfficiencyPercent(actualEuro: number, idealEuro: number): number {
  const actual = safeEuro(actualEuro);
  const ideal = safeEuro(idealEuro);
  if (actual === 0 && ideal === 0) return 100;
  if (actual === 0 && ideal > 0) return 0;
  if (ideal === 0 && actual > 0) return 0;
  return clampPercent(100 - computeScostamentoPercent(actual, ideal));
}

function basenameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function extractAifaNota(refs: RagLegalReference[]): string | undefined {
  for (const ref of refs) {
    const hay = `${ref.sourceRef} ${ref.documentPath} ${(ref.articles ?? []).join(" ")}`;
    const m = hay.match(/nota[\s_-]*(\d+)/i);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

function pickEconomySourceRef(params: {
  examId: string;
  ragRefs: RagLegalReference[];
  kind: "virtuous" | "inappropriate" | "omission";
}): string {
  const aifa = extractAifaNota(params.ragRefs);
  if (params.kind === "inappropriate" && aifa) {
    return ECONOMY_RAG_REFS.noteAifa(aifa);
  }
  if (params.kind === "inappropriate" || params.kind === "omission") {
    const art13 = params.ragRefs.find((r) =>
      /art\.?\s*13|deontologia|appropriatezza/i.test(
        `${r.sourceRef} ${(r.articles ?? []).join(" ")}`,
      ),
    );
    if (art13) {
      const title = basenameFromPath(art13.documentPath) || art13.sourceRef;
      const art = art13.articles?.[0] ?? "Art. 13";
      return `[${title}] - ${art}`;
    }
    return ECONOMY_RAG_REFS.art13;
  }
  return ECONOMY_RAG_REFS.nomenclatore(params.examId);
}

function resolveIdealCatalog(
  registered:
    | {
        mandatoryExams?: CaseExamDefinition[];
        inappropriateExams?: CaseExamDefinition[];
        goldStandardPath?: string[];
      }
    | undefined,
  mandatoryExams?: CaseExamDefinition[] | null,
  inappropriateExams?: CaseExamDefinition[] | null,
  goldStandardPath?: string[] | null,
  examCatalog?: Record<string, ExamClinicalMeta> | null,
): CaseExamDefinition[] {
  const mandatory = mandatoryExams ?? registered?.mandatoryExams ?? [];
  const inappropriate = inappropriateExams ?? registered?.inappropriateExams ?? [];
  const gold = goldStandardPath ?? registered?.goldStandardPath ?? [];
  const byId = new Map<string, CaseExamDefinition>();

  for (const exam of mandatory) {
    const priceEuro = resolveSsnTariffEuro({
      examId: exam.examId,
      catalog: examCatalog,
      authoredPriceEuro: exam.priceEuro,
    });
    byId.set(exam.examId, { ...exam, priceEuro });
  }

  for (const step of gold) {
    const id = String(step).trim();
    if (!id || byId.has(id)) continue;
    if (/consenso|anamnesi|diagnosi|piano|stabilizz/i.test(id)) continue;
    const fromInapp = inappropriate.find((e) => e.examId === id);
    if (fromInapp) continue;
    byId.set(id, {
      examId: id,
      name: id,
      level: "I",
      mandatory: true,
      finding: "",
      priceEuro: resolveSsnTariffEuro({
        examId: id,
        catalog: examCatalog,
      }),
    });
  }

  return [...byId.values()];
}

function isExecuted(
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
  if (panel?.componentExamIds?.length) {
    return panel.componentExamIds.every((c) => executed.has(c));
  }
  return false;
}

function priceForExam(
  examId: string,
  catalog: CaseExamDefinition[],
  orderedCostById: Map<string, number>,
): number {
  if (orderedCostById.has(examId)) return safeEuro(orderedCostById.get(examId));
  const def = catalog.find((e) => e.examId === examId);
  if (def) return safeEuro(def.priceEuro);
  for (const exam of catalog) {
    if (exam.componentExamIds?.includes(examId)) {
      const share =
        exam.componentExamIds.length > 0
          ? safeEuro(exam.priceEuro) / exam.componentExamIds.length
          : 0;
      return share;
    }
  }
  return 0;
}

function buildExpertAnalysis(params: {
  caseTitle: string;
  score: number;
  actual: number;
  ideal: number;
  delta: number;
  efficiency: number;
  scostamento: number;
  waste: number;
  omission: number;
  virtuous: EconomyPrescriptionItem[];
  inappropriate: EconomyPrescriptionItem[];
  omissions: EconomyPrescriptionItem[];
  primarySourceRef: string;
}): string {
  const parts: string[] = [];
  parts.push(
    `Giudizio di Direzione Sanitaria / HTA sul caso «${params.caseTitle}». ` +
      `Spesa effettiva €${params.actual.toFixed(2)} vs spesa ideale Gold Standard €${params.ideal.toFixed(2)} ` +
      `(Δ €${params.delta >= 0 ? "+" : ""}${params.delta.toFixed(2)}; scostamento ${params.scostamento}%; ` +
      `efficienza prescrittiva ${params.efficiency}%) → score sostenibilità ${params.score}/100.`,
  );

  if (params.virtuous.length > 0) {
    parts.push(
      `Prescrizioni virtuose (I/II livello allineate a LG): ${params.virtuous
        .slice(0, 5)
        .map((p) => `«${p.name}» €${p.costEuro.toFixed(2)}`)
        .join(" · ")}.`,
    );
  }

  if (params.inappropriate.length > 0) {
    parts.push(
      `Medicina difensiva / inappropriatezza: spreco stimato €${params.waste.toFixed(2)} — ` +
        `${params.inappropriate
          .slice(0, 4)
          .map((p) => `«${p.name}» €${p.costEuro.toFixed(2)}`)
          .join("; ")}.`,
    );
  }

  if (params.omissions.length > 0) {
    parts.push(
      `Omissioni diagnostiche per falso risparmio (€${params.omission.toFixed(2)} mancati): ` +
        `${params.omissions
          .slice(0, 4)
          .map((p) => `«${p.name}»`)
          .join(" · ")}.`,
    );
  }

  if (params.inappropriate.length === 0 && params.omissions.length === 0 && params.actual > 0) {
    parts.push(
      "Profilo prescrittivo sostenibile: nessun spreco incongruente né omissione di prestazioni ad alta resa/basso costo rilevata rispetto al Gold Standard.",
    );
  }

  parts.push(`Ancoraggio tariffario/deontologico: ${params.primarySourceRef}.`);
  return parts.join(" ");
}

function qualitativeLabel(params: {
  score: number;
  underRx: boolean;
  waste: number;
  efficiency: number;
}): string {
  if (params.underRx && params.waste > 0) {
    return "Economia SSN critica — spreco e sotto-prescrizione concomitanti";
  }
  if (params.underRx) return "Falso risparmio — omissioni diagnostiche a bassa spesa/alta resa";
  if (params.waste > 0) return "Medicina difensiva — spreco di risorse SSN";
  if (params.score >= 85 && params.efficiency >= 85) {
    return "Sostenibilità eccellente — appropriatezza prescrittiva e rispetto tariffario";
  }
  if (params.score >= 60) return "Sostenibilità accettabile — margini di ottimizzazione HTA";
  return "Sostenibilità insufficiente rispetto al Nomenclatore / Gold Standard";
}

/**
 * Valutazione economico-prescrittiva SSN (HTA).
 * Score = efficienza (vs spesa ideale) − penalità spreco − penalità omissioni, clamp [0,100].
 */
export function computeEconomySsnScore(params: {
  caseId?: string | null;
  caseTitle?: string | null;
  totalCostEuro: number;
  budgetEuro: number;
  orderedExams?: Array<{ id?: string | null; name?: string | null; cost?: number | null }> | null;
  goldStandardPath?: string[] | null;
  mandatoryExams?: CaseExamDefinition[] | null;
  inappropriateExams?: CaseExamDefinition[] | null;
  examsAppropriatenessScore?: number | null;
  ragReferences?: RagLegalReference[] | null;
}): EconomySsnResult {
  const registered = params.caseId ? getCaseById(params.caseId) : undefined;
  const ragRefs =
    params.ragReferences ?? registered?.legalConformity?.ragReferences ?? [];
  const idealDefs = resolveIdealCatalog(
    registered,
    params.mandatoryExams,
    params.inappropriateExams,
    params.goldStandardPath,
  );
  const inappropriateDefs =
    params.inappropriateExams ?? registered?.inappropriateExams ?? [];
  const catalog = [...idealDefs, ...inappropriateDefs];

  const ordered = Array.isArray(params.orderedExams) ? params.orderedExams : [];
  const orderedCostById = new Map<string, number>();
  const executedIds: string[] = [];
  for (const exam of ordered) {
    const id = typeof exam.id === "string" ? exam.id.trim() : "";
    if (!id) continue;
    executedIds.push(id);
    orderedCostById.set(id, safeEuro(exam.cost));
  }
  const executed = new Set(executedIds);

  const actualSpendEuro = safeEuro(params.totalCostEuro);
  const budgetEuro = safeEuro(params.budgetEuro) || safeEuro(registered?.examBudgetEuro);

  // Spesa ideale = somma tariffe prestazioni Gold / mandatorie
  let idealSpendEuro = 0;
  const idealItems: Array<{ examId: string; name: string; costEuro: number }> = [];
  for (const def of idealDefs) {
    const cost = priceForExam(def.examId, catalog, orderedCostById) || safeEuro(def.priceEuro);
    // Prefer authored priceEuro as SSOT when > 0
    const tariff = safeEuro(def.priceEuro) > 0 ? safeEuro(def.priceEuro) : cost;
    idealSpendEuro += tariff;
    idealItems.push({ examId: def.examId, name: def.name || def.examId, costEuro: tariff });
  }

  // If ideal still 0 but we have budget and gold path length, do not invent — keep 0
  const deltaSpendEuro = actualSpendEuro - idealSpendEuro;
  const scostamentoPercent = computeScostamentoPercent(actualSpendEuro, idealSpendEuro);
  const efficiencyPercent = computeEfficiencyPercent(actualSpendEuro, idealSpendEuro);

  const virtuous: EconomyPrescriptionItem[] = [];
  const inappropriate: EconomyPrescriptionItem[] = [];
  const omissions: EconomyPrescriptionItem[] = [];

  const inappropriateIdSet = new Set(inappropriateDefs.map((e) => e.examId));

  for (const exam of ordered) {
    const id = typeof exam.id === "string" ? exam.id.trim() : "";
    if (!id) continue;
    const name = (typeof exam.name === "string" && exam.name.trim()) || id;
    const cost = safeEuro(exam.cost);
    const isIdeal = idealDefs.some(
      (d) => d.examId === id || d.componentExamIds?.includes(id),
    );
    const isInapp =
      inappropriateIdSet.has(id) ||
      inappropriateDefs.some((d) => d.inappropriate && d.examId === id);

    if (isInapp || (!isIdeal && idealDefs.length > 0)) {
      inappropriate.push({
        examId: id,
        name,
        costEuro: cost,
        kind: "inappropriate",
        sourceRef: pickEconomySourceRef({ examId: id, ragRefs, kind: "inappropriate" }),
      });
    } else if (isIdeal || idealDefs.length === 0) {
      virtuous.push({
        examId: id,
        name,
        costEuro: cost,
        kind: "virtuous",
        sourceRef: pickEconomySourceRef({ examId: id, ragRefs, kind: "virtuous" }),
      });
    }
  }

  for (const def of idealDefs) {
    if (isExecuted(def.examId, executed, catalog)) continue;
    const cost = resolveSsnTariffEuro({
      examId: def.examId,
      authoredPriceEuro: def.priceEuro,
    });
    omissions.push({
      examId: def.examId,
      name: def.name || def.examId,
      costEuro: cost,
      kind: "omission",
      sourceRef: pickEconomySourceRef({
        examId: def.examId,
        ragRefs,
        kind: "omission",
      }),
    });
  }

  const wasteEuro = inappropriate.reduce((s, p) => s + p.costEuro, 0);
  const virtuousSpendEuro = virtuous.reduce((s, p) => s + p.costEuro, 0);
  const omissionEuro = omissions.reduce((s, p) => s + p.costEuro, 0);

  // Score: start from efficiency, apply HTA penalties
  let score = efficiencyPercent;
  const motivations: EconomyScoreMotivation[] = [];
  let appropriatenessCouplingApplied = false;
  let underPrescriptionApplied = false;

  const primarySourceRef =
    ECONOMY_RAG_REFS.nomenclatoreGeneric +
    ` · ${ECONOMY_RAG_REFS.art13}` +
    (extractAifaNota(ragRefs) ? ` · ${ECONOMY_RAG_REFS.noteAifa(extractAifaNota(ragRefs))}` : "");

  motivations.push({
    id: "eco_balance",
    type: "neutral",
    text: `Bilancio SSN: effettiva €${actualSpendEuro.toFixed(2)} · ideale GS €${idealSpendEuro.toFixed(2)} · Δ €${deltaSpendEuro >= 0 ? "+" : ""}${deltaSpendEuro.toFixed(2)} · scostamento ${scostamentoPercent}% · efficienza ${efficiencyPercent}%`,
    sourceRef: primarySourceRef,
    scoreImpact: 0,
  });

  if (actualSpendEuro === 0 && idealSpendEuro === 0) {
    motivations.push({
      id: "eco_zero_zero",
      type: "positive",
      text: "Spesa effettiva e ideale nulle — scostamento 0%, efficienza prescrittiva 100%",
      sourceRef: ECONOMY_RAG_REFS.nomenclatoreGeneric,
      scoreImpact: 100,
    });
  }

  if (virtuous.length > 0) {
    motivations.push({
      id: "eco_virtuous",
      type: "positive",
      text: `Prescrizioni virtuose: ${virtuous.length} (€${virtuousSpendEuro.toFixed(2)})`,
      sourceRef: ECONOMY_RAG_REFS.nomenclatore(virtuous[0]!.examId),
      scoreImpact: Math.round((virtuous.length / Math.max(1, idealDefs.length || virtuous.length)) * 20),
    });
  }

  if (wasteEuro > 0 || inappropriate.length > 0) {
    const wastePenalty = Math.min(
      45,
      Math.round(wasteEuro / 4) + inappropriate.length * 12,
    );
    score -= wastePenalty;
    appropriatenessCouplingApplied = true;
    motivations.push({
      id: "eco_waste",
      type: "negative",
      text: `Spreco / medicina difensiva: ${inappropriate.length} prestazioni (€${wasteEuro.toFixed(2)})`,
      sourceRef: pickEconomySourceRef({
        examId: inappropriate[0]?.examId ?? "n/d",
        ragRefs,
        kind: "inappropriate",
      }),
      scoreImpact: -wastePenalty,
    });
  }

  if (omissions.length > 0) {
    const omissionPenalty = Math.min(50, 25 + omissions.length * 8);
    score = Math.min(score, 100 - omissionPenalty);
    underPrescriptionApplied = true;
    motivations.push({
      id: "eco_omission",
      type: "negative",
      text: `Omissioni per falso risparmio: ${omissions.length} (€${omissionEuro.toFixed(2)} mancati)`,
      sourceRef: ECONOMY_RAG_REFS.art13,
      scoreImpact: -omissionPenalty,
    });
  }

  // Budget overrun vs session budget (operational HTA gate)
  if (budgetEuro > 0 && actualSpendEuro > budgetEuro) {
    const overrunPenalty = Math.min(
      25,
      Math.round(25 * (1 - budgetEuro / actualSpendEuro)),
    );
    score -= overrunPenalty;
    motivations.push({
      id: "eco_budget_overrun",
      type: "negative",
      text: `Sforamento budget sessione: €${actualSpendEuro.toFixed(2)} > €${budgetEuro.toFixed(2)}`,
      sourceRef: ECONOMY_RAG_REFS.nomenclatoreGeneric,
      scoreImpact: -overrunPenalty,
    });
  } else if (budgetEuro > 0 && actualSpendEuro > 0 && actualSpendEuro <= budgetEuro) {
    motivations.push({
      id: "eco_budget_ok",
      type: "positive",
      text: `Budget sessione rispettato (€${actualSpendEuro.toFixed(2)} ≤ €${budgetEuro.toFixed(2)})`,
      sourceRef: ECONOMY_RAG_REFS.nomenclatoreGeneric,
      scoreImpact: 10,
    });
  }

  const examsScore = params.examsAppropriatenessScore;
  if (
    typeof examsScore === "number" &&
    Number.isFinite(examsScore) &&
    examsScore < 60 &&
    !appropriatenessCouplingApplied
  ) {
    const gap = 60 - examsScore;
    score -= gap;
    appropriatenessCouplingApplied = true;
    motivations.push({
      id: "eco_approp_coupling",
      type: "negative",
      text: `Coupling appropriatezza esami ${Math.round(examsScore)}% < 60% — spesa non etica (Art. 13)`,
      sourceRef: ECONOMY_RAG_REFS.art13,
      scoreImpact: -gap,
    });
  }

  let final = clampPercent(score);
  if (underPrescriptionApplied && final >= 100) {
    final = clampPercent(100 - 35);
  }

  const caseTitle =
    params.caseTitle || registered?.title || registered?.code || "Caso clinico";
  const label = qualitativeLabel({
    score: final,
    underRx: underPrescriptionApplied,
    waste: wasteEuro,
    efficiency: efficiencyPercent,
  });

  const expertAnalysis = buildExpertAnalysis({
    caseTitle,
    score: final,
    actual: actualSpendEuro,
    ideal: idealSpendEuro,
    delta: deltaSpendEuro,
    efficiency: efficiencyPercent,
    scostamento: scostamentoPercent,
    waste: wasteEuro,
    omission: omissionEuro,
    virtuous,
    inappropriate,
    omissions,
    primarySourceRef,
  });

  return {
    score: final,
    qualitativeLabel: label,
    expertAnalysis,
    framework: "economy-ssn-hta",
    actualSpendEuro,
    idealSpendEuro,
    deltaSpendEuro,
    budgetEuro,
    scostamentoPercent,
    efficiencyPercent,
    wasteEuro,
    virtuousSpendEuro,
    omissionEuro,
    prescriptions: { virtuous, inappropriate, omissions },
    motivations,
    primarySourceRef,
    appropriatenessCouplingApplied,
    underPrescriptionApplied,
  };
}
