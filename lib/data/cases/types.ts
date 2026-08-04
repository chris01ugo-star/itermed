/**
 * Aequan Clinical Case — canonical TypeScript contract for gold-standard cases.
 * Source files live under `lib/data/cases/<specialty>/`.
 * Maps to Prisma `ClinicalCase` + `baselineExamFindings` at seed/import time.
 */

export type ClinicalCaseDifficulty = "EASY" | "MEDIUM" | "HARD";

export type AnamnesisQuestion = {
  id: string;
  /** Domanda chiave che il medico deve formulare. */
  prompt: string;
  /** Se true, conta nella copertura anamnestica del protocollo. */
  critical: boolean;
  /** Keyword/frasi attese nel turno medico (matching fuzzy). */
  expectedKeywords: string[];
  /** Perché è clinicamente/medico-legalmente rilevante. */
  rationale: string;
};

export type PhysicalExamDistrict = {
  district:
    | "generale"
    | "cardiovascolare"
    | "torace_polmonare"
    | "addome"
    | "neurologico"
    | "periferico";
  finding: string;
};

export type CaseExamDefinition = {
  /** Catalog exam id (`lib/exam-catalog-structure.ts`). */
  examId: string;
  name: string;
  level: "I" | "II" | "III";
  mandatory: boolean;
  finding: string;
  priceEuro: number;
  /** Max latency from triage / request (minutes) when time-critical. */
  maxLatencyMinutes?: number;
  /** True → −25% appropriatezza prescrittiva se richiesto. */
  inappropriate?: boolean;
  inappropriatePenaltyPercent?: number;
  wasteRationale?: string;
};

export type LegalConformityCriterion = {
  id: string;
  description: string;
  /** Milestone keys that must be unlocked for CONFORME. */
  requiredMilestoneKeys: string[];
};

export type RagLegalReference = {
  /** Formal citation shown in report motivations (`sourceRef`). */
  sourceRef: string;
  /** Path relative to repo `rag_knowledge_base/`. */
  documentPath: string;
  articles?: string[];
  relevance: string;
};

/**
 * Gold-standard clinical case definition (authoring + evaluation SSOT).
 */
export type ClinicalCase = {
  code: string;
  id: string;
  title: string;
  description: string;
  specialty: string;
  medicalSpecialtyKey: string;
  difficulty: ClinicalCaseDifficulty;
  estimatedDurationMinutes: number;
  timeLimitMinutes: number;
  patientDeteriorationThreshold: number;
  patientPrompt: string;
  pastMedicalHistory: string;
  /** Server-only gold management — never send to browser. */
  correctSolution: string;
  diagnosis: string;
  /** Ordered gold path (exam / action ids). */
  goldStandardPath: string[];
  examLatencies: Record<string, number>;
  anamnesisQuestions: AnamnesisQuestion[];
  physicalExam: {
    killipClass: "I" | "II" | "III" | "IV";
    summary: string;
    districts: PhysicalExamDistrict[];
  };
  mandatoryExams: CaseExamDefinition[];
  inappropriateExams: CaseExamDefinition[];
  legalConformity: {
    /** Binary outcome when all criteria are met. */
    statusWhenMet: "CONFORME";
    statusWhenUnmet: "NON_CONFORME";
    criteria: LegalConformityCriterion[];
    ragReferences: RagLegalReference[];
  };
  /** Canonical baseline for simulator vitals / findings / budget / stress. */
  baselineExamFindings: Record<string, unknown>;
};
