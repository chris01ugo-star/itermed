/**
 * In-memory clinical cases for offline / no-DATABASE_URL mode.
 * Aligned with seed content (`prisma/seed-aequan-cases.ts`) and Prassi DEMO_CASES ids.
 *
 * `correctSolution` is kept here for dataset completeness / future offline eval,
 * but must never be forwarded to the browser (Art. 32 / anti-cheat).
 */

import { getCaseById } from "@/lib/data/cases/registry";
import {
  buildAuthoredFallbackMap,
  getCachedCaseById,
  normalizeCaseLookupKey,
  toFallbackClinicalCase,
} from "@/lib/data/cases/registry-store";
import { buildSimulatorCasePayload } from "@/lib/cases/case-payload";

export type FallbackCaseDifficulty = "EASY" | "MEDIUM" | "HARD";

export type FallbackClinicalCase = {
  id: string;
  title: string;
  description: string;
  /** Human-readable specialty label (maps to MedicalSpecialty.name in seed). */
  specialty: string;
  /** Stable specialty slug for offline analytics / filters. */
  medicalSpecialtyKey: string;
  difficulty: FallbackCaseDifficulty;
  estimatedDurationMinutes: number;
  timeLimitMinutes: number;
  patientDeteriorationThreshold: number;
  patientPrompt: string;
  pastMedicalHistory: string;
  /** Gold diagnosis / management — server-only; strip before SimulatorClient. */
  correctSolution: string;
  goldStandardPath: string[];
  examLatencies: Record<string, number>;
  baselineExamFindings: Record<string, unknown>;
};

const CHEST_PAIN_ECG =
  "Ritmo sinusale. Underslivellamento ST laterale lieve. Frequenza cardiaca 96 bpm.";
const CHEST_PAIN_TROP = "Troponina hs 48 ng/L (limite <14).";
const FEVER_CBC = "GB 14.2 x10^9/L con neutrofilia; Hb 12.1 g/dL.";
const FEVER_CXR = "Opacità basale destra compatibile con focolaio broncopolmonare.";
const HYDRO_CT =
  "Ventricoli dilatati rispetto a TC precedenti; sospetta malfunzione di shunt.";

