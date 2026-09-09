/**
 * RAG clinical-case generation for the Authoring Tool.
 * Pinecone retrieval → D-RIME patient profile → Zod validate → Prisma upsert.
 */
import { openai } from "@ai-sdk/openai";
import { Prisma } from "@prisma/client";
import { embed, generateObject } from "ai";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  GeneratedCaseNarrativeSchema,
  MATRIX_TO_ENGINE_DIFFICULTY,
  knowledgeBaseCaseSchema,
  type GeneratedCaseNarrative,
  type KnowledgeBaseCase,
  type PatientProfile,
} from "@/lib/cases/knowledge-base-case-schema";
import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import { sanitizeExamFinding } from "@/lib/simulator/exam-finding-text";
import { createLogger } from "@/lib/logger";
import { getPineconeIndex } from "@/lib/pinecone";
import { prisma } from "@/lib/prisma";
import { clearCasesCache } from "@/lib/data/cases/registry-store";
import { PINECONE_GUIDELINES_NAMESPACE } from "@/lib/services/ingestion-service";

const logger = createLogger("case-generation-service");

const RAG_TOP_K = 4;

export const KB_SPECIALTIES = ["cardiologia", "pneumologia", "gastroenterologia"] as const;
export type KbSpecialty = (typeof KB_SPECIALTIES)[number];

export type MatrixFrequency = "HIGH" | "MEDIUM" | "LOW";
export type MatrixDifficulty = "BASE" | "INTERMEDIATE" | "ADVANCED";
export type CaseSetting = "GUARDIA_MEDICA" | "PRONTO_SOCCORSO" | "AMBULATORIO" | "REPARTO";

export type MatrixRow = {
  id: string;
  title: string;
  condition: string;
  frequencyCategory: MatrixFrequency;
  difficulty: MatrixDifficulty;
  setting: CaseSetting;
  guidelineRef: string;
};

export type EpidemiologicalCriteria = {
  frequencyCategory?: MatrixFrequency;
  difficulty?: MatrixDifficulty;
  setting?: CaseSetting;
  onlyIds?: string[];
};

export type GenerateCasesInput = EpidemiologicalCriteria & {
  specialty: KbSpecialty;
  count?: number;
  skipLlm?: boolean;
  onProgress?: (progress: number, message: string) => void | Promise<void>;
};

/** Cases processed per sub-batch to bound peak RAM on serverless. */
export const CASE_GENERATION_BATCH_SIZE = 5;

export type GenerateCasesResult = {
  specialty: KbSpecialty;
  requested: number;
  upserted: string[];
  failed: Array<{ id: string; error: string }>;
  ragHits: number;
};

type Scaffold = {
  goldStandardPath: string[];
  inappropriateExamIds: string[];
  examBudgetEuro: number;
};

type RagHit = { chunkId: string; source: string; text: string };

const SPECIALTY_LABEL: Record<KbSpecialty, KnowledgeBaseCase["specialtyLabel"]> = {
  cardiologia: "Cardiologia",
  pneumologia: "Pneumologia",
  gastroenterologia: "Gastroenterologia",
};

const SETTING_LABEL: Record<CaseSetting, string> = {
  GUARDIA_MEDICA: "Guardia Medica territoriale",
  PRONTO_SOCCORSO: "Pronto Soccorso",
  AMBULATORIO: "Ambulatorio",
  REPARTO: "Reparto",
};

