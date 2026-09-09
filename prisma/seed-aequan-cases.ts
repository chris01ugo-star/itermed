/**
 * AEQUAN production/demo seed — specialties + clinical cases.
 *
 * Run (from `itermed/`):
 *   npx prisma db seed
 *   npx tsx prisma/seed-aequan-cases.ts
 *
 * Idempotent: re-running upserts specialties and updates cases by title + creator.
 */
import "dotenv/config";
import { PrismaClient, type CaseDifficulty } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_USER_ID = "mock-dev-user-id";

const SSM_SPECIALTIES: Array<{ name: string; description: string }> = [
  { name: "Anestesia e Rianimazione", description: "Gestione perioperatoria, shock e supporto vitale avanzato." },
  { name: "Cardiologia", description: "Sindromi coronariche acute, aritmie e scompenso — fast-track dolore toracico." },
  { name: "Chirurgia Generale", description: "Addome acuto, trauma e patologie chirurgiche comuni." },
  { name: "Dermatologia", description: "Dermatiti acute, infezioni cutanee e urgenze dermatologiche." },
  { name: "Endocrinologia", description: "Diabete scompensato, tiroide e urgenze metaboliche." },
  { name: "Gastroenterologia", description: "Emorragia digestiva, pancreatite e addome medico." },
  { name: "Geriatria", description: "Paziente fragile, delirium e multimorbidità." },
  { name: "Malattie Infettive", description: "Sepsis, meningite e infezioni sistemiche." },
  { name: "Medicina d'Emergenza-Urgenza", description: "Triage, stabilizzazione e percorsi di emergenza." },
  { name: "Medicina Interna", description: "Quadri internistici complessi e diagnosi differenziale." },
  { name: "Neurologia", description: "Stroke, cefalea acuta, crisi e neuropatie." },
  { name: "Oncologia", description: "Complicanze oncologiche e supporto clinico." },
  { name: "Ortopedia e Traumatologia", description: "Fratture, politrauma e urgenze muscolo-scheletriche." },
  { name: "Ostetricia e Ginecologia", description: "Urgenze ostetrico-ginecologiche." },
  { name: "Pediatria", description: "Urgenze pediatriche e valutazione età-specifica." },
  { name: "Pneumologia", description: "Dispnea, BPCO riacutizzata e insufficienza respiratoria." },
  { name: "Psichiatria", description: "Agitazione, rischio suicidario e urgenze psichiatriche." },
  { name: "Radiologia", description: "Appropriatezza imaging e interpretazione di base." },
  { name: "Urologia", description: "Colica renale, ritenzione e urgenze urologiche." },
];

type SeedCase = {
  title: string;
  description: string;
  specialtyName: string;
  difficulty: CaseDifficulty;
  patientPrompt: string;
  pastMedicalHistory: string;
  correctSolution: string;
  examBudgetEuro: number;
  patientDeteriorationThreshold: number;
  initialStress: number;
  goldStandardPath: string[];
  examLatencies: Record<string, number>;
  baseline: Record<string, unknown>;
};

const STEMI_ECG =
  "Sopraslivellamento del tratto ST nelle derivazioni precordiali da V1 a V4 (STEMI anteriore). Frequenza cardiaca 102 bpm.";
const STEMI_TROP =
  "In attesa di referto urgente (dosaggio basale: 150 ng/L, limite <14 ng/L).";
const STEMI_TC =
  "Esame non indicato in prima battuta. Nessun segno di dissezione aortica o embolia polmonare evidente.";

