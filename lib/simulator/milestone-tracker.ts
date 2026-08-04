import { prisma } from "@/lib/prisma";
import { normalizeStepId } from "@/lib/cases/simulation-time";
import {
  normalizeExamText,
  resolveCanonicalExam,
} from "@/lib/simulator/exam-canonical-registry";

export type MilestoneCategory = "clinical" | "legal" | "economic" | "empathy" | "exam";

export type DetectedMilestone = {
  milestoneKey: string;
  label: string;
  category: MilestoneCategory;
  source: "chat_pattern" | "exam_request" | "gold_standard" | "user_action";
  evidence?: string;
};

export type SessionMilestoneSnapshot = {
  milestoneKey: string;
  label: string;
  category: string;
  source: string;
  evidence: string | null;
  detectedAt: Date;
};

type MilestoneRule = {
  milestoneKey: string;
  label: string;
  category: MilestoneCategory;
  patterns: RegExp[];
};

const CHAT_MILESTONE_RULES: MilestoneRule[] = [
  {
    milestoneKey: "indagate_allergie",
    label: "Indagati allergie / intolleranze",
    category: "legal",
    patterns: [/allerg/i, /anafil/i, /intoller/i],
  },
  {
    milestoneKey: "anamnesi_farmaci",
    label: "Anamnesi farmacologica raccolta",
    category: "legal",
    patterns: [/farmac|medicin|assum|terap|flebo|anticoag|antibiot/i],
  },
  {
    milestoneKey: "escluso_uso_farmaci_de",
    label: "Valutata appropriatezza terapia / farmaci",
    category: "clinical",
    patterns: [/sospend|interromp|farmaco|terap|prescri/i],
  },
  {
    milestoneKey: "consenso_informato",
    label: "Consenso informato / spiegazione procedura",
    category: "legal",
    patterns: [/consenso|informat|autorizz|spieg.*rischi/i],
  },
  {
    milestoneKey: "documentazione_clinica",
    label: "Documentazione clinica / refertazione",
    category: "legal",
    patterns: [/document|refert|cartell|registr/i],
  },
  {
    milestoneKey: "anamnesi_completa",
    label: "Anamnesi mirata (sintomi / storia)",
    category: "clinical",
    patterns: [/anamnes|quando.*inizi|da quanto|stor/i],
  },
  {
    milestoneKey: "esame_obiettivo",
    label: "Esame obiettivo eseguito",
    category: "clinical",
    patterns: [/auscult|palp|obiettiv|esamin|ispezion/i],
  },
  {
    milestoneKey: "ascolto_attivo",
    label: "Ascolto attivo / validazione emotiva",
    category: "empathy",
    patterns: [/capisco|mi dica|raccont|come si sente|preoccup|ansia|dolore.*cap/i],
  },
  {
    milestoneKey: "comunicazione_empatica",
    label: "Comunicazione empatica / linguaggio accessibile",
    category: "empathy",
    patterns: [/tranquill|non si preoccup|spieg|in parole semplici|ci pens/i],
  },
  {
    milestoneKey: "diagnosi_differenziale",
    label: "Ipotesi diagnostiche formulate",
    category: "clinical",
    patterns: [/sospett|ipotesi|diagnosi|esclud|differenzial/i],
  },
  {
    milestoneKey: "piano_terapeutico",
    label: "Piano terapeutico / gestione proposta",
    category: "clinical",
    patterns: [/terap|tratt|somministr|prescri|piano|gest/i],
  },
];

const EXAM_CHAT_PATTERNS: Array<{ pattern: RegExp; resolver: (match: string) => string | null }> = [
  { pattern: /\b(tac|tc)\s*(encefal|cranio|cerebr|encefalo)\b/i, resolver: () => "tc_encefalo" },
  { pattern: /\b(tac|tc)\s*torac/i, resolver: () => "tc_torace" },
  { pattern: /\b(tac|tc)\s*addom/i, resolver: () => "tc_addome" },
  { pattern: /\btomografia\s+computerizzata\b/i, resolver: () => "tc_generica" },
  { pattern: /\bcateterismo\b|\bcoronarografia\b/i, resolver: () => "cateterismo" },
  { pattern: /\bemogas\b|\bgas\s+arterioso\b/i, resolver: () => "emogas" },
];