const DEFAULT_GOLD: Record<KbSpecialty, Scaffold> = {
  cardiologia: {
    goldStandardPath: ["ecg", "troponina-hs", "elettroliti", "creat-urea-gfr"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 120,
  },
  pneumologia: {
    goldStandardPath: ["ega", "rx-torace", "emocromo", "pcr-pct"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 110,
  },
  gastroenterologia: {
    goldStandardPath: ["emocromo", "enzimi-epatici", "ecografia"],
    inappropriateExamIds: ["pet-tc", "rm"],
    examBudgetEuro: 100,
  },
};

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
  "enzimi-epatici": 8,
  colonscopia: 120,
  egds: 90,
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
  "enzimi-epatici": 30,
  colonscopia: 60,
  egds: 45,
};

/** D-RIME emotional archetypes rotated by case index (literacy × emotion × adherence). */
const D_RIME_ARCHETYPES: Array<Omit<PatientProfile, "communicationStyle">> = [
  {
    healthLiteracy: "CYBERCHONDRIA_AI",
    emotionalState: "ANXIOUS",
    adherence: "SELF_MEDICATED",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
  },
  {
    healthLiteracy: "LOW",
    emotionalState: "PASSIVE",
    adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
  },
  {
    healthLiteracy: "MEDIUM",
    emotionalState: "DEFENSIVE",
    adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
  },
  {
    healthLiteracy: "HIGH",
    emotionalState: "COLLABORATIVE",
    adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "GOOD", stressLevel: "LOW", socialSupport: "STRONG" },
  },
  {
    healthLiteracy: "LOW",
    emotionalState: "OPPOSITIONAL",
    adherence: "NON_COMPLIANT",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ISOLATED" },
  },
  {
    healthLiteracy: "MEDIUM",
    emotionalState: "ANXIOUS",
    adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
  },
  {
    healthLiteracy: "HIGH",
    emotionalState: "DEFENSIVE",
    adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
  },
  {
    healthLiteracy: "LOW",
    emotionalState: "ANXIOUS",
    adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
  },
];

