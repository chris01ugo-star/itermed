/**
 * Generate 30 structured cardiology cases from matrix.json + ESC RAG chunks.
 *
 * Usage:
 *   npx tsx scripts/generate-cardiologia-cases.ts
 *   npx tsx scripts/generate-cardiologia-cases.ts --resume
 *   npx tsx scripts/generate-cardiologia-cases.ts --only=CARDIO-001
 *   npx tsx scripts/generate-cardiologia-cases.ts --patch-ages
 */
import { openai } from "@ai-sdk/openai";
import { embed, generateObject } from "ai";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import {
  GeneratedCaseNarrativeSchema,
  KnowledgeBaseCaseSchema,
  MATRIX_TO_ENGINE_DIFFICULTY,
  type GeneratedCaseNarrative,
  type KnowledgeBaseCase,
} from "@/lib/cases/knowledge-base-case-schema";
import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import { getPineconeIndex } from "@/lib/pinecone";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const MATRIX_PATH = resolve(process.cwd(), "knowledge_base/cardiologia/matrix.json");
const OUT_DIR = resolve(process.cwd(), "knowledge_base/cardiologia/cases");
const PINECONE_NAMESPACE = "guidelines";
const RAG_TOP_K = 4;

type MatrixRow = {
  id: string;
  title: string;
  condition: string;
  frequencyCategory: "HIGH" | "MEDIUM" | "LOW";
  difficulty: "BASE" | "INTERMEDIATE" | "ADVANCED";
  setting: "GUARDIA_MEDICA" | "PRONTO_SOCCORSO" | "AMBULATORIO" | "REPARTO";
  guidelineRef: string;
};

type Scaffold = {
  goldStandardPath: string[];
  inappropriateExamIds: string[];
  examBudgetEuro: number;
};

type RagHit = { chunkId: string; source: string; text: string };

const ALLOWED_EXAM_IDS = new Set([
  ...flattenCatalogExams().map((e) => e.id),
  "consenso-informato",
  "dapt",
  "trasferimento-ps",
  "cardioversione",
  "pacing",
]);

const EXAM_NAMES = new Map(flattenCatalogExams().map((e) => [e.id, e.name]));
EXAM_NAMES.set("consenso-informato", "Consenso informato");
EXAM_NAMES.set("dapt", "DAPT (ASA + P2Y12)");
EXAM_NAMES.set("trasferimento-ps", "Trasferimento in Pronto Soccorso");
EXAM_NAMES.set("cardioversione", "Cardioversione elettrica");
EXAM_NAMES.set("pacing", "Pacing transcutaneo / temporaneo");

const PRICE_EURO: Record<string, number> = {
  ecg: 11.6,
  "troponina-hs": 8,
  elettroliti: 8,
  "creat-urea-gfr": 8,
  "pt-ptt-inr": 9,
  emocromo: 4.5,
  ecocardio: 43.9,
  angio: 180,
  tc: 180,
  coronarografia: 1800,
  "nt-probnp": 18,
  "rx-torace": 15.5,
  ddimero: 9,
  ega: 12,
  lattati: 7,
  emocolture: 22,
  "pcr-pct": 12,
  ecocolordoppler: 42,
  ecografia: 35,
  abpm: 28,
  "assetto-lipidico": 8,
  hba1c: 6,
  glicemia: 3.5,
  "urine-sed": 3.5,
  fundus: 12,
  scintigrafia: 160,
  rm: 220,
  "pet-tc": 900,
  "beta-hcg": 8,
  biopsia: 80,
};

const LATENCY: Record<string, number> = {
  ecg: 8,
  "troponina-hs": 35,
  elettroliti: 30,
  "creat-urea-gfr": 30,
  "pt-ptt-inr": 30,
  emocromo: 30,
  ecocardio: 20,
  angio: 45,
  tc: 40,
  coronarografia: 25,
  "nt-probnp": 40,
  "rx-torace": 20,
  ddimero: 30,
  ega: 10,
  emocolture: 15,
  ecocolordoppler: 30,
  ecografia: 25,
  abpm: 1440,
};

const SETTING_LABEL: Record<MatrixRow["setting"], string> = {
  GUARDIA_MEDICA: "Guardia Medica territoriale",
  PRONTO_SOCCORSO: "Pronto Soccorso",
  AMBULATORIO: "Ambulatorio di Cardiologia",
  REPARTO: "Reparto di Cardiologia",
};

