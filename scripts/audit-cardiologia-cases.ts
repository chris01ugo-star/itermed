/**
 * Audit benchmark: 30 cardiology KB cases — Zod schema, playability, matrix coherence.
 *
 *   npx tsx scripts/audit-cardiologia-cases.ts
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

const MATRIX_PATH = resolve(process.cwd(), "knowledge_base/cardiologia/matrix.json");
const CASES_DIR = resolve(process.cwd(), "knowledge_base/cardiologia/cases");
const EXPECTED_COUNT = 30;
const ACTION_IDS = new Set(["consenso-informato", "dapt", "trasferimento-ps", "cardioversione", "pacing"]);
const CATALOG_IDS = new Set(flattenCatalogExams().map((e) => e.id));

const ESC_PDFS = [
  "ESC_2018_Pregnancy_Cardiovascular_Guidelines.pdf",
  "ESC_2018_Syncope_Guidelines.pdf",
  "ESC_2019_Pulmonary_Embolism_Guidelines.pdf",
  "ESC_2021_Heart_Failure_Guidelines.pdf",
  "ESC_2022_Ventricular_Arrhythmias_Guidelines.pdf",
  "ESC_2023_ACS_Guidelines.pdf",
  "ESC_2023_Cardiomyopathies_Guidelines.pdf",
  "ESC_2023_Endocarditis_Guidelines.pdf",
  "ESC_2024_Aortic_and_Peripheral_Diseases_Guidelines.pdf",
  "ESC_2024_Atrial_Fibrillation_Guidelines.pdf",
  "ESC_2024_Chronic_Coronary_Syndromes_Guidelines.pdf",
  "ESC_2024_Hypertension_Guidelines.pdf",
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
  issues: string[];
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
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
  if (caze.specialty !== "cardiologia") issues.push("specialty != cardiologia");

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
  if (caze.escCitations.length < 1) issues.push("nessuna citazione ESC/RAG");
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
  return issues;
}

async function main() {
  console.log("----------------------------------------------------");
  console.log("🩺 AUDIT COERENZA CLINICA — Cardiologia KB (30 casi)");
  console.log("----------------------------------------------------");

  const matrix = JSON.parse(await readFile(MATRIX_PATH, "utf8")) as MatrixRow[];
  const files = (await readdir(CASES_DIR)).filter((f) => /^CARDIO-\d{3}\.json$/.test(f)).sort();
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

    const matrixRow = matrixById.get(id);
    if (!matrixRow) {
      issues.push("id assente dalla matrice");
    } else if (schema.success) {
      issues.push(...clinicalIssues(schema.data, matrixRow));
      freq[schema.data.frequencyCategory] = (freq[schema.data.frequencyCategory] ?? 0) + 1;
      pdfs.add(schema.data.guidelineRef);
    }

    const row: AuditRow = {
      id,
      playable: playable.ok,
      schemaOk: schema.success,
      clinicalOk: issues.length === 0,
      issues,
    };
    rows.push(row);
    const mark = row.clinicalOk && row.playable && row.schemaOk ? "✓" : "✗";
    console.log(
      `  ${mark} ${id.padEnd(12)} playable=${row.playable ? "OK" : "NO"}  schema=${row.schemaOk ? "OK" : "NO"}  clinical=${row.clinicalOk ? "OK" : "NO"}`,
    );
    for (const issue of issues.slice(0, 4)) console.log(`      • ${issue}`);
  }

  for (const row of matrix) {
    if (!files.includes(`${row.id}.json`)) globalIssues.push(`manca file per ${row.id}`);
  }
  if (freq.HIGH !== 18 || freq.MEDIUM !== 9 || freq.LOW !== 3) {
    globalIssues.push(`distribuzione frequenza HIGH/MEDIUM/LOW = ${freq.HIGH}/${freq.MEDIUM}/${freq.LOW} (attesa 18/9/3)`);
  }
  for (const pdf of ESC_PDFS) {
    if (!pdfs.has(pdf)) globalIssues.push(`PDF ESC non referenziato: ${pdf}`);
  }

  const passed = rows.filter((r) => r.playable && r.schemaOk && r.clinicalOk).length;
  console.log("----------------------------------------------------");
  console.log("📊 REPORT AUDIT");
  console.log("----------------------------------------------------");
  console.log(`Casi auditati     : ${rows.length}/${EXPECTED_COUNT}`);
  console.log(`Playable          : ${rows.filter((r) => r.playable).length}/${rows.length}`);
  console.log(`Schema Zod        : ${rows.filter((r) => r.schemaOk).length}/${rows.length}`);
  console.log(`Coerenza clinica  : ${rows.filter((r) => r.clinicalOk).length}/${rows.length}`);
  console.log(`Frequenza         : HIGH=${freq.HIGH} MEDIUM=${freq.MEDIUM} LOW=${freq.LOW}`);
  console.log(`PDF ESC coperti   : ${pdfs.size}/12`);
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
  process.exitCode = 1;
});
