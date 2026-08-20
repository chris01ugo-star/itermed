/**
 * Maps authored `knowledge_base/cardiologia/cases/CARDIO-*.json` into the Prassi registry.
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

import cardio001 from "@/knowledge_base/cardiologia/cases/CARDIO-001.json";
import cardio002 from "@/knowledge_base/cardiologia/cases/CARDIO-002.json";
import cardio003 from "@/knowledge_base/cardiologia/cases/CARDIO-003.json";
import cardio004 from "@/knowledge_base/cardiologia/cases/CARDIO-004.json";
import cardio005 from "@/knowledge_base/cardiologia/cases/CARDIO-005.json";
import cardio006 from "@/knowledge_base/cardiologia/cases/CARDIO-006.json";
import cardio007 from "@/knowledge_base/cardiologia/cases/CARDIO-007.json";
import cardio008 from "@/knowledge_base/cardiologia/cases/CARDIO-008.json";
import cardio009 from "@/knowledge_base/cardiologia/cases/CARDIO-009.json";
import cardio010 from "@/knowledge_base/cardiologia/cases/CARDIO-010.json";
import cardio011 from "@/knowledge_base/cardiologia/cases/CARDIO-011.json";
import cardio012 from "@/knowledge_base/cardiologia/cases/CARDIO-012.json";
import cardio013 from "@/knowledge_base/cardiologia/cases/CARDIO-013.json";
import cardio014 from "@/knowledge_base/cardiologia/cases/CARDIO-014.json";
import cardio015 from "@/knowledge_base/cardiologia/cases/CARDIO-015.json";
import cardio016 from "@/knowledge_base/cardiologia/cases/CARDIO-016.json";
import cardio017 from "@/knowledge_base/cardiologia/cases/CARDIO-017.json";
import cardio018 from "@/knowledge_base/cardiologia/cases/CARDIO-018.json";
import cardio019 from "@/knowledge_base/cardiologia/cases/CARDIO-019.json";
import cardio020 from "@/knowledge_base/cardiologia/cases/CARDIO-020.json";
import cardio021 from "@/knowledge_base/cardiologia/cases/CARDIO-021.json";
import cardio022 from "@/knowledge_base/cardiologia/cases/CARDIO-022.json";
import cardio023 from "@/knowledge_base/cardiologia/cases/CARDIO-023.json";
import cardio024 from "@/knowledge_base/cardiologia/cases/CARDIO-024.json";
import cardio025 from "@/knowledge_base/cardiologia/cases/CARDIO-025.json";
import cardio026 from "@/knowledge_base/cardiologia/cases/CARDIO-026.json";
import cardio027 from "@/knowledge_base/cardiologia/cases/CARDIO-027.json";
import cardio028 from "@/knowledge_base/cardiologia/cases/CARDIO-028.json";
import cardio029 from "@/knowledge_base/cardiologia/cases/CARDIO-029.json";
import cardio030 from "@/knowledge_base/cardiologia/cases/CARDIO-030.json";

const DIFFICULTY_LABEL: Record<ClinicalCase["difficulty"], PrassiDifficultyLabel> = {
  EASY: "facile",
  MEDIUM: "medio",
  HARD: "difficile",
};

const RAW_KB_CASES: unknown[] = [
  cardio001,
  cardio002,
  cardio003,
  cardio004,
  cardio005,
  cardio006,
  cardio007,
  cardio008,
  cardio009,
  cardio010,
  cardio011,
  cardio012,
  cardio013,
  cardio014,
  cardio015,
  cardio016,
  cardio017,
  cardio018,
  cardio019,
  cardio020,
  cardio021,
  cardio022,
  cardio023,
  cardio024,
  cardio025,
  cardio026,
  cardio027,
  cardio028,
  cardio029,
  cardio030,
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
    { district: "cardiovascolare", finding: physicalSummary },
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
      `CARDIO KB case #${index + 1} invalid at ${path}: ${first?.message ?? "schema error"}`,
    );
  }
  return knowledgeBaseCaseToClinicalCase(parsed.data);
}

export const CARDIO_KB_CASES: ClinicalCase[] = RAW_KB_CASES.map(parseKbCase);
