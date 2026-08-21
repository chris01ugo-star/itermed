/**
 * Maps authored `knowledge_base/gastroenterologia/cases/GASTRO-*.json` into the Prassi registry.
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

import gastro001 from "@/knowledge_base/gastroenterologia/cases/GASTRO-001.json";
import gastro002 from "@/knowledge_base/gastroenterologia/cases/GASTRO-002.json";
import gastro003 from "@/knowledge_base/gastroenterologia/cases/GASTRO-003.json";
import gastro004 from "@/knowledge_base/gastroenterologia/cases/GASTRO-004.json";
import gastro005 from "@/knowledge_base/gastroenterologia/cases/GASTRO-005.json";
import gastro006 from "@/knowledge_base/gastroenterologia/cases/GASTRO-006.json";
import gastro007 from "@/knowledge_base/gastroenterologia/cases/GASTRO-007.json";
import gastro008 from "@/knowledge_base/gastroenterologia/cases/GASTRO-008.json";
import gastro009 from "@/knowledge_base/gastroenterologia/cases/GASTRO-009.json";
import gastro010 from "@/knowledge_base/gastroenterologia/cases/GASTRO-010.json";
import gastro011 from "@/knowledge_base/gastroenterologia/cases/GASTRO-011.json";
import gastro012 from "@/knowledge_base/gastroenterologia/cases/GASTRO-012.json";
import gastro013 from "@/knowledge_base/gastroenterologia/cases/GASTRO-013.json";
import gastro014 from "@/knowledge_base/gastroenterologia/cases/GASTRO-014.json";
import gastro015 from "@/knowledge_base/gastroenterologia/cases/GASTRO-015.json";
import gastro016 from "@/knowledge_base/gastroenterologia/cases/GASTRO-016.json";
import gastro017 from "@/knowledge_base/gastroenterologia/cases/GASTRO-017.json";
import gastro018 from "@/knowledge_base/gastroenterologia/cases/GASTRO-018.json";
import gastro019 from "@/knowledge_base/gastroenterologia/cases/GASTRO-019.json";
import gastro020 from "@/knowledge_base/gastroenterologia/cases/GASTRO-020.json";
import gastro021 from "@/knowledge_base/gastroenterologia/cases/GASTRO-021.json";
import gastro022 from "@/knowledge_base/gastroenterologia/cases/GASTRO-022.json";
import gastro023 from "@/knowledge_base/gastroenterologia/cases/GASTRO-023.json";
import gastro024 from "@/knowledge_base/gastroenterologia/cases/GASTRO-024.json";
import gastro025 from "@/knowledge_base/gastroenterologia/cases/GASTRO-025.json";
import gastro026 from "@/knowledge_base/gastroenterologia/cases/GASTRO-026.json";
import gastro027 from "@/knowledge_base/gastroenterologia/cases/GASTRO-027.json";
import gastro028 from "@/knowledge_base/gastroenterologia/cases/GASTRO-028.json";
import gastro029 from "@/knowledge_base/gastroenterologia/cases/GASTRO-029.json";
import gastro030 from "@/knowledge_base/gastroenterologia/cases/GASTRO-030.json";

const DIFFICULTY_LABEL: Record<ClinicalCase["difficulty"], PrassiDifficultyLabel> = {
  EASY: "facile",
  MEDIUM: "medio",
  HARD: "difficile",
};

const RAW_KB_CASES: unknown[] = [
  gastro001,
  gastro002,
  gastro003,
  gastro004,
  gastro005,
  gastro006,
  gastro007,
  gastro008,
  gastro009,
  gastro010,
  gastro011,
  gastro012,
  gastro013,
  gastro014,
  gastro015,
  gastro016,
  gastro017,
  gastro018,
  gastro019,
  gastro020,
  gastro021,
  gastro022,
  gastro023,
  gastro024,
  gastro025,
  gastro026,
  gastro027,
  gastro028,
  gastro029,
  gastro030,
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
    { district: "addome", finding: physicalSummary },
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
      `GASTRO KB case #${index + 1} invalid at ${path}: ${first?.message ?? "schema error"}`,
    );
  }
  return knowledgeBaseCaseToClinicalCase(parsed.data);
}

export const GASTRO_KB_CASES: ClinicalCase[] = RAW_KB_CASES.map(parseKbCase);
