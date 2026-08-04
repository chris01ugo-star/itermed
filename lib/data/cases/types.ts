/**
 * Aequan Clinical Case — canonical TypeScript contract for gold-standard cases.
 * Source files live under `lib/data/cases/<specialty>/`.
 * Maps to Prisma `ClinicalCase` + `baselineExamFindings` at seed/import time.
 */

export type ClinicalCaseDifficulty = "EASY" | "MEDIUM" | "HARD";

/** Prassi Clinica UI difficulty label (Italian). */
export type PrassiDifficultyLabel = "facile" | "medio" | "difficile";

/** App section that owns the case in the product IA. */
export type CaseCategory = "prassi-clinica" | "simulazione-libera" | "training";

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
  /** Livello nomenclatore / priorità diagnostica (I–III). */
  level: "I" | "II" | "III";
  /**
   * Classe di raccomandazione ESC/AHA (opzionale).
   * Default derivato: mandatory → I; inappropriate → III.
   */
  recommendationClass?: "I" | "IIa" | "IIb" | "III";
  /**
   * Se true (o penalty ≥40 su inappropriate), esecuzione = Danno Iatrogeno Critico
   * → Accuratezza Clinica = 0.
   */
  iatrogenicCritical?: boolean;
  mandatory: boolean;
  finding: string;
  /** Tariffa SSN / nomenclatore (EUR). */
  priceEuro: number;
  /** Max latency from triage / request (minutes) when time-critical. */
  maxLatencyMinutes?: number;
  /** True → −25% appropriatezza prescrittiva se richiesto. */
  inappropriate?: boolean;
  inappropriatePenaltyPercent?: number;
  wasteRationale?: string;
  /** Optional component catalog ids when this row is a panel. */
  componentExamIds?: string[];
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
  /** Product IA section (Prassi Clinica, …). */
  category: CaseCategory;
  /** Specialty slug used by Prassi filters (`cardiologia`). */
  specialty: string;
  /** Display name for UI (`Cardiologia`). */
  specialtyLabel: string;
  medicalSpecialtyKey: string;
  /** Canonical engine difficulty (Prisma CaseDifficulty). */
  difficulty: ClinicalCaseDifficulty;
  /** Prassi UI label (`facile` | `medio` | `difficile`). */
  difficultyLabel: PrassiDifficultyLabel;
  /** Alias richiesto dai metadati Prassi (= estimatedDurationMinutes). */
  estimatedTimeMinutes: number;
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
  /** Modulo Econ — budget SSN di riferimento per la sessione. */
  examBudgetEuro: number;
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