export const FALLBACK_CASES: Record<string, FallbackClinicalCase> = {
  ...buildAuthoredFallbackMap(),
  cs_001: {
    id: "cs_001",
    title: "Uomo 58 anni con dolore toracico in PS",
    description:
      "Uomo di 58 anni riferisce dolore toracico costrittivo da 45 minuti, irradiato alla mandibola, con nausea. Arriva in Pronto Soccorso autonomo.",
    specialty: "Medicina d'Emergenza-Urgenza",
    medicalSpecialtyKey: "medicina-emergenza-urgenza",
    difficulty: "MEDIUM",
    estimatedDurationMinutes: 45,
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 20,
    patientPrompt: [
      "Sei Paolo, 58 anni. Hai un peso sullo sterno e paura di infarto.",
      "Rispondi come paziente ansioso, in prima persona, senza dare diagnosi e senza citare valori vitali numerici a voce.",
      "Descrivi dolore, irradiazione, nausea e preoccupazioni. Chiedi spesso se è grave.",
      "Se il medico ritarda l'ECG o non ti rassicura, aumenta ansia e dispnea nelle risposte successive.",
    ].join(" "),
    pastMedicalHistory: "Dislipidemia. Fumatore attivo. Nessuna chirurgia pregressa.",
    correctSolution:
      "Sospetta SCA: ECG entro 10', monitoraggio, ASA se non controindicato, troponina, percorso chest-pain.",
    goldStandardPath: ["ecg", "troponina", "consenso-informato"],
    examLatencies: { ecg: 5, troponina: 40, "troponina-hs": 40 },
    baselineExamFindings: {
      demographics: { age: 58, sex: "M", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "150/95",
        heartRate: 96,
        spo2: 96,
        temperature: 36.5,
        respiratoryRate: 18,
        bp: "150/95",
        hr: 96,
        temp: 36.5,
        rr: 18,
      },
      physicalExam: {
        finding:
          "Paziente inquieto, dolore retrosternale. Toni cardiaci ritmici. Torace libero. Addome trattabile.",
      },
      examBudgetEuro: 350,
      stressProfile: {
        initialStress: 55,
        reactivityType: "hyper",
        timeDecayRate: 1.8,
        criticalMilestones: {
          reduceStress: ["richiesto_ecg", "consenso_informato", "rassicurazione"],
          increaseStress: ["ritardo_ecg", "esame_inappropriato"],
        },
        lifesavingMilestones: ["ecg", "troponina"],
        relievingExams: ["ecg", "troponina", "troponina-hs"],
        dangerousPrescriptions: [],
      },
      ecg: { finding: CHEST_PAIN_ECG },
      troponina: { finding: CHEST_PAIN_TROP },
      advancedExams: {
        notes: "Dolore toracico — prioritizzare ECG e marker cardiaci.",
        values: {
          ecg: {
            price: 15,
            urgencyTiming: "5 min",
            routineTiming: "n.p.",
            routineMinutes: 5,
            normalFinding: CHEST_PAIN_ECG,
          },
          "troponina-hs": {
            price: 18,
            urgencyTiming: "40 min",
            routineTiming: "2h",
            routineMinutes: 40,
            normalFinding: CHEST_PAIN_TROP,
          },
          troponina: {
            price: 18,
            urgencyTiming: "40 min",
            routineTiming: "2h",
            routineMinutes: 40,
            normalFinding: CHEST_PAIN_TROP,
          },
        },
      },
    },
  },
  cs_002: {
    id: "cs_002",
    title: "Donna 72 anni con febbre persistente",
    description:
      "Donna di 72 anni con febbre da 3 giorni, tosse produttiva e astenia. Portata in PS dalla figlia per confusione lieve.",
    specialty: "Medicina Interna",
    medicalSpecialtyKey: "medicina-interna",
    difficulty: "EASY",
    estimatedDurationMinutes: 40,
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 25,
    patientPrompt: [
      "Sei Lucia Rossi, 72 anni. Ti senti debole e confusa. Hai freddo e tossisci.",
      "Rispondi in modo semplice, a volte ripeti le stesse cose. Non dare diagnosi e non citare valori vitali numerici.",
      "Descrivi febbre, tosse produttiva, astenia e la preoccupazione della figlia.",
    ].join(" "),
    pastMedicalHistory: "Diabete tipo 2. Ipertensione. Nessuna allergia nota.",
    correctSolution:
      "Sospetta polmonite / sepsi: vitals, emocromo, PCR/PCT, emocolture se indicato, RX torace, antibiotico empirico dopo culture quando possibile.",
    goldStandardPath: ["emocromo", "rx-torace", "consenso-informato"],
    examLatencies: { emocromo: 30, "rx-torace": 25, "pcr-pct": 45 },
    baselineExamFindings: {
      demographics: { age: 72, sex: "F", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "105/65",
        heartRate: 108,
        spo2: 91,
        temperature: 38.7,
        respiratoryRate: 24,
        bp: "105/65",
        hr: 108,
        temp: 38.7,
        rr: 24,
      },
      physicalExam: {
        finding:
          "Anziana febbrile, confusa lieve. Crepitii basali destri. Addome trattabile. No segni meningei.",
      },
      examBudgetEuro: 280,
      stressProfile: {
        initialStress: 40,
        reactivityType: "standard",
        timeDecayRate: 1.5,
        criticalMilestones: {
          reduceStress: ["rassicurazione", "anamnesi_completa"],
          increaseStress: ["ritardo_diagnostico"],
        },
        lifesavingMilestones: ["emocromo", "rx-torace"],
        relievingExams: ["emocromo", "rx-torace", "pcr-pct"],
        dangerousPrescriptions: [],
      },
      emocromo: { finding: FEVER_CBC },
      "rx-torace": { finding: FEVER_CXR },
      advancedExams: {
        notes: "Anziana con febbre e ipossiemia — valutare sepsi e polmonite.",
        values: {
          emocromo: {
            price: 4.8,
            urgencyTiming: "20 min",
            routineTiming: "4h",
            routineMinutes: 30,
            normalFinding: FEVER_CBC,
          },
          "rx-torace": {
            price: 25,
            urgencyTiming: "30 min",
            routineTiming: "24h",
            routineMinutes: 25,
            normalFinding: FEVER_CXR,
          },
        },
      },
    },
  },
  cs_003: {
    id: "cs_003",
    title: "Uomo 33 anni con idrocefalo e cefalea acuta",
    description:
      "Uomo di 33 anni con storia di idrocefalo e shunt VP presenta cefalea improvvisa, vomito e sonnolenza. Arriva in PS.",
    specialty: "Neurologia",
    medicalSpecialtyKey: "neurologia",
    difficulty: "HARD",
    estimatedDurationMinutes: 45,
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 12,
    patientPrompt: [
      "Sei Marco Rossi, 33 anni. Hai un dolore alla testa fortissimo e nausea. Sei sonnolento.",
      "Rispondi come paziente, senza dare diagnosi e senza citare valori vitali numerici a voce.",
      "Se il medico ritarda la TC, aumenta ansia, confusione e sonnolenza nelle risposte successive.",
    ].join(" "),
    pastMedicalHistory: "Idrocefalo con shunt ventricolo-peritoneale. Nessuna allergia nota.",
    correctSolution:
      "Sospetta disfunzione di shunt / ipertensione endocranica: ABC, neurostatus, TC encefalo urgente, consulto neurochirurgico. Evitare ritardi.",
    goldStandardPath: ["esame-obiettivo-neuro", "tc", "consenso-informato"],
    examLatencies: { tc: 25, ega: 10 },
    baselineExamFindings: {
      demographics: { age: 33, sex: "M", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "160/100",
        heartRate: 64,
        spo2: 98,
        temperature: 36.8,
        respiratoryRate: 14,
        bp: "160/100",
        hr: 64,
        temp: 36.8,
        rr: 14,
      },
      neuro: { pupils: "Anisocoria lieve", gcs: "13", deficits: "Sonnolenza, vomito ripetuto" },
      physicalExam: {
        finding: "Sonnolento, vomito. Anisocoria lieve. Non deficit focale motorio evidente.",
      },
      examBudgetEuro: 450,
      stressProfile: {
        initialStress: 70,
        reactivityType: "hyper",
        timeDecayRate: 2.5,
        criticalMilestones: {
          reduceStress: ["richiesto_tc_encefalo", "rassicurazione"],
          increaseStress: ["ritardo_diagnostico"],
        },
        lifesavingMilestones: ["tc", "esame-obiettivo-neuro"],
        relievingExams: ["tc", "ega"],
        dangerousPrescriptions: [],
      },
      tc: { finding: HYDRO_CT },
      advancedExams: {
        notes: "Cefalea acuta in paziente con shunt — TC encefalo prioritaria.",
        values: {
          tc: {
            price: 120,
            urgencyTiming: "25 min",
            routineTiming: "24h",
            routineMinutes: 25,
            normalFinding: HYDRO_CT,
          },
        },
      },
    },
  },
};

