/**
 * Pilastro 1 — Empatia & Comunicazione Clinica
 * Framework Calgary-Cambridge + Validazione Emotiva + ponderazione d'urgenza.
 * Citazioni: Codice Deontologia Medica Art. 20 / Art. 24 (rag_knowledge_base).
 */

import type { AnamnesisQuestion } from "@/lib/data/cases/types";
import { getCaseById, normalizeCaseLookupKey } from "@/lib/data/cases/registry";

export type EmpathyScoreMotivation = {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef?: string;
  scoreImpact: number;
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
export const EMPATHY_RAG_REFS = {
  art20:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 20 (Relazione di cura e tempo di comunicazione)",
  art24:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 24 (Informazione e consenso del paziente)",
  calgary:
    "Rif. Framework Calgary-Cambridge — Patient-Centered Communication (ascolto attivo / exploration)",
} as const;

export type ClinicalUrgencyMode = "acute_emergency" | "stable_exploratory" | "standard";

export type EmpathyDimensionScore = {
  id: "active_listening" | "emotional_validation" | "clinical_context";
  label: string;
  score: number;
  weight: number;
  evidenceQuotes: string[];
  deficits: string[];
};

export type CalgaryEmpathyResult = {
  score: number;
  qualitativeLabel: string;
  expertAnalysis: string;
  urgencyMode: ClinicalUrgencyMode;
  dimensions: {
    activeListening: EmpathyDimensionScore;
    emotionalValidation: EmpathyDimensionScore;
    clinicalContext: EmpathyDimensionScore;
  };
  motivations: EmpathyScoreMotivation[];
  /** Legacy-compatible fields for persisted ScoreBreakdown.empathy */
  legacy: {
    baseline: number;
    validationBonus: number;
    transparencyBonus: number;
    allianceBonus: number;
    dismissalPenalty: number;
  };
};

const ACUTE_CASE_IDS = new Set([
  "car-f01", // STEMI — time-critical
  "car-m02", // EPA
  "car-d01", // Dissezione
  "car-d02", // TV sostenuta
  "car-d03", // Tamponamento
]);

const STABLE_EXPLORATORY_IDS = new Set([
  "car-f02", // FA-ARV stabile
  "car-m01", // NSTEMI atipico diabetico
  "car-m03", // BAV (urgente ma comunicazione breve + anamnesi mirata)
  "car-m04", // Pericardite
  "car-d04", // Intossicazione digitalica — esplorazione anamnestica farmacologica
]);

const ACUTE_CONTEXT_RE =
  /tamponament|edema polmonare|\bEPA\b|dissezione|shock|STEMI|ipossiem|SpO₂?\s*8|PA\s*8[0-9]|bradicardia.*3[0-9]|TV\s|arresto|PEA|Killip\s*III/i;

const STABLE_CONTEXT_RE =
  /pericardite|NSTEMI|atipic|diabetic|FA-ARV|fibrillazione atriale|stabile|palpitaz|equivalente anginoso/i;

/** A) Lived experience / fear / functional impact (Calgary-Cambridge exploration). */
const LIVED_EXPERIENCE_RE =
  /cosa (la|le) (spaventa|preoccupa|fa paura)|di cosa ha (paura|timore)|come (sta )?vivendo|impatto (su|sulla|sul)|nella (sua )?vita|al lavoro|a casa|cosa pensa (che sia|di)|ha paura (di|che)|si sente (ansios|terror|agit)|come si sente (emotivamente|ora)|cosa la inquieta|percezione del rischio|quanto (la )?limita/i;

/** B) Emotional validation / reassurance (Art. 20). */
const VALIDATION_RE =
  /capisco|comprendo|mi dispiace|la sua (ansia|preoccupazione|paura)|è normale sentirsi|riconosco (che|il)|dev['’]?essere difficil|la capisco|la rassicuro|non è sola|non è solo|ci occupiamo (noi|di lei)|ora siamo qui|stia (tranquill|seren)|la sua preoccupazione (è|è comprensibile)|capisco la preoccupazione/i;

/** Transparency / information (Art. 24) — supports alliance without replacing validation. */
const TRANSPARENCY_RE =
  /le spiego|in parole semplic|significa che|faremo (un |una )?|l['’]esame serve|serve a|passo dopo passo|in termini semplici|le dico (cosa|perché)|per capire meglio|senza (dolore|rischio)/i;

const ALLIANCE_RE =
  /ha domande|domande\s*\?|insieme (a lei|facciamo)|d['’]accordo\s*\?|mi segue|si senta liber|procediamo insieme|posso (aiutarla|rispondere)/i;

const BRUSQUE_RE =
  /\b(faccia subito|deve stare zitt|non c['’]è tempo|sbrighi?ati|solo s[iì] o no|non interrompa|basta cos[iì]|non mi interessa|non perdiamo tempo)\b|!{2,}/i;

const JUDGMENTAL_RE =
  /\b(è (solo )?ansia|esagera|non è niente|si inventa|è (tutta )?nella sua testa|è ipocondriac)\b/i;

const BUREAUCRATIC_RE =
  /\b(compili (il )?modulo|firma qui|prossimo paziente|codice triage|protocollo standard senza|non ho tempo di spiegare)\b/i;

const PATIENT_ANXIETY_RE =
  /paura|ansios[oa]|ansia|preoccupat[oa]|ho paura|non ce la faccio|sto malissimo|aiuto|terrorizzat|agitato|mi sento male/i;

const LIFESAVING_MILESTONE_HINTS = [
  "ecg",
  "cpap",
  "niv",
  "furosemide",
  "angio",
  "pericardiocentesi",
  "pacing",
  "pacemaker",
  "cardioversione",
  "amiodarone",
  "coronarografia",
  "fluidi",
  "calcio_gluconato",
];

function motivation(
  type: EmpathyScoreMotivation["type"],
  text: string,
  extra?: Partial<Pick<EmpathyScoreMotivation, "id" | "scoreImpact" | "sourceRef">>,
): EmpathyScoreMotivation {
  return {
    id: extra?.id ?? `emp_${type}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    text,
    scoreImpact: extra?.scoreImpact ?? 0,
    sourceRef: extra?.sourceRef,
  };
}

function clipQuote(s: string, max = 110): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function resolveClinicalUrgencyMode(params: {
  caseId?: string | null;
  caseContext?: string | null;
  caseTitle?: string | null;
}): ClinicalUrgencyMode {
  const id = params.caseId ? normalizeCaseLookupKey(params.caseId) : "";
  if (id && ACUTE_CASE_IDS.has(id)) return "acute_emergency";
  if (id && STABLE_EXPLORATORY_IDS.has(id)) return "stable_exploratory";

  const blob = `${params.caseTitle ?? ""} ${params.caseContext ?? ""}`;
  if (ACUTE_CONTEXT_RE.test(blob)) return "acute_emergency";
  if (STABLE_CONTEXT_RE.test(blob)) return "stable_exploratory";
  return "standard";
}

function dimensionWeights(mode: ClinicalUrgencyMode): {
  activeListening: number;
  emotionalValidation: number;
  clinicalContext: number;
} {
  switch (mode) {
    case "acute_emergency":
      // Empatia concisa + priorità salvavita
      return { activeListening: 0.25, emotionalValidation: 0.25, clinicalContext: 0.5 };
    case "stable_exploratory":
      return { activeListening: 0.45, emotionalValidation: 0.35, clinicalContext: 0.2 };
    default:
      return { activeListening: 0.4, emotionalValidation: 0.35, clinicalContext: 0.25 };
  }
}

function resolveAnamnesisQuestions(
  caseId?: string | null,
  explicit?: AnamnesisQuestion[] | null,
): AnamnesisQuestion[] {
  if (Array.isArray(explicit) && explicit.length > 0) return explicit;
  if (!caseId) return [];
  return getCaseById(caseId)?.anamnesisQuestions ?? [];
}

function matchAnamnesisCoverage(
  doctorText: string,
  questions: AnamnesisQuestion[],
): { covered: number; expected: number; missing: string[]; hitPrompts: string[] } {
  if (questions.length === 0) {
    return { covered: 0, expected: 0, missing: [], hitPrompts: [] };
  }
  const lower = doctorText.toLowerCase();
  const hitPrompts: string[] = [];
  const missing: string[] = [];
  for (const q of questions) {
    const hit = (q.expectedKeywords ?? []).some((kw) => {
      const k = kw.trim().toLowerCase();
      return k.length > 0 && lower.includes(k);
    });
    if (hit) hitPrompts.push(q.prompt);
    else if (q.critical) missing.push(q.prompt);
  }
  const expected = questions.filter((q) => q.critical).length || questions.length;
  const covered = hitPrompts.length;
  return { covered: Math.min(covered, expected), expected, missing, hitPrompts };
}

function scoreActiveListening(params: {
  doctorTurns: string[];
  doctorText: string;
  anamnesis: ReturnType<typeof matchAnamnesisCoverage>;
  mode: ClinicalUrgencyMode;
  weights: ReturnType<typeof dimensionWeights>;
}): EmpathyDimensionScore {
  const evidence: string[] = [];
  const deficits: string[] = [];
  let livedHits = 0;
  for (const turn of params.doctorTurns) {
    if (LIVED_EXPERIENCE_RE.test(turn)) {
      livedHits += 1;
      if (evidence.length < 3) evidence.push(clipQuote(turn));
    }
  }

  // Exploration of lived experience: 0–50
  let livedScore = 0;
  if (livedHits === 0) {
    livedScore = 0;
    deficits.push(
      "Manca esplorazione del vissuto/paura (Calgary-Cambridge: impact & ideas/concerns).",
    );
  } else if (livedHits === 1) livedScore = 28;
  else if (livedHits === 2) livedScore = 40;
  else livedScore = 50;

  // Anamnesis matrix coverage: 0–50 (proportional — no fictitious floor)
  let anamScore = 0;
  if (params.anamnesis.expected > 0) {
    anamScore = Math.round((params.anamnesis.covered / params.anamnesis.expected) * 50);
    if (params.anamnesis.covered > 0) {
      evidence.push(
        `Quesiti anamnestici chiave affrontati: ${params.anamnesis.covered}/${params.anamnesis.expected}`,
      );
    }
    if (params.anamnesis.missing.length > 0) {
      deficits.push(
        `Deficit anamnestici: ${params.anamnesis.missing.slice(0, 3).join("; ")}`,
      );
    }
  } else {
    // No case matrix: score from open clinical curiosity (questions)
    const questionTurns = params.doctorTurns.filter((t) => /\?|mi dica|da quanto|dove |come /.test(t));
    anamScore = Math.min(50, questionTurns.length * 12);
    if (questionTurns.length === 0) {
      deficits.push("Scarsa esplorazione anamnestica strutturata.");
    }
  }

  // In acute emergency, prolonged pure anamnesis without lived-experience brevity is ok if concise —
  // but very long chat without lifesaving is handled in dimension C.
  let score = clampScore(livedScore + anamScore);
  if (params.mode === "acute_emergency" && params.doctorTurns.length >= 8 && livedHits === 0) {
    // Prefer concise operational reassurance over long psychosocial interview
    score = clampScore(score - 10);
    deficits.push(
      "In emergenza acuta: anamnesi prolungata senza focus sul vissuto essenziale né rassicurazione operativa.",
    );
  }
  if (params.mode === "stable_exploratory" && livedHits === 0 && params.anamnesis.covered < 3) {
    score = clampScore(Math.min(score, 35));
    deficits.push(
      "Contesto stabile/atipico: richiesta esplorazione approfondita della storia clinica ed emotiva.",
    );
  }

  return {
    id: "active_listening",
    label: "Ascolto attivo & esplorazione del vissuto",
    score,
    weight: params.weights.activeListening,
    evidenceQuotes: evidence,
    deficits,
  };
}

function scoreEmotionalValidation(params: {
  doctorTurns: string[];
  chat: Array<{ role: string; content: string }>;
  weights: ReturnType<typeof dimensionWeights>;
}): EmpathyDimensionScore & { dismissalPenalty: number; validationHits: number; transparencyHits: number; allianceHits: number } {
  const evidence: string[] = [];
  const deficits: string[] = [];
  let validationHits = 0;
  let transparencyHits = 0;
  let allianceHits = 0;
  let brusqueHits = 0;
  let judgmentHits = 0;
  let bureauHits = 0;

  for (const turn of params.doctorTurns) {
    if (VALIDATION_RE.test(turn)) {
      validationHits += 1;
      if (evidence.length < 4) evidence.push(clipQuote(turn));
    }
    if (TRANSPARENCY_RE.test(turn)) transparencyHits += 1;
    if (ALLIANCE_RE.test(turn)) allianceHits += 1;
    if (BRUSQUE_RE.test(turn)) brusqueHits += 1;
    if (JUDGMENTAL_RE.test(turn)) judgmentHits += 1;
    if (BUREAUCRATIC_RE.test(turn)) bureauHits += 1;
  }

  // Proportional build (no +60 floor): validation up to 55, transparency 25, alliance 20
  let score = 0;
  if (validationHits === 1) score += 30;
  else if (validationHits === 2) score += 45;
  else if (validationHits >= 3) score += 55;

  if (transparencyHits === 1) score += 12;
  else if (transparencyHits >= 2) score += 25;

  if (allianceHits > 0) score += 20;

  let dismissalPenalty = 0;
  let anxietyIgnored = false;
  for (let i = 0; i < params.chat.length - 1; i += 1) {
    const cur = params.chat[i];
    const next = params.chat[i + 1];
    if (
      cur?.role === "assistant" &&
      next?.role === "user" &&
      PATIENT_ANXIETY_RE.test(cur.content) &&
      !VALIDATION_RE.test(next.content) &&
      !ALLIANCE_RE.test(next.content)
    ) {
      anxietyIgnored = true;
      break;
    }
  }
  if (anxietyIgnored) {
    dismissalPenalty += 20;
    deficits.push("Ansia del paziente non validata nel turno successivo (Art. 20).");
  }
  if (brusqueHits > 0) {
    dismissalPenalty += 25;
    deficits.push("Linguaggio direttivo/sbrigativo rilevato.");
  }
  if (judgmentHits > 0) {
    dismissalPenalty += 20;
    deficits.push("Linguaggio giudicante rispetto al vissuto del paziente.");
  }
  if (bureauHits > 0) {
    dismissalPenalty += 15;
    deficits.push("Tono eccessivamente burocratico (riduce alleanza terapeutica).");
  }

  if (validationHits === 0) {
    deficits.push("Assenza di atti di validazione emotiva espliciti.");
  }

  score = clampScore(score - dismissalPenalty);

  return {
    id: "emotional_validation",
    label: "Validazione emotiva & tono relazionale",
    score,
    weight: params.weights.emotionalValidation,
    evidenceQuotes: evidence,
    deficits,
    dismissalPenalty,
    validationHits,
    transparencyHits,
    allianceHits,
  };
}

function scoreClinicalContextAdequacy(params: {
  doctorTurns: string[];
  mode: ClinicalUrgencyMode;
  milestones: Set<string>;
  weights: ReturnType<typeof dimensionWeights>;
  validationHits: number;
}): EmpathyDimensionScore {
  const evidence: string[] = [];
  const deficits: string[] = [];
  const turnCount = params.doctorTurns.length;

  const lifesavingHit = [...params.milestones].some((k) =>
    LIFESAVING_MILESTONE_HINTS.some((h) => k.includes(h)),
  );

  let score = 70; // contextual baseline only for this dimension (not global empathy floor)

  if (params.mode === "acute_emergency") {
    // Reward concise operational reassurance + early lifesaving
    if (lifesavingHit) {
      score += 20;
      evidence.push("Manovre/azioni salvavita documentate in parallelo alla comunicazione.");
    } else {
      score -= 35;
      deficits.push(
        "Emergenza acuta: comunicazione senza evidenza di priorità a manovre salvavita (errore di priorità clinico-comportamentale).",
      );
    }
    if (turnCount >= 10 && !lifesavingHit) {
      score -= 25;
      deficits.push(
        "Anamnesi/dialogo prolungato in paziente potenzialmente instabile — ritardo comunicativo-operativo.",
      );
    }
    if (params.validationHits > 0 && turnCount <= 6) {
      score += 10;
      evidence.push("Rassicurazione operativa concisa appropriata al setting di emergenza.");
    }
    if (turnCount <= 2 && params.validationHits === 0) {
      score -= 10;
      deficits.push("Anche in emergenza serve una micro-rassicurazione (Art. 20) senza ritardare le cure.");
    }
  } else if (params.mode === "stable_exploratory") {
    if (turnCount < 3) {
      score -= 30;
      deficits.push(
        "Presentazione stabile/atipica: esplorazione troppo superficiale rispetto al bisogno diagnostico-relazionale.",
      );
    } else {
      score += 15;
      evidence.push("Tempo comunicativo adeguato a presentazione stabile/atipica.");
    }
    if (params.validationHits === 0 && turnCount >= 4) {
      score -= 15;
      deficits.push("Tempo dialogico presente ma senza validazione del vissuto.");
    }
  } else {
    if (turnCount === 0) {
      score = 0;
      deficits.push("Nessuna interazione comunicativa.");
    } else if (turnCount >= 3) {
      score += 10;
    }
  }

  return {
    id: "clinical_context",
    label: "Adeguatezza al contesto clinico-emodinamico",
    score: clampScore(score),
    weight: params.weights.clinicalContext,
    evidenceQuotes: evidence,
    deficits,
  };
}

function qualitativeLabel(final: number, mode: ClinicalUrgencyMode): string {
  if (final >= 85) {
    return mode === "acute_emergency"
      ? "Comunicazione d'emergenza eccellente — rassicurazione operativa e priorità cliniche allineate"
      : "Eccellente alleanza terapeutica e esplorazione del vissuto (Calgary-Cambridge)";
  }
  if (final >= 70) return "Buona comunicazione patient-centered con margini di miglioramento";
  if (final >= 55) return "Comunicazione professionale parziale — gap di validazione o esplorazione";
  if (final >= 40) return "Empatia insufficiente — deficit anamnestici/relazionali rilevanti";
  return "Comunicazione a rischio — tono inadeguato o errore di priorità clinico-comportamentale";
}

function buildExpertAnalysis(params: {
  final: number;
  mode: ClinicalUrgencyMode;
  A: EmpathyDimensionScore;
  B: EmpathyDimensionScore;
  C: EmpathyDimensionScore;
  doctorTurns: string[];
}): string {
  const modeLabel =
    params.mode === "acute_emergency"
      ? "setting di emergenza acuta / instabilità"
      : params.mode === "stable_exploratory"
        ? "setting stabile o presentazione atipica (esplorazione approfondita attesa)"
        : "setting clinico standard";

  const virtuous = [
    ...params.A.evidenceQuotes,
    ...params.B.evidenceQuotes,
    ...params.C.evidenceQuotes,
  ].slice(0, 4);

  const deficits = [...params.A.deficits, ...params.B.deficits, ...params.C.deficits].slice(
    0,
    5,
  );

  const parts: string[] = [];
  parts.push(
    `Analisi comportamentale (Framework Calgary-Cambridge × Validazione emotiva) in ${modeLabel}. ` +
      `Sintesi ponderata delle tre dimensioni: Ascolto/Esplorazione ${params.A.score}/100 (peso ${(params.A.weight * 100).toFixed(0)}%), ` +
      `Validazione/Tono ${params.B.score}/100 (peso ${(params.B.weight * 100).toFixed(0)}%), ` +
      `Adeguatezza contestuale ${params.C.score}/100 (peso ${(params.C.weight * 100).toFixed(0)}%) → punteggio complessivo ${params.final}/100.`,
  );

  if (virtuous.length > 0) {
    parts.push(
      `Atti comunicativi virtuosi rilevati: ${virtuous.map((q) => `«${q}»`).join(" · ")}.`,
    );
  } else if (params.doctorTurns.length > 0) {
    parts.push(
      "Non emergono frasi chiaramente virtuosistiche di esplorazione del vissuto o validazione emotiva nel trascritto analizzato.",
    );
  } else {
    parts.push("Assenza di turni medici valutabili: l'empatia clinica non è dimostrabile.");
  }

  if (deficits.length > 0) {
    parts.push(`Deficit anamnestici/relazionali: ${deficits.join(" ")}`);
  }

  parts.push(
    `Ancoraggio deontologico: la relazione di cura richiede tempo di comunicazione adeguato al contesto (Art. 20) e informazione comprensibile (Art. 24), senza ritardare le priorità salvavita quando l'emodinamica è instabile.`,
  );

  return parts.join(" ");
}

/**
 * Calgary-Cambridge + Validazione emotiva + ponderazione d'urgenza.
 * Nessun offset fittizio (+60) sul punteggio globale.
 */
export function computeCalgaryCambridgeEmpathy(params: {
  chatHistory?: Array<{ role: string; content: string }> | null;
  caseId?: string | null;
  caseContext?: string | null;
  caseTitle?: string | null;
  anamnesisQuestions?: AnamnesisQuestion[] | null;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
}): CalgaryEmpathyResult {
  const chat = Array.isArray(params.chatHistory) ? params.chatHistory : [];
  const doctorTurns = chat
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const doctorText = doctorTurns.join("\n");
  const milestones = new Set(
    (params.sessionMilestones ?? []).map((m) => m.milestoneKey).filter(Boolean),
  );

  const mode = resolveClinicalUrgencyMode({
    caseId: params.caseId,
    caseContext: params.caseContext,
    caseTitle: params.caseTitle,
  });
  const weights = dimensionWeights(mode);
  const questions = resolveAnamnesisQuestions(params.caseId, params.anamnesisQuestions);
  const anamnesis = matchAnamnesisCoverage(doctorText, questions);

  const A = scoreActiveListening({
    doctorTurns,
    doctorText,
    anamnesis,
    mode,
    weights,
  });
  const Bfull = scoreEmotionalValidation({
    doctorTurns,
    chat,
    weights,
  });
  const { dismissalPenalty, validationHits, transparencyHits, allianceHits, ...B } = Bfull;
  const C = scoreClinicalContextAdequacy({
    doctorTurns,
    mode,
    milestones,
    weights,
    validationHits,
  });

  const engaged = doctorTurns.length > 0;
  const final = engaged
    ? clampScore(
        Math.round(A.score * A.weight + B.score * B.weight + C.score * C.weight),
      )
    : 0;

  const motivations: EmpathyScoreMotivation[] = [];

  motivations.push(
    motivation(
      final >= 70 ? "positive" : "negative",
      `Pilastro 1 (Calgary-Cambridge): Ascolto ${A.score} · Validazione ${B.score} · Contesto ${C.score} → ${final}/100 (${mode})`,
      {
        id: "emp_calgary_summary",
        scoreImpact: final,
        sourceRef: EMPATHY_RAG_REFS.calgary,
      },
    ),
  );

  for (const q of A.evidenceQuotes.slice(0, 2)) {
    motivations.push(
      motivation("positive", `Esplorazione del vissuto: «${q}»`, {
        id: "emp_a_quote",
        scoreImpact: Math.round(A.score * A.weight * 0.25),
        sourceRef: EMPATHY_RAG_REFS.calgary,
      }),
    );
  }
  for (const d of A.deficits.slice(0, 2)) {
    motivations.push(
      motivation("negative", d, {
        id: "emp_a_def",
        scoreImpact: -Math.round((100 - A.score) * A.weight * 0.2),
        sourceRef: EMPATHY_RAG_REFS.calgary,
      }),
    );
  }

  for (const q of B.evidenceQuotes.slice(0, 2)) {
    motivations.push(
      motivation("positive", `Validazione emotiva: «${q}»`, {
        id: "emp_b_quote",
        scoreImpact: Math.round(B.score * B.weight * 0.25),
        sourceRef: EMPATHY_RAG_REFS.art20,
      }),
    );
  }
  for (const d of B.deficits.slice(0, 2)) {
    motivations.push(
      motivation("negative", d, {
        id: "emp_b_def",
        scoreImpact: -Math.round((100 - B.score) * B.weight * 0.25),
        sourceRef: EMPATHY_RAG_REFS.art20,
      }),
    );
  }

  if (transparencyHits > 0) {
    motivations.push(
      motivation("positive", "Trasparenza informativa su indagini/manovre (Art. 24)", {
        id: "emp_art24",
        scoreImpact: Math.min(15, transparencyHits * 8),
        sourceRef: EMPATHY_RAG_REFS.art24,
      }),
    );
  }

  for (const d of C.deficits.slice(0, 2)) {
    motivations.push(
      motivation("negative", d, {
        id: "emp_c_def",
        scoreImpact: -Math.round((100 - C.score) * C.weight * 0.3),
        sourceRef: EMPATHY_RAG_REFS.art20,
      }),
    );
  }
  for (const e of C.evidenceQuotes.slice(0, 2)) {
    motivations.push(
      motivation("positive", e, {
        id: "emp_c_ev",
        scoreImpact: Math.round(C.score * C.weight * 0.2),
        sourceRef: EMPATHY_RAG_REFS.art20,
      }),
    );
  }

  const expertAnalysis = buildExpertAnalysis({
    final,
    mode,
    A,
    B,
    C,
    doctorTurns,
  });

  // Legacy mapping for older report widgets (no fictitious global +60)
  const legacy = {
    baseline: 0,
    validationBonus: Math.min(55, validationHits === 0 ? 0 : validationHits === 1 ? 30 : validationHits === 2 ? 45 : 55),
    transparencyBonus: Math.min(25, transparencyHits === 0 ? 0 : transparencyHits === 1 ? 12 : 25),
    allianceBonus: allianceHits > 0 ? 20 : 0,
    dismissalPenalty,
  };

  return {
    score: final,
    qualitativeLabel: qualitativeLabel(final, mode),
    expertAnalysis,
    urgencyMode: mode,
    dimensions: {
      activeListening: A,
      emotionalValidation: B,
      clinicalContext: C,
    },
    motivations,
    legacy,
  };
}