const NAMES_M = ["Marco", "Giuseppe", "Antonio", "Luca", "Paolo", "Francesco", "Vincenzo", "Andrea"];
const NAMES_F = ["Maria", "Anna", "Rosa", "Elena", "Giulia", "Laura", "Teresa", "Chiara"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function isKbSpecialty(value: string): value is KbSpecialty {
  return (KB_SPECIALTIES as readonly string[]).includes(value);
}

export function buildDrimePatientProfile(params: {
  caseId: string;
  condition: string;
  setting: CaseSetting;
  existing?: PatientProfile;
}): PatientProfile {
  if (params.existing) return params.existing;
  const archetype = D_RIME_ARCHETYPES[hashString(params.caseId) % D_RIME_ARCHETYPES.length];
  const communicationStyle =
    `Il paziente con ${params.condition} in ${SETTING_LABEL[params.setting]} ` +
    `ha literacy ${archetype.healthLiteracy}, stato emotivo ${archetype.emotionalState} ` +
    `e aderenza ${archetype.adherence}. Serve validazione SPIKES-Emotions senza concessioni ` +
    `difensive e senza gergo inutile.`;
  return { ...archetype, communicationStyle };
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function ensureLen(text: string, min: number, max: number, fallback: string): string {
  const trimmed = (text || "").replace(/\s+/g, " ").trim() || fallback;
  if (trimmed.length >= min) return trimmed.slice(0, max);
  return `${trimmed} ${fallback}`.trim().slice(0, max);
}

function normalizeBloodPressure(raw: string): string {
  const match = String(raw).replace(/\s+/g, "").match(/(\d{2,3})\/(\d{2,3})/);
  return match ? `${match[1]}/${match[2]}` : "120/80";
}

function timeLimits(difficulty: MatrixDifficulty) {
  if (difficulty === "BASE") return { timeLimitMinutes: 20, patientDeteriorationThreshold: 10 };
  if (difficulty === "INTERMEDIATE") return { timeLimitMinutes: 25, patientDeteriorationThreshold: 12 };
  return { timeLimitMinutes: 30, patientDeteriorationThreshold: 12 };
}

function sourceNameFor(specialty: KbSpecialty, pdf: string): string {
  if (pdf.includes("/")) return pdf.replace(/\\/g, "/");
  return `knowledge_base/${specialty}/clinical/${pdf}`;
}

function examLatenciesFor(path: string[], extra: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of [...path, ...extra]) {
    out[id] = LATENCY[id] ?? 30;
  }
  return out;
}

function wasteRationale(examId: string, guidelineRef: string): string {
  return `Esame non di prima intenzione per questo quadro clinico (spreco SSN / possibile ritardo terapeutico). Riferimento: ${guidelineRef}.`;
}

function findingForExam(
  examId: string,
  matrix: MatrixRow,
  summary: string,
  inappropriate: boolean,
): string {
  if (inappropriate) return wasteRationale(examId, matrix.guidelineRef);
  const fromSummary = sanitizeExamFinding(examId, summary);
  return ensureLen(
    fromSummary,
    20,
    900,
    `Reperto strumentale dell'esame richiesto, senza indicazioni di percorso.`,
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
      rationale: "Fenotipo clinico per diagnosi differenziale.",
    },
    {
      prompt: "Fattori di rischio, comorbidità e contesto epidemiologico",
      keywords: ["rischio", "diabet", "fum", "farmaci", "familiar"],
      rationale: "Profilo di rischio e matrice epidemiologica del caso.",
    },
    {
      prompt: "Terapie in atto, allergie e precedenti procedure",
      keywords: ["farmaci", "terapia", "allergia", "intervento", "ospedale"],
      rationale: "Baseline prescrittiva e sicurezza (Gelli-Bianco / appropriatezza).",
    },
    {
      prompt: "Sintomi di allarme e instabilità (dolore, dispnea, sanguinamento, deficit)",
      keywords: ["dolore", "dispnea", "sangue", "sincope", "deficit"],
      rationale: "Identifica red flag tempo-dipendenti.",
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

function citationsFromRag(
  specialty: KbSpecialty,
  hits: RagHit[],
  guidelineRef: string,
  fallbackQuote: string,
): KnowledgeBaseCase["escCitations"] {
  const rows = hits.slice(0, 4).map((h) => ({
    chunkId: h.chunkId,
    source: h.source || sourceNameFor(specialty, guidelineRef),
    quote: ensureLen(h.text, 20, 500, fallbackQuote),
  }));
  if (rows.length > 0) return rows;
  return [
    {
      chunkId: `fallback-${guidelineRef}`,
      source: sourceNameFor(specialty, guidelineRef),
      quote: ensureLen(fallbackQuote, 20, 500, `Riferimento ${guidelineRef}.`),
    },
  ];
}

export async function loadSpecialtyMatrix(specialty: KbSpecialty): Promise<MatrixRow[]> {
  const matrixPath = resolve(process.cwd(), "knowledge_base", specialty, "matrix.json");
  if (!existsSync(matrixPath)) {
    throw new Error(`Matrice epidemiologica mancante: ${matrixPath}`);
  }
  const raw = JSON.parse(await readFile(matrixPath, "utf8")) as unknown;
  if (!Array.isArray(raw)) throw new Error(`matrix.json di ${specialty} non è un array.`);
  return raw as MatrixRow[];
}

export function filterMatrixRows(rows: MatrixRow[], criteria: EpidemiologicalCriteria): MatrixRow[] {
  return rows.filter((row) => {
    if (criteria.onlyIds?.length && !criteria.onlyIds.includes(row.id)) return false;
    if (criteria.frequencyCategory && row.frequencyCategory !== criteria.frequencyCategory) {
      return false;
    }
    if (criteria.difficulty && row.difficulty !== criteria.difficulty) return false;
    if (criteria.setting && row.setting !== criteria.setting) return false;
    return true;
  });
}

async function loadExistingCaseJson(
  specialty: KbSpecialty,
  caseId: string,
): Promise<KnowledgeBaseCase | null> {
  const file = resolve(process.cwd(), "knowledge_base", specialty, "cases", `${caseId}.json`);
  if (!existsSync(file)) return null;
  try {
    const parsed = knowledgeBaseCaseSchema.safeParse(JSON.parse(await readFile(file, "utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function scaffoldFromExisting(existing: KnowledgeBaseCase | null, specialty: KbSpecialty): Scaffold {
  const fallback = DEFAULT_GOLD[specialty];
  if (!existing) return fallback;
  const inappropriate = existing.inappropriateExams.map((e) => e.examId).filter(Boolean);
  const gold =
    existing.goldStandardPath.length >= 2 ? existing.goldStandardPath : fallback.goldStandardPath;
  return {
    goldStandardPath: gold,
    inappropriateExamIds: inappropriate.length > 0 ? inappropriate : fallback.inappropriateExamIds,
    examBudgetEuro:
      typeof existing.baselineExamFindings.examBudgetEuro === "number"
        ? existing.baselineExamFindings.examBudgetEuro
        : fallback.examBudgetEuro,
  };
}

async function retrieveGuidelineChunks(params: {
  specialty: KbSpecialty;
  pdf: string;
  query: string;
}): Promise<RagHit[]> {
  const index = getPineconeIndex();
  if (!index) {
    throw new Error("Pinecone non configurato (PINECONE_API_KEY + PINECONE_INDEX).");
  }
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: params.query.slice(0, 8000),
  });
  const sourceName = sourceNameFor(params.specialty, params.pdf);
  const queryOnce = async (filter?: Record<string, unknown>) =>
    index.namespace(PINECONE_GUIDELINES_NAMESPACE).query({
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
    hits.push({
      chunkId: typeof match.id === "string" ? match.id : String(metadata.chunkId ?? "unknown"),
      source: src || sourceName,
      text: text.slice(0, 900),
    });
  }
  return hits.slice(0, RAG_TOP_K);
}

function formatRagCorpus(hits: RagHit[]): string {
  if (hits.length === 0) return "(nessun chunk RAG disponibile)";
  return hits.map((h, i) => `[${i + 1}] ${h.source}\n${h.text}`).join("\n\n");
}

async function generateNarrative(params: {
  specialty: KbSpecialty;
  matrix: MatrixRow;
  scaffold: Scaffold;
  ragHits: RagHit[];
  profile: PatientProfile;
  age: number;
  sex: "M" | "F";
  name: string;
}): Promise<GeneratedCaseNarrative> {
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: GeneratedCaseNarrativeSchema,
    temperature: 0.4,
    system: `Sei uno specialista di ${SPECIALTY_LABEL[params.specialty]} e un medico-legale (L. 24/2017 Gelli-Bianco) che progetta casi per un simulatore formativo italiano (AEQUAN).
Scrivi in italiano un caso realistico e internamente coerente.

REGOLE:
- Non inventare classi di raccomandazione se non compaiono nei chunk RAG.
- patientPrompt: prima persona; niente diagnosi e niente valori numerici.
- Nome proprio coerente col sesso: usa "${params.name}".
- Età/sesso fissati dal profilo epidemiologico: ${params.age} anni, ${params.sex}.
- Profilo D-RIME: literacy=${params.profile.healthLiteracy}; emotion=${params.profile.emotionalState}; adherence=${params.profile.adherence}.
- redHerring1/2/3: rumore clinico che NON è la diagnosi.
- gelliArt5Adherence: scudo L. 24/2017 Art. 5 se si segue il gold path.
- I campi testo lunghi devono essere paragrafi completi.`,
    prompt: `MATRICE EPIDEMIOLOGICA
id: ${params.matrix.id}
titolo: ${params.matrix.title}
patologia: ${params.matrix.condition}
setting: ${params.matrix.setting} (${SETTING_LABEL[params.matrix.setting]})
frequenza: ${params.matrix.frequencyCategory}
difficoltà: ${params.matrix.difficulty}
PDF: ${params.matrix.guidelineRef}
GOLD PATH: ${params.scaffold.goldStandardPath.join(" → ")}
ESAMI INAPPROPRIATI: ${params.scaffold.inappropriateExamIds.join(", ")}
D-RIME: ${params.profile.communicationStyle}

<<<RAG_CORPUS>>>
${formatRagCorpus(params.ragHits)}
<<<END>>>`,
  });

  return object;
}

function assembleCase(params: {
  specialty: KbSpecialty;
  matrix: MatrixRow;
  scaffold: Scaffold;
  narrative: GeneratedCaseNarrative;
  ragHits: RagHit[];
  patientProfile: PatientProfile;
  age: number;
  sex: "M" | "F";
}): KnowledgeBaseCase {
  const { matrix, scaffold, narrative, specialty } = params;
  const engineDifficulty = MATRIX_TO_ENGINE_DIFFICULTY[matrix.difficulty];
  const times = timeLimits(matrix.difficulty);

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
    `Sei ${narrative.name || (params.sex === "F" ? "la paziente" : "il paziente")}. Descrivi i sintomi senza nominare la diagnosi e senza citare valori numerici.`,
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
    `Percorso diagnostico-terapeutico: ${scaffold.goldStandardPath.join(" → ")}. Evitare ${scaffold.inappropriateExamIds.join(", ")}.`,
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
    `L'adesione alle linee guida (${matrix.guidelineRef}) e al gold path costituisce parametro di conformità alle buone pratiche clinico-assistenziali (L. 24/2017 Art. 5 Gelli-Bianco).`,
  );
  const redHerrings = [narrative.redHerring1, narrative.redHerring2, narrative.redHerring3].map((h) =>
    ensureLen(h || "", 8, 400, "Dettaglio anamnestico rumoroso non dirimente."),
  );

  const examAbnormalities = ensureLen(
    narrative.examAbnormalitiesSummary,
    20,
    800,
    `Reperti attesi lungo il gold path per ${matrix.condition}.`,
  );

  const mandatoryExams = scaffold.goldStandardPath.slice(0, 12).map((examId) => ({
    examId,
    name: EXAM_NAMES.get(examId) ?? examId,
    finding: findingForExam(examId, matrix, examAbnormalities, false),
    isAbnormal: true,
    priceEuro: PRICE_EURO[examId] ?? 20,
  }));

  const inappropriateExams = scaffold.inappropriateExamIds.slice(0, 6).map((examId) => ({
    examId,
    name: EXAM_NAMES.get(examId) ?? examId,
    finding: findingForExam(examId, matrix, examAbnormalities, true),
    isAbnormal: false,
    priceEuro: PRICE_EURO[examId] ?? 20,
    inappropriate: true,
    wasteRationale: wasteRationale(examId, matrix.guidelineRef),
  }));

  const values: Record<string, { finding: string; isAbnormal: boolean; price?: number }> = {};
  for (const exam of [...mandatoryExams, ...inappropriateExams]) {
    values[exam.examId] = {
      finding: exam.finding,
      isAbnormal: exam.isAbnormal,
      price: exam.priceEuro,
    };
  }

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
      age: params.age,
      sex: params.sex,
      context: ensureLen(narrative.context, 8, 240, SETTING_LABEL[matrix.setting]),
    },
    physicalExam: {
      finding: physicalSummary,
      ...(specialty === "cardiologia" ? { killipClass: narrative.killipClass } : {}),
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
    specialty,
    specialtyLabel: SPECIALTY_LABEL[specialty],
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
      ...(specialty === "cardiologia" ? { killipClass: narrative.killipClass } : {}),
      summary: physicalSummary,
    },
    baselineExamFindings,
    escCitations: citationsFromRag(specialty, params.ragHits, matrix.guidelineRef, goldPathNarrative),
    auditMetrics: {
      appropriatenessIndicators: [
        `Eseguire in sequenza il gold path: ${scaffold.goldStandardPath.join(" → ")}.`,
        `Non prescrivere di prima intenzione: ${scaffold.inappropriateExamIds.join(", ")} (${matrix.guidelineRef}).`,
        `Budget SSN di riferimento: €${scaffold.examBudgetEuro}.`,
      ],
      gelliBiancoShield: {
        art5Adherence: gelli,
        legalCriteria: [
          "Documentare adesione alle linee guida accreditate (L. 24/2017 Art. 5).",
          "Raccogliere consenso informato prima di procedure invasive.",
          "Evitare esami inappropriati (Codice deontologico, appropriatezza prescrittiva).",
          `Registrare tempi critici nel setting ${SETTING_LABEL[matrix.setting]}.`,
        ],
      },
    },
    mandatoryExams,
    inappropriateExams,
    patientProfile: params.patientProfile,
  };
}

function fallbackNarrative(params: {
  matrix: MatrixRow;
  age: number;
  sex: "M" | "F";
  name: string;
  scaffold: Scaffold;
}): GeneratedCaseNarrative {
  const { matrix, name, age, sex, scaffold } = params;
  const setting = SETTING_LABEL[matrix.setting];
  return {
    age,
    sex,
    name,
    context: setting,
    heartRate: 88,
    bloodPressure: "128/78",
    spo2: 97,
    temperature: 36.6,
    respiratoryRate: 18,
    description: `${matrix.title} in ${setting}. Quadro clinico coerente con ${matrix.condition}, da inquadrare secondo ${matrix.guidelineRef}.`,
    presentation: `Paziente di ${age} anni valutato in ${setting} per ${matrix.condition}. La presentazione è realistica rispetto alla frequenza ${matrix.frequencyCategory}.`,
    redHerring1: "Riferisce un episodio virale recente non dirimente per la diagnosi principale.",
    redHerring2: "Ansia da attesa che può mascherare o amplificare i sintomi cardinali.",
    redHerring3: "Assunzione occasionale di FANS senza nesso temporale dirimente.",
    pastMedicalHistory: `Anamnesi remota compatibile con ${matrix.condition}: fattori di rischio e terapie da documentare senza anticipare la diagnosi.`,
    patientPrompt: `Sei ${name}. Hai ${age} anni e ti trovi in ${setting}. Racconta i sintomi con le tue parole, senza nominare la diagnosi e senza citare numeri.`,
    diagnosis: matrix.condition,
    correctSolution: `Seguire il gold path ${scaffold.goldStandardPath.join(" → ")} e non prescrivere ${scaffold.inappropriateExamIds.join(", ")}.`,
    goldPathNarrative: `Il percorso appropriato è ${scaffold.goldStandardPath.join(" → ")} secondo ${matrix.guidelineRef}, evitando esami di secondo livello inappropriati.`,
    physicalExamSummary: `Esame obiettivo in ${setting} con reperti compatibili con ${matrix.condition}, da integrare con il gold path.`,
    examAbnormalitiesSummary: `Reperti attesi sui tappe ${scaffold.goldStandardPath.join(", ")} coerenti con ${matrix.condition}.`,
    killipClass: "I",
    gelliArt5Adherence: `L'adesione a ${matrix.guidelineRef} e al gold path costituisce conformità all'Art. 5 L. 24/2017 Gelli-Bianco.`,
  };
}

async function upsertKnowledgeBaseCase(kb: KnowledgeBaseCase): Promise<void> {
  const patientProfile = kb.patientProfile ?? {};
  const ragSources = kb.escCitations;
  await prisma.knowledgeBaseCase.upsert({
    where: { id: kb.id },
    create: {
      id: kb.id,
      specialty: kb.specialty,
      version: 1,
      title: kb.title,
      patientProfile: patientProfile as Prisma.InputJsonValue,
      caseData: kb as Prisma.InputJsonValue,
      ragSources: ragSources as Prisma.InputJsonValue,
    },
    update: {
      specialty: kb.specialty,
      title: kb.title,
      patientProfile: patientProfile as Prisma.InputJsonValue,
      caseData: kb as Prisma.InputJsonValue,
      ragSources: ragSources as Prisma.InputJsonValue,
    },
  });
  clearCasesCache();
}

function demographicsFromId(caseId: string): { age: number; sex: "M" | "F"; name: string } {
  const hash = hashString(caseId);
  const sex: "M" | "F" = hash % 2 === 0 ? "M" : "F";
  const age = 24 + (hash % 63);
  const name = sex === "M" ? NAMES_M[hash % NAMES_M.length] : NAMES_F[hash % NAMES_F.length];
  return { age, sex, name };
}

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function generateSingleCase(
  specialty: KbSpecialty,
  row: MatrixRow,
  skipLlm: boolean,
): Promise<{ upserted: boolean; ragHits: number }> {
  const existing = await loadExistingCaseJson(specialty, row.id);
  const scaffold = scaffoldFromExisting(existing, specialty);
  const demo = demographicsFromId(row.id);
  const patientProfile = buildDrimePatientProfile({
    caseId: row.id,
    condition: row.condition,
    setting: row.setting,
    existing: existing?.patientProfile,
  });

  if (skipLlm && existing) {
    const withProfile: KnowledgeBaseCase = {
      ...existing,
      patientProfile: existing.patientProfile ?? patientProfile,
    };
    const parsed = knowledgeBaseCaseSchema.safeParse(withProfile);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new Error(`Zod ${first?.path.join(".")}: ${first?.message ?? "schema error"}`);
    }
    await upsertKnowledgeBaseCase(parsed.data);
    return { upserted: true, ragHits: 0 };
  }

  let ragHits: RagHit[] = [];
  try {
    ragHits = await retrieveGuidelineChunks({
      specialty,
      pdf: row.guidelineRef,
      query: `${row.title}. ${row.condition}. ${row.guidelineRef}. Gold path ${scaffold.goldStandardPath.join(" ")}`,
    });
  } catch (error) {
    logger.warn("RAG retrieval failed; continuing with fallback citations", {
      caseId: row.id,
      error,
    });
  }

  let narrative: GeneratedCaseNarrative;
  if (skipLlm) {
    narrative = fallbackNarrative({ matrix: row, scaffold, ...demo });
  } else {
    try {
      narrative = await generateNarrative({
        specialty,
        matrix: row,
        scaffold,
        ragHits,
        profile: patientProfile,
        ...demo,
      });
    } catch (error) {
      logger.warn("LLM narrative failed; using deterministic fallback", {
        caseId: row.id,
        error,
      });
      narrative = fallbackNarrative({ matrix: row, scaffold, ...demo });
    }
  }

  const assembled = assembleCase({
    specialty,
    matrix: row,
    scaffold,
    narrative,
    ragHits,
    patientProfile,
    age: demo.age,
    sex: demo.sex,
  });

  const parsed = knowledgeBaseCaseSchema.safeParse(assembled);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`Zod ${first?.path.join(".") || "root"}: ${first?.message ?? "schema error"}`);
  }

  await upsertKnowledgeBaseCase(parsed.data);
  logger.info("Upserted knowledge-base case", { id: row.id, specialty, rag: ragHits.length });
  return { upserted: true, ragHits: ragHits.length };
}