/** Epidemiology-aware age/sex (24–86). Used at generate-time and `--patch-ages`. */
const PATIENT_PROFILES: Record<string, { age: number; sex: "M" | "F" }> = {
  "CARDIO-001": { age: 67, sex: "M" }, // STEMI
  "CARDIO-002": { age: 74, sex: "F" }, // NSTEMI diabetico
  "CARDIO-003": { age: 79, sex: "M" }, // STEMI + BAV
  "CARDIO-004": { age: 61, sex: "M" }, // UA
  "CARDIO-005": { age: 52, sex: "F" }, // HTN ambulatorio
  "CARDIO-006": { age: 48, sex: "M" }, // urgenza ipertensiva
  "CARDIO-007": { age: 71, sex: "F" }, // emergenza ipertensiva
  "CARDIO-008": { age: 64, sex: "F" }, // FA nuova
  "CARDIO-009": { age: 78, sex: "M" }, // FA RVR
  "CARDIO-010": { age: 82, sex: "M" }, // FA + TAO
  "CARDIO-011": { age: 69, sex: "M" }, // HFrEF
  "CARDIO-012": { age: 76, sex: "F" }, // EPA
  "CARDIO-013": { age: 84, sex: "F" }, // HFpEF
  "CARDIO-014": { age: 63, sex: "M" }, // CCS angina
  "CARDIO-015": { age: 70, sex: "M" }, // CCS rivascolarizzazione
  "CARDIO-016": { age: 66, sex: "F" }, // CCS post-PCI
  "CARDIO-017": { age: 24, sex: "F" }, // sincope vasovagale giovane
  "CARDIO-018": { age: 81, sex: "M" }, // sincope cardiogena
  "CARDIO-019": { age: 57, sex: "F" }, // EP intermedia
  "CARDIO-020": { age: 73, sex: "M" }, // EP alto rischio
  "CARDIO-021": { age: 68, sex: "M" }, // TVNS
  "CARDIO-022": { age: 72, sex: "M" }, // TV sostenuta
  "CARDIO-023": { age: 31, sex: "M" }, // HCM screening giovane
  "CARDIO-024": { age: 38, sex: "F" }, // DCM genetica
  "CARDIO-025": { age: 59, sex: "M" }, // AOP
  "CARDIO-026": { age: 77, sex: "M" }, // AAA
  "CARDIO-027": { age: 80, sex: "F" }, // ischemia acuta arto
  "CARDIO-028": { age: 29, sex: "F" }, // gravidanza
  "CARDIO-029": { age: 46, sex: "M" }, // endocardite
  "CARDIO-030": { age: 86, sex: "M" }, // dissezione tipo A (picco età avanzata)
};