function resolveExamMilestone(
  examId: string,
  catalogName?: string,
): DetectedMilestone | null {
  const canon = resolveCanonicalExam(examId, catalogName);
  if (canon) {
    return {
      milestoneKey: canon.milestoneKey,
      label: `Esame richiesto: ${canon.label}`,
      category: "exam",
      source: "exam_request",
      evidence: catalogName ? `${examId} — ${catalogName}` : examId,
    };
  }

  const norm = normalizeStepId(examId);
  return {
    milestoneKey: `richiesto_esame_${norm.replace(/[^a-z0-9]+/g, "_")}`,
    label: `Esame richiesto: ${catalogName ?? examId}`,
    category: "exam",
    source: "exam_request",
    evidence: catalogName ? `${examId} — ${catalogName}` : examId,
  };
}

function detectExamsFromChatText(msg: string): DetectedMilestone[] {
  const found: DetectedMilestone[] = [];
  const norm = normalizeExamText(msg);

  for (const { pattern, resolver } of EXAM_CHAT_PATTERNS) {
    if (pattern.test(msg) || pattern.test(norm)) {
      const key = resolver(msg);
      if (!key) continue;
      const canon = resolveCanonicalExam(key);
      if (canon) {
        found.push({
          milestoneKey: canon.milestoneKey,
          label: `Esame richiesto (chat): ${canon.label}`,
          category: "exam",
          source: "chat_pattern",
          evidence: msg.slice(0, 280),
        });
      }
    }
  }

  return found;
}

function slugifyGoldStep(step: string): string {
  return normalizeStepId(step).replace(/[^a-z0-9]+/g, "_");
}

export function detectMilestonesFromTurn(params: {
  userMessage?: string;
  requestedExamIds?: string[];
  completedGoldSteps?: string[];
  examLabels?: Record<string, string>;
  prescribedExams?: Array<{ id: string; name: string }>;
}): DetectedMilestone[] {
  const found = new Map<string, DetectedMilestone>();
  const msg = params.userMessage?.trim() ?? "";

  if (msg.length > 0) {
    for (const rule of CHAT_MILESTONE_RULES) {
      if (rule.patterns.some((p) => p.test(msg))) {
        found.set(rule.milestoneKey, {
          milestoneKey: rule.milestoneKey,
          label: rule.label,
          category: rule.category,
          source: "chat_pattern",
          evidence: msg.slice(0, 280),
        });
      }
    }
    for (const m of detectExamsFromChatText(msg)) {
      found.set(m.milestoneKey, m);
    }
  }

  const examSources =
    params.prescribedExams ??
    (params.requestedExamIds ?? []).map((id) => ({
      id,
      name: params.examLabels?.[id] ?? id,
    }));

  for (const exam of examSources) {
    const m = resolveExamMilestone(exam.id, exam.name);
    if (m) found.set(m.milestoneKey, m);
  }

  for (const step of params.completedGoldSteps ?? []) {
    const key = `gold_standard_${slugifyGoldStep(step)}`;
    found.set(key, {
      milestoneKey: key,
      label: `Gold standard: ${step}`,
      category: "clinical",
      source: "gold_standard",
      evidence: step,
    });
  }

  return [...found.values()];
}

/**
 * Atomically upserts milestones — first detection wins (idempotent under concurrent chat).
 */
export async function recordSessionMilestones(
  sessionId: string,
  detected: DetectedMilestone[],
): Promise<void> {
  if (detected.length === 0) return;

  await prisma.$transaction(
    detected.map((m) =>
      prisma.simulationMilestone.upsert({
        where: {
          sessionId_milestoneKey: {
            sessionId,
            milestoneKey: m.milestoneKey,
          },
        },
        create: {
          sessionId,
          milestoneKey: m.milestoneKey,
          label: m.label,
          category: m.category,
          source: m.source,
          evidence: m.evidence?.slice(0, 500) ?? null,
        },
        update: {},
      }),
    ),
  );
}