export async function generateCases(input: GenerateCasesInput): Promise<GenerateCasesResult> {
  const specialty = input.specialty;
  const count = Math.max(1, Math.min(30, input.count ?? 30));
  const matrix = filterMatrixRows(await loadSpecialtyMatrix(specialty), input).slice(0, count);

  const result: GenerateCasesResult = {
    specialty,
    requested: matrix.length,
    upserted: [],
    failed: [],
    ragHits: 0,
  };

  if (matrix.length === 0) {
    throw new Error(
      `Nessuna riga della matrice ${specialty} corrisponde ai criteri epidemiologici richiesti.`,
    );
  }

  const batches = chunkArray(matrix, CASE_GENERATION_BATCH_SIZE);
  let processed = 0;

  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b];
    for (const row of batch) {
      processed += 1;
      try {
        const one = await generateSingleCase(specialty, row, Boolean(input.skipLlm));
        if (one.upserted) result.upserted.push(row.id);
        result.ragHits += one.ragHits;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Case generation failed", { id: row.id, error });
        result.failed.push({ id: row.id, error: message });
      }
    }

    const progress = Math.floor(((b + 1) / batches.length) * 100);
    await input.onProgress?.(
      Math.max(1, progress),
      `Sotto-batch ${b + 1}/${batches.length} · ${processed}/${matrix.length} casi`,
    );
    await yieldEventLoop();
  }

  return result;
}
