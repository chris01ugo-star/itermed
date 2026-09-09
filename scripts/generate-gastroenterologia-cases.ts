/**
 * Generate 30 structured gastroenterology cases from matrix.json + RAG chunks.
 *
 *   npx tsx scripts/generate-gastroenterologia-cases.ts
 *   npx tsx scripts/generate-gastroenterologia-cases.ts --resume
 *   npx tsx scripts/generate-gastroenterologia-cases.ts --only=GASTRO-001
 *   npx tsx scripts/generate-gastroenterologia-cases.ts --validate-only
 */
import { openai } from "@ai-sdk/openai";
import { embed, generateObject } from "ai";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import {
  GeneratedCaseNarrativeSchema,
  KnowledgeBaseCaseSchema,
  MATRIX_TO_ENGINE_DIFFICULTY,
  type GeneratedCaseNarrative,
  type KnowledgeBaseCase,
  type PatientProfile,
} from "@/lib/cases/knowledge-base-case-schema";
import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import { sanitizeExamFinding } from "@/lib/simulator/exam-finding-text";
import { getPineconeIndex } from "@/lib/pinecone";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const MATRIX_PATH = resolve(process.cwd(), "knowledge_base/gastroenterologia/matrix.json");
const OUT_DIR = resolve(process.cwd(), "knowledge_base/gastroenterologia/cases");
const PINECONE_NAMESPACE = "guidelines";
const RAG_TOP_K = 4;
const SPECIALTY = "Gastroenterologia";

type MatrixRow = {
  id: string;
  title: string;
  condition: string;
  frequencyCategory: "HIGH" | "MEDIUM" | "LOW";
  difficulty: "BASE" | "INTERMEDIATE" | "ADVANCED";
  setting: "GUARDIA_MEDICA" | "PRONTO_SOCCORSO" | "AMBULATORIO" | "REPARTO";
  guidelineRef: string;
};

type Scaffold = {
  goldStandardPath: string[];
  inappropriateExamIds: string[];
  examBudgetEuro: number;
};

type RagHit = { chunkId: string; source: string; text: string };

type AuthoredProfile = {
  age: number;
  sex: "M" | "F";
  name: string;
  vitals: {
    heartRate: number;
    bloodPressure: string;
    spo2: number;
    temperature: number;
    respiratoryRate: number;
  };
  patientProfile: PatientProfile;
};

const ALLOWED_EXAM_IDS = new Set([
  ...flattenCatalogExams().map((e) => e.id),
  "consenso-informato",
  "trasferimento-ps",
]);

const EXAM_NAMES = new Map(flattenCatalogExams().map((e) => [e.id, e.name]));
EXAM_NAMES.set("consenso-informato", "Consenso informato");
EXAM_NAMES.set("trasferimento-ps", "Trasferimento in Pronto Soccorso");

const PRICE_EURO: Record<string, number> = {
  emocromo: 4.5,
  "pt-ptt-inr": 8,
  "gruppo-rh": 12,
  egds: 90,
  colonscopia: 120,
  ecografia: 35,
  "amilasi-lipasi": 9,
  "enzimi-epatici": 10,
  bilirubina: 6,
  liquidi: 40,
  "pcr-pct": 12,
  biopsia: 80,
  immunoglobuline: 18,
  coprocultura: 16,
  "hiv-hcv-hbv": 22,
  cea: 18,
  "ca-markers": 28,
  tc: 180,
  "colangio-rm": 220,
  rm: 200,
  lattati: 7,
  emocolture: 22,
  elettroliti: 8,
  "creat-urea-gfr": 8,
  "rx-addome": 18,
  "pet-tc": 900,
  coronarografia: 800,
  moc: 40,
  mammografia: 45,
  ecg: 11.6,
  glicemia: 3,
};

const LATENCY: Record<string, number> = {
  emocromo: 30,
  "pt-ptt-inr": 30,
  "gruppo-rh": 25,
  egds: 60,
  colonscopia: 90,
  ecografia: 25,
  "amilasi-lipasi": 30,
  "enzimi-epatici": 30,
  bilirubina: 30,
  liquidi: 40,
  "pcr-pct": 35,
  biopsia: 90,
  immunoglobuline: 40,
  coprocultura: 48,
  "hiv-hcv-hbv": 40,
  cea: 40,
  "ca-markers": 40,
  tc: 45,
  "colangio-rm": 60,
  rm: 50,
  lattati: 15,
  emocolture: 20,
  elettroliti: 30,
  "creat-urea-gfr": 30,
  "rx-addome": 20,
  "pet-tc": 180,
  coronarografia: 90,
  moc: 40,
  consenso: 10,
  "consenso-informato": 10,
  ecg: 8,
  glicemia: 20,
};

const SETTING_LABEL: Record<MatrixRow["setting"], string> = {
  GUARDIA_MEDICA: "Guardia Medica territoriale",
  PRONTO_SOCCORSO: "Pronto Soccorso",
  AMBULATORIO: "Ambulatorio di Gastroenterologia",
  REPARTO: "Reparto di Gastroenterologia",
};

function p(
  age: number,
  sex: "M" | "F",
  name: string,
  vitals: AuthoredProfile["vitals"],
  patientProfile: PatientProfile,
): AuthoredProfile {
  return { age, sex, name, vitals, patientProfile };
}

