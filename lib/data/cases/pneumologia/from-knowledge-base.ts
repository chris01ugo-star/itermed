/**
 * Maps authored `knowledge_base/pneumologia/cases/PNEUMO-*.json` into the Prassi registry.
 */

import type {
  CaseExamDefinition,
  ClinicalCase,
  PhysicalExamDistrict,
  PrassiDifficultyLabel,
} from "@/lib/data/cases/types";
import {
  KnowledgeBaseCaseSchema,
  type KnowledgeBaseCase,
} from "@/lib/cases/knowledge-base-case-schema";

import pneumo001 from "@/knowledge_base/pneumologia/cases/PNEUMO-001.json";
import pneumo002 from "@/knowledge_base/pneumologia/cases/PNEUMO-002.json";
import pneumo003 from "@/knowledge_base/pneumologia/cases/PNEUMO-003.json";
import pneumo004 from "@/knowledge_base/pneumologia/cases/PNEUMO-004.json";
import pneumo005 from "@/knowledge_base/pneumologia/cases/PNEUMO-005.json";
import pneumo006 from "@/knowledge_base/pneumologia/cases/PNEUMO-006.json";
import pneumo007 from "@/knowledge_base/pneumologia/cases/PNEUMO-007.json";
import pneumo008 from "@/knowledge_base/pneumologia/cases/PNEUMO-008.json";
import pneumo009 from "@/knowledge_base/pneumologia/cases/PNEUMO-009.json";
import pneumo010 from "@/knowledge_base/pneumologia/cases/PNEUMO-010.json";
import pneumo011 from "@/knowledge_base/pneumologia/cases/PNEUMO-011.json";
import pneumo012 from "@/knowledge_base/pneumologia/cases/PNEUMO-012.json";
import pneumo013 from "@/knowledge_base/pneumologia/cases/PNEUMO-013.json";
import pneumo014 from "@/knowledge_base/pneumologia/cases/PNEUMO-014.json";
import pneumo015 from "@/knowledge_base/pneumologia/cases/PNEUMO-015.json";
import pneumo016 from "@/knowledge_base/pneumologia/cases/PNEUMO-016.json";
import pneumo017 from "@/knowledge_base/pneumologia/cases/PNEUMO-017.json";
import pneumo018 from "@/knowledge_base/pneumologia/cases/PNEUMO-018.json";
import pneumo019 from "@/knowledge_base/pneumologia/cases/PNEUMO-019.json";
import pneumo020 from "@/knowledge_base/pneumologia/cases/PNEUMO-020.json";
import pneumo021 from "@/knowledge_base/pneumologia/cases/PNEUMO-021.json";
import pneumo022 from "@/knowledge_base/pneumologia/cases/PNEUMO-022.json";
import pneumo023 from "@/knowledge_base/pneumologia/cases/PNEUMO-023.json";
import pneumo024 from "@/knowledge_base/pneumologia/cases/PNEUMO-024.json";
import pneumo025 from "@/knowledge_base/pneumologia/cases/PNEUMO-025.json";
import pneumo026 from "@/knowledge_base/pneumologia/cases/PNEUMO-026.json";
import pneumo027 from "@/knowledge_base/pneumologia/cases/PNEUMO-027.json";
import pneumo028 from "@/knowledge_base/pneumologia/cases/PNEUMO-028.json";
import pneumo029 from "@/knowledge_base/pneumologia/cases/PNEUMO-029.json";
import pneumo030 from "@/knowledge_base/pneumologia/cases/PNEUMO-030.json";

const DIFFICULTY_LABEL: Record<ClinicalCase["difficulty"], PrassiDifficultyLabel> = {
  EASY: "facile",
  MEDIUM: "medio",
  HARD: "difficile",
};

const RAW_KB_CASES: unknown[] = [
  pneumo001,
  pneumo002,
  pneumo003,
  pneumo004,
  pneumo005,
  pneumo006,
  pneumo007,
  pneumo008,
  pneumo009,
  pneumo010,
  pneumo011,
  pneumo012,
  pneumo013,
  pneumo014,
  pneumo015,
  pneumo016,
  pneumo017,
  pneumo018,
  pneumo019,
  pneumo020,
  pneumo021,
  pneumo022,
  pneumo023,
  pneumo024,
  pneumo025,
  pneumo026,
  pneumo027,
  pneumo028,
  pneumo029,
  pneumo030,
];