export async function fetchSessionMilestones(
  sessionId: string,
): Promise<SessionMilestoneSnapshot[]> {
  return prisma.simulationMilestone.findMany({
    where: { sessionId },
    orderBy: { detectedAt: "asc" },
    select: {
      milestoneKey: true,
      label: true,
      category: true,
      source: true,
      evidence: true,
      detectedAt: true,
    },
  });
}

export const HELP_REQUESTED_MILESTONE_KEY = "help_requested";
export const CONSENT_INFORMED_MILESTONE_KEY = "consenso_informato";
/** Canonical action id for ESC Class I / gold path matching. */
export const CONSENT_INFORMED_ACTION_ID = "consenso-informato";

/**
 * Records a user-initiated informed-consent request (Modulo consenso).
 */
export async function recordConsentInformedRequest(params: {
  sessionId: string;
}): Promise<{ consentRequested: true; actionId: string }> {
  await prisma.simulationMilestone.upsert({
    where: {
      sessionId_milestoneKey: {
        sessionId: params.sessionId,
        milestoneKey: CONSENT_INFORMED_MILESTONE_KEY,
      },
    },
    create: {
      sessionId: params.sessionId,
      milestoneKey: CONSENT_INFORMED_MILESTONE_KEY,
      label: "Consenso informato / spiegazione procedura (iniziativa utente)",
      category: "legal",
      source: "user_action",
      evidence: CONSENT_INFORMED_ACTION_ID,
    },
    update: {
      evidence: CONSENT_INFORMED_ACTION_ID,
      label: "Consenso informato / spiegazione procedura (iniziativa utente)",
      source: "user_action",
    },
  });
  return { consentRequested: true, actionId: CONSENT_INFORMED_ACTION_ID };
}

/**
 * Records a user-initiated help/consult request for autonomy tracking.
 * Increments count in milestone evidence (unique key per session).
 */
export async function recordHelpRequest(params: {
  sessionId: string;
  helpRequestCount: number;
}): Promise<{ helpRequested: true; helpRequestCount: number }> {
  const count = Math.max(1, Math.floor(params.helpRequestCount) || 1);
  await prisma.simulationMilestone.upsert({
    where: {
      sessionId_milestoneKey: {
        sessionId: params.sessionId,
        milestoneKey: HELP_REQUESTED_MILESTONE_KEY,
      },
    },
    create: {
      sessionId: params.sessionId,
      milestoneKey: HELP_REQUESTED_MILESTONE_KEY,
      label: "Richiesta aiuto / consulto (iniziativa utente)",
      category: "clinical",
      source: "user_action",
      evidence: String(count),
    },
    update: {
      evidence: String(count),
      label: "Richiesta aiuto / consulto (iniziativa utente)",
      source: "user_action",
    },
  });
  return { helpRequested: true, helpRequestCount: count };
}

export function parseHelpTelemetryFromMilestones(
  milestones: Array<{ milestoneKey: string; evidence?: string | null }>,
): { helpRequested: boolean; helpRequestCount: number } {
  const hit = milestones.find((m) => m.milestoneKey === HELP_REQUESTED_MILESTONE_KEY);
  if (!hit) return { helpRequested: false, helpRequestCount: 0 };
  const n = Number.parseInt(String(hit.evidence ?? "1"), 10);
  return {
    helpRequested: true,
    helpRequestCount: Number.isFinite(n) && n > 0 ? n : 1,
  };
}

export function milestonesToEvaluationJson(milestones: SessionMilestoneSnapshot[]): string {
  if (milestones.length === 0) {
    return JSON.stringify({ milestones: [], note: "Nessun milestone registrato per questa sessione." });
  }

  return JSON.stringify(
    {
      count: milestones.length,
      milestones: milestones.map((m) => ({
        key: m.milestoneKey,
        label: m.label,
        category: m.category,
        source: m.source,
        evidence: m.evidence,
        detectedAt: m.detectedAt.toISOString(),
      })),
    },
    null,
    2,
  );
}