const PATIENT_PROFILES: Record<string, AuthoredProfile> = {
  "GASTRO-001": p(58, "M", "Marco", { heartRate: 112, bloodPressure: "98/58", spo2: 96, temperature: 36.6, respiratoryRate: 22 }, {
    healthLiteracy: "MEDIUM", emotionalState: "ANXIOUS", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
    communicationStyle: "Vomita sangue e teme di morire. Chiede se 'è un tumore'. Il tono sbrigativo aumenta il panico; serve validazione e spiegazione dell'EGDS senza gergo Forrest.",
  }),
  "GASTRO-002": p(74, "F", "Rosa", { heartRate: 108, bloodPressure: "102/62", spo2: 95, temperature: 36.4, respiratoryRate: 20 }, {
    healthLiteracy: "LOW", emotionalState: "PASSIVE", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
    communicationStyle: "Minimizza i FANS 'per l'artrosi'. Annuisce senza capire coagulazione e trasfusione. Serve linguaggio concreto e coinvolgere la figlia.",
  }),
  "GASTRO-003": p(76, "M", "Vincenzo", { heartRate: 104, bloodPressure: "108/64", spo2: 95, temperature: 36.5, respiratoryRate: 18 }, {
    healthLiteracy: "MEDIUM", emotionalState: "DEFENSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
    communicationStyle: "Si vergogna del sangue nelle feci. Se il medico è giudicante sul vino, si chiude. Accetta la colonscopia se si spiega preparazione e consenso.",
  }),
  "GASTRO-004": p(81, "F", "Teresa", { heartRate: 96, bloodPressure: "118/70", spo2: 94, temperature: 36.3, respiratoryRate: 18 }, {
    healthLiteracy: "LOW", emotionalState: "ANXIOUS", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
    communicationStyle: "Ha paura della preparazione intestinale. Il caregiver parla per lei. Serve tempo, volume basso e conferma di chi resta in sala d'attesa.",
  }),
  "GASTRO-005": p(54, "M", "Salvatore", { heartRate: 118, bloodPressure: "88/52", spo2: 93, temperature: 36.8, respiratoryRate: 24 }, {
    healthLiteracy: "LOW", emotionalState: "OPPOSITIONAL", adherence: "NON_COMPLIANT",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ISOLATED" },
    communicationStyle: "Nega l'alcol. Il moralismo innesca ostilità. Funziona il framing sulla varice come 'vena fragile' e sulla necessità dell'EGDS urgente, senza colpa.",
  }),
  "GASTRO-006": p(62, "M", "Pietro", { heartRate: 98, bloodPressure: "108/68", spo2: 94, temperature: 36.7, respiratoryRate: 20 }, {
    healthLiteracy: "MEDIUM", emotionalState: "ANXIOUS", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "LIMITED" },
    communicationStyle: "Il pancione da ascite lo umilia. Chiede se 'è acqua o tumore'. La paracentesi va spiegata come sollievo e analisi, non come puntura punitiva.",
  }),
  "GASTRO-007": p(45, "M", "Andrea", { heartRate: 110, bloodPressure: "128/82", spo2: 97, temperature: 37.4, respiratoryRate: 22 }, {
    healthLiteracy: "MEDIUM", emotionalState: "ANXIOUS", adherence: "SELF_MEDICATED",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
    communicationStyle: "Ha preso FANS e amari 'per lo stomaco'. Il dolore a cintura lo terrorizza. Serve de-escalation e spiegare lipasi/eco senza catastrophizzare la necrosi.",
  }),
  "GASTRO-008": p(68, "F", "Lucia", { heartRate: 102, bloodPressure: "142/86", spo2: 96, temperature: 37.8, respiratoryRate: 20 }, {
    healthLiteracy: "MEDIUM", emotionalState: "COLLABORATIVE", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "STRONG" },
    communicationStyle: "Chiede se dovrà operare la cistifellea. Preferisce un piano (eco, colangio-RM, timing). Il silenzio procedurale la inquieta.",
  }),
  "GASTRO-009": p(29, "F", "Sara", { heartRate: 108, bloodPressure: "108/68", spo2: 98, temperature: 37.9, respiratoryRate: 18 }, {
    healthLiteracy: "HIGH", emotionalState: "ANXIOUS", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
    communicationStyle: "Conosce i farmaci biologici da forum. Se si sminuisce il dolore, si sente non creduta. Collabora se si noma ECCO e si condivide il work-up.",
  }),
  "GASTRO-010": p(34, "M", "Matteo", { heartRate: 106, bloodPressure: "112/70", spo2: 97, temperature: 38.1, respiratoryRate: 18 }, {
    healthLiteracy: "HIGH", emotionalState: "DEFENSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
    communicationStyle: "Ha smesso gli steroidi da solo. Il tono paternalistico irrigidisce. Funziona spiegare il rischio di megacolon senza colpevolizzare.",
  }),
  "GASTRO-011": p(41, "F", "Valentina", { heartRate: 78, bloodPressure: "118/74", spo2: 98, temperature: 36.4, respiratoryRate: 16 }, {
    healthLiteracy: "CYBERCHONDRIA_AI", emotionalState: "ANXIOUS", adherence: "SELF_MEDICATED",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
    communicationStyle: "Arriva con screenshot ChatGPT sul Barrett e chiede subito una pH-impedenzometria. Se si sminuisce Google, si chiude. Serve validare l'ansia e ancorare al Lyon Consensus senza concessioni difensive.",
  }),
  "GASTRO-012": p(38, "F", "Federica", { heartRate: 76, bloodPressure: "116/72", spo2: 98, temperature: 36.5, respiratoryRate: 16 }, {
    healthLiteracy: "CYBERCHONDRIA_AI", emotionalState: "ANXIOUS", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
    communicationStyle: "Ha letto che l'IBS 'nasconde un tumore'. Pretende RM e colonscopia. La de-escalation Roma IV funziona solo se si riconosce la paura e si tengono gli allarmi, senza over-testing.",
  }),
  "GASTRO-013": p(26, "F", "Giada", { heartRate: 82, bloodPressure: "108/66", spo2: 99, temperature: 36.3, respiratoryRate: 16 }, {
    healthLiteracy: "HIGH", emotionalState: "COLLABORATIVE", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "STRONG" },
    communicationStyle: "Chiede dati su glutine e biopsia. Il paternalismo la infastidisce; apprezza la condivisione (sierologia prima, poi EGDS).",
  }),
  "GASTRO-014": p(55, "M", "Carmine", { heartRate: 104, bloodPressure: "136/84", spo2: 97, temperature: 38.4, respiratoryRate: 20 }, {
    healthLiteracy: "LOW", emotionalState: "ANXIOUS", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
    communicationStyle: "Il dolore ipocondrio destro lo fa pensare all'infarto. Serve distinguere colecistite da cuore in parole semplici e spiegare l'eco addome.",
  }),
  "GASTRO-015": p(48, "M", "Daniele", { heartRate: 74, bloodPressure: "128/80", spo2: 98, temperature: 36.5, respiratoryRate: 14 }, {
    healthLiteracy: "MEDIUM", emotionalState: "COLLABORATIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "GOOD", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
    communicationStyle: "Dispepsia da mesi. Accetta il test H. pylori se si spiega perché non serve subito la PET. Chiede un piano scritto di eradicazione.",
  }),
  "GASTRO-016": p(50, "F", "Monica", { heartRate: 72, bloodPressure: "122/76", spo2: 98, temperature: 36.4, respiratoryRate: 14 }, {
    healthLiteracy: "HIGH", emotionalState: "DEFENSIVE", adherence: "SELF_MEDICATED",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "STRONG" },
    communicationStyle: "Assume IPP da tre anni 'perché Google dice gastrite cronica'. Resiste alla deprescrizione. Serve Nota AIFA N01 spiegata senza sdegno, con criterio Lyon.",
  }),
  "GASTRO-017": p(63, "M", "Nicola", { heartRate: 88, bloodPressure: "112/70", spo2: 95, temperature: 36.6, respiratoryRate: 18 }, {
    healthLiteracy: "MEDIUM", emotionalState: "PASSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
    communicationStyle: "In degenza, accetta le procedure se spiegate in una frase. Il gergo Baveno/HVPG lo spaventa senza migliorare la comprensione.",
  }),
  "GASTRO-018": p(51, "M", "Rocco", { heartRate: 124, bloodPressure: "96/58", spo2: 94, temperature: 38.2, respiratoryRate: 26 }, {
    healthLiteracy: "LOW", emotionalState: "OPPOSITIONAL", adherence: "NON_COMPLIANT",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ISOLATED" },
    communicationStyle: "Rifiuta il ricovero ('è solo una colica'). Il paternalismo aumenta la fuga. Serve micro-rassicurazione e spiegare perché la TC non è immediata (IAP/APA).",
  }),
  "GASTRO-019": p(70, "F", "Assunta", { heartRate: 112, bloodPressure: "100/60", spo2: 93, temperature: 38.6, respiratoryRate: 22 }, {
    healthLiteracy: "LOW", emotionalState: "ANXIOUS", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
    communicationStyle: "Confusa, febbrile. Il caregiver chiede 'è peritonite?'. Serve spiegare la paracentesi diagnostica come urgenza, non come invasività inutile.",
  }),
  "GASTRO-020": p(31, "M", "Lorenzo", { heartRate: 86, bloodPressure: "122/74", spo2: 98, temperature: 37.2, respiratoryRate: 16 }, {
    healthLiteracy: "HIGH", emotionalState: "DEFENSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
    communicationStyle: "Si vergogna della fistola perianale. Il tono burocratico lo fa rimandare. Funziona riservatezza, RM/colonscopia spiegate e piano ECCO.",
  }),
  "GASTRO-021": p(44, "F", "Ilaria", { heartRate: 74, bloodPressure: "118/72", spo2: 98, temperature: 36.4, respiratoryRate: 14 }, {
    healthLiteracy: "HIGH", emotionalState: "COLLABORATIVE", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "GOOD", stressLevel: "MEDIUM", socialSupport: "STRONG" },
    communicationStyle: "Chiede intervalli di sorveglianza e rischio displasia. Apprezza numeri e linee guida ECCO; odia il 'stia tranquilla' senza dati.",
  }),
  "GASTRO-022": p(39, "F", "Martina", { heartRate: 80, bloodPressure: "116/74", spo2: 98, temperature: 36.6, respiratoryRate: 16 }, {
    healthLiteracy: "CYBERCHONDRIA_AI", emotionalState: "ANXIOUS", adherence: "SELF_MEDICATED",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "STRONG" },
    communicationStyle: "Assume curcuma e 'detox' da influencer. Porta stampe su DILI. Se si deride l'integratore, si chiude. Serve validare e fermare il prodotto secondo EASL, senza PET difensiva.",
  }),
  "GASTRO-023": p(67, "M", "Giovanni", { heartRate: 78, bloodPressure: "138/84", spo2: 97, temperature: 36.5, respiratoryRate: 16 }, {
    healthLiteracy: "MEDIUM", emotionalState: "ANXIOUS", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
    communicationStyle: "Ha notato sangue occulto e pensa al padre morto di K. Serve SPIKES-Perception prima dello staging. Il gergo TNM senza preparazione aumenta l'ansia.",
  }),
  "GASTRO-024": p(71, "M", "Alfonso", { heartRate: 82, bloodPressure: "132/80", spo2: 96, temperature: 36.4, respiratoryRate: 16 }, {
    healthLiteracy: "LOW", emotionalState: "PASSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
    communicationStyle: "Dispepsia e calo ponderale minimizzati. Accetta l'EGDS se il figlio è presente. Frasi corte, niente acronimi ESMO.",
  }),
  "GASTRO-025": p(18, "M", "Samuele", { heartRate: 72, bloodPressure: "118/70", spo2: 99, temperature: 36.4, respiratoryRate: 14 }, {
    healthLiteracy: "CYBERCHONDRIA_AI", emotionalState: "ANXIOUS", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
    communicationStyle: "Studente, ha chiesto a un chatbot se il gonfiore è Crohn o tumore. Pretende colonscopia e RM. Roma IV: ascolto aperto, criteri di allarme, no over-testing.",
  }),
  "GASTRO-026": p(52, "F", "Cristina", { heartRate: 76, bloodPressure: "124/78", spo2: 98, temperature: 36.4, respiratoryRate: 14 }, {
    healthLiteracy: "HIGH", emotionalState: "DEFENSIVE", adherence: "NON_COMPLIANT",
    lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
    communicationStyle: "Dice di essere 'senza glutine' ma concede tracce. Il tono inquisitorio irrigidisce. Serve re-biopsia e diario alimentare come alleanza, non come processo.",
  }),
  "GASTRO-027": p(46, "F", "Elisa", { heartRate: 74, bloodPressure: "120/76", spo2: 98, temperature: 36.5, respiratoryRate: 14 }, {
    healthLiteracy: "MEDIUM", emotionalState: "DEFENSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "GOOD", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
    communicationStyle: "Ha già fallito una terapia e dubita del medico. Maastricht rescue va spiegato come piano B evidence-based, non come colpa della paziente.",
  }),
  "GASTRO-028": p(42, "F", "Nadia", { heartRate: 92, bloodPressure: "110/68", spo2: 97, temperature: 37.1, respiratoryRate: 18 }, {
    healthLiteracy: "HIGH", emotionalState: "ANXIOUS", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
    communicationStyle: "Ittero e paura del trapianto. Chiede percentuali. Serve SPIKES (Perception/Emotions) e work-up EASL senza catastrophizzare.",
  }),
  "GASTRO-029": p(64, "M", "Franco", { heartRate: 88, bloodPressure: "128/78", spo2: 95, temperature: 36.6, respiratoryRate: 18 }, {
    healthLiteracy: "LOW", emotionalState: "PASSIVE", adherence: "PARTIAL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
    communicationStyle: "Calo ponderale avanzato, parla poco. Il caregiver decide. Cattive notizie: setting riservato, invita a chiedere quanto vuole sapere (SPIKES).",
  }),
  "GASTRO-030": p(85, "F", "Giuseppina", { heartRate: 86, bloodPressure: "142/78", spo2: 94, temperature: 36.3, respiratoryRate: 18 }, {
    healthLiteracy: "LOW", emotionalState: "PASSIVE", adherence: "FULL",
    lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "LOW", socialSupport: "ADEQUATE" },
    communicationStyle: "Grande anziana, si affida alla nipote. Evitare aggressività diagnostica (PET, colonscopia ripetuta) senza bilancio geriatrico. Linguaggio lento e rispettoso.",
  }),
};