const SCAFFOLDS: Record<string, Scaffold> = {
  "CARDIO-001": {
    goldStandardPath: [
      "ecg",
      "troponina-hs",
      "elettroliti",
      "creat-urea-gfr",
      "pt-ptt-inr",
      "ecocardio",
      "consenso-informato",
      "coronarografia",
    ],
    inappropriateExamIds: ["angio", "tc"],
    examBudgetEuro: 120,
  },
  "CARDIO-002": {
    goldStandardPath: [
      "ecg",
      "troponina-hs",
      "elettroliti",
      "creat-urea-gfr",
      "pt-ptt-inr",
      "nt-probnp",
      "ecocardio",
    ],
    inappropriateExamIds: ["pet-tc", "rm"],
    examBudgetEuro: 140,
  },
  "CARDIO-003": {
    goldStandardPath: [
      "ecg",
      "troponina-hs",
      "elettroliti",
      "ega",
      "ecocardio",
      "pacing",
      "consenso-informato",
      "coronarografia",
    ],
    inappropriateExamIds: ["angio", "tc"],
    examBudgetEuro: 160,
  },
  "CARDIO-004": {
    goldStandardPath: ["ecg", "troponina-hs", "elettroliti", "trasferimento-ps"],
    inappropriateExamIds: ["coronarografia", "pet-tc"],
    examBudgetEuro: 80,
  },
  "CARDIO-005": {
    goldStandardPath: [
      "ecg",
      "creat-urea-gfr",
      "elettroliti",
      "assetto-lipidico",
      "hba1c",
      "urine-sed",
      "fundus",
    ],
    inappropriateExamIds: ["angio", "tc"],
    examBudgetEuro: 90,
  },
  "CARDIO-006": {
    goldStandardPath: ["ecg", "creat-urea-gfr", "elettroliti", "urine-sed", "troponina-hs"],
    inappropriateExamIds: ["abpm", "angio"],
    examBudgetEuro: 85,
  },
  "CARDIO-007": {
    goldStandardPath: ["ecg", "ega", "creat-urea-gfr", "troponina-hs", "tc", "fundus"],
    inappropriateExamIds: ["abpm", "pet-tc"],
    examBudgetEuro: 220,
  },
  "CARDIO-008": {
    goldStandardPath: ["ecg", "elettroliti", "troponina-hs", "pt-ptt-inr", "ecocardio"],
    inappropriateExamIds: ["coronarografia", "tc"],
    examBudgetEuro: 100,
  },
  "CARDIO-009": {
    goldStandardPath: ["ecg", "elettroliti", "ega", "troponina-hs", "pt-ptt-inr"],
    inappropriateExamIds: ["coronarografia", "rm"],
    examBudgetEuro: 110,
  },
  "CARDIO-010": {
    goldStandardPath: ["ecg", "pt-ptt-inr", "creat-urea-gfr", "emocromo"],
    inappropriateExamIds: ["tc", "angio"],
    examBudgetEuro: 70,
  },
  "CARDIO-011": {
    goldStandardPath: ["ecg", "nt-probnp", "rx-torace", "elettroliti", "creat-urea-gfr", "ecocardio"],
    inappropriateExamIds: ["coronarografia", "pet-tc"],
    examBudgetEuro: 130,
  },
  "CARDIO-012": {
    goldStandardPath: ["ecg", "ega", "nt-probnp", "rx-torace", "troponina-hs", "ecocardio"],
    inappropriateExamIds: ["angio", "colonscopia"],
    examBudgetEuro: 150,
  },
  "CARDIO-013": {
    goldStandardPath: ["ecg", "nt-probnp", "rx-torace", "ecocardio", "elettroliti", "creat-urea-gfr"],
    inappropriateExamIds: ["coronarografia", "pet-tc"],
    examBudgetEuro: 140,
  },
  "CARDIO-014": {
    goldStandardPath: ["ecg", "assetto-lipidico", "glicemia", "ecocardio"],
    inappropriateExamIds: ["coronarografia", "pet-tc"],
    examBudgetEuro: 90,
  },
  "CARDIO-015": {
    goldStandardPath: ["ecg", "ecocardio", "scintigrafia", "assetto-lipidico"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 220,
  },
  "CARDIO-016": {
    goldStandardPath: ["ecg", "troponina-hs", "elettroliti", "creat-urea-gfr", "pt-ptt-inr"],
    inappropriateExamIds: ["angio", "tc"],
    examBudgetEuro: 100,
  },
  "CARDIO-017": {
    goldStandardPath: ["ecg", "glicemia", "elettroliti"],
    inappropriateExamIds: ["tc", "eeg"],
    examBudgetEuro: 60,
  },
  "CARDIO-018": {
    goldStandardPath: ["ecg", "elettroliti", "troponina-hs", "ecocardio"],
    inappropriateExamIds: ["eeg", "tc"],
    examBudgetEuro: 110,
  },
  "CARDIO-019": {
    goldStandardPath: ["ddimero", "ega", "rx-torace", "troponina-hs", "nt-probnp", "angio"],
    inappropriateExamIds: ["coronarografia", "colonscopia"],
    examBudgetEuro: 250,
  },
  "CARDIO-020": {
    goldStandardPath: ["ega", "ecg", "ecocardio", "lattati", "angio"],
    inappropriateExamIds: ["ddimero", "scintigrafia"],
    examBudgetEuro: 280,
  },
  "CARDIO-021": {
    goldStandardPath: ["ecg", "elettroliti", "troponina-hs", "ecocardio"],
    inappropriateExamIds: ["eeg", "pet-tc"],
    examBudgetEuro: 110,
  },
  "CARDIO-022": {
    goldStandardPath: ["ecg", "elettroliti", "ega", "troponina-hs", "ecocardio", "cardioversione"],
    inappropriateExamIds: ["tc", "rm"],
    examBudgetEuro: 140,
  },
  "CARDIO-023": {
    goldStandardPath: ["ecg", "ecocardio", "elettroliti"],
    inappropriateExamIds: ["coronarografia", "pet-tc"],
    examBudgetEuro: 90,
  },
  "CARDIO-024": {
    goldStandardPath: ["ecg", "nt-probnp", "ecocardio", "elettroliti", "creat-urea-gfr", "rx-torace"],
    inappropriateExamIds: ["colonscopia", "pet-tc"],
    examBudgetEuro: 140,
  },
  "CARDIO-025": {
    goldStandardPath: ["ecocolordoppler", "assetto-lipidico", "glicemia", "hba1c"],
    inappropriateExamIds: ["angio", "coronarografia"],
    examBudgetEuro: 80,
  },
  "CARDIO-026": {
    goldStandardPath: ["ecografia", "ecocolordoppler", "emocromo", "creat-urea-gfr"],
    inappropriateExamIds: ["colonscopia", "rm"],
    examBudgetEuro: 120,
  },
  "CARDIO-027": {
    goldStandardPath: ["ecocolordoppler", "emocromo", "pt-ptt-inr", "creat-urea-gfr", "elettroliti"],
    inappropriateExamIds: ["moc", "mammografia"],
    examBudgetEuro: 130,
  },
  "CARDIO-028": {
    goldStandardPath: ["ecg", "ecocardio", "pt-ptt-inr", "beta-hcg", "emocromo"],
    inappropriateExamIds: ["tc", "rx-torace"],
    examBudgetEuro: 110,
  },
  "CARDIO-029": {
    goldStandardPath: ["emocromo", "pcr-pct", "emocolture", "ecocardio", "creat-urea-gfr", "urine-sed"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 160,
  },
  "CARDIO-030": {
    goldStandardPath: ["ecg", "troponina-hs", "rx-torace", "ddimero", "pt-ptt-inr", "creat-urea-gfr", "angio"],
    inappropriateExamIds: ["coronarografia", "pet-tc"],
    examBudgetEuro: 280,
  },
};

function parseArgs(argv: string[]) {
  let resume = false;
  let validateOnly = false;
  let patchAges = false;
  let only: string | null = null;
  for (const arg of argv) {
    if (arg === "--resume") resume = true;
    if (arg === "--validate-only") validateOnly = true;
    if (arg === "--patch-ages") patchAges = true;
    if (arg.startsWith("--only=")) only = arg.slice("--only=".length).trim();
  }
  return { resume, validateOnly, patchAges, only };
}

function sourceNameFor(pdf: string): string {
  return `knowledge_base/cardiologia/clinical/${pdf}`;
}

function timeLimits(difficulty: MatrixRow["difficulty"]) {
  if (difficulty === "BASE") return { timeLimitMinutes: 20, patientDeteriorationThreshold: 10 };
  if (difficulty === "INTERMEDIATE") return { timeLimitMinutes: 25, patientDeteriorationThreshold: 12 };
  return { timeLimitMinutes: 30, patientDeteriorationThreshold: 12 };
}

function normalizeBloodPressure(raw: string): string {
  const match = String(raw).replace(/\s+/g, "").match(/(\d{2,3})\/(\d{2,3})/);
  return match ? `${match[1]}/${match[2]}` : "120/80";
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function wasteRationale(examId: string, guidelineRef: string): string {
  return `Esame non di prima intenzione per questo quadro clinico (spreco SSN / possibile ritardo terapeutico). Riferimento: ${guidelineRef}.`;
}

async function retrieveGuidelineChunks(pdf: string, query: string): Promise<RagHit[]> {
  const index = getPineconeIndex();
  if (!index) {
    throw new Error("Pinecone non configurato (PINECONE_API_KEY + PINECONE_INDEX).");
  }
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query.slice(0, 8000),
  });
  const sourceName = sourceNameFor(pdf);
  const queryOnce = async (filter?: Record<string, unknown>) =>
    index.namespace(PINECONE_NAMESPACE).query({
      vector: embedding,
      topK: RAG_TOP_K,
      includeMetadata: true,
      ...(filter ? { filter } : {}),
    });

  let response = await queryOnce({ sourceName: { $eq: sourceName } });
  if ((response.matches ?? []).length === 0) {
    response = await queryOnce();
  }

  const hits: RagHit[] = [];
  for (const match of response.matches ?? []) {
    const metadata = (match.metadata ?? {}) as Record<string, unknown>;
    const text = typeof metadata.content === "string" ? metadata.content.trim() : "";
    if (!text) continue;
    const src = typeof metadata.sourceName === "string" ? metadata.sourceName : "";
    if (src && !src.includes(pdf) && (response.matches?.length ?? 0) > RAG_TOP_K / 2) {
      // Prefer same-PDF hits when the unfiltered query mixed sources.
      continue;
    }
    hits.push({
      chunkId: typeof match.id === "string" ? match.id : String(metadata.chunkId ?? "unknown"),
      source: src || sourceName,
      text: text.slice(0, 900),
    });
  }
  if (hits.length === 0) {
    for (const match of response.matches ?? []) {
      const metadata = (match.metadata ?? {}) as Record<string, unknown>;
      const text = typeof metadata.content === "string" ? metadata.content.trim() : "";
      if (!text) continue;
      hits.push({
        chunkId: typeof match.id === "string" ? match.id : String(metadata.chunkId ?? "unknown"),
        source: typeof metadata.sourceName === "string" ? metadata.sourceName : sourceName,
        text: text.slice(0, 900),
      });
      if (hits.length >= RAG_TOP_K) break;
    }
  }
  return hits;
}

function formatRagCorpus(hits: RagHit[]): string {
  if (hits.length === 0) return "(nessun chunk RAG recuperato)";
  return hits
    .map((h, i) => `[${i + 1}] CHUNK_ID=${h.chunkId}\nFONTE=${h.source}\n${h.text}`)
    .join("\n---\n");
}

function examLatenciesFor(path: string[], extra: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of [...path, ...extra]) {
    if (LATENCY[id] != null) out[id] = LATENCY[id];
  }
  return out;
}

