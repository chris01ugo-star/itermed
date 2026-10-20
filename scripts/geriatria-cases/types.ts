export type Phase = "anamnesi" | "diagnostica" | "screening" | "terapia" | "follow-up";
export type Trap = "medico-legale" | "economico";

export type Step = {
  phase: Phase;
  title: string;
  prompt: string;
  cost: number;
  score: number;
  correctLabel: string;
  wrongs: { label: string; next: string }[];
};

export type Resolution = {
  id: string;
  outcome: "positive" | "negative";
  trap?: Trap;
  title: string;
  prompt: string;
  cost: number;
  score: number;
};

export type ExamRow = {
  examId: string;
  name: string;
  finding: string;
  isAbnormal: boolean;
  priceEuro: number;
  inappropriate?: boolean;
  wasteRationale?: string;
  isFatal?: boolean;
};

export type Question = {
  id: string;
  prompt: string;
  critical: boolean;
  expectedKeywords: string[];
  rationale: string;
};

export type Spec = {
  n: number;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  matrixDifficulty: "BASE" | "INTERMEDIATE" | "ADVANCED";
  frequencyCategory: "HIGH" | "MEDIUM" | "LOW";
  setting: "AMBULATORIO" | "PRONTO_SOCCORSO" | "REPARTO" | "GUARDIA_MEDICA";
  condition: string;
  guidelineRef: string;
  diagnosis: string;
  pastMedicalHistory: string;
  presentation: string;
  redHerrings: string[];
  timeLimitMinutes: number;
  patientDeteriorationThreshold: number;
  patientPrompt: string;
  correctSolution: string;
  goldStandardPath: string[];
  goldPathNarrative: string;
  examLatencies: Record<string, number>;
  anamnesisQuestions: Question[];
  physicalSummary: string;
  citations: { chunkId: string; source: string; quote: string }[];
  indicators: string[];
  art5: string;
  legalCriteria: string[];
  mandatoryExams: ExamRow[];
  inappropriateExams: ExamRow[];
  budget: number;
  name: string;
  age: number;
  sex: "F" | "M";
  context: string;
  vitals: {
    heartRate: number;
    bloodPressure: string;
    spo2: number;
    temperature: number;
    respiratoryRate: number;
  };
  signs: { signName: string; result: string; isPositive: boolean }[];
  literacy: "LOW" | "MEDIUM" | "HIGH" | "CYBERCHONDRIA_AI";
  emotion: "ANXIOUS" | "DEFENSIVE" | "OPPOSITIONAL" | "COLLABORATIVE" | "PASSIVE";
  adherence: "FULL" | "PARTIAL" | "NON_COMPLIANT" | "SELF_MEDICATED";
  sleep: "POOR" | "FAIR" | "GOOD";
  stress: "LOW" | "MEDIUM" | "HIGH";
  support: "ISOLATED" | "LIMITED" | "ADEQUATE" | "STRONG";
  communicationStyle: string;
  steps: Step[];
  resolutions: Resolution[];
};