const SCAFFOLDS: Record<string, Scaffold> = {
  "GASTRO-001": { goldStandardPath: ["emocromo", "pt-ptt-inr", "gruppo-rh", "egds", "consenso-informato"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 180 },
  "GASTRO-002": { goldStandardPath: ["emocromo", "pt-ptt-inr", "egds", "consenso-informato"], inappropriateExamIds: ["pet-tc", "coronarografia"], examBudgetEuro: 150 },
  "GASTRO-003": { goldStandardPath: ["emocromo", "pt-ptt-inr", "colonscopia", "consenso-informato"], inappropriateExamIds: ["pet-tc", "egds"], examBudgetEuro: 200 },
  "GASTRO-004": { goldStandardPath: ["emocromo", "colonscopia", "consenso-informato"], inappropriateExamIds: ["pet-tc", "moc"], examBudgetEuro: 160 },
  "GASTRO-005": { goldStandardPath: ["emocromo", "pt-ptt-inr", "egds", "consenso-informato"], inappropriateExamIds: ["colonscopia", "pet-tc"], examBudgetEuro: 170 },
  "GASTRO-006": { goldStandardPath: ["enzimi-epatici", "bilirubina", "ecografia", "liquidi"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 120 },
  "GASTRO-007": { goldStandardPath: ["amilasi-lipasi", "enzimi-epatici", "ecografia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 80 },
  "GASTRO-008": { goldStandardPath: ["amilasi-lipasi", "ecografia", "colangio-rm"], inappropriateExamIds: ["pet-tc", "coronarografia"], examBudgetEuro: 280 },
  "GASTRO-009": { goldStandardPath: ["pcr-pct", "emocromo", "colonscopia", "biopsia"], inappropriateExamIds: ["pet-tc", "moc"], examBudgetEuro: 240 },
  "GASTRO-010": { goldStandardPath: ["pcr-pct", "emocromo", "colonscopia"], inappropriateExamIds: ["pet-tc", "coronarografia"], examBudgetEuro: 160 },
  "GASTRO-011": { goldStandardPath: ["emocromo", "egds", "consenso-informato"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 120 },
  "GASTRO-012": { goldStandardPath: ["emocromo", "coprocultura"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 40 },
  "GASTRO-013": { goldStandardPath: ["immunoglobuline", "egds", "biopsia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 200 },
  "GASTRO-014": { goldStandardPath: ["emocromo", "enzimi-epatici", "ecografia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 70 },
  "GASTRO-015": { goldStandardPath: ["egds", "biopsia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 180 },
  "GASTRO-016": { goldStandardPath: ["emocromo", "egds"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 110 },
  "GASTRO-017": { goldStandardPath: ["emocromo", "enzimi-epatici", "egds", "consenso-informato"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 160 },
  "GASTRO-018": { goldStandardPath: ["amilasi-lipasi", "lattati", "tc"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 220 },
  "GASTRO-019": { goldStandardPath: ["liquidi", "pcr-pct", "emocolture"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 90 },
  "GASTRO-020": { goldStandardPath: ["pcr-pct", "rm", "colonscopia"], inappropriateExamIds: ["pet-tc", "moc"], examBudgetEuro: 360 },
  "GASTRO-021": { goldStandardPath: ["colonscopia", "biopsia", "consenso-informato"], inappropriateExamIds: ["pet-tc", "coronarografia"], examBudgetEuro: 220 },
  "GASTRO-022": { goldStandardPath: ["enzimi-epatici", "bilirubina", "hiv-hcv-hbv"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 60 },
  "GASTRO-023": { goldStandardPath: ["colonscopia", "biopsia", "cea"], inappropriateExamIds: ["pet-tc", "moc"], examBudgetEuro: 230 },
  "GASTRO-024": { goldStandardPath: ["egds", "biopsia", "cea"], inappropriateExamIds: ["colonscopia", "coronarografia"], examBudgetEuro: 200 },
  "GASTRO-025": { goldStandardPath: ["emocromo", "coprocultura"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 35 },
  "GASTRO-026": { goldStandardPath: ["immunoglobuline", "egds", "biopsia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 200 },
  "GASTRO-027": { goldStandardPath: ["egds", "biopsia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 180 },
  "GASTRO-028": { goldStandardPath: ["enzimi-epatici", "bilirubina", "hiv-hcv-hbv", "biopsia"], inappropriateExamIds: ["pet-tc", "colonscopia"], examBudgetEuro: 140 },
  "GASTRO-029": { goldStandardPath: ["egds", "biopsia", "tc", "ca-markers"], inappropriateExamIds: ["colonscopia", "coronarografia"], examBudgetEuro: 320 },
  "GASTRO-030": { goldStandardPath: ["colonscopia", "cea", "tc"], inappropriateExamIds: ["pet-tc", "moc"], examBudgetEuro: 330 },
};

function parseArgs(argv: string[]) {
  let resume = false;
  let validateOnly = false;
  let only: string | null = null;
  for (const arg of argv) {
    if (arg === "--resume") resume = true;
    if (arg === "--validate-only") validateOnly = true;
    if (arg.startsWith("--only=")) only = arg.slice("--only=".length).trim();
  }
  return { resume, validateOnly, only };
}

function sourceNameFor(pdf: string): string {
  return `knowledge_base/gastroenterologia/clinical/${pdf}`;
}

function timeLimits(difficulty: MatrixRow["difficulty"]) {
  if (difficulty === "BASE") return { timeLimitMinutes: 20, patientDeteriorationThreshold: 10 };
  if (difficulty === "INTERMEDIATE") return { timeLimitMinutes: 25, patientDeteriorationThreshold: 12 };
  return { timeLimitMinutes: 30, patientDeteriorationThreshold: 12 };
}

function normalizeBloodPressure(raw: string): string {
  const match = String(raw).replace(/\s+/g, "").match(/(\d{2,3})\/(\d{2,3})/);
  return match ? `${match[1]}/${match[2]}` : "120/80";
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function wasteRationale(examId: string, guidelineRef: string): string {
  return `Esame non di prima intenzione per questo quadro clinico (spreco SSN / possibile ritardo terapeutico). Riferimento: ${guidelineRef}.`;
}

async function retrieveGuidelineChunks(pdf: string, query: string): Promise<RagHit[]> {
  const index = getPineconeIndex();
  if (!index) {
    throw new Error("Pinecone non configurato (PINECONE_API_KEY + PINECONE_INDEX).");
  }
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query.slice(0, 8000),
  });
  const sourceName = sourceNameFor(pdf);
  const queryOnce = async (filter?: Record<string, unknown>) =>
    index.namespace(PINECONE_NAMESPACE).query({
      vector: embedding,
      topK: RAG_TOP_K,
      includeMetadata: true,
      ...(filter ? { filter } : {}),
    });

  let response = await queryOnce({ sourceName: { $eq: sourceName } });
  if ((response.matches ?? []).length === 0) {
    response = await queryOnce({ specialty: { $eq: SPECIALTY } });
  }
  if ((response.matches ?? []).length === 0) {
    response = await queryOnce();
  }

  const hits: RagHit[] = [];
  for (const match of response.matches ?? []) {
    const metadata = (match.metadata ?? {}) as Record<string, unknown>;
    const text = typeof metadata.content === "string" ? metadata.content.trim() : "";
    if (!text) continue;
    const src = typeof metadata.sourceName === "string" ? metadata.sourceName : "";
    if (src && !src.includes(pdf) && (response.matches?.length ?? 0) > RAG_TOP_K / 2) {
      continue;
    }
    hits.push({
      chunkId: typeof match.id === "string" ? match.id : String(metadata.chunkId ?? "unknown"),
      source: src || sourceName,
      text: text.slice(0, 900),
    });
  }
  if (hits.length === 0) {
    for (const match of response.matches ?? []) {
      const metadata = (match.metadata ?? {}) as Record<string, unknown>;
      const text = typeof metadata.content === "string" ? metadata.content.trim() : "";
      if (!text) continue;
      hits.push({
        chunkId: typeof match.id === "string" ? match.id : String(metadata.chunkId ?? "unknown"),
        source: typeof metadata.sourceName === "string" ? metadata.sourceName : sourceName,
        text: text.slice(0, 900),
      });
      if (hits.length >= RAG_TOP_K) break;
    }
  }
  return hits;
}

function formatRagCorpus(hits: RagHit[]): string {
  if (hits.length === 0) return "(nessun chunk RAG recuperato)";
  return hits
    .map((h, i) => `[${i + 1}] CHUNK_ID=${h.chunkId}\nFONTE=${h.source}\n${h.text}`)
    .join("\n---\n");
}

function examLatenciesFor(path: string[], extra: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of [...path, ...extra]) {
    if (LATENCY[id] != null) out[id] = LATENCY[id];
  }
  return out;
}

function ensureLen(text: string, min: number, max: number, fallback: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim() || fallback;
  if (trimmed.length >= min) return trimmed.slice(0, max);
  return `${trimmed} ${fallback}`.trim().slice(0, max);
}

function findingForExam(examId: string, matrix: MatrixRow, summary: string, inappropriate: boolean): string {
  if (inappropriate) return wasteRationale(examId, matrix.guidelineRef);
  const fromSummary = sanitizeExamFinding(examId, summary);
  return ensureLen(
    fromSummary,
    20,
    900,
    `Reperto strumentale dell'esame richiesto, senza indicazioni di percorso.`,
  );
}

function anamnesisFor(matrix: MatrixRow): KnowledgeBaseCase["anamnesisQuestions"] {
  const base = [
    {
      prompt: `Tempo e modalità di insorgenza di dolore addominale, sanguinamento o ittero (${matrix.condition})`,
      keywords: ["da quanto", "quando", "insorgenza", "dolore", "sangue"],
      rationale: "Definisce urgenza gastroenterologica e finestra endoscopica.",
    },
    {
      prompt: "Caratteristiche (ematemesi, melena, rettorragia, vomito, diarrea, prurito, calo ponderale)",
      keywords: ["vomito", "melena", "feci", "diarrea", "peso"],
      rationale: "Fenotipo clinico per diagnosi differenziale digestiva.",
    },
    {
      prompt: "Farmaci (FANS, anticoagulanti, IPP, antibiotici, integratori) e alcol",
      keywords: ["fans", "anticoag", "ipp", "integratori", "alcol"],
      rationale: "Fattori di rischio UGIB, DILI, pancreatite e appropriatezza IPP (Nota AIFA N01).",
    },
    {
      prompt: "Terapie in atto, allergie, precedenti chirurgici / endoscopie",
      keywords: ["farmaci", "allergia", "intervento", "gastroscopia", "colonscopia"],
      rationale: "Baseline prescrittiva, consenso e scudo Gelli-Bianco (L. 24/2017 Art. 5).",
    },
    {
      prompt: "Red flag (ipotensione, febbre, confusione, massa, disfagia, anemia)",
      keywords: ["pressione", "febbre", "confusione", "peso", "disfagia"],
      rationale: "Identifica instabilità e indicazioni a trasferimento/EGDS urgente.",
    },
    {
      prompt: `Contesto di presentazione: ${SETTING_LABEL[matrix.setting]}`,
      keywords: ["dove si trova", "arrivato", "ambulanza", "visita"],
      rationale: "Il setting condiziona triage, risorse e obblighi di trasferimento.",
    },
  ];
  return base.map((q, i) => ({
    id: `aq_${matrix.id.toLowerCase()}_${i + 1}`,
    prompt: q.prompt,
    critical: i < 5,
    expectedKeywords: q.keywords,
    rationale: q.rationale,
  }));
}

function citationsFromRag(
  hits: RagHit[],
  guidelineRef: string,
  fallbackQuote: string,
): KnowledgeBaseCase["escCitations"] {
  const rows = hits.slice(0, 4).map((h) => ({
    chunkId: h.chunkId,
    source: h.source || sourceNameFor(guidelineRef),
    quote: ensureLen(h.text, 20, 500, fallbackQuote),
  }));
  if (rows.length > 0) return rows;
  return [
    {
      chunkId: `fallback-${guidelineRef}`,
      source: sourceNameFor(guidelineRef),
      quote: ensureLen(fallbackQuote, 20, 500, `Riferimento ${guidelineRef}.`),
    },
  ];
}

const ACTION_IDS = new Set(["consenso-informato", "trasferimento-ps"]);

function fallbackNarrative(matrix: MatrixRow, authored: AuthoredProfile, scaffold: Scaffold): GeneratedCaseNarrative {
  const who = authored.sex === "F" ? "Donna" : "Uomo";
  const v = authored.vitals;
  return {
    age: authored.age,
    sex: authored.sex,
    name: authored.name,
    context: `${who} di ${authored.age} anni valutato in ${SETTING_LABEL[matrix.setting]} per ${matrix.condition}.`,
    heartRate: v.heartRate,
    bloodPressure: v.bloodPressure,
    spo2: v.spo2,
    temperature: v.temperature,
    respiratoryRate: v.respiratoryRate,
    description: `${authored.name}, ${authored.age} anni, si presenta in ${SETTING_LABEL[matrix.setting]} con un quadro compatibile con ${matrix.condition}. I vitali mostrano FC ${v.heartRate} bpm, PA ${v.bloodPressure}, SpO2 ${v.spo2}%, temperatura ${v.temperature} °C e FR ${v.respiratoryRate} atti/min. Il profilo psicologico influenza l'intervista e l'aderenza, senza sostituire il razionale delle linee guida gastroenterologiche.`,
    presentation: `All'arrivo in ${SETTING_LABEL[matrix.setting]}, ${authored.name} riferisce sintomi digestivi coerenti con ${matrix.condition}. Non enuncia la diagnosi e descrive dolore, nausea o sanguinamento in modo laico. L'esame obiettivo e i primi test del gold path orientano verso ${matrix.guidelineRef}.`,
    redHerring1: "Attribuisce i sintomi a 'indigestione da un pasto pesante'.",
    redHerring2: "Ha assunto un antiacido o un integratore pensando di risolvere da solo.",
    redHerring3: "Menziona un dolore muscolare o da sforzo, non dirimente per il quadro digestivo.",
    pastMedicalHistory: `${authored.name} ha un'anamnesi digestiva e generale coerente con ${matrix.condition}, con fattori di rischio (FANS, alcol, IPP, IBD, cirrosi o familiarità oncologica) da esplorare. L'aderenza dichiarata è ${authored.patientProfile.adherence}.`,
    patientPrompt: `Mi chiamo ${authored.name} e ho ${authored.age} anni. Sono qui per un problema di stomaco o intestino e ho paura. Non voglio parole difficili. Dimmi cosa stai per fare e perché, senza dirmi il nome della malattia se non te lo chiedo.`,
    diagnosis: matrix.condition,
    correctSolution: `Gold path: ${scaffold.goldStandardPath.join(" → ")}. Evitare ${scaffold.inappropriateExamIds.join(", ")}. Linea guida: ${matrix.guidelineRef}. Scudo L. 24/2017 Art. 5 se si documenta l'adesione.`,
    goldPathNarrative: `Il percorso ${scaffold.goldStandardPath.join(" → ")} è la sequenza di prima intenzione per ${matrix.condition} secondo ${matrix.guidelineRef}. Gli esami ${scaffold.inappropriateExamIds.join(", ")} non sono di prima linea e configurano spreco SSN o ritardo.`,
    physicalExamSummary: `Paziente vigile in ${SETTING_LABEL[matrix.setting]}. Addome con reperti coerenti con ${matrix.condition}; non segni extra-addominali dirimenti. Vitali come da triage.`,
    examAbnormalitiesSummary: `Reperti attesi sul gold path per ${matrix.condition}: laboratorio e imaging/endoscopia orientati alla diagnosi, senza over-testing.`,
    killipClass: "I",
    gelliArt5Adherence: `L'adesione a ${matrix.guidelineRef} e al gold path costituisce conformità alle buone pratiche clinico-assistenziali (L. 24/2017 Art. 5 Gelli-Bianco), con consenso e appropriatezza prescrittiva documentati.`,
  };
}

function assembleCase(params: {
  matrix: MatrixRow;
  scaffold: Scaffold;
  narrative: GeneratedCaseNarrative;
  ragHits: RagHit[];
  authored: AuthoredProfile;
}): KnowledgeBaseCase {
  const { matrix, scaffold, narrative, authored } = params;
  const engineDifficulty = MATRIX_TO_ENGINE_DIFFICULTY[matrix.difficulty];
  const times = timeLimits(matrix.difficulty);
  const summary = narrative.examAbnormalitiesSummary || narrative.goldPathNarrative;

  const requiredIds = [...new Set([...scaffold.goldStandardPath, ...scaffold.inappropriateExamIds])].filter(
    (id) => ALLOWED_EXAM_IDS.has(id) && EXAM_NAMES.has(id) && !ACTION_IDS.has(id),
  );

  const values: Record<
    string,
    { finding: string; normalFinding: string; isAbnormal: boolean; price: number }
  > = {};

  const mandatoryExams: KnowledgeBaseCase["mandatoryExams"] = [];
  for (const examId of scaffold.goldStandardPath) {
    if (!requiredIds.includes(examId)) continue;
    const finding = findingForExam(examId, matrix, summary, false);
    const price = PRICE_EURO[examId] ?? 0;
    values[examId] = { finding, normalFinding: finding, isAbnormal: true, price };
    mandatoryExams.push({
      examId,
      name: EXAM_NAMES.get(examId) ?? examId,
      finding,
      isAbnormal: true,
      priceEuro: price,
    });
  }

  const inappropriateExams: KnowledgeBaseCase["inappropriateExams"] = [];
  for (const examId of scaffold.inappropriateExamIds) {
    const finding = findingForExam(examId, matrix, summary, true);
    const price = PRICE_EURO[examId] ?? 0;
    values[examId] = { finding, normalFinding: finding, isAbnormal: false, price };
    inappropriateExams.push({
      examId,
      name: EXAM_NAMES.get(examId) ?? examId,
      finding,
      isAbnormal: false,
      priceEuro: price,
      inappropriate: true,
      wasteRationale: wasteRationale(examId, matrix.guidelineRef),
    });
  }

  const description = ensureLen(
    narrative.description,
    40,
    2500,
    `${matrix.title} in ${SETTING_LABEL[matrix.setting]}. Patologia: ${matrix.condition}.`,
  );
  const presentation = ensureLen(
    narrative.presentation,
    40,
    2500,
    `Paziente valutato in ${SETTING_LABEL[matrix.setting]} per ${matrix.condition}.`,
  );
  const pastMedicalHistory = ensureLen(
    narrative.pastMedicalHistory,
    40,
    2500,
    `Anamnesi patologica prossima e remota coerente con ${matrix.condition}.`,
  );
  const patientPrompt = ensureLen(
    narrative.patientPrompt,
    40,
    2500,
    `Sei ${authored.name}. Descrivi i sintomi senza nominare la diagnosi e senza citare valori numerici.`,
  );
  const correctSolution = ensureLen(
    narrative.correctSolution,
    40,
    2500,
    `Gold path: ${scaffold.goldStandardPath.join(" → ")}. Linea guida: ${matrix.guidelineRef}.`,
  );
  const goldPathNarrative = ensureLen(
    narrative.goldPathNarrative,
    40,
    2000,
    `Percorso diagnostico-terapeutico: ${scaffold.goldStandardPath.join(" → ")}. Evitare ${scaffold.inappropriateExamIds.join(", ")}.`,
  );
  const physicalSummary = ensureLen(
    narrative.physicalExamSummary,
    40,
    1200,
    `Esame obiettivo in ${SETTING_LABEL[matrix.setting]}, quadro compatibile con ${matrix.condition}.`,
  );
  const gelli = ensureLen(
    narrative.gelliArt5Adherence,
    30,
    800,
    `L'adesione alle linee guida (${matrix.guidelineRef}) e al gold path costituisce parametro di conformità alle buone pratiche clinico-assistenziali (L. 24/2017 Art. 5 Gelli-Bianco).`,
  );
  const redHerrings = [narrative.redHerring1, narrative.redHerring2, narrative.redHerring3].map((h) =>
    ensureLen(h || "", 8, 400, "Dettaglio anamnestico rumoroso non dirimente."),
  );

  const baselineExamFindings = {
    vitals: {
      heartRate: clamp(authored.vitals.heartRate, 30, 220),
      bloodPressure: normalizeBloodPressure(authored.vitals.bloodPressure),
      spo2: clamp(authored.vitals.spo2, 50, 100),
      temperature: clamp(authored.vitals.temperature, 34, 41),
      respiratoryRate: clamp(authored.vitals.respiratoryRate, 6, 50),
    },
    examBudgetEuro: scaffold.examBudgetEuro,
    demographics: {
      age: authored.age,
      sex: authored.sex,
      context: ensureLen(narrative.context, 8, 240, SETTING_LABEL[matrix.setting]),
    },
    physicalExam: {
      finding: physicalSummary,
    },
    advancedExams: { values },
    ...Object.fromEntries(
      Object.entries(values).map(([id, row]) => [id, { finding: row.finding, isAbnormal: row.isAbnormal }]),
    ),
  };

  return {
    id: matrix.id,
    code: matrix.id,
    title: matrix.title,
    description,
    difficulty: engineDifficulty,
    specialty: "gastroenterologia",
    specialtyLabel: "Gastroenterologia",
    condition: matrix.condition,
    frequencyCategory: matrix.frequencyCategory,
    matrixDifficulty: matrix.difficulty,
    setting: matrix.setting,
    guidelineRef: matrix.guidelineRef,
    diagnosis: ensureLen(narrative.diagnosis, 8, 400, matrix.condition),
    pastMedicalHistory,
    presentation,
    redHerrings,
    patientPrompt,
    correctSolution,
    goldStandardPath: scaffold.goldStandardPath,
    goldPathNarrative,
    timeLimitMinutes: times.timeLimitMinutes,
    patientDeteriorationThreshold: times.patientDeteriorationThreshold,
    examLatencies: examLatenciesFor(scaffold.goldStandardPath, scaffold.inappropriateExamIds),
    anamnesisQuestions: anamnesisFor(matrix),
    physicalExam: {
      summary: physicalSummary,
    },
    patientProfile: authored.patientProfile,
    baselineExamFindings,
    escCitations: citationsFromRag(params.ragHits, matrix.guidelineRef, goldPathNarrative),
    auditMetrics: {
      appropriatenessIndicators: [
        `Eseguire in sequenza il gold path: ${scaffold.goldStandardPath.join(" → ")}.`,
        `Non prescrivere di prima intenzione: ${scaffold.inappropriateExamIds.join(", ")} (${matrix.guidelineRef}).`,
        `Budget SSN di riferimento: €${scaffold.examBudgetEuro}.`,
      ],
      gelliBiancoShield: {
        art5Adherence: gelli,
        legalCriteria: [
          "Documentare adesione alle linee guida accreditate (L. 24/2017 Art. 5 Gelli-Bianco).",
          "Raccogliere consenso informato prima di procedure invasive (EGDS/colonscopia/paracentesi).",
          "Evitare esami inappropriati e IPP senza indicazione (Codice deontologico, Nota AIFA N01).",
          `Registrare tempi critici nel setting ${SETTING_LABEL[matrix.setting]}.`,
        ],
      },
    },
    mandatoryExams,
    inappropriateExams,
  };
}

async function generateNarrative(params: {
  matrix: MatrixRow;
  scaffold: Scaffold;
  ragHits: RagHit[];
  authored: AuthoredProfile;
}): Promise<GeneratedCaseNarrative> {
  const { authored } = params;
  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: GeneratedCaseNarrativeSchema,
    temperature: 0.4,
    system: `Sei un gastroenterologo (ESGE/EASL/ECCO/IAP/Lyon/Roma IV/ESMO/Maastricht) e un medico-legale (L. 24/2017 Gelli-Bianco) che progetta casi per un simulatore formativo italiano (AEQUAN).
Scrivi in italiano un caso realistico e internamente coerente.

REGOLE:
- Non inventare classi di raccomandazione se non compaiono nei chunk RAG.
- patientPrompt: prima persona; niente diagnosi e niente valori numerici.
- Nome proprio: usa esattamente "${authored.name}".
- Età/sesso fissati: ${authored.age} anni, ${authored.sex}. Non cambiare età.
- Vitali coerenti col quadro (shock da UGIB, febbre da colecistite/SBP, tachicardia da pancreatite).
- Integra il profilo psicologico (literacy, ansia, aderenza, sonno, rete sociale, eventuale cybercondria) nel patientPrompt e nella presentazione, senza nominare gli enum.
- redHerring1/2/3: rumore clinico che NON è la diagnosi.
- examAbnormalitiesSummary: elenco sintetico dei reperti attesi.
- gelliArt5Adherence: scudo L. 24/2017 Art. 5 se si segue il gold path.
- I campi testo lunghi devono essere paragrafi completi.
- killipClass: usa sempre I (non è un caso cardiologico).`,
    prompt: `MATRICE
id: ${params.matrix.id}
titolo: ${params.matrix.title}
patologia: ${params.matrix.condition}
setting: ${params.matrix.setting} (${SETTING_LABEL[params.matrix.setting]})
frequenza: ${params.matrix.frequencyCategory}
difficoltà: ${params.matrix.difficulty}
PDF LINEA GUIDA: ${params.matrix.guidelineRef}
GOLD PATH: ${params.scaffold.goldStandardPath.join(" → ")}
ESAMI INAPPROPRIATI: ${params.scaffold.inappropriateExamIds.join(", ")}
PAZIENTE: ${authored.name}, ${authored.age} anni, ${authored.sex}
VITALI TARGET: FC ${authored.vitals.heartRate}, PA ${authored.vitals.bloodPressure}, SpO2 ${authored.vitals.spo2}, T ${authored.vitals.temperature}, FR ${authored.vitals.respiratoryRate}
PROFILO: literacy=${authored.patientProfile.healthLiteracy}; emotion=${authored.patientProfile.emotionalState}; adherence=${authored.patientProfile.adherence}; sleep=${authored.patientProfile.lifestyleAndSocial.sleepQuality}; stress=${authored.patientProfile.lifestyleAndSocial.stressLevel}; support=${authored.patientProfile.lifestyleAndSocial.socialSupport}
STILE: ${authored.patientProfile.communicationStyle}

<<<RAG_CORPUS>>>
${formatRagCorpus(params.ragHits)}
<<<END>>>`,
  });

  return {
    ...object,
    age: authored.age,
    sex: authored.sex,
    name: authored.name,
    heartRate: authored.vitals.heartRate,
    bloodPressure: authored.vitals.bloodPressure,
    spo2: authored.vitals.spo2,
    temperature: authored.vitals.temperature,
    respiratoryRate: authored.vitals.respiratoryRate,
  };
}

function casePath(id: string): string {
  return resolve(OUT_DIR, `${id}.json`);
}

function validateCaseFile(raw: unknown): { ok: boolean; issues: string[] } {
  const parsed = KnowledgeBaseCaseSchema.safeParse(raw);
  const issues: string[] = [];
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  } else if (!parsed.data.patientProfile) {
    issues.push("patientProfile mancante (obbligatorio per Gastroenterologia)");
  }
  const playable = assertPlayableCase({
    title: (raw as KnowledgeBaseCase | undefined)?.title,
    description: (raw as KnowledgeBaseCase | undefined)?.description,
    difficulty: (raw as KnowledgeBaseCase | undefined)?.difficulty,
    goldStandardPath: (raw as KnowledgeBaseCase | undefined)?.goldStandardPath,
    baselineExamFindings: (raw as KnowledgeBaseCase | undefined)?.baselineExamFindings,
    correctSolution: (raw as KnowledgeBaseCase | undefined)?.correctSolution,
    patientPrompt: (raw as KnowledgeBaseCase | undefined)?.patientPrompt,
  });
  if (!playable.ok) {
    for (const issue of playable.issues) {
      issues.push(`playable.${issue.path}: ${issue.message}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

async function validateAll(ids: string[]): Promise<boolean> {
  let okAll = true;
  for (const id of ids) {
    const file = casePath(id);
    if (!existsSync(file)) {
      console.error(`  ✗ ${id}: file mancante`);
      okAll = false;
      continue;
    }
    const raw = JSON.parse(await readFile(file, "utf8")) as unknown;
    const result = validateCaseFile(raw);
    if (result.ok) {
      console.log(`  ✓ ${id}`);
    } else {
      okAll = false;
      console.error(`  ✗ ${id}`);
      for (const issue of result.issues.slice(0, 8)) console.error(`      ${issue}`);
    }
  }
  return okAll;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrix = JSON.parse(await readFile(MATRIX_PATH, "utf8")) as MatrixRow[];
  if (!Array.isArray(matrix) || matrix.length !== 30) {
    throw new Error(`matrix.json deve contenere 30 casi (trovati: ${Array.isArray(matrix) ? matrix.length : "n/d"})`);
  }

  const selected = args.only ? matrix.filter((row) => row.id === args.only) : matrix;
  if (selected.length === 0) throw new Error(`Nessun caso per --only=${args.only}`);

  await mkdir(OUT_DIR, { recursive: true });

  console.log("----------------------------------------------------");
  console.log(
    args.validateOnly
      ? "🔎 VALIDAZIONE CASI GASTROENTEROLOGIA KB"
      : "🧬 GENERAZIONE CASI GASTROENTEROLOGIA DA MATRICE + RAG",
  );
  console.log("----------------------------------------------------");

  if (args.validateOnly) {
    const ok = await validateAll(selected.map((r) => r.id));
    if (!ok) process.exitCode = 1;
    return;
  }

  const ragCache = new Map<string, RagHit[]>();
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let usedFallback = 0;

  for (const row of selected) {
    const out = casePath(row.id);
    if (args.resume && existsSync(out)) {
      const raw = JSON.parse(await readFile(out, "utf8")) as unknown;
      if (validateCaseFile(raw).ok) {
        console.log(`  ↷ skip valido: ${row.id}`);
        skipped += 1;
        continue;
      }
      console.log(`  ♻️  rigennero (file non valido): ${row.id}`);
    }

    const scaffold = SCAFFOLDS[row.id];
    const authored = PATIENT_PROFILES[row.id];
    if (!scaffold || !authored) {
      console.error(`  ✗ scaffold/profilo mancante: ${row.id}`);
      failed += 1;
      continue;
    }

    const cacheKey = `${row.guidelineRef}::${row.condition}`;
    let hits = ragCache.get(cacheKey);
    if (!hits) {
      const query = `${row.condition}. ${row.title}. Guideline management, diagnosis, timing, first-line recommendations.`;
      console.log(`  📚 RAG ${row.guidelineRef} ← ${row.id}`);
      try {
        hits = await retrieveGuidelineChunks(row.guidelineRef, query);
      } catch (error) {
        console.warn(`     RAG error: ${error instanceof Error ? error.message : error}`);
        hits = [];
      }
      if (hits.length === 0) {
        hits = [
          {
            chunkId: `fallback-${row.guidelineRef}`,
            source: sourceNameFor(row.guidelineRef),
            text: `Nessun chunk vettoriale recuperato per ${row.guidelineRef}. Resta su pratica clinica guideline-concordante senza inventare classi di raccomandazione. L. 24/2017 Art. 5 Gelli-Bianco: adesione alle buone pratiche.`,
          },
        ];
      }
      ragCache.set(cacheKey, hits);
      console.log(`     ${hits.length} chunk`);
    }

    try {
      console.log(`  ✍️  ${row.id} ${row.title}`);
      let lastError: unknown;
      let assembled: KnowledgeBaseCase | null = null;
      const canLlm = Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
      if (canLlm) {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            const narrative = await generateNarrative({ matrix: row, scaffold, ragHits: hits, authored });
            const candidate = assembleCase({ matrix: row, scaffold, narrative, ragHits: hits, authored });
            const check = KnowledgeBaseCaseSchema.safeParse(candidate);
            if (!check.success) {
              throw new Error(check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
            }
            const playable = validateCaseFile(check.data);
            if (!playable.ok) {
              throw new Error(playable.issues.join("; "));
            }
            assembled = check.data;
            break;
          } catch (error) {
            lastError = error;
            if (attempt === 1) {
              console.warn(`     retry ${row.id}: ${error instanceof Error ? error.message.slice(0, 180) : error}`);
            }
          }
        }
      }
      if (!assembled) {
        console.warn(
          `     fallback deterministico ${row.id}: ${lastError instanceof Error ? lastError.message.slice(0, 120) : lastError ?? "no LLM"}`,
        );
        const narrative = fallbackNarrative(row, authored, scaffold);
        const candidate = assembleCase({ matrix: row, scaffold, narrative, ragHits: hits, authored });
        const playable = validateCaseFile(candidate);
        if (!playable.ok) {
          throw new Error(playable.issues.join("; "));
        }
        assembled = candidate;
        usedFallback += 1;
      }
      await writeFile(out, `${JSON.stringify(assembled, null, 2)}\n`, "utf8");
      console.log(`  ✓ ${row.id} → ${out}`);
      generated += 1;
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${row.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("----------------------------------------------------");
  console.log(`Generati: ${generated} · skip: ${skipped} · fallback: ${usedFallback} · fail: ${failed}`);
  const ok = await validateAll(selected.map((r) => r.id));
  if (!ok || failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n❌ Generazione fallita:", error instanceof Error ? error.message : error);
  process.exit(1);
});