function ensureLen(text: string, min: number, max: number, fallback: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim() || fallback;
  if (trimmed.length >= min) return trimmed.slice(0, max);
  return `${trimmed} ${fallback}`.trim().slice(0, max);
}

function findingForExam(examId: string, matrix: MatrixRow, summary: string, inappropriate: boolean): string {
  const name = EXAM_NAMES.get(examId) ?? examId;
  if (inappropriate) return wasteRationale(examId, matrix.guidelineRef);
  const hint = summary.trim().slice(0, 280);
  return ensureLen(
    `${name} nel contesto di ${matrix.condition} (${matrix.id}). ${hint}`,
    20,
    900,
    `Reperto coerente con ${matrix.title}.`,
  );
}

function anamnesisFor(matrix: MatrixRow): KnowledgeBaseCase["anamnesisQuestions"] {
  const base = [
    {
      prompt: `Tempo e modalità di insorgenza dei sintomi (${matrix.condition})`,
      keywords: ["da quanto", "quando", "insorgenza", "inizio"],
      rationale: "Definisce urgenza e finestra terapeutica.",
    },
    {
      prompt: "Caratteristiche dei sintomi (sede, qualità, irradiazione, fattori scatenanti)",
      keywords: ["dove", "come", "irradia", "sforzo", "riposo"],
      rationale: "Fenotipo clinico per diagnosi differenziale cardiologica.",
    },
    {
      prompt: "Fattori di rischio cardiovascolare (ipertensione, diabete, fumo, dislipidemia, familiarità)",
      keywords: ["ipertens", "diabet", "fum", "colesterolo", "familiar"],
      rationale: "Profilo di rischio e contesto epidemiologico.",
    },
    {
      prompt: "Terapie in atto, allergie e precedenti cardiologici / procedure",
      keywords: ["farmaci", "terapia", "allergia", "stent", "bypass"],
      rationale: "Baseline prescrittiva e sicurezza (Gelli-Bianco / appropriatezza).",
    },
    {
      prompt: "Sintomi di allarme (sincope, dispnea, dolore, deficit neurologico, sanguinamento)",
      keywords: ["sincope", "dispnea", "dolore", "sangue", "deficit"],
      rationale: "Identifica instabilità e red flag tempo-dipendenti.",
    },
    {
      prompt: `Contesto di presentazione: ${SETTING_LABEL[matrix.setting]}`,
      keywords: ["dove si trova", "arrivato", "ambulanza", "visita"],
      rationale: "Il setting condiziona triage, risorse e obblighi di trasferimento.",
    },
  ];
  return base.map((q, i) => ({
    id: `aq_${matrix.id.toLowerCase()}_${i + 1}`,
    prompt: q.prompt,
    critical: i < 5,
    expectedKeywords: q.keywords,
    rationale: q.rationale,
  }));
}