const CASES: SeedCase[] = [
  {
    title: "Dolore toracico oppressivo in PS",
    description:
      "Uomo di 55 anni con dolore retrosternale acuto irradiato all'arto superiore sinistro da circa 2 ore, associato a sudorazione fredda.",
    specialtyName: "Cardiologia",
    difficulty: "HARD",
    patientPrompt:
      "Interpreta un uomo di 55 anni di nome Marco. Hai un dolore terribile al petto, come un macigno, che ti toglie il respiro. Sei terrorizzato dall'idea di stare per morire. Se il medico non ti fa l'ECG o non ti rassicura entro poche domande, il tuo stress salirà a 90.",
    pastMedicalHistory:
      "Ipertensione arteriosa in terapia con ACE-inibitore. Ex-fumatore (20 pack-year). Padre deceduto per IMA a 58 anni. Nessuna allergia nota.",
    correctSolution:
      "STEMI anteriore (occlusione IVA). Percorso: ECG immediato → attivazione sala di emodinamica → consenso informato → angioplastica primaria. Evitare TC torace se non indicato.",
    examBudgetEuro: 400,
    patientDeteriorationThreshold: 15,
    initialStress: 75,
    goldStandardPath: ["ecg", "consenso-informato", "coronaro-angioplastica"],
    examLatencies: {
      ecg: 5,
      troponina: 45,
      "troponina-hs": 45,
      "tc-torace": 35,
      tc: 35,
      "coronaro-angioplastica": 25,
      coronarografia: 25,
    },
    baseline: {
      demographics: { age: 55, sex: "M", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "145/90",
        heartRate: 102,
        spo2: 94,
        temperature: 36.6,
        respiratoryRate: 20,
        bp: "145/90",
        hr: 102,
        temp: 36.6,
        rr: 20,
      },
      physicalExam: {
        finding:
          "Paziente agitato, madido di sudore. Toni cardiaci ritmici, tachicardici. Non rumori di sfregamento pleurico. Addome trattabile.",
      },
      thorax: {
        cardiacAuscultation: "Toni cardiaci ritmici, tachicardici. Non rumori di sfregamento pleurico.",
        lungAuscultation: "Paziente agitato, madido di sudore.",
      },
      abdomen: { inspection: "Addome trattabile.", palpation: "Addome trattabile.", percussion: "" },
      neuro: { pupils: "Isochoriche, normoreagenti", gcs: "15", deficits: "Nessun deficit focale" },
      examBudgetEuro: 400,
      stressProfile: {
        initialStress: 75,
        reactivityType: "hyper",
        timeDecayRate: 2.2,
        criticalMilestones: {
          reduceStress: ["richiesto_ecg", "consenso_informato", "rassicurazione"],
          increaseStress: ["tc_torace", "ritardo_ecg", "procedura_invasiva_non_spiegata"],
        },
        lifesavingMilestones: ["ecg", "coronaro-angioplastica", "coronarografia"],
        relievingExams: ["ecg", "troponina", "troponina-hs", "coronarografia"],
        dangerousPrescriptions: [],
      },
      ecg: { finding: STEMI_ECG },
      troponina: { finding: STEMI_TROP },
      "tc-torace": { finding: STEMI_TC, cost: 220 },
      advancedExams: {
        notes:
          "STEMI anteriore sospetto. ECG urgente entro 10'. Evitare TC torace in prima battuta se non sospetto dissezione/EP.",
        values: {
          ecg: {
            price: 15,
            urgencyTiming: "5 min",
            routineTiming: "n.p.",
            routineMinutes: 5,
            normalFinding: STEMI_ECG,
          },
          "troponina-hs": {
            price: 18,
            urgencyTiming: "45 min",
            routineTiming: "2h",
            routineMinutes: 45,
            normalFinding: STEMI_TROP,
          },
          troponina: {
            price: 18,
            urgencyTiming: "45 min",
            routineTiming: "2h",
            routineMinutes: 45,
            normalFinding: STEMI_TROP,
          },
          tc: {
            price: 220,
            urgencyTiming: "35 min",
            routineTiming: "24h",
            routineMinutes: 35,
            normalFinding: STEMI_TC,
          },
          "tc-torace": {
            price: 220,
            urgencyTiming: "35 min",
            routineTiming: "24h",
            routineMinutes: 35,
            normalFinding: STEMI_TC,
          },
          coronarografia: {
            price: 1800,
            urgencyTiming: "Real-time",
            routineTiming: "n.p.",
            routineMinutes: 25,
            normalFinding:
              "Occlusione critica IVA prossimale; angioplastica primaria con stent DES — TIMI 3.",
          },
          "coronaro-angioplastica": {
            price: 1800,
            urgencyTiming: "Real-time",
            routineTiming: "n.p.",
            routineMinutes: 25,
            normalFinding:
              "Occlusione critica IVA prossimale; angioplastica primaria con stent DES — TIMI 3.",
          },
        },
      },
    },
  },
  {
    title: "Uomo 58 anni con dolore toracico in PS",
    description:
      "Uomo di 58 anni riferisce dolore toracico costrittivo da 45 minuti, irradiato alla mandibola, con nausea. Arriva in Pronto Soccorso autonomo.",
    specialtyName: "Medicina d'Emergenza-Urgenza",
    difficulty: "MEDIUM",
    patientPrompt:
      "Sei Paolo, 58 anni. Hai un peso sullo sterno e paura di infarto. Rispondi come paziente, senza dare diagnosi. Chiedi spesso se è grave.",
    pastMedicalHistory: "Dislipidemia. Fumatore attivo. Nessuna chirurgia pregressa.",
    correctSolution:
      "Sospetta SCA: ECG entro 10', monitoraggio, ASA se non controindicato, troponina, percorso chest-pain.",
    examBudgetEuro: 350,
    patientDeteriorationThreshold: 20,
    initialStress: 55,
    goldStandardPath: ["ecg", "troponina", "consenso-informato"],
    examLatencies: { ecg: 5, troponina: 40, "troponina-hs": 40 },
    baseline: {
      demographics: { age: 58, sex: "M", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "150/95",
        heartRate: 96,
        spo2: 96,
        temperature: 36.5,
        respiratoryRate: 18,
      },
      examBudgetEuro: 350,
      stressProfile: { initialStress: 55, reactivityType: "hyper", timeDecayRate: 1.8 },
      advancedExams: {
        notes: "Dolore toracico — prioritizzare ECG e marker cardiaci.",
        values: {
          ecg: {
            price: 15,
            urgencyTiming: "5 min",
            routineTiming: "n.p.",
            routineMinutes: 5,
            normalFinding: "Ritmo sinusale. Underslivellamento ST laterale lieve.",
          },
          "troponina-hs": {
            price: 18,
            urgencyTiming: "40 min",
            routineTiming: "2h",
            routineMinutes: 40,
            normalFinding: "Troponina hs 48 ng/L (limite <14).",
          },
        },
      },
    },
  },
  {
    title: "Donna 72 anni con febbre persistente",
    description:
      "Donna di 72 anni con febbre da 3 giorni, tosse produttiva e astenia. Portata in PS dalla figlia per confusione lieve.",
    specialtyName: "Medicina Interna",
    difficulty: "EASY",
    patientPrompt:
      "Sei Lucia Rossi, 72 anni. Ti senti debole e confusa. Hai freddo e tossisci. Rispondi in modo semplice, a volte ripeti le stesse cose.",
    pastMedicalHistory: "Diabete tipo 2. Ipertensione. Nessuna allergia nota.",
    correctSolution:
      "Sospetta polmonite / sepsi: vitals, emocromo, PCR/PCT, emocolture se indicato, RX torace, antibiotico empirico dopo culture quando possibile.",
    examBudgetEuro: 280,
    patientDeteriorationThreshold: 25,
    initialStress: 40,
    goldStandardPath: ["emocromo", "rx-torace", "consenso-informato"],
    examLatencies: { emocromo: 30, "rx-torace": 25, "pcr-pct": 45 },
    baseline: {
      demographics: { age: 72, sex: "F", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "105/65",
        heartRate: 108,
        spo2: 91,
        temperature: 38.7,
        respiratoryRate: 24,
      },
      examBudgetEuro: 280,
      stressProfile: { initialStress: 40, reactivityType: "standard", timeDecayRate: 1.5 },
      advancedExams: {
        notes: "Anziana con febbre e ipossiemia — valutare sepsi e polmonite.",
        values: {
          emocromo: {
            price: 4.8,
            urgencyTiming: "20 min",
            routineTiming: "4h",
            routineMinutes: 30,
            normalFinding: "GB 14.2 x10^9/L con neutrofilia; Hb 12.1 g/dL.",
          },
          "rx-torace": {
            price: 25,
            urgencyTiming: "30 min",
            routineTiming: "24h",
            routineMinutes: 25,
            normalFinding: "Opacità basale destra compatibile con focolaio broncopolmonare.",
          },
        },
      },
    },
  },
  {
    title: "Uomo 33 anni con cefalea acuta e nausea",
    description:
      "Uomo di 33 anni con storia di idrocefalo e shunt VP presenta cefalea improvvisa, vomito e sonnolenza. Arriva in PS.",
    specialtyName: "Neurologia",
    difficulty: "HARD",
    patientPrompt:
      "Sei Marco Rossi, 33 anni. Hai un dolore alla testa fortissimo e nausea. Sei sonnolento. Se il medico ritarda la TC, aumenti ansia e confusione.",
    pastMedicalHistory: "Idrocefalo con shunt ventricolo-peritoneale. Nessuna allergia nota.",
    correctSolution:
      "Sospetta disfunzione di shunt / ipertensione endocranica: ABC, neurostatus, TC encefalo urgente, consulto neurochirurgico. Evitare ritardi.",
    examBudgetEuro: 450,
    patientDeteriorationThreshold: 12,
    initialStress: 70,
    goldStandardPath: ["esame-obiettivo-neuro", "tc", "consenso-informato"],
    examLatencies: { tc: 25, ega: 10 },
    baseline: {
      demographics: { age: 33, sex: "M", context: "Pronto Soccorso" },
      vitals: {
        bloodPressure: "160/100",
        heartRate: 64,
        spo2: 98,
        temperature: 36.8,
        respiratoryRate: 14,
      },
      neuro: { pupils: "Anisocoria lieve", gcs: "13", deficits: "Sonnolenza, vomito ripetuto" },
      examBudgetEuro: 450,
      stressProfile: { initialStress: 70, reactivityType: "hyper", timeDecayRate: 2.5 },
      advancedExams: {
        notes: "Cefalea acuta in paziente con shunt — TC encefalo prioritaria.",
        values: {
          tc: {
            price: 120,
            urgencyTiming: "25 min",
            routineTiming: "24h",
            routineMinutes: 25,
            normalFinding:
              "Ventricoli dilatati rispetto a TC precedenti; sospetta malfunzione di shunt.",
          },
        },
      },
    },
  },
];

