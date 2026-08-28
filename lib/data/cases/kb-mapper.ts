/**
 * Maps a Zod-validated knowledge-base case into the engine `ClinicalCase` contract.
 * Prisma JSONB must be parsed with `knowledgeBaseCaseSchema.safeParse` before mapping.
 */

import { z } from "zod";
import {
  KbEscCitationSchema,
  PatientProfileSchema,
  knowledgeBaseCaseSchema,
  type KnowledgeBaseCase,
} from "@/lib/cases/knowledge-base-case-schema";
import { KnowledgeBaseCaseValidationError } from "@/lib/errors";
import type {
  CaseExamDefinition,
  ClinicalCase,
  PhysicalExamDistrict,
  PrassiDifficultyLabel,
} from "@/lib/data/cases/types";

const DIFFICULTY_LABEL: Record<ClinicalCase["difficulty"], PrassiDifficultyLabel> = {
  EASY: "facile",
  MEDIUM: "medio",
  HARD: "difficile",
};

const SPECIALTY_DISTRICT: Record<KnowledgeBaseCase["specialty"], PhysicalExamDistrict["district"]> =
  {
    cardiologia: "cardiovascolare",
    pneumologia: "torace_polmonare",
    gastroenterologia: "addome",
  };

const RagSourcesColumnSchema = z.array(KbEscCitationSchema);

export type KnowledgeBaseCaseRowInput = {
  id: string;
  caseData: unknown;
  patientProfile?: unknown;
  ragSources?: unknown;
};

function zodIssueList(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "root",
    message: issue.message,
  }));
}

function isPopulatedJson(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * Runtime-validate Prisma JSONB columns. Throws {@link KnowledgeBaseCaseValidationError}
 * instead of coercing corrupt payloads into the simulation engine.
 */
export function parseKnowledgeBaseCaseRow(row: KnowledgeBaseCaseRowInput): KnowledgeBaseCase {
  const parsed = knowledgeBaseCaseSchema.safeParse(row.caseData);
  if (!parsed.success) {
    throw new KnowledgeBaseCaseValidationError(row.id, "caseData", zodIssueList(parsed.error));
  }

  const kb = parsed.data;
  if (kb.id !== row.id) {
    throw new KnowledgeBaseCaseValidationError(row.id, "caseData.id", [
      { path: "id", message: `caseData.id (${kb.id}) does not match row.id (${row.id})` },
    ]);
  }

  if (isPopulatedJson(row.patientProfile)) {
    const profile = PatientProfileSchema.safeParse(row.patientProfile);
    if (!profile.success) {
      throw new KnowledgeBaseCaseValidationError(
        row.id,
        "patientProfile",
        zodIssueList(profile.error),
      );
    }
  }

  if (isPopulatedJson(row.ragSources)) {
    const rag = RagSourcesColumnSchema.safeParse(row.ragSources);
    if (!rag.success) {
      throw new KnowledgeBaseCaseValidationError(row.id, "ragSources", zodIssueList(rag.error));
    }
  }

  return kb;
}

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

/**
 * Pure mapper: `kb` must already be Zod-validated (`parseKnowledgeBaseCaseRow`).
 * Builds a `ClinicalCase` field-by-field — no `as ClinicalCase` / `as any`.
 */
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
    { district: SPECIALTY_DISTRICT[kb.specialty], finding: physicalSummary },
  ];
  const patientPrompt = kb.patientPrompt?.trim() || kb.presentation;
  const correctSolution = kb.correctSolution?.trim() || kb.diagnosis;

  const mapped = {
    code: kb.code,
    id: kb.id,
    title: kb.title,
    description: kb.description,
    category: "prassi-clinica" as const,
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
    patientPrompt,
    pastMedicalHistory: kb.pastMedicalHistory,
    correctSolution,
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
      statusWhenMet: "CONFORME" as const,
      statusWhenUnmet: "NON_CONFORME" as const,
      criteria: kb.auditMetrics.gelliBiancoShield.legalCriteria.map((description, index) => ({
        id: `legal_${kb.id}_${index + 1}`,
        description,
        requiredMilestoneKeys: [] as string[],
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
  } satisfies ClinicalCase;

  return mapped;
}

/** Parse Prisma JSONB then map — the only supported path from DB → simulation engine. */
export function clinicalCaseFromKnowledgeBaseRow(row: KnowledgeBaseCaseRowInput): ClinicalCase {
  return knowledgeBaseCaseToClinicalCase(parseKnowledgeBaseCaseRow(row));
}
