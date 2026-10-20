/**
 * Scrive knowledge_base/geriatria/cases/GERIA-001.json … GERIA-025.json
 * e li valida contro KnowledgeBaseCaseSchema.
 *
 *   npx tsx scripts/generate-geriatria-cases.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import { KnowledgeBaseCaseSchema } from "@/lib/cases/knowledge-base-case-schema";
import { GERIA_SPECS } from "./geriatria-cases/specs";
import type { ExamRow, Resolution, Spec, Step } from "./geriatria-cases/types";

const OUT_DIR = resolve(process.cwd(), "knowledge_base/geriatria/cases");

const DRUGS = [
  "Donepezil 5 mg",
  "Memantina 10 mg",
  "Quetiapina 25 mg",
  "Aloperidolo 2 mg/ml gocce",
  "Colecalciferolo (Vitamina D) 25.000 UI",
] as const;

const EXAM_IDS = ["mmse", "valutazione-geriatrica", "densitometria-ossea", "tc-encefalo"] as const;

function buildNodes(steps: Step[], resolutions: Resolution[]) {
  if (steps.length < 7) throw new Error(`servono almeno 7 decisioni, trovate ${steps.length}`);
  const decisions = steps.map((step, index) => {
    const id = `d${index + 1}`;
    const nextOk = index < steps.length - 1 ? `d${index + 2}` : "res-ok";
    return {
      id,
      type: "decision" as const,
      phase: step.phase,
      title: step.title,
      prompt: step.prompt,
      cost: step.cost,
      score: step.score,
      choices: [
        { id: `${id}-ok`, label: step.correctLabel, next: nextOk },
        ...step.wrongs.map((wrong, wrongIndex) => ({
          id: `${id}-w${wrongIndex + 1}`,
          label: wrong.label,
          next: wrong.next,
        })),
      ],
    };
  });
  const nodes = [
    ...decisions,
    ...resolutions.map((resolution) => ({
      id: resolution.id,
      type: "resolution" as const,
      title: resolution.title,
      prompt: resolution.prompt,
      cost: resolution.cost,
      score: resolution.score,
      outcome: resolution.outcome,
      ...(resolution.trap ? { trap: resolution.trap } : {}),
    })),
  ];
  if (nodes.length > 24) throw new Error(`albero di ${nodes.length} nodi, massimo 24`);
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.type !== "decision") continue;
    if (node.choices.length < 2) throw new Error(`${node.id} senza bivio`);
    for (const choice of node.choices) {
      if (!ids.has(choice.next)) throw new Error(`scelta ${choice.id} punta a ${choice.next} inesistente`);
    }
  }
  let cursor = "d1";
  let depth = 0;
  const seen = new Set<string>();
  while (nodes.find((node) => node.id === cursor)?.type === "decision") {
    if (seen.has(cursor)) throw new Error(`ciclo su ${cursor}`);
    seen.add(cursor);
    depth += 1;
    const node = nodes.find((item) => item.id === cursor);
    if (!node || node.type !== "decision") break;
    const correct = node.choices.find((choice) => choice.id.endsWith("-ok"));
    if (!correct) throw new Error(`manca la scelta corretta su ${cursor}`);
    cursor = correct.next;
  }
  if (depth < 7) throw new Error(`catena decisionale di ${depth} nodi, ne servono 7`);
  if (cursor !== "res-ok") throw new Error(`la catena corretta finisce su ${cursor}`);
  const negatives = nodes.filter((node) => node.type === "resolution" && node.outcome === "negative");
  if (!negatives.some((node) => "trap" in node && node.trap === "medico-legale")) {
    throw new Error("manca una resolution negativa medico-legale");
  }
  if (!negatives.some((node) => "trap" in node && node.trap === "economico")) {
    throw new Error("manca una resolution negativa economica");
  }
  return nodes;
}

function valuesFrom(exams: ExamRow[]) {
  const values: Record<string, { finding: string; normalFinding: string; isAbnormal: boolean; price: number }> = {};
  for (const exam of exams) {
    values[exam.examId] = {
      finding: exam.finding,
      normalFinding: exam.finding,
      isAbnormal: exam.isAbnormal,
      price: exam.priceEuro,
    };
  }
  return values;
}

function assemble(spec: Spec) {
  const id = `GERIA-${String(spec.n).padStart(3, "0")}`;
  const nodes = buildNodes(spec.steps, spec.resolutions);
  const exams = [...spec.mandatoryExams, ...spec.inappropriateExams];
  const examIds = new Set(exams.map((exam) => exam.examId));
  if (!examIds.has("mmse") || !examIds.has("valutazione-geriatrica")) {
    throw new Error("mancano mmse o valutazione-geriatrica");
  }
  if (!spec.goldStandardPath.includes("mmse") || !spec.goldStandardPath.includes("valutazione-geriatrica")) {
    throw new Error("il gold path non include mmse e valutazione-geriatrica");
  }
  return {
    id,
    code: id,
    title: spec.title,
    description: spec.description,
    difficulty: spec.difficulty,
    specialty: "geriatria" as const,
    specialtyLabel: "Geriatria" as const,
    condition: spec.condition,
    frequencyCategory: spec.frequencyCategory,
    matrixDifficulty: spec.matrixDifficulty,
    setting: spec.setting,
    guidelineRef: spec.guidelineRef,
    diagnosis: spec.diagnosis,
    pastMedicalHistory: spec.pastMedicalHistory,
    presentation: spec.presentation,
    redHerrings: spec.redHerrings,
    timeLimitMinutes: spec.timeLimitMinutes,
    patientDeteriorationThreshold: spec.patientDeteriorationThreshold,
    patientPrompt: spec.patientPrompt,
    correctSolution: spec.correctSolution,
    goldStandardPath: spec.goldStandardPath,
    goldPathNarrative: spec.goldPathNarrative,
    examLatencies: spec.examLatencies,
    anamnesisQuestions: spec.anamnesisQuestions,
    physicalExam: { summary: spec.physicalSummary },
    escCitations: spec.citations,
    auditMetrics: {
      appropriatenessIndicators: spec.indicators,
      gelliBiancoShield: {
        art5Adherence: spec.art5,
        legalCriteria: spec.legalCriteria,
      },
    },
    mandatoryExams: spec.mandatoryExams,
    inappropriateExams: spec.inappropriateExams.map((exam) => ({ ...exam, inappropriate: true })),
    baselineExamFindings: {
      context: spec.context,
      vitals: spec.vitals,
      examBudgetEuro: spec.budget,
      demographics: { age: spec.age, sex: spec.sex, name: spec.name },
      clinicalSigns: spec.signs,
      semeiotics: spec.signs,
      advancedExams: { values: valuesFrom(exams) },
    },
    patientProfile: {
      healthLiteracy: spec.literacy,
      emotionalState: spec.emotion,
      adherence: spec.adherence,
      lifestyleAndSocial: {
        sleepQuality: spec.sleep,
        stressLevel: spec.stress,
        socialSupport: spec.support,
      },
      communicationStyle: spec.communicationStyle,
    },
    secondary_specialties: ["neurologia"],
    nodes,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const failures: string[] = [];
  const corpusDrugs = new Set<string>();
  const corpusExams = new Set<string>();
  if (GERIA_SPECS.length !== 25) failures.push(`attesi 25 casi, trovati ${GERIA_SPECS.length}`);
  const numbers = new Set(GERIA_SPECS.map((spec) => spec.n));
  if (numbers.size !== 25) failures.push("numeri caso non univoci");

  for (const spec of GERIA_SPECS) {
    const id = `GERIA-${String(spec.n).padStart(3, "0")}`;
    let payload: ReturnType<typeof assemble>;
    try {
      payload = assemble(spec);
    } catch (error) {
      failures.push(`${id} build: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const parsed = KnowledgeBaseCaseSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues
        .slice(0, 4)
        .map((item) => `${item.path.join(".") || "root"} — ${item.message}`)
        .join(" | ");
      failures.push(`${id} schema: ${issue}`);
      continue;
    }
    const playable = assertPlayableCase(payload);
    if (!playable.ok) {
      failures.push(`${id} playable: ${playable.issues.map((item) => `${item.path}: ${item.message}`).join("; ")}`);
      continue;
    }
    const decisions = payload.nodes.filter((node) => node.type === "decision").length;
    if (decisions < 7) {
      failures.push(`${id} decisioni ${decisions}`);
      continue;
    }
    const blob = JSON.stringify(payload);
    const usedDrugs = DRUGS.filter((drug) => blob.includes(drug));
    if (usedDrugs.length === 0) failures.push(`${id} non cita nessun farmaco del catalogo geriatrico`);
    for (const drug of usedDrugs) corpusDrugs.add(drug);
    for (const examId of EXAM_IDS) {
      if (blob.includes(`"${examId}"`)) corpusExams.add(examId);
    }
    await writeFile(resolve(OUT_DIR, `${id}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`scritto ${id}.json (${payload.nodes.length} nodi, ${decisions} decisioni)`);
  }

  for (const drug of DRUGS) {
    if (!corpusDrugs.has(drug)) failures.push(`farmaco assente dal corpus: ${drug}`);
  }
  for (const examId of EXAM_IDS) {
    if (!corpusExams.has(examId)) failures.push(`esame assente dal corpus: ${examId}`);
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("25 casi di geriatria validati e scritti.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