async function ensureSeedUser() {
  return prisma.user.upsert({
    where: { id: SEED_USER_ID },
    create: {
      id: SEED_USER_ID,
      email: "test@itermed.com",
      name: "Dev User",
      role: "ADMIN",
    },
    update: {
      role: "ADMIN",
      name: "Dev User",
    },
  });
}

async function ensureSpecialties() {
  const map = new Map<string, string>();
  for (const specialty of SSM_SPECIALTIES) {
    const row = await prisma.medicalSpecialty.upsert({
      where: { name: specialty.name },
      create: specialty,
      update: { description: specialty.description },
      select: { id: true, name: true },
    });
    map.set(row.name, row.id);
  }
  return map;
}

async function upsertCase(
  userId: string,
  specialtyId: string,
  seed: SeedCase,
): Promise<string> {
  const payload = {
    title: seed.title,
    description: seed.description,
    specialty: seed.specialtyName,
    difficulty: seed.difficulty,
    isActive: true,
    isGlobal: true,
    estimatedDurationMinutes: 45,
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: seed.patientDeteriorationThreshold,
    pastMedicalHistory: seed.pastMedicalHistory,
    correctSolution: seed.correctSolution,
    medicalSpecialtyId: specialtyId,
    goldStandardPath: seed.goldStandardPath,
    examLatencies: seed.examLatencies,
    baselineExamFindings: {
      ...seed.baseline,
      examBudgetEuro: seed.examBudgetEuro,
      stressProfile: {
        ...(typeof seed.baseline.stressProfile === "object" && seed.baseline.stressProfile
          ? (seed.baseline.stressProfile as Record<string, unknown>)
          : {}),
        initialStress: seed.initialStress,
      },
    },
    createdById: userId,
  };

  const existing = await prisma.clinicalCase.findFirst({
    where: { title: seed.title, createdById: userId },
    select: { id: true, nodes: { select: { id: true }, take: 1, orderBy: { order: "asc" } } },
  });

  if (existing) {
    await prisma.clinicalCase.update({ where: { id: existing.id }, data: payload });
    const firstNodeId = existing.nodes[0]?.id;
    if (firstNodeId) {
      await prisma.caseNode.update({
        where: { id: firstNodeId },
        data: { order: 1, type: "HISTORY", content: { casePrompt: seed.patientPrompt } },
      });
    } else {
      await prisma.caseNode.create({
        data: {
          caseId: existing.id,
          order: 1,
          type: "HISTORY",
          content: { casePrompt: seed.patientPrompt },
        },
      });
    }
    return existing.id;
  }

  const created = await prisma.clinicalCase.create({
    data: {
      ...payload,
      nodes: {
        create: [{ order: 1, type: "HISTORY", content: { casePrompt: seed.patientPrompt } }],
      },
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  console.log("→ Seed AEQUAN cases + specialties…");
  console.log(`  DATABASE_URL host: ${summarizeDbHost(process.env.DATABASE_URL)}`);

  const user = await ensureSeedUser();
  console.log(`  User: ${user.email} (${user.id})`);

  const specialties = await ensureSpecialties();
  console.log(`  Specialties upserted: ${specialties.size}`);

  for (const seed of CASES) {
    const specialtyId = specialties.get(seed.specialtyName);
    if (!specialtyId) {
      throw new Error(`Specialty missing after upsert: ${seed.specialtyName}`);
    }
    const caseId = await upsertCase(user.id, specialtyId, seed);
    console.log(`  ✓ ${seed.title} → ${caseId} [${seed.specialtyName}]`);
  }

  console.log("\n✓ Seed AEQUAN completato.");
}

function summarizeDbHost(url?: string): string {
  if (!url) return "(missing)";
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

main()
  .catch((error) => {
    console.error("Seed AEQUAN failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
