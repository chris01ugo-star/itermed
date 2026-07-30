import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { normalizeStepId } from "@/lib/cases/simulation-time";
import type { SessionMilestoneSnapshot } from "@/lib/simulator/milestone-tracker";
import { withOpenAIRetry } from "@/lib/ai/openai-retry";

export const semanticVerdictSchema = z.object({
  isEquivalent: z.boolean(),
  confidence: z.number().min(0).max(1),
  standardizedDiagnosis: z.string().max(200),
  macroscopicMismatch: z.boolean().default(false),
});

export type SemanticVerdict = z.infer<typeof semanticVerdictSchema>;

export type DiagnosisAlignerInput = {
  userDiagnosis: string;
  expectedDiagnosis: string;
  caseTitle?: string;
  caseDescription?: string;
  milestoneCompletionRate?: number;
};

export type DiagnosisAlignerResult = {
  isCorrect: boolean;
  rationale: string;
  expectedCondition?: string;
  standardizedDiagnosis?: string;
  confidence: number;
  method: "substring" | "deterministic" | "semantic" | "behavioral_override" | "no_expected";
  milestoneCompletionRate?: number;
};

type CanonicalEntry = {
  key: string;
  aliases: string[];
};

/** Dizionario locale acronimi / sinonimi medici → chiave canonica. */
const CANONICAL_DIAGNOSES: CanonicalEntry[] = [
  {
    key: "stemi",
    aliases: [
      "stemi",
      "st elevation myocardial infarction",
      "infarto miocardico acuto",
      "infarto acuto miocardio",
      "ima anteriore",
      "ima inferiore",
      "ima con sopraslivellamento",
      "sopraslivellamento st",
      "acs con sopraslivellamento",
    ],
  },
  {
    key: "nstemi",
    aliases: [
      "nstemi",
      "infarto miocardico non st",
      "ima non st",
      "sindrome coronarica acuta senza sopraslivellamento",
    ],
  },
  {
    key: "ictus_ischemico",
    aliases: [
      "ictus",
      "stroke",
      "ictus ischemico",
      "accidente cerebrovascolare",
      "ischemia cerebrale",
      "infarto cerebrale",
      "embolia cerebrale",
      "trombosi cerebrale",
    ],
  },
  {
    key: "emorragia_cerebrale",
    aliases: [
      "emorragia cerebrale",
      "ictus emorragico",
      "stroke emorragico",
      "ematoma intracerebrale",
      "sah",
      "emorragia subaracnoidea",
    ],
  },
  {
    key: "appendicite",
    aliases: ["appendicite", "appendicite acuta", "appendicite acuta non complicata"],
  },
  {
    key: "polmonite",
    aliases: ["polmonite", "polmonite acquisita in comunita", "pac", "infezione polmonare"],
  },
  {
    key: "scompenso_cardiaco",
    aliases: [
      "scompenso cardiaco",
      "insufficienza cardiaca",
      "edema polmonare cardiogeno",
      "scompenso cardiaco acuto",
    ],
  },
  {
    key: "embolia_polmonare",
    aliases: ["embolia polmonare", "tep", "pe", "tromboembolia polmonare"],
  },
  {
    key: "pancreatite",
    aliases: ["pancreatite", "pancreatite acuta", "pancreatite acuta biliare"],
  },
  {
    key: "sepsi",
    aliases: ["sepsi", "shock settico", "infezione sistemica", "batteriemia"],
  },
  {
    key: "asma_acuta",
    aliases: ["asma acuta", "crisi asmatica", "broncospasmo acuto", "exacerbazione asma"],
  },
  {
    key: "bpco_riacutizzata",
    aliases: ["bpco riacutizzata", "exacerbazione bpco", "riacutizzazione bpco"],
  },
];

const aliasIndex = new Map<string, string>();

for (const entry of CANONICAL_DIAGNOSES) {
  for (const alias of [entry.key, ...entry.aliases]) {
    aliasIndex.set(normalizeDiagnosisText(alias), entry.key);
  }
}

export function normalizeDiagnosisText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  return normalizeDiagnosisText(input)
    .split(" ")
    .filter((t) => t.length >= 3);
}