function citationsFromRag(hits: RagHit[], guidelineRef: string, fallbackQuote: string): KnowledgeBaseCase["escCitations"] {
  const rows = hits.slice(0, 4).map((h) => ({
    chunkId: h.chunkId,
    source: h.source || sourceNameFor(guidelineRef),
    quote: ensureLen(h.text, 20, 500, fallbackQuote),
  }));
  if (rows.length > 0) return rows;
  return [
    {
      chunkId: `fallback-${guidelineRef}`,
      source: sourceNameFor(guidelineRef),
      quote: ensureLen(fallbackQuote, 20, 500, `Riferimento ${guidelineRef}.`),
    },
  ];
}

const ACTION_IDS = new Set(["consenso-informato", "dapt", "trasferimento-ps", "cardioversione", "pacing"]);

function assembleCase(params: {
  matrix: MatrixRow;
  scaffold: Scaffold;
  narrative: GeneratedCaseNarrative;
  ragHits: RagHit[];
}): KnowledgeBaseCase {
  const { matrix, scaffold, narrative } = params;
  const engineDifficulty = MATRIX_TO_ENGINE_DIFFICULTY[matrix.difficulty];
  const times = timeLimits(matrix.difficulty);
  const summary = narrative.examAbnormalitiesSummary || narrative.goldPathNarrative;

  const requiredIds = [...new Set([...scaffold.goldStandardPath, ...scaffold.inappropriateExamIds])].filter(
    (id) => ALLOWED_EXAM_IDS.has(id) && EXAM_NAMES.has(id) && !ACTION_IDS.has(id),
  );

  const values: Record<
    string,
    { finding: string; normalFinding: string; isAbnormal: boolean; price: number }
  > = {};

  const mandatoryExams: KnowledgeBaseCase["mandatoryExams"] = [];
  for (const examId of scaffold.goldStandardPath) {
    if (!requiredIds.includes(examId)) continue;
    const finding = findingForExam(examId, matrix, summary, false);
    const price = PRICE_EURO[examId] ?? 0;
    values[examId] = { finding, normalFinding: finding, isAbnormal: true, price };
    mandatoryExams.push({
      examId,
      name: EXAM_NAMES.get(examId) ?? examId,
      finding,
      isAbnormal: true,
      priceEuro: price,
    });
  }

  const inappropriateExams: KnowledgeBaseCase["inappropriateExams"] = [];
  for (const examId of scaffold.inappropriateExamIds) {
    const finding = findingForExam(examId, matrix, summary, true);
    const price = PRICE_EURO[examId] ?? 0;
    values[examId] = { finding, normalFinding: finding, isAbnormal: false, price };
    inappropriateExams.push({
      examId,
      name: EXAM_NAMES.get(examId) ?? examId,
      finding,
      isAbnormal: false,
      priceEuro: price,
      inappropriate: true,
      wasteRationale: wasteRationale(examId, matrix.guidelineRef),
    });
  }

  const description = ensureLen(
    narrative.description,
    40,
    2500,
    `${matrix.title} in ${SETTING_LABEL[matrix.setting]}. Patologia: ${matrix.condition}.`,
  );
  const presentation = ensureLen(
    narrative.presentation,
    40,
    2500,
    `Paziente valutato in ${SETTING_LABEL[matrix.setting]} per ${matrix.condition}.`,
  );
  const pastMedicalHistory = ensureLen(
    narrative.pastMedicalHistory,
    40,
    2500,
    `Anamnesi patologica prossima e remota coerente con ${matrix.condition}.`,
  );
  const patientPrompt = ensureLen(
    narrative.patientPrompt,
    40,
    2500,
    `Sei ${narrative.name || "il paziente"}. Descrivi i sintomi senza nominare la diagnosi e senza citare valori numerici.`,
  );
  const correctSolution = ensureLen(
    narrative.correctSolution,
    40,
    2500,
    `Gold path: ${scaffold.goldStandardPath.join(" → ")}. Linea guida: ${matrix.guidelineRef}.`,
  );
  const goldPathNarrative = ensureLen(
    narrative.goldPathNarrative,
    40,
    2000,
    `Percorso diagnostico-terapeutico ESC: ${scaffold.goldStandardPath.join(" → ")}. Evitare ${scaffold.inappropriateExamIds.join(", ")}.`,
  );
  const physicalSummary = ensureLen(
    narrative.physicalExamSummary,
    40,
    1200,
    `Esame obiettivo in ${SETTING_LABEL[matrix.setting]}, quadro compatibile con ${matrix.condition}.`,
  );
  const gelli = ensureLen(
    narrative.gelliArt5Adherence,
    30,
    800,
    `L'adesione alle linee guida ESC (${matrix.guidelineRef}) e al gold path costituisce parametro di conformità alle buone pratiche clinico-assistenziali (L. 24/2017 Art. 5 Gelli-Bianco).`,
  );
  const redHerrings = [narrative.redHerring1, narrative.redHerring2, narrative.redHerring3].map((h) =>
    ensureLen(h || "", 8, 400, "Dettaglio anamnestico rumoroso non dirimente."),
  );

  const baselineExamFindings = {
    vitals: {
      heartRate: clamp(Number(narrative.heartRate), 30, 220),
      bloodPressure: normalizeBloodPressure(narrative.bloodPressure),
      spo2: clamp(Number(narrative.spo2), 50, 100),
      temperature: clamp(Number(narrative.temperature), 34, 41),
      respiratoryRate: clamp(Number(narrative.respiratoryRate), 6, 50),
    },
    examBudgetEuro: scaffold.examBudgetEuro,
    demographics: {
      age: PATIENT_PROFILES[matrix.id]?.age ?? clamp(Number(narrative.age), 24, 86),
      sex: PATIENT_PROFILES[matrix.id]?.sex ?? narrative.sex,
      context: ensureLen(narrative.context, 8, 240, SETTING_LABEL[matrix.setting]),
    },
    physicalExam: {
      finding: physicalSummary,
      killipClass: narrative.killipClass,
    },
    advancedExams: { values },
    ...Object.fromEntries(
      Object.entries(values).map(([id, row]) => [id, { finding: row.finding, isAbnormal: row.isAbnormal }]),
    ),
  };

  return {
    id: matrix.id,
    code: matrix.id,
    title: matrix.title,
    description,
    difficulty: engineDifficulty,
    specialty: "cardiologia",
    specialtyLabel: "Cardiologia",
    condition: matrix.condition,
    frequencyCategory: matrix.frequencyCategory,
    matrixDifficulty: matrix.difficulty,
    setting: matrix.setting,
    guidelineRef: matrix.guidelineRef,
    diagnosis: ensureLen(narrative.diagnosis, 8, 400, matrix.condition),
    pastMedicalHistory,
    presentation,
    redHerrings,
    patientPrompt,
    correctSolution,
    goldStandardPath: scaffold.goldStandardPath,
    goldPathNarrative,
    timeLimitMinutes: times.timeLimitMinutes,
    patientDeteriorationThreshold: times.patientDeteriorationThreshold,
    examLatencies: examLatenciesFor(scaffold.goldStandardPath, scaffold.inappropriateExamIds),
    anamnesisQuestions: anamnesisFor(matrix),
    physicalExam: {
      killipClass: narrative.killipClass,
      summary: physicalSummary,
    },
    baselineExamFindings,
    escCitations: citationsFromRag(params.ragHits, matrix.guidelineRef, goldPathNarrative),
    auditMetrics: {
      appropriatenessIndicators: [
        `Eseguire in sequenza il gold path: ${scaffold.goldStandardPath.join(" → ")}.`,
        `Non prescrivere di prima intenzione: ${scaffold.inappropriateExamIds.join(", ")} (${matrix.guidelineRef}).`,
        `Budget SSN di riferimento: €${scaffold.examBudgetEuro}.`,
      ],
      gelliBiancoShield: {
        art5Adherence: gelli,
        legalCriteria: [
          "Documentare adesione alle linee guida ESC accreditate (L. 24/2017 Art. 5).",
          "Raccogliere consenso informato prima di procedure invasive.",
          "Evitare esami inappropriati (Codice deontologico, appropriatezza prescrittiva).",
          `Registrare tempi critici nel setting ${SETTING_LABEL[matrix.setting]}.`,
        ],
      },
    },
    mandatoryExams,
    inappropriateExams,
  };
}