function lookupStaticFallback(rawId: string): FallbackClinicalCase | undefined {
  const key = normalizeCaseLookupKey(rawId);
  if (!key) return undefined;
  return (
    FALLBACK_CASES[key] ??
    FALLBACK_CASES[key.replace(/-/g, "_")] ??
    FALLBACK_CASES[rawId.trim()] ??
    FALLBACK_CASES[rawId.trim().toUpperCase()]
  );
}

/** Lookup by case id (case-insensitive). Hydrates KB cases from PostgreSQL when needed. */
export async function getFallbackCase(rawId: string): Promise<FallbackClinicalCase | undefined> {
  const fromMap = lookupStaticFallback(rawId);
  if (fromMap) return fromMap;

  const cached = getCachedCaseById(rawId);
  if (cached) return toFallbackClinicalCase(cached);

  const registered = await getCaseById(rawId);
  return registered ? toFallbackClinicalCase(registered) : undefined;
}

/**
 * Payload safe for SimulatorClient — strips gold answer, gold path, and scoring metadata.
 */
export function toSimulatorFallbackPayload(fallback: FallbackClinicalCase) {
  return buildSimulatorCasePayload({
    id: fallback.id,
    title: fallback.title,
    description: fallback.description,
    specialty: fallback.specialty,
    difficulty: fallback.difficulty,
    estimatedDurationMinutes: fallback.estimatedDurationMinutes,
    patientPrompt: fallback.patientPrompt,
    baselineExamFindings: fallback.baselineExamFindings,
    timeLimitMinutes: fallback.timeLimitMinutes,
  });
}