/** Risolve testo libero verso chiave canonica (match esatto alias o fuzzy token). */
export function resolveCanonicalDiagnosis(text: string): string | null {
  const norm = normalizeDiagnosisText(text);
  if (!norm) return null;

  const direct = aliasIndex.get(norm);
  if (direct) return direct;

  let best: { key: string; score: number } | null = null;

  for (const [alias, key] of aliasIndex.entries()) {
    if (alias.length < 4) continue;
    if (norm.includes(alias) || alias.includes(norm)) {
      const score = alias.length;
      if (!best || score > best.score) best = { key, score };
    }
  }

  if (best) return best.key;

  const tokens = tokenize(text);
  for (const entry of CANONICAL_DIAGNOSES) {
    const aliasTokens = entry.aliases.flatMap(tokenize);
    const overlap = tokens.filter((t) => aliasTokens.some((a) => a.includes(t) || t.includes(a))).length;
    if (overlap >= 2) return entry.key;
  }

  return null;
}

export function deterministicDiagnosisMatch(
  userDiagnosis: string,
  expectedDiagnosis: string,
): { matched: boolean; canonicalKey?: string } {
  const nUser = normalizeDiagnosisText(userDiagnosis);
  const nExpected = normalizeDiagnosisText(expectedDiagnosis);

  if (nExpected && nUser && (nExpected.includes(nUser) || nUser.includes(nExpected))) {
    return { matched: true };
  }

  const userCanon = resolveCanonicalDiagnosis(userDiagnosis);
  const expectedCanon = resolveCanonicalDiagnosis(expectedDiagnosis);

  if (userCanon && expectedCanon && userCanon === expectedCanon) {
    return { matched: true, canonicalKey: userCanon };
  }

  const userTokens = new Set(tokenize(userDiagnosis));
  const expectedTokens = tokenize(expectedDiagnosis);
  const shared = expectedTokens.filter((t) => userTokens.has(t));
  if (shared.length >= 2 && shared.length / Math.max(expectedTokens.length, 1) >= 0.5) {
    return { matched: true };
  }

  return { matched: false };
}

/** Calcola % milestone diagnostico-terapeutici completati vs Gold Standard. */
export function computeMilestoneCompletionRate(params: {
  goldStandardPath: string[];
  completedGoldSteps: string[];
  sessionMilestones: SessionMilestoneSnapshot[];
}): number {
  const { goldStandardPath, completedGoldSteps, sessionMilestones } = params;

  if (goldStandardPath.length === 0) {
    const therapeutic = sessionMilestones.filter(
      (m) => m.category === "clinical" || m.category === "exam" || m.source === "gold_standard",
    );
    if (therapeutic.length === 0) return 0;
    return Math.min(1, therapeutic.length / 6);
  }

  const completed = new Set(completedGoldSteps.map((s) => normalizeStepId(s)));
  const milestoneEvidence = sessionMilestones.map((m) =>
    normalizeDiagnosisText(`${m.milestoneKey} ${m.label} ${m.evidence ?? ""}`),
  );

  let met = 0;
  for (const step of goldStandardPath) {
    const normStep = normalizeStepId(step);
    const normText = normalizeDiagnosisText(step);

    const goldMet =
      completed.has(normStep) ||
      milestoneEvidence.some(
        (ev) => ev.includes(normText) || normText.split(" ").some((w) => w.length >= 4 && ev.includes(w)),
      );

    if (goldMet) met += 1;
  }

  return met / goldStandardPath.length;
}

const BEHAVIORAL_MILESTONE_THRESHOLD = 0.8;
const SEMANTIC_ACCEPT_CONFIDENCE = 0.65;
const BEHAVIORAL_ACCEPT_CONFIDENCE = 0.5;

export async function evaluateSemanticDiagnosisLLM(params: {
  userDiagnosis: string;
  expectedDiagnosis: string;
  caseTitle?: string;
  caseDescription?: string;
  milestoneCompletionRate?: number;
  generateObjectFn?: typeof generateObject;
}): Promise<SemanticVerdict> {
  const generate = params.generateObjectFn ?? generateObject;

  const { object } = await withOpenAIRetry(() =>
    generate({
      model: openai("gpt-4o-mini"),
      schema: semanticVerdictSchema,
      temperature: 0,
      system: `
Sei un arbitro semantico clinico. Rispondi SOLO JSON.
Regola: se lo studente identifica correttamente la patologia e il distretto d'organo bersaglio,
anche con gergo, acronimi o descrizioni fisiopatologiche equivalenti → isEquivalent: true.
macroscopicMismatch: true SOLO se la diagnosi indica una patologia radicalmente diversa e pericolosa
(es. infarto vs appendicite, ictus vs frattura).
confidence: 0.0-1.0 (quanto sei sicuro dell'equivalenza semantica).
standardizedDiagnosis: forma canonica breve in italiano.
`.trim(),
      prompt: `
CASO: ${params.caseTitle ?? "N/D"}
DESCRIZIONE: ${params.caseDescription ?? "N/D"}
DIAGNOSI ATTESA: """${params.expectedDiagnosis}"""
DIAGNOSI STUDENTE: """${params.userDiagnosis}"""
MILESTONE COMPLETATI: ${params.milestoneCompletionRate != null ? `${Math.round(params.milestoneCompletionRate * 100)}%` : "N/D"}
`.trim(),
    }),
  );

  return object;
}