async function generateNarrative(params: {
  matrix: MatrixRow;
  scaffold: Scaffold;
  ragHits: RagHit[];
}): Promise<GeneratedCaseNarrative> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: GeneratedCaseNarrativeSchema,
    temperature: 0.4,
    system: `Sei un cardiologo ESC e un medico-legale (L. 24/2017 Gelli-Bianco) che progetta casi per un simulatore formativo italiano (AEQUAN).
Scrivi in italiano un caso realistico e internamente coerente.

REGOLE:
- Non inventare classi ESC (I/IIa/III) se non compaiono nei chunk RAG.
- patientPrompt: prima persona; niente diagnosi e niente valori numerici.
- Nome proprio coerente col sesso.
- Vitali e Killip coerenti (EPA: FR alta, SpO2 bassa, Killip III; STEMI stabile: Killip I).
- Età/sesso fissati dal profilo epidemiologico: ${PATIENT_PROFILES[params.matrix.id]?.age ?? 58} anni, ${PATIENT_PROFILES[params.matrix.id]?.sex ?? "M"}. Non usare 58 anni se non è il profilo.
- redHerring1/2/3: rumore clinico che NON è la diagnosi.
- examAbnormalitiesSummary: elenco sintetico dei reperti attesi (ECG, lab, imaging).
- gelliArt5Adherence: scudo L. 24/2017 Art. 5 se si segue il gold path ESC.
- I campi testo lunghi (description, presentation, patientPrompt, pastMedicalHistory, correctSolution, goldPathNarrative, physicalExamSummary) devono essere paragrafi completi.`,
    prompt: `MATRICE
id: ${params.matrix.id}
titolo: ${params.matrix.title}
patologia: ${params.matrix.condition}
setting: ${params.matrix.setting} (${SETTING_LABEL[params.matrix.setting]})
frequenza: ${params.matrix.frequencyCategory}
difficoltà: ${params.matrix.difficulty}
PDF ESC: ${params.matrix.guidelineRef}
GOLD PATH: ${params.scaffold.goldStandardPath.join(" → ")}
ESAMI INAPPROPRIATI: ${params.scaffold.inappropriateExamIds.join(", ")}

<<<RAG_ESC_CORPUS>>>
${formatRagCorpus(params.ragHits)}
<<<END>>>`,
  });

  return object;
}

