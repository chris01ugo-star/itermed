/**
 * Audit benchmark: 30 gastroenterology KB cases — Zod, playability, RAG, Gelli-Bianco, patientProfile, D-RIME.
 *
 *   npx tsx scripts/audit-gastroenterologia-cases.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import {
  KnowledgeBaseCaseSchema,
  MATRIX_TO_ENGINE_DIFFICULTY,
  type KnowledgeBaseCase,
} from "@/lib/cases/knowledge-base-case-schema";
import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import {
  evaluateInteractionTrajectory,
  initializePatientState,
} from "@/lib/reports/d-rime-engine";

const MATRIX_PATH = resolve(process.cwd(), "knowledge_base/gastroenterologia/matrix.json");
const CASES_DIR = resolve(process.cwd(), "knowledge_base/gastroenterologia/cases");
const EXPECTED_COUNT = 30;
const ACTION_IDS = new Set(["consenso-informato", "trasferimento-ps"]);
const CATALOG_IDS = new Set(flattenCatalogExams().map((e) => e.id));

const CLINICAL_PDFS = [
  "ACG_2023_Lower_GI_Bleeding.pdf",
  "ACG_Celiac_Disease_Guidelines.pdf",
  "EASL_2018_Decompensated_Cirrhosis.pdf",
  "EASL_Baveno_VII_Portal_Hypertension.pdf",
  "EASL_DILI_Guidelines.pdf",
  "ECCO_2023_IBD_Guidelines.pdf",
  "ESGE_2022_Upper_GI_Bleeding.pdf",
  "ESMO_Colorectal_Cancer_Guidelines.pdf",
  "ESMO_Gastric_Cancer_Guidelines.pdf",
  "IAP_APA_Acute_Pancreatitis_Guidelines.pdf",
  "Lyon_Consensus_GERD_Guidelines.pdf",
  "Maastricht_VI_H_Pylori_Guidelines.pdf",
  "Rome_IV_IBS_Guidelines.pdf",
  "Tokyo_Guidelines_TG18_Cholecystitis.pdf",
] as const;

type MatrixRow = {
  id: string;
  title: string;
  condition: string;
  frequencyCategory: "HIGH" | "MEDIUM" | "LOW";
  difficulty: "BASE" | "INTERMEDIATE" | "ADVANCED";
  setting: string;
  guidelineRef: string;
};

type AuditRow = {
  id: string;
  playable: boolean;
  schemaOk: boolean;
  clinicalOk: boolean;
  dRimeOk: boolean;
  issues: string[];
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function ageFromCase(caze: KnowledgeBaseCase): number | null {
  const demo = (caze.baselineExamFindings as { demographics?: { age?: unknown } }).demographics;
  const n = num(demo?.age);
  return Number.isFinite(n) ? n : null;
}

function dRimeIssues(caze: KnowledgeBaseCase): string[] {
  const issues: string[] = [];
  const profile = caze.patientProfile;
  if (!profile) {
    issues.push("D-RIME: patientProfile assente");
    return issues;
  }
  try {
    const initial = initializePatientState(profile);
    if (
      !Number.isFinite(initial.trust) ||
      !Number.isFinite(initial.anxiety) ||
      !Number.isFinite(initial.defensiveness)
    ) {
      issues.push("D-RIME: stato iniziale non numerico");
    }
    if (profile.healthLiteracy === "CYBERCHONDRIA_AI") {
      if (initial.trust > 50) issues.push("D-RIME: CYBERCHONDRIA_AI trust troppo alta");
      if (initial.defensiveness < 70) issues.push("D-RIME: CYBERCHONDRIA_AI defensiveness troppo bassa");
      if (initial.anxiety < 70) issues.push("D-RIME: CYBERCHONDRIA_AI anxiety troppo bassa");
    }
    const chat = [
      { role: "assistant" as const, content: "Ho paura, ho letto su internet che è un tumore." },
      {
        role: "user" as const,
        content:
          "Capisco la sua preoccupazione, è comprensibile. Le spiego in parole semplici il prossimo passo e procediamo insieme.",
      },
    ];
    const result = evaluateInteractionTrajectory(chat, profile, caze.anamnesisQuestions);
    if (!Number.isFinite(result.score) || result.score < 0 || result.score > 100) {
      issues.push(`D-RIME: score fuori range (${String(result.score)})`);
    }
    if (result.framework !== "d-rime") issues.push("D-RIME: framework inatteso");
    if (!Array.isArray(result.relationalInsights)) issues.push("D-RIME: relationalInsights mancanti");
  } catch (error) {
    issues.push(`D-RIME throw: ${error instanceof Error ? error.message : String(error)}`);
  }
  return issues;
}

function clinicalIssues(caze: KnowledgeBaseCase, matrix: MatrixRow): string[] {
  const issues: string[] = [];
  if (caze.id !== matrix.id) issues.push(`id != matrice (${caze.id} vs ${matrix.id})`);
  if (caze.title !== matrix.title) issues.push("title non allineato alla matrice");
  if (caze.condition !== matrix.condition) issues.push("condition non allineata alla matrice");
  if (caze.guidelineRef !== matrix.guidelineRef) issues.push("guidelineRef non allineato alla matrice");
  if (caze.frequencyCategory !== matrix.frequencyCategory) issues.push("frequencyCategory non allineata");
  if (caze.matrixDifficulty !== matrix.difficulty) issues.push("matrixDifficulty non allineata");
  if (caze.setting !== matrix.setting) issues.push("setting non allineato");
  if (caze.difficulty !== MATRIX_TO_ENGINE_DIFFICULTY[matrix.difficulty]) {
    issues.push(`difficulty engine attesa ${MATRIX_TO_ENGINE_DIFFICULTY[matrix.difficulty]}`);
  }
  if (caze.specialty !== "gastroenterologia") issues.push("specialty != gastroenterologia");

  if (!caze.patientProfile) {
    issues.push("patientProfile assente");
  } else {
    const p = caze.patientProfile;
    if (!p.communicationStyle || p.communicationStyle.length < 20) {
      issues.push("communicationStyle insufficiente");
    }
    if (!p.lifestyleAndSocial) issues.push("lifestyleAndSocial assente");
  }

  const vitals = caze.baselineExamFindings.vitals;
  const hr = num(vitals.heartRate);
  const spo2 = num(vitals.spo2);
  const temp = num(vitals.temperature);
  const rr = num(vitals.respiratoryRate);
  if (!(hr >= 30 && hr <= 220)) issues.push(`heartRate fuori range: ${vitals.heartRate}`);
  if (!(spo2 >= 50 && spo2 <= 100)) issues.push(`spo2 fuori range: ${vitals.spo2}`);
  if (!(temp >= 34 && temp <= 41)) issues.push(`temperature fuori range: ${vitals.temperature}`);
  if (!(rr >= 6 && rr <= 50)) issues.push(`respiratoryRate fuori range: ${vitals.respiratoryRate}`);
  if (!/^\d{2,3}\/\d{2,3}/.test(String(vitals.bloodPressure))) {
    issues.push(`bloodPressure non parseable: ${vitals.bloodPressure}`);
  }

  const values = caze.baselineExamFindings.advancedExams?.values ?? {};
  const goldExams = caze.goldStandardPath.filter((id) => !ACTION_IDS.has(id));
  for (const examId of goldExams) {
    if (!CATALOG_IDS.has(examId) && !ACTION_IDS.has(examId)) {
      issues.push(`gold path exam sconosciuto: ${examId}`);
    }
    if (!ACTION_IDS.has(examId) && !values[examId] && !caze.mandatoryExams.some((e) => e.examId === examId)) {
      issues.push(`manca finding per gold exam ${examId}`);
    }
  }
  for (const exam of caze.inappropriateExams) {
    if (!exam.inappropriate) issues.push(`inappropriateExam ${exam.examId} senza flag`);
    if (!exam.wasteRationale) issues.push(`inappropriateExam ${exam.examId} senza wasteRationale`);
  }
  if (caze.escCitations.length < 1) issues.push("nessuna citazione RAG");
  if (caze.anamnesisQuestions.length < 4) issues.push("anamnesi insufficiente");
  if (caze.redHerrings.length < 2) issues.push("red herring insufficienti");
  const shieldText = [
    caze.auditMetrics.gelliBiancoShield.art5Adherence,
    ...caze.auditMetrics.gelliBiancoShield.legalCriteria,
  ]
    .join(" ")
    .toLowerCase();
  if (!/24\/2017/.test(shieldText) || !/(gelli|art\.?\s*5)/.test(shieldText)) {
    issues.push("scudo Gelli-Bianco / L. 24/2017 Art. 5 assente nel testo audit");
  }
  if (caze.auditMetrics.appropriatenessIndicators.length < 2) {
    issues.push("indicatori di appropriatezza insufficienti");
  }
  issues.push(...dRimeIssues(caze));
  return issues;
}

async function main() {
  console.log("----------------------------------------------------");
  console.log("🩺 AUDIT COERENZA CLINICA — Gastroenterologia KB (30 casi) + D-RIME");
  console.log("----------------------------------------------------");

  const matrix = JSON.parse(await readFile(MATRIX_PATH, "utf8")) as MatrixRow[];
  const files = (await readdir(CASES_DIR)).filter((f) => /^GASTRO-\d{3}\.json$/.test(f)).sort();
  const matrixById = new Map(matrix.map((row) => [row.id, row]));

  const globalIssues: string[] = [];
  if (matrix.length !== EXPECTED_COUNT) {
    globalIssues.push(`matrix.json ha ${matrix.length} righe, attese ${EXPECTED_COUNT}`);
  }
  if (files.length !== EXPECTED_COUNT) {
    globalIssues.push(`cartella cases/ ha ${files.length} JSON, attesi ${EXPECTED_COUNT}`);
  }

  const freq: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const pdfs = new Set<string>();
  const literacy = new Set<string>();
  const emotions = new Set<string>();
  const adherence = new Set<string>();
  const sleep = new Set<string>();
  const ages: number[] = [];
  const rows: AuditRow[] = [];

  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    const raw = JSON.parse(await readFile(resolve(CASES_DIR, file), "utf8")) as unknown;
    const schema = KnowledgeBaseCaseSchema.safeParse(raw);
    const playable = assertPlayableCase({
      title: (raw as KnowledgeBaseCase)?.title,
      description: (raw as KnowledgeBaseCase)?.description,
      difficulty: (raw as KnowledgeBaseCase)?.difficulty,
      goldStandardPath: (raw as KnowledgeBaseCase)?.goldStandardPath,
      baselineExamFindings: (raw as KnowledgeBaseCase)?.baselineExamFindings,
      correctSolution: (raw as KnowledgeBaseCase)?.correctSolution,
      patientPrompt: (raw as KnowledgeBaseCase)?.patientPrompt,
    });

    const issues: string[] = [];
    if (!schema.success) {
      for (const issue of schema.error.issues.slice(0, 6)) {
        issues.push(`schema.${issue.path.join(".")}: ${issue.message}`);
      }
    }
    if (!playable.ok) {
      for (const issue of playable.issues) issues.push(`playable.${issue.path}: ${issue.message}`);
    }

    let dRimeOk = false;
    const matrixRow = matrixById.get(id);
    if (!matrixRow) {
      issues.push("id assente dalla matrice");
    } else if (schema.success) {
      issues.push(...clinicalIssues(schema.data, matrixRow));
      dRimeOk = !issues.some((i) => i.startsWith("D-RIME"));
      freq[schema.data.frequencyCategory] = (freq[schema.data.frequencyCategory] ?? 0) + 1;
      pdfs.add(schema.data.guidelineRef);
      const profile = schema.data.patientProfile;
      if (profile) {
        literacy.add(profile.healthLiteracy);
        emotions.add(profile.emotionalState);
        adherence.add(profile.adherence);
        sleep.add(profile.lifestyleAndSocial.sleepQuality);
      }
      const age = ageFromCase(schema.data);
      if (age != null) ages.push(age);
    }

    const row: AuditRow = {
      id,
      playable: playable.ok,
      schemaOk: schema.success,
      clinicalOk: issues.length === 0,
      dRimeOk,
      issues,
    };
    rows.push(row);
    const mark = row.clinicalOk && row.playable && row.schemaOk ? "✓" : "✗";
    console.log(
      `  ${mark} ${id.padEnd(12)} playable=${row.playable ? "OK" : "NO"}  schema=${row.schemaOk ? "OK" : "NO"}  clinical=${row.clinicalOk ? "OK" : "NO"}  D-RIME=${row.dRimeOk ? "OK" : "NO"}`,
    );
    for (const issue of issues.slice(0, 4)) console.log(`      • ${issue}`);
  }

  for (const row of matrix) {
    if (!files.includes(`${row.id}.json`)) globalIssues.push(`manca file per ${row.id}`);
  }
  if (freq.HIGH !== 18 || freq.MEDIUM !== 9 || freq.LOW !== 3) {
    globalIssues.push(`distribuzione frequenza HIGH/MEDIUM/LOW = ${freq.HIGH}/${freq.MEDIUM}/${freq.LOW} (attesa 18/9/3)`);
  }
  for (const pdf of CLINICAL_PDFS) {
    if (!pdfs.has(pdf)) globalIssues.push(`PDF clinico non referenziato: ${pdf}`);
  }
  if (!literacy.has("CYBERCHONDRIA_AI")) {
    globalIssues.push("nessun caso con healthLiteracy=CYBERCHONDRIA_AI");
  }
  if (!emotions.has("ANXIOUS")) globalIssues.push("nessun caso ANXIOUS");
  if (!sleep.has("POOR")) globalIssues.push("nessun caso con insonnia/sonno POOR");
  if (![...adherence].some((a) => a === "PARTIAL" || a === "NON_COMPLIANT" || a === "SELF_MEDICATED")) {
    globalIssues.push("nessun caso con difetto di aderenza");
  }
  if (ages.length > 0) {
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    if (minAge > 18 || maxAge < 85) {
      globalIssues.push(`range età ${minAge}–${maxAge} (atteso 18–85)`);
    }
  }

  const passed = rows.filter((r) => r.playable && r.schemaOk && r.clinicalOk).length;
  console.log("----------------------------------------------------");
  console.log("📊 REPORT AUDIT");
  console.log("----------------------------------------------------");
  console.log(`Casi auditati     : ${rows.length}/${EXPECTED_COUNT}`);
  console.log(`Playable          : ${rows.filter((r) => r.playable).length}/${rows.length}`);
  console.log(`Schema Zod        : ${rows.filter((r) => r.schemaOk).length}/${rows.length}`);
  console.log(`Coerenza clinica  : ${rows.filter((r) => r.clinicalOk).length}/${rows.length}`);
  console.log(`D-RIME            : ${rows.filter((r) => r.dRimeOk).length}/${rows.length}`);
  console.log(`Frequenza         : HIGH=${freq.HIGH} MEDIUM=${freq.MEDIUM} LOW=${freq.LOW}`);
  console.log(`PDF clinici       : ${pdfs.size}/${CLINICAL_PDFS.length}`);
  console.log(`Literacy          : ${[...literacy].sort().join(", ") || "—"}`);
  console.log(`Emotional         : ${[...emotions].sort().join(", ") || "—"}`);
  console.log(`Adherence         : ${[...adherence].sort().join(", ") || "—"}`);
  console.log(`Sleep             : ${[...sleep].sort().join(", ") || "—"}`);
  console.log(
    `Età               : ${ages.length ? `${Math.min(...ages)}–${Math.max(...ages)} (${new Set(ages).size} uniche)` : "n/d"}`,
  );
  if (globalIssues.length > 0) {
    console.log("Issue globali:");
    for (const issue of globalIssues) console.log(`  • ${issue}`);
  }
  console.log("----------------------------------------------------");
  const ok = passed === EXPECTED_COUNT && globalIssues.length === 0 && rows.length === EXPECTED_COUNT;
  console.log(ok ? "🎉 AUDIT 30/30 SUPERATO" : `⚠ AUDIT FALLITO (${passed}/${EXPECTED_COUNT})`);
  console.log("----------------------------------------------------");
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n❌ Audit fallito:", error instanceof Error ? error.message : error);
  process.exit(1);
});
