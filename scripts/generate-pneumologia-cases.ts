/**
 * Generate 30 structured pneumology cases from matrix.json + RAG chunks.
 *
 * Usage:
 *   npx tsx scripts/generate-pneumologia-cases.ts
 *   npx tsx scripts/generate-pneumologia-cases.ts --resume
 *   npx tsx scripts/generate-pneumologia-cases.ts --only=PNEUMO-001
 *   npx tsx scripts/generate-pneumologia-cases.ts --validate-only
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

const MATRIX_PATH = resolve(process.cwd(), "knowledge_base/pneumologia/matrix.json");
const OUT_DIR = resolve(process.cwd(), "knowledge_base/pneumologia/cases");
const PINECONE_NAMESPACE = "guidelines";
const RAG_TOP_K = 4;

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
  ega: 12,
  "rx-torace": 15.5,
  spirometria: 25,
  polisonnografia: 80,
  tc: 180,
  emocromo: 4.5,
  "pcr-pct": 12,
  emocolture: 22,
  broncoscopia: 180,
  liquidi: 40,
  biopsia: 80,
  ddimero: 9,
  angio: 180,
  "nt-probnp": 18,
  ecg: 11.6,
  "6mwt": 15,
  quantiferon: 35,
  "pet-tc": 900,
  ecocardio: 43.9,
  elettroliti: 8,
  "creat-urea-gfr": 8,
  lattati: 7,
  tamponi: 15,
  cea: 12,
  nse: 18,
  fna: 50,
  ecografia: 35,
  "hiv-hcv-hbv": 20,
  "urine-sed": 3.5,
  glicemia: 3.5,
  hba1c: 6,
  "troponina-hs": 8,
  "pt-ptt-inr": 9,
  "assetto-lipidico": 8,
  rm: 220,
  colonscopia: 90,
  moc: 40,
  coronarografia: 1800,
};

const LATENCY: Record<string, number> = {
  ega: 10,
  "rx-torace": 20,
  spirometria: 25,
  polisonnografia: 720,
  tc: 40,
  emocromo: 30,
  "pcr-pct": 35,
  emocolture: 15,
  broncoscopia: 60,
  liquidi: 40,
  biopsia: 90,
  ddimero: 30,
  angio: 45,
  "nt-probnp": 40,
  ecg: 8,
  "6mwt": 30,
  quantiferon: 120,
  "pet-tc": 180,
  ecocardio: 20,
  elettroliti: 30,
  "creat-urea-gfr": 30,
  lattati: 15,
  tamponi: 20,
  cea: 40,
  "troponina-hs": 35,
};

const SETTING_LABEL: Record<MatrixRow["setting"], string> = {
  GUARDIA_MEDICA: "Guardia Medica territoriale",
  PRONTO_SOCCORSO: "Pronto Soccorso",
  AMBULATORIO: "Ambulatorio di Pneumologia",
  REPARTO: "Reparto di Pneumologia",
};

const PATIENT_PROFILES: Record<string, AuthoredProfile> = {
  "PNEUMO-001": {
    age: 68,
    sex: "M",
    name: "Paolo",
    vitals: { heartRate: 108, bloodPressure: "148/88", spo2: 88, temperature: 37.6, respiratoryRate: 28 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Si agita se il medico usa acronimi (GOLD, FEV1). Chiede rassicurazioni ripetute sulla saturazione e tende a minimizzare il fumo se percepisce tono giudicante.",
    },
  },
  "PNEUMO-002": {
    age: 72,
    sex: "M",
    name: "Luigi",
    vitals: { heartRate: 82, bloodPressure: "138/82", spo2: 93, temperature: 36.5, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "PASSIVE",
      adherence: "NON_COMPLIANT",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "ISOLATED" },
      communicationStyle:
        "Annuisce senza capire. Se il linguaggio è tecnico, non chiede spiegazioni e poi non usa gli inalatori. Risponde meglio a istruzioni concrete e dimostrazioni pratiche.",
    },
  },
  "PNEUMO-003": {
    age: 79,
    sex: "F",
    name: "Anna",
    vitals: { heartRate: 118, bloodPressure: "156/90", spo2: 84, temperature: 36.9, respiratoryRate: 30 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "ANXIOUS",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Ha paura della maschera NIV. Il tono calmo e le spiegazioni sul 'aiuto a respirare' riducono l'opposizione; il gergo da rianimazione la fa ritirare.",
    },
  },
  "PNEUMO-004": {
    age: 28,
    sex: "F",
    name: "Giulia",
    vitals: { heartRate: 88, bloodPressure: "118/74", spo2: 97, temperature: 36.4, respiratoryRate: 16 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "SELF_MEDICATED",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "STRONG" },
      communicationStyle:
        "Arriva con screenshot di ChatGPT e forum. Se il medico sminuisce le ricerche, si chiude e aumenta l'autosomministrazione. Collabora se si riconosce l'ansia e si ricentra sulle evidenze GINA.",
    },
  },
  "PNEUMO-005": {
    age: 34,
    sex: "F",
    name: "Elena",
    vitals: { heartRate: 122, bloodPressure: "132/80", spo2: 91, temperature: 36.8, respiratoryRate: 32 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Parla a scatti per la dispnea. L'insonnia amplifica l'ansia: frasi lunghe e allarmistiche peggiorano l'iperpnea. Serve linguaggio breve e rassicurante.",
    },
  },
  "PNEUMO-006": {
    age: 41,
    sex: "M",
    name: "Stefano",
    vitals: { heartRate: 128, bloodPressure: "110/68", spo2: 86, temperature: 36.7, respiratoryRate: 34 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "DEFENSIVE",
      adherence: "SELF_MEDICATED",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Nega l'abuso di SABA ('è l'unico che mi fa stare bene'). Il tono moralizzatore innesca ostilità; il framing sul rischio di near-fatal asthma è accettato se non colpevolizzante.",
    },
  },
  "PNEUMO-007": {
    age: 62,
    sex: "M",
    name: "Antonio",
    vitals: { heartRate: 102, bloodPressure: "136/84", spo2: 92, temperature: 38.7, respiratoryRate: 24 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "COLLABORATIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "GOOD", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Ascolta e riassume. Preferisce un piano chiaro (esami, antibiotico, criteri di rientro). Il burocratese lo disorienta ma non lo fa opporre.",
    },
  },
  "PNEUMO-008": {
    age: 85,
    sex: "F",
    name: "Maria",
    vitals: { heartRate: 112, bloodPressure: "98/62", spo2: 87, temperature: 38.2, respiratoryRate: 28 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "PASSIVE",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
      communicationStyle:
        "Risponde poco, si affida al nipote. Il linguaggio troppo rapido o astratto la fa acconsentire senza comprendere. Serve tempo, volume basso e coinvolgimento del caregiver.",
    },
  },
  "PNEUMO-009": {
    age: 75,
    sex: "M",
    name: "Giuseppe",
    vitals: { heartRate: 96, bloodPressure: "128/76", spo2: 90, temperature: 38.4, respiratoryRate: 22 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "PASSIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "LOW", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Paziente di reparto stanco. Accetta le procedure se spiegate in una frase. Il gergo nosocomiale (HAP, MDR) lo spaventa senza migliorare la comprensione.",
    },
  },
  "PNEUMO-010": {
    age: 48,
    sex: "M",
    name: "Roberto",
    vitals: { heartRate: 78, bloodPressure: "142/90", spo2: 94, temperature: 36.5, respiratoryRate: 16 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
      communicationStyle:
        "Ha letto che l'OSAS 'provoca infarto notturno'. Interrompe con citazioni da Google. Se si convalida la preoccupazione e si propone la polisonnografia come passo concreto, collabora.",
    },
  },
  "PNEUMO-011": {
    age: 55,
    sex: "M",
    name: "Francesco",
    vitals: { heartRate: 84, bloodPressure: "150/92", spo2: 93, temperature: 36.6, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "DEFENSIVE",
      adherence: "NON_COMPLIANT",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Minimizza il russamento e rifiuta la CPAP ('sembro un astronauta'). Il paternalismo irrigidisce. Funziona il confronto sui sintomi diurni e sul rischio alla guida.",
    },
  },
  "PNEUMO-012": {
    age: 22,
    sex: "M",
    name: "Luca",
    vitals: { heartRate: 104, bloodPressure: "124/76", spo2: 93, temperature: 36.6, respiratoryRate: 26 },
    patientProfile: {
      healthLiteracy: "HIGH",
      emotionalState: "COLLABORATIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "GOOD", stressLevel: "MEDIUM", socialSupport: "STRONG" },
      communicationStyle:
        "Giovane alto e magro, capisce in fretta. Chiede dati e opzioni (osservazione vs drenaggio). Il tono paternalistico lo infastidisce; apprezza la condivisione decisionale.",
    },
  },
  "PNEUMO-013": {
    age: 69,
    sex: "M",
    name: "Enrico",
    vitals: { heartRate: 116, bloodPressure: "142/86", spo2: 86, temperature: 36.8, respiratoryRate: 30 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ISOLATED" },
      communicationStyle:
        "Vive solo, teme il ricovero. Se si parla di 'tubo nel torace' senza preparazione, rifiuta. Serve spiegare il drenaggio con analogie semplici e confermare chi avvisare.",
    },
  },
  "PNEUMO-014": {
    age: 64,
    sex: "F",
    name: "Paola",
    vitals: { heartRate: 98, bloodPressure: "126/78", spo2: 93, temperature: 38.1, respiratoryRate: 22 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "COLLABORATIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Chiede il perché di ogni prelievo. Accetta la toracentesi se si spiega dolore, consenso e cosa si cerca nel liquido. Il silenzio procedurale la inquieta.",
    },
  },
  "PNEUMO-015": {
    age: 51,
    sex: "F",
    name: "Laura",
    vitals: { heartRate: 118, bloodPressure: "108/70", spo2: 90, temperature: 36.7, respiratoryRate: 26 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "STRONG" },
      communicationStyle:
        "Ha chiesto a un chatbot se la dispnea è 'tumore o embolia'. Oscilla tra panico e iper-compliance. Il medico deve nominare il D-dimero/angio-TC senza alimentarne le diagnosi catastrophiche.",
    },
  },
  "PNEUMO-016": {
    age: 46,
    sex: "F",
    name: "Chiara",
    vitals: { heartRate: 92, bloodPressure: "118/76", spo2: 94, temperature: 36.5, respiratoryRate: 20 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Insonnia e ricerche notturne su PAH. Porta stampe ESC/ERS. Se si ignora il materiale, si sente non creduta. Serve ancorare il work-up (eco, 6MWT) al sospetto clinico.",
    },
  },
  "PNEUMO-017": {
    age: 61,
    sex: "M",
    name: "Davide",
    vitals: { heartRate: 76, bloodPressure: "134/82", spo2: 96, temperature: 36.4, respiratoryRate: 16 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Ex fumatore, ha googlato 'nodulo = cancro'. Chiede PET immediata. Reagisce male al 'aspettiamo tre mesi'; accetta il piano BTS se si quantifica il rischio e si fissa il controllo.",
    },
  },
  "PNEUMO-018": {
    age: 67,
    sex: "M",
    name: "Marco",
    vitals: { heartRate: 80, bloodPressure: "138/84", spo2: 95, temperature: 36.5, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "COLLABORATIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "STRONG" },
      communicationStyle:
        "Vuole sapersi la verità sulla stadiazione. Il linguaggio eufemistico lo irrita. Preferisce mappe ESMO (TC, PET, biopsia, consenso) dette con chiarezza e rispetto.",
    },
  },
  "PNEUMO-019": {
    age: 71,
    sex: "M",
    name: "Vincenzo",
    vitals: { heartRate: 88, bloodPressure: "140/86", spo2: 91, temperature: 36.6, respiratoryRate: 22 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Confonde 'fibrosi' con 'cancro'. L'insonnia peggiora la ruminazione. Serve ripetere con parole povere e scrivere il piano antifibrotico / riabilitazione.",
    },
  },
  "PNEUMO-020": {
    age: 54,
    sex: "F",
    name: "Silvia",
    vitals: { heartRate: 126, bloodPressure: "96/58", spo2: 82, temperature: 38.9, respiratoryRate: 36 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "PASSIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Poco in grado di parlare per l'ipossiemia. Il caregiver interpreta. Qualsiasi allarme urlato in sala peggiora il distress; serve comunicazione al team a bassa voce e aggiornamenti brevi ai familiari.",
    },
  },
  "PNEUMO-021": {
    age: 38,
    sex: "M",
    name: "Andrea",
    vitals: { heartRate: 90, bloodPressure: "122/78", spo2: 95, temperature: 37.8, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "DEFENSIVE",
      adherence: "NON_COMPLIANT",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "ISOLATED" },
      communicationStyle:
        "Teme lo stigma della tubercolosi e il contatto dei servizi. Nega i sintomi se percepisce giudizio. Il tono non colpevolizzante e la spiegazione della contagiosità trattabile aprono il dialogo.",
    },
  },
  "PNEUMO-022": {
    age: 59,
    sex: "F",
    name: "Francesca",
    vitals: { heartRate: 100, bloodPressure: "130/80", spo2: 91, temperature: 38.0, respiratoryRate: 24 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "OPPOSITIONAL",
      adherence: "SELF_MEDICATED",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "LIMITED" },
      communicationStyle:
        "Ha già iniziato un antibiotico avanzato. Contesta le linee guida ERS ('funziona sempre così'). Serve riconoscere l'esperienza e spiegare perché l'autosomministrazione aumenta resistenze.",
    },
  },
  "PNEUMO-023": {
    age: 36,
    sex: "F",
    name: "Sara",
    vitals: { heartRate: 82, bloodPressure: "118/72", spo2: 96, temperature: 36.6, respiratoryRate: 16 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
      communicationStyle:
        "Ha confrontato i linfoadenopatie con linforma su un LLM. Insonnia da scrolling. Se si sminuisce, insiste per PET e biopsia immediate. Accetta il percorso ERS se si nomina la diagnosi differenziale con rispetto.",
    },
  },
  "PNEUMO-024": {
    age: 77,
    sex: "M",
    name: "Pietro",
    vitals: { heartRate: 110, bloodPressure: "152/88", spo2: 85, temperature: 36.8, respiratoryRate: 28 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "PASSIVE",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Sonnolento per ipercapnia. Non discute. Se si parla in fretta firma senza capire la NIV. Serve check-back con il familiare e frasi su 'macchina che aiuta i polmoni'.",
    },
  },
  "PNEUMO-025": {
    age: 70,
    sex: "M",
    name: "Alberto",
    vitals: { heartRate: 108, bloodPressure: "118/70", spo2: 89, temperature: 38.6, respiratoryRate: 26 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "PASSIVE",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Intubato o appena estubato: comunicazione mediata. I familiari reagiscono al termine 'polmonite da macchina'. Serve trasparenza senza colpe, citando il protocollo HAP/VAP.",
    },
  },
  "PNEUMO-026": {
    age: 63,
    sex: "F",
    name: "Marta",
    vitals: { heartRate: 86, bloodPressure: "136/82", spo2: 93, temperature: 36.5, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "DEFENSIVE",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "MEDIUM", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Rifiuta l'etichetta BPCO ('è solo asma'). Si offende se si insiste sul fumo. Meglio partire dai sintomi e dalla spirometria, poi introdurre l'overlap GOLD/GINA.",
    },
  },
  "PNEUMO-027": {
    age: 74,
    sex: "F",
    name: "Elisa",
    vitals: { heartRate: 94, bloodPressure: "128/76", spo2: 91, temperature: 36.7, respiratoryRate: 22 },
    patientProfile: {
      healthLiteracy: "MEDIUM",
      emotionalState: "ANXIOUS",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
      communicationStyle:
        "Capisce che il versamento può essere maligno. Chiede tempi e verità. Il linguaggio elusivo aumenta l'ansia notturna; SPIKES-like e pause migliorano l'alleanza.",
    },
  },
  "PNEUMO-028": {
    age: 26,
    sex: "F",
    name: "Ilaria",
    vitals: { heartRate: 92, bloodPressure: "112/70", spo2: 95, temperature: 36.8, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "HIGH",
      emotionalState: "COLLABORATIVE",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "STRONG" },
      communicationStyle:
        "Esperta della propria CF. Non tollera spiegazioni da manuale pediatrico. L'insonnia da fisioterapia serale la rende irritabile: chiede partnership da adulto (ECFS) e obiettivi concreti.",
    },
  },
  "PNEUMO-029": {
    age: 58,
    sex: "M",
    name: "Salvatore",
    vitals: { heartRate: 80, bloodPressure: "144/88", spo2: 94, temperature: 36.5, respiratoryRate: 18 },
    patientProfile: {
      healthLiteracy: "LOW",
      emotionalState: "OPPOSITIONAL",
      adherence: "PARTIAL",
      lifestyleAndSocial: { sleepQuality: "FAIR", stressLevel: "HIGH", socialSupport: "LIMITED" },
      communicationStyle:
        "Operaio, teme che la diagnosi gli faccia perdere il lavoro. Se il medico parla solo di 'polvere', si irrigidisce. Serve collegare sintomi, esposizione e tutele senza accusarlo.",
    },
  },
  "PNEUMO-030": {
    age: 52,
    sex: "F",
    name: "Valentina",
    vitals: { heartRate: 96, bloodPressure: "122/78", spo2: 92, temperature: 36.5, respiratoryRate: 20 },
    patientProfile: {
      healthLiteracy: "CYBERCHONDRIA_AI",
      emotionalState: "ANXIOUS",
      adherence: "FULL",
      lifestyleAndSocial: { sleepQuality: "POOR", stressLevel: "HIGH", socialSupport: "ADEQUATE" },
      communicationStyle:
        "Dopo una EP ha passato notti su forum CTEPH. Porta PDF ESC/ERS. Se si banalizza il follow-up, insorge. Collabora se si prende sul serio il 6MWT/eco e si spiega perché non tutti i post-EP diventano CTEPH.",
    },
  },
};

const SCAFFOLDS: Record<string, Scaffold> = {
  "PNEUMO-001": {
    goldStandardPath: ["ega", "rx-torace", "emocromo", "pcr-pct", "elettroliti"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 90,
  },
  "PNEUMO-002": {
    goldStandardPath: ["spirometria", "rx-torace", "6mwt"],
    inappropriateExamIds: ["tc", "broncoscopia"],
    examBudgetEuro: 70,
  },
  "PNEUMO-003": {
    goldStandardPath: ["ega", "rx-torace", "elettroliti", "lattati"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 110,
  },
  "PNEUMO-004": {
    goldStandardPath: ["spirometria", "emocromo"],
    inappropriateExamIds: ["tc", "broncoscopia"],
    examBudgetEuro: 55,
  },
  "PNEUMO-005": {
    goldStandardPath: ["ega", "rx-torace", "emocromo"],
    inappropriateExamIds: ["tc", "pet-tc"],
    examBudgetEuro: 80,
  },
  "PNEUMO-006": {
    goldStandardPath: ["ega", "rx-torace", "lattati", "elettroliti"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 100,
  },
  "PNEUMO-007": {
    goldStandardPath: ["rx-torace", "emocromo", "pcr-pct", "ega"],
    inappropriateExamIds: ["pet-tc", "broncoscopia"],
    examBudgetEuro: 85,
  },
  "PNEUMO-008": {
    goldStandardPath: ["rx-torace", "ega", "emocromo", "pcr-pct", "lattati", "creat-urea-gfr"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 130,
  },
  "PNEUMO-009": {
    goldStandardPath: ["rx-torace", "emocromo", "pcr-pct", "emocolture", "ega"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 120,
  },
  "PNEUMO-010": {
    goldStandardPath: ["polisonnografia", "emocromo", "spirometria"],
    inappropriateExamIds: ["tc", "pet-tc"],
    examBudgetEuro: 140,
  },
  "PNEUMO-011": {
    goldStandardPath: ["polisonnografia", "ega", "spirometria"],
    inappropriateExamIds: ["angio", "pet-tc"],
    examBudgetEuro: 150,
  },
  "PNEUMO-012": {
    goldStandardPath: ["rx-torace", "ega"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 50,
  },
  "PNEUMO-013": {
    goldStandardPath: ["rx-torace", "ega", "emocromo"],
    inappropriateExamIds: ["pet-tc", "rm"],
    examBudgetEuro: 80,
  },
  "PNEUMO-014": {
    goldStandardPath: ["rx-torace", "tc", "emocromo", "pcr-pct", "liquidi"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 260,
  },
  "PNEUMO-015": {
    goldStandardPath: ["ddimero", "ega", "rx-torace", "angio", "troponina-hs", "nt-probnp"],
    inappropriateExamIds: ["coronarografia", "colonscopia"],
    examBudgetEuro: 280,
  },
  "PNEUMO-016": {
    goldStandardPath: ["ecocardio", "rx-torace", "6mwt", "nt-probnp"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 140,
  },
  "PNEUMO-017": {
    goldStandardPath: ["rx-torace", "tc"],
    inappropriateExamIds: ["colonscopia", "rm"],
    examBudgetEuro: 200,
  },
  "PNEUMO-018": {
    goldStandardPath: ["tc", "pet-tc", "biopsia", "consenso-informato"],
    inappropriateExamIds: ["colonscopia", "moc"],
    examBudgetEuro: 1200,
  },
  "PNEUMO-019": {
    goldStandardPath: ["rx-torace", "tc", "spirometria", "6mwt"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 250,
  },
  "PNEUMO-020": {
    goldStandardPath: ["ega", "rx-torace", "lattati", "emocromo", "pcr-pct"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 120,
  },
  "PNEUMO-021": {
    goldStandardPath: ["rx-torace", "quantiferon", "emocromo", "tamponi"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 90,
  },
  "PNEUMO-022": {
    goldStandardPath: ["rx-torace", "emocromo", "pcr-pct", "spirometria"],
    inappropriateExamIds: ["pet-tc", "rm"],
    examBudgetEuro: 90,
  },
  "PNEUMO-023": {
    goldStandardPath: ["rx-torace", "tc", "emocromo"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 220,
  },
  "PNEUMO-024": {
    goldStandardPath: ["ega", "rx-torace", "elettroliti", "lattati"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 100,
  },
  "PNEUMO-025": {
    goldStandardPath: ["rx-torace", "ega", "emocromo", "pcr-pct", "emocolture", "tamponi"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 140,
  },
  "PNEUMO-026": {
    goldStandardPath: ["spirometria", "rx-torace", "emocromo"],
    inappropriateExamIds: ["pet-tc", "coronarografia"],
    examBudgetEuro: 70,
  },
  "PNEUMO-027": {
    goldStandardPath: ["rx-torace", "tc", "liquidi", "cea"],
    inappropriateExamIds: ["moc", "colonscopia"],
    examBudgetEuro: 260,
  },
  "PNEUMO-028": {
    goldStandardPath: ["spirometria", "emocromo", "pcr-pct", "rx-torace"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 90,
  },
  "PNEUMO-029": {
    goldStandardPath: ["rx-torace", "spirometria", "tc"],
    inappropriateExamIds: ["pet-tc", "colonscopia"],
    examBudgetEuro: 230,
  },
  "PNEUMO-030": {
    goldStandardPath: ["ecocardio", "angio", "6mwt", "nt-probnp", "ddimero"],
    inappropriateExamIds: ["coronarografia", "colonscopia"],
    examBudgetEuro: 280,
  },
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
  return `knowledge_base/pneumologia/clinical/${pdf}`;
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
    response = await queryOnce({ specialty: { $eq: "Pneumologia" } });
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
      prompt: `Tempo e modalità di insorgenza di dispnea, tosse o dolore toracico (${matrix.condition})`,
      keywords: ["da quanto", "quando", "insorgenza", "dispnea", "tosse"],
      rationale: "Definisce urgenza respiratoria e finestra terapeutica.",
    },
    {
      prompt: "Caratteristiche respiratorie (espettorato, emoftoe, sibili, ortopnea, dolore pleurico)",
      keywords: ["espettorato", "sangue", "sibili", "dolore", "ortopnea"],
      rationale: "Fenotipo clinico per diagnosi differenziale pneumologica.",
    },
    {
      prompt: "Fumo, esposizioni professionali/ambientali, allergie e atopia",
      keywords: ["fum", "lavoro", "polvere", "allergia", "asbesto"],
      rationale: "Fattori di rischio e nesso occupazionale / allergologico.",
    },
    {
      prompt: "Terapie inalatorie, ossigeno, CPAP/NIV, antibiotici e aderenza",
      keywords: ["inalator", "ossigeno", "cpap", "antibiot", "aderenza"],
      rationale: "Baseline prescrittiva, appropriatezza e scudo Gelli-Bianco.",
    },
    {
      prompt: "Red flag (ipossiemia, confusione, emottisi massiva, trauma, febbre alta)",
      keywords: ["saturazione", "confusione", "emottisi", "febbre", "trauma"],
      rationale: "Identifica instabilità e indicazioni a trasferimento/NIV.",
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
    description: `${authored.name}, ${authored.age} anni, si presenta in ${SETTING_LABEL[matrix.setting]} con un quadro compatibile con ${matrix.condition}. I vitali mostrano FC ${v.heartRate} bpm, PA ${v.bloodPressure}, SpO2 ${v.spo2}%, temperatura ${v.temperature} °C e FR ${v.respiratoryRate} atti/min. Il profilo psicologico influenza l'intervista e l'aderenza, senza sostituire il razionale delle linee guida.`,
    presentation: `All'arrivo in ${SETTING_LABEL[matrix.setting]}, ${authored.name} riferisce sintomi respiratori coerenti con ${matrix.condition}. Non enuncia la diagnosi e descrive fatica a respirare, tosse o dolore in modo laico. L'esame obiettivo e i primi test del gold path orientano verso ${matrix.guidelineRef}.`,
    redHerring1: "Riferisce un recente raffreddore che attribuisce a 'semplice influenza di stagione'.",
    redHerring2: "Ha assunto un antiacido pensando che il fastidio fosse di stomaco.",
    redHerring3: "Menziona un dolore muscolare dopo uno sforzo domestico, non dirimente.",
    pastMedicalHistory: `${authored.name} ha un'anamnesi respiratoria e generale coerente con ${matrix.condition}, con fattori di rischio (fumo, esposizioni, infezioni o terapie inalatorie) da esplorare. Non emergono allergie note non dichiarate. L'aderenza dichiarata è ${authored.patientProfile.adherence}.`,
    patientPrompt: `Mi chiamo ${authored.name} e ho ${authored.age} anni. Sono qui perché faccio fatica a respirare e non capisco cosa mi sta succedendo. Non voglio sentire parole difficili. Dimmi cosa stai per fare e perché, senza dirmi il nome della malattia se non te lo chiedo.`,
    diagnosis: matrix.condition,
    correctSolution: `Gold path: ${scaffold.goldStandardPath.join(" → ")}. Evitare ${scaffold.inappropriateExamIds.join(", ")}. Linea guida: ${matrix.guidelineRef}. Scudo L. 24/2017 Art. 5 se si documenta l'adesione.`,
    goldPathNarrative: `Il percorso ${scaffold.goldStandardPath.join(" → ")} è la sequenza di prima intenzione per ${matrix.condition} secondo ${matrix.guidelineRef}. Gli esami ${scaffold.inappropriateExamIds.join(", ")} non sono di prima linea e configurano spreco SSN o ritardo.`,
    physicalExamSummary: `Paziente vigile in ${SETTING_LABEL[matrix.setting]}. Torace con reperti coerenti con ${matrix.condition}; non segni extra-polmonari dirimenti. Vitali come da triage.`,
    examAbnormalitiesSummary: `Reperti attesi sul gold path per ${matrix.condition}: imaging e laboratorio orientati alla diagnosi, senza over-testing.`,
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
    specialty: "pneumologia",
    specialtyLabel: "Pneumologia",
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
          "Raccogliere consenso informato prima di procedure invasive.",
          "Evitare esami inappropriati (Codice deontologico, appropriatezza prescrittiva).",
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
    system: `Sei un pneumologo (GOLD/GINA/ATS/ERS/BTS/WHO) e un medico-legale (L. 24/2017 Gelli-Bianco) che progetta casi per un simulatore formativo italiano (AEQUAN).
Scrivi in italiano un caso realistico e internamente coerente.

REGOLE:
- Non inventare classi di raccomandazione se non compaiono nei chunk RAG.
- patientPrompt: prima persona; niente diagnosi e niente valori numerici.
- Nome proprio: usa esattamente "${authored.name}".
- Età/sesso fissati: ${authored.age} anni, ${authored.sex}. Non cambiare età.
- Vitali coerenti col quadro (ipossiemia, febbre, tachipnea).
- Integra il profilo psicologico (literacy, ansia, aderenza, sonno, rete sociale) nel patientPrompt e nella presentazione, senza nominare gli enum.
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
    issues.push("patientProfile mancante (obbligatorio per Pneumologia)");
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
  console.log(args.validateOnly ? "🔎 VALIDAZIONE CASI PNEUMOLOGIA KB" : "🧬 GENERAZIONE CASI PNEUMOLOGIA DA MATRICE + RAG");
  console.log("----------------------------------------------------");

  if (args.validateOnly) {
    const ok = await validateAll(selected.map((r) => r.id));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY) {
    throw new Error("OPENAI_API_KEY è richiesto.");
  }
  if (!getPineconeIndex()) {
    throw new Error("Pinecone non configurato.");
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
      if (!assembled) {
        console.warn(
          `     fallback deterministico ${row.id}: ${lastError instanceof Error ? lastError.message.slice(0, 120) : lastError}`,
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
  console.log(
    `Generati=${generated}  skip=${skipped}  fail=${failed}  fallback=${usedFallback}  attesi=${selected.length}`,
  );
  const ok = await validateAll(selected.map((r) => r.id));
  console.log(ok && failed === 0 ? "🎉 30 casi validi (schema Zod + patientProfile + playable)" : "⚠ validazione incompleta");
  console.log("----------------------------------------------------");
  if (!ok || failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n❌ Generazione fallita:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