function replaceAgeMentions(text: string, age: number): string {
  return text
    .replace(/\b\d{1,3}\s*anni\b/gi, `${age} anni`)
    .replace(/\bho\s+\d{1,3}\b/gi, `Ho ${age}`);
}

function applyAgeToUnknown(value: unknown, age: number): unknown {
  if (typeof value === "string") return replaceAgeMentions(value, age);
  if (Array.isArray(value)) return value.map((item) => applyAgeToUnknown(item, age));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "age" && (typeof child === "number" || typeof child === "string")) {
        next[key] = age;
      } else {
        next[key] = applyAgeToUnknown(child, age);
      }
    }
    return next;
  }
  return value;
}

async function patchCaseAges(ids: string[]): Promise<boolean> {
  let okAll = true;
  const ages = new Set<number>();
  for (const id of ids) {
    const profile = PATIENT_PROFILES[id];
    const file = casePath(id);
    if (!profile) {
      console.error(`  ✗ ${id}: profilo età mancante`);
      okAll = false;
      continue;
    }
    if (!existsSync(file)) {
      console.error(`  ✗ ${id}: file mancante`);
      okAll = false;
      continue;
    }
    const raw = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    const patched = applyAgeToUnknown(raw, profile.age) as Record<string, unknown>;
    const baseline =
      patched.baselineExamFindings && typeof patched.baselineExamFindings === "object"
        ? { ...(patched.baselineExamFindings as Record<string, unknown>) }
        : {};
    const demographics =
      baseline.demographics && typeof baseline.demographics === "object"
        ? { ...(baseline.demographics as Record<string, unknown>) }
        : {};
    demographics.age = profile.age;
    baseline.demographics = demographics;
    patched.baselineExamFindings = baseline;
    if (typeof patched.title === "string" && !/\d{1,3}\s*anni/i.test(patched.title)) {
      const who = profile.sex === "F" ? "donna" : "uomo";
      patched.title = `${String(patched.title).replace(/\s+$/, "")} (${who} ${profile.age} anni)`;
    }
    const check = validateCaseFile(patched);
    if (!check.ok) {
      console.error(`  ✗ ${id} patch non valida`);
      for (const issue of check.issues.slice(0, 6)) console.error(`      ${issue}`);
      okAll = false;
      continue;
    }
    await writeFile(file, `${JSON.stringify(patched, null, 2)}\n`, "utf8");
    ages.add(profile.age);
    console.log(`  ✓ ${id} age=${profile.age} sex=${profile.sex}`);
  }
  console.log(`----------------------------------------------------`);
  console.log(`Età uniche: ${ages.size} (min ${Math.min(...ages)} max ${Math.max(...ages)})`);
  return okAll;
}

function casePath(id: string): string {
  return resolve(OUT_DIR, `${id}.json`);
}