function applyBehavioralCoherence(
  semantic: SemanticVerdict,
  milestoneRate: number | undefined,
): { accept: boolean; rationale?: string } {
  if (milestoneRate == null || milestoneRate < BEHAVIORAL_MILESTONE_THRESHOLD) {
    return { accept: false };
  }

  if (semantic.macroscopicMismatch) {
    return { accept: false };
  }

  if (semantic.isEquivalent && semantic.confidence >= BEHAVIORAL_ACCEPT_CONFIDENCE) {
    return {
      accept: true,
      rationale: `Coerenza comportamentale elevata (${Math.round(milestoneRate * 100)}% milestone): diagnosi semanticamente equivalente.`,
    };
  }

  if (!semantic.isEquivalent && semantic.confidence >= 0.72 && milestoneRate >= 0.85) {
    return {
      accept: true,
      rationale: `Override comportamentale: percorso clinico impeccabile (${Math.round(milestoneRate * 100)}% milestone) con equivalenza semantica probabile.`,
    };
  }

  return { accept: false };
}

/** Pipeline completa: deterministico → LLM → override comportamentale. */
export async function alignDiagnosis(
  input: DiagnosisAlignerInput,
  options?: { generateObjectFn?: typeof generateObject },
): Promise<DiagnosisAlignerResult> {
  const expected = input.expectedDiagnosis.trim();
  const userDx = input.userDiagnosis.trim();

  if (!expected) {
    return {
      isCorrect: true,
      rationale:
        "Nessuna soluzione corretta salvata per il caso: diagnosi accettata in attesa di revisione.",
      confidence: 1,
      method: "no_expected",
      milestoneCompletionRate: input.milestoneCompletionRate,
    };
  }

  const det = deterministicDiagnosisMatch(userDx, expected);
  if (det.matched) {
    return {
      isCorrect: true,
      rationale: det.canonicalKey
        ? `Match deterministico su concetto clinico canonico (${det.canonicalKey}).`
        : "Match testuale o sinonimico evidente tra diagnosi e soluzione attesa.",
      expectedCondition: expected,
      standardizedDiagnosis: expected,
      confidence: 0.95,
      method: "deterministic",
      milestoneCompletionRate: input.milestoneCompletionRate,
    };
  }

  const semantic = await evaluateSemanticDiagnosisLLM({
    userDiagnosis: userDx,
    expectedDiagnosis: expected,
    caseTitle: input.caseTitle,
    caseDescription: input.caseDescription,
    milestoneCompletionRate: input.milestoneCompletionRate,
    generateObjectFn: options?.generateObjectFn,
  });

  const behavioral = applyBehavioralCoherence(semantic, input.milestoneCompletionRate);

  if (behavioral.accept) {
    return {
      isCorrect: true,
      rationale: behavioral.rationale ?? semantic.standardizedDiagnosis,
      expectedCondition: expected,
      standardizedDiagnosis: semantic.standardizedDiagnosis,
      confidence: semantic.confidence,
      method: "behavioral_override",
      milestoneCompletionRate: input.milestoneCompletionRate,
    };
  }

  const accepted =
    semantic.isEquivalent &&
    !semantic.macroscopicMismatch &&
    semantic.confidence >= SEMANTIC_ACCEPT_CONFIDENCE;

  return {
    isCorrect: accepted,
    rationale: accepted
      ? `Equivalenza semantica confermata (confidence ${Math.round(semantic.confidence * 100)}%).`
      : semantic.macroscopicMismatch
        ? "Diagnosi macroscopicamente discordante rispetto alla patologia attesa."
        : `Diagnosi non equivalente alla soluzione attesa (confidence ${Math.round(semantic.confidence * 100)}%).`,
    expectedCondition: expected,
    standardizedDiagnosis: semantic.standardizedDiagnosis,
    confidence: semantic.confidence,
    method: "semantic",
    milestoneCompletionRate: input.milestoneCompletionRate,
  };
}