function toMandatoryExam(row: KnowledgeBaseCase["mandatoryExams"][number]): CaseExamDefinition {
  return {
    examId: row.examId,
    name: row.name?.trim() || row.examId,
    level: "I",
    mandatory: true,
    finding: row.finding,
    priceEuro: row.priceEuro ?? 0,
  };
}

function toInappropriateExam(
  row: KnowledgeBaseCase["inappropriateExams"][number],
): CaseExamDefinition {
  return {
    examId: row.examId,
    name: row.name?.trim() || row.examId,
    level: "III",
    mandatory: false,
    finding: row.finding,
    priceEuro: row.priceEuro ?? 0,
    inappropriate: true,
    inappropriatePenaltyPercent: 25,
    wasteRationale: row.wasteRationale,
  };
}

export function knowledgeBaseCaseToClinicalCase(kb: KnowledgeBaseCase): ClinicalCase {
  const budget =
    typeof kb.baselineExamFindings.examBudgetEuro === "number"
      ? kb.baselineExamFindings.examBudgetEuro
      : 350;
  const mandatoryExams = kb.mandatoryExams.map(toMandatoryExam);
  const inappropriateExams = kb.inappropriateExams.map(toInappropriateExam);
  const physicalSummary = kb.physicalExam.summary;
  const districts: PhysicalExamDistrict[] = [
    { district: "generale", finding: physicalSummary },
    { district: "torace_polmonare", finding: physicalSummary },
  ];

  return {
    code: kb.code,
    id: kb.id,
    title: kb.title,
    description: kb.description,
    category: "prassi-clinica",
    specialty: kb.specialty,
    specialtyLabel: kb.specialtyLabel,
    medicalSpecialtyKey: kb.specialty,
    difficulty: kb.difficulty,
    difficultyLabel: DIFFICULTY_LABEL[kb.difficulty],
    estimatedTimeMinutes: kb.timeLimitMinutes,
    estimatedDurationMinutes: kb.timeLimitMinutes,
    timeLimitMinutes: kb.timeLimitMinutes,
    patientDeteriorationThreshold: kb.patientDeteriorationThreshold,
    ...(kb.patientProfile ? { patientProfile: kb.patientProfile } : {}),
    patientPrompt: kb.patientPrompt?.trim() || kb.presentation,
    pastMedicalHistory: kb.pastMedicalHistory,
    correctSolution: kb.correctSolution?.trim() || kb.diagnosis,
    diagnosis: kb.diagnosis,
    goldStandardPath: kb.goldStandardPath,
    examLatencies: kb.examLatencies,
    anamnesisQuestions: kb.anamnesisQuestions,
    physicalExam: {
      killipClass: kb.physicalExam.killipClass ?? "I",
      summary: physicalSummary,
      districts,
    },
    mandatoryExams,
    inappropriateExams,
    examBudgetEuro: budget,
    legalConformity: {
      statusWhenMet: "CONFORME",
      statusWhenUnmet: "NON_CONFORME",
      criteria: kb.auditMetrics.gelliBiancoShield.legalCriteria.map((description, index) => ({
        id: `legal_${kb.id}_${index + 1}`,
        description,
        requiredMilestoneKeys: [],
      })),
      ragReferences: kb.escCitations.map((citation) => ({
        sourceRef: citation.source,
        documentPath: citation.source,
        relevance: citation.quote,
      })),
    },
    baselineExamFindings: {
      ...kb.baselineExamFindings,
      examBudgetEuro: budget,
      anamnesisQuestions: kb.anamnesisQuestions,
      physicalExam: {
        killipClass: kb.physicalExam.killipClass ?? "I",
        summary: physicalSummary,
        finding: physicalSummary,
        districts,
      },
      mandatoryExams,
      inappropriateExams,
    },
  };
}

function parseKbCase(raw: unknown, index: number): ClinicalCase {
  const parsed = KnowledgeBaseCaseSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.join(".") || "root";
    throw new Error(
      `PNEUMO KB case #${index + 1} invalid at ${path}: ${first?.message ?? "schema error"}`,
    );
  }
  return knowledgeBaseCaseToClinicalCase(parsed.data);
}

export const PNEUMO_KB_CASES: ClinicalCase[] = RAW_KB_CASES.map(parseKbCase);