function validateCaseFile(raw: unknown): { ok: boolean; issues: string[] } {
  const parsed = KnowledgeBaseCaseSchema.safeParse(raw);
  const issues: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }
  const playable = assertPlayableCase({
    title: (raw as KnowledgeBaseCase | undefined)?.title,
    description: (raw as KnowledgeBaseCase | undefined)?.description,
    difficulty: (raw as KnowledgeBaseCase | undefined)?.difficulty,
    goldStandardPath: (raw as KnowledgeBaseCase | undefined)?.goldStandardPath,
    baselineExamFindings: (raw as KnowledgeBaseCase | undefined)?.baselineExamFindings,
    correctSolution: (raw as KnowledgeBaseCase | undefined)?.correctSolution,
    patientPrompt: (raw as KnowledgeBaseCase | undefined)?.patientPrompt,
  });
  if (!playable.ok) {
    for (const issue of playable.issues) {
      issues.push(`playable.${issue.path}: ${issue.message}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

async function validateAll(ids: string[]): Promise<boolean> {
  let okAll = true;
  for (const id of ids) {
    const file = casePath(id);
    if (!existsSync(file)) {
      console.error(`  ✗ ${id}: file mancante`);
      okAll = false;
      continue;
    }
    const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
    const result = validateCaseFile(raw);
    if (result.ok) {
      console.log(`  ✓ ${id}`);
    } else {
      okAll = false;
      console.error(`  ✗ ${id}`);
      for (const issue of result.issues.slice(0, 8)) console.error(`      ${issue}`);
    }
  }
  return okAll;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrix = JSON.parse(await readFile(MATRIX_PATH, "utf8")) as MatrixRow[];
  if (!Array.isArray(matrix) || matrix.length !== 30) {
    throw new Error(`matrix.json deve contenere 30 casi (trovati: ${Array.isArray(matrix) ? matrix.length : "n/d"})`);
  }

  const selected = args.only ? matrix.filter((row) => row.id === args.only) : matrix;
  if (selected.length === 0) throw new Error(`Nessun caso per --only=${args.only}`);

  await mkdir(OUT_DIR, { recursive: true });

  console.log("----------------------------------------------------");
  console.log(args.validateOnly ? "🔎 VALIDAZIONE CASI CARDIOLOGIA KB" : "🧬 GENERAZIONE CASI CARDIOLOGIA DA MATRICE + RAG");
  console.log("----------------------------------------------------");

  if (args.patchAges) {
    const ok = await patchCaseAges(selected.map((r) => r.id));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (args.validateOnly) {
    const ok = await validateAll(selected.map((r) => r.id));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY è richiesto.");
  }
  if (!getPineconeIndex()) {
    throw new Error("Pinecone non configurato.");
  }

  const ragCache = new Map<string, RagHit[]>();
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of selected) {
    const out = casePath(row.id);
    if (args.resume && existsSync(out)) {
      const raw = JSON.parse(await readFile(out, "utf8")) as unknown;
      if (validateCaseFile(raw).ok) {
        console.log(`  ↷ skip valido: ${row.id}`);
        skipped += 1;
        continue;
      }
      console.log(`  ♻️  rigennero (file non valido): ${row.id}`);
    }

    const scaffold = SCAFFOLDS[row.id];
    if (!scaffold) {
      console.error(`  ✗ scaffold mancante: ${row.id}`);
      failed += 1;
      continue;
    }

    const cacheKey = `${row.guidelineRef}::${row.condition}`;
    let hits = ragCache.get(cacheKey);
    if (!hits) {
      const query = `${row.condition}. ${row.title}. ESC guideline management, diagnosis, timing, Class I recommendations.`;
      console.log(`  📚 RAG ${row.guidelineRef} ← ${row.id}`);
      hits = await retrieveGuidelineChunks(row.guidelineRef, query);
      if (hits.length === 0) {
        hits = [
          {
            chunkId: `fallback-${row.guidelineRef}`,
            source: sourceNameFor(row.guidelineRef),
            text: `Nessun chunk vettoriale recuperato per ${row.guidelineRef}. Resta su pratica clinica ESC generale senza inventare classi di raccomandazione.`,
          },
        ];
      }
      ragCache.set(cacheKey, hits);
      console.log(`     ${hits.length} chunk`);
    }

    try {
      console.log(`  ✍️  ${row.id} ${row.title}`);
      let lastError: unknown;
      let assembled: KnowledgeBaseCase | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const narrative = await generateNarrative({ matrix: row, scaffold, ragHits: hits });
          const candidate = assembleCase({ matrix: row, scaffold, narrative, ragHits: hits });
          const check = KnowledgeBaseCaseSchema.safeParse(candidate);
          if (!check.success) {
            throw new Error(check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }
          const playable = validateCaseFile(check.data);
          if (!playable.ok) {
            throw new Error(playable.issues.join("; "));
          }
          assembled = check.data;
          break;
        } catch (error) {
          lastError = error;
          if (attempt === 1) {
            console.warn(`     retry ${row.id}: ${error instanceof Error ? error.message.slice(0, 180) : error}`);
          }
        }
      }
      if (!assembled) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }
      await writeFile(out, `${JSON.stringify(assembled, null, 2)}\n`, "utf8");
      console.log(`  ✓ ${row.id} → ${out}`);
      generated += 1;
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${row.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("----------------------------------------------------");
  console.log(`Generati=${generated}  skip=${skipped}  fail=${failed}  attesi=${selected.length}`);
  const ok = await validateAll(selected.map((r) => r.id));
  console.log(ok && failed === 0 ? "🎉 30 casi validi (schema Zod + playable)" : "⚠ validazione incompleta");
  console.log("----------------------------------------------------");
  if (!ok || failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n❌ Generazione fallita:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
