/**
 * Scrive knowledge_base/reumatologia/cases/REUMA-001.json … REUMA-015.json
 * e li valida contro KnowledgeBaseCaseSchema.
 *
 *   npx tsx scripts/generate-reumatologia-cases.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertPlayableCase } from "@/lib/cases/case-import-schema";
import { KnowledgeBaseCaseSchema } from "@/lib/cases/knowledge-base-case-schema";

const OUT_DIR = resolve(process.cwd(), "knowledge_base/reumatologia/cases");

type Phase = "anamnesi" | "diagnostica" | "screening" | "terapia" | "follow-up";
type Trap = "medico-legale" | "economico";

type Step = {
  phase: Phase;
  title: string;
  prompt: string;
  cost: number;
  score: number;
  correctLabel: string;
  wrongs: { label: string; next: string }[];
};

type Resolution = {
  id: string;
  outcome: "positive" | "negative";
  trap?: Trap;
  title: string;
  prompt: string;
  cost: number;
  score: number;
};

type ExamRow = {
  examId: string;
  name: string;
  finding: string;
  isAbnormal: boolean;
  priceEuro: number;
  inappropriate?: boolean;
  wasteRationale?: string;
  isFatal?: boolean;
};

type Question = {
  id: string;
  prompt: string;
  critical: boolean;
  expectedKeywords: string[];
  rationale: string;
};

type Spec = {
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

function buildNodes(steps: Step[], resolutions: Resolution[]) {
  if (steps.length < 5) throw new Error("servono almeno 5 decisioni");
  const decisions = steps.map((step, index) => {
    const id = `d${index + 1}`;
    const nextOk = index < steps.length - 1 ? `d${index + 2}` : "res-ok";
    return {
      id,
      type: "decision" as const,
      phase: step.phase,
      title: step.title,
      prompt: step.prompt,
      cost: step.cost,
      score: step.score,
      choices: [
        { id: `${id}-ok`, label: step.correctLabel, next: nextOk },
        ...step.wrongs.map((wrong, wrongIndex) => ({
          id: `${id}-w${wrongIndex + 1}`,
          label: wrong.label,
          next: wrong.next,
        })),
      ],
    };
  });
  const nodes = [
    ...decisions,
    ...resolutions.map((resolution) => ({
      id: resolution.id,
      type: "resolution" as const,
      title: resolution.title,
      prompt: resolution.prompt,
      cost: resolution.cost,
      score: resolution.score,
      outcome: resolution.outcome,
      ...(resolution.trap ? { trap: resolution.trap } : {}),
    })),
  ];
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.type !== "decision") continue;
    for (const choice of node.choices) {
      if (!ids.has(choice.next)) {
        throw new Error(`scelta ${choice.id} punta a ${choice.next} inesistente`);
      }
    }
  }
  let cursor = "d1";
  let depth = 0;
  const seen = new Set<string>();
  while (nodes.find((node) => node.id === cursor)?.type === "decision") {
    if (seen.has(cursor)) throw new Error(`ciclo su ${cursor}`);
    seen.add(cursor);
    depth += 1;
    const node = nodes.find((item) => item.id === cursor);
    if (!node || node.type !== "decision") break;
    const correct = node.choices.find((choice) => choice.id.endsWith("-ok"));
    if (!correct) throw new Error(`manca la scelta corretta su ${cursor}`);
    cursor = correct.next;
  }
  if (depth < 5) throw new Error(`catena decisionale di ${depth} nodi, ne servono 5`);
  if (cursor !== "res-ok") throw new Error(`la catena corretta finisce su ${cursor}`);
  const negatives = nodes.filter((node) => node.type === "resolution" && node.outcome === "negative");
  if (!negatives.some((node) => node.trap === "medico-legale")) {
    throw new Error("manca una resolution negativa medico-legale");
  }
  if (!negatives.some((node) => node.trap === "economico")) {
    throw new Error("manca una resolution negativa economica");
  }
  return nodes;
}

function valuesFrom(exams: ExamRow[]) {
  const values: Record<string, { finding: string; normalFinding: string; isAbnormal: boolean; price: number }> = {};
  for (const exam of exams) {
    values[exam.examId] = {
      finding: exam.finding,
      normalFinding: exam.finding,
      isAbnormal: exam.isAbnormal,
      price: exam.priceEuro,
    };
  }
  return values;
}

function assemble(spec: Spec) {
  const id = `REUMA-${String(spec.n).padStart(3, "0")}`;
  const nodes = buildNodes(spec.steps, spec.resolutions);
  const exams = [...spec.mandatoryExams, ...spec.inappropriateExams];
  return {
    id,
    code: id,
    title: spec.title,
    description: spec.description,
    difficulty: spec.difficulty,
    specialty: "reumatologia",
    specialtyLabel: "Reumatologia",
    condition: spec.condition,
    frequencyCategory: spec.frequencyCategory,
    matrixDifficulty: spec.matrixDifficulty,
    setting: spec.setting,
    guidelineRef: spec.guidelineRef,
    diagnosis: spec.diagnosis,
    pastMedicalHistory: spec.pastMedicalHistory,
    presentation: spec.presentation,
    redHerrings: spec.redHerrings,
    timeLimitMinutes: spec.timeLimitMinutes,
    patientDeteriorationThreshold: spec.patientDeteriorationThreshold,
    patientPrompt: spec.patientPrompt,
    correctSolution: spec.correctSolution,
    goldStandardPath: spec.goldStandardPath,
    goldPathNarrative: spec.goldPathNarrative,
    examLatencies: spec.examLatencies,
    anamnesisQuestions: spec.anamnesisQuestions,
    physicalExam: { summary: spec.physicalSummary },
    escCitations: spec.citations,
    auditMetrics: {
      appropriatenessIndicators: spec.indicators,
      gelliBiancoShield: {
        art5Adherence: spec.art5,
        legalCriteria: spec.legalCriteria,
      },
    },
    mandatoryExams: spec.mandatoryExams,
    inappropriateExams: spec.inappropriateExams.map((exam) => ({ ...exam, inappropriate: true })),
    baselineExamFindings: {
      context: spec.context,
      vitals: spec.vitals,
      examBudgetEuro: spec.budget,
      demographics: { age: spec.age, sex: spec.sex, name: spec.name },
      clinicalSigns: spec.signs,
      semeiotics: spec.signs,
      advancedExams: { values: valuesFrom(exams) },
    },
    patientProfile: {
      healthLiteracy: spec.literacy,
      emotionalState: spec.emotion,
      adherence: spec.adherence,
      lifestyleAndSocial: {
        sleepQuality: spec.sleep,
        stressLevel: spec.stress,
        socialSupport: spec.support,
      },
      communicationStyle: spec.communicationStyle,
    },
    nodes,
  };
}

const q = (
  id: string,
  prompt: string,
  expectedKeywords: string[],
  rationale: string,
  critical = true,
): Question => ({ id, prompt, critical, expectedKeywords, rationale });

const CASES: Spec[] = [
  {
    n: 1,
    title: "Artrite reumatoide all'esordio",
    description:
      "Giulia Ferrara, 46 anni, sarta, da dieci settimane ha gonfiore simmetrico di metacarpo-falangee e interfalangee prossimali, rigidità mattutina di oltre un'ora e presa della mano che cede sul lavoro. Non ha febbre, non ha monoartrite calda, non ha trauma. Il percorso è la conferma infiammatoria con radiografie e autoanticorpi mirati, lo screening di sicurezza e il metotrexato entro tre mesi dall'esordio. La risonanza immediata e il biologico di prima linea sono le trappole.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "AMBULATORIO",
    condition: "Artrite reumatoide all'esordio: csDMARD precoce, non RM né biologico di prima linea",
    guidelineRef: "EULAR RA — csDMARD subito dopo la diagnosi, biologico solo dopo fallimento",
    diagnosis:
      "Artrite reumatoide all'esordio, sieropositiva. Serve metotrexato dopo screening. Non RM articolare immediata e non adalimumab di prima linea.",
    pastMedicalHistory:
      "Ipotiroidismo in levotiroxina, stabile. Due gravidanze portate a termine, l'ultima otto anni fa. Non beve alcolici. Non ha epatite nota, non ha tubercolosi, non ha allergie. Una zia aveva le mani deformate, mai inquadrata. Assume ibuprofene da tre settimane, con poco beneficio e epigastralgia lieve. Ultimo ciclo regolare, non usa contraccezione.",
    presentation:
      "In ambulatorio tiene le mani socchiuse. Se si chiede solo da quanto fa male, risponde «da un po'» e accetta qualunque risonanza pur di tornare a cucire. Se si ricostruiscono rigidità, simmetria e durata oltre le sei settimane, il quadro è infiammatorio e non meccanico. Parametri stabili, non febbre.",
    redHerrings: [
      "Il dolore al pollice della mano dominante sembra artrosi da lavoro.",
      "Chiede lei la risonanza perché una collega «ha risolto così».",
      "L'ibuprofene ha abbassato un po' il dolore e fa sembrare inutile un farmaco di fondo.",
    ],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 40,
    patientPrompt:
      "ROLEPLAY. Sei Giulia Ferrara, 46 anni, sarta, ambulatorio di reumatologia. Registro: preoccupata, frasi brevi, torni sempre al lavoro. Alla «Come sta?»: «Non chiudo più le forbici. La mattina le mani sono blocchi.» Non dire tu che è artrite reumatoide. Se chiedono rigidità, simmetria, da quanto, febbre, altre articolazioni: più di un'ora al risveglio, entrambe le mani, da dieci settimane, niente febbre, anche i polsi. Se propongono una risonanza subito accetti: «Così si vede tutto.» Se propongono radiografie, esami del sangue e poi una compressa settimanale dopo i controlli di fegato e gravidanza, accetti se ti spiegano perché non è un antidolorifico. Se ti mandano a casa solo con l'ibuprofene, [stringe i pugni]: «Tra un mese non lavoro più.» Non nominare budget, linee guida o trappole.",
    correctSolution:
      "Artrite reumatoide all'esordio. Radiografie delle mani, fattore reumatoide, anti-CCP e indici di flogosi; screening con beta-HCG, transaminasi, sierologia epatite e radiografia del torace; metotrexato 10 mg a settimana con folato. Controllo di emocromo e fegato a 4-6 settimane. Non RM immediata. Non adalimumab prima del fallimento del DMARD.",
    goldStandardPath: [
      "anamnesi-infiammatoria",
      "rx-ossa",
      "fr",
      "anti-ccp",
      "beta-hcg",
      "enzimi-epatici",
      "hiv-hcv-hbv",
      "azione-metotrexato",
      "azione-followup-laboratorio",
    ],
    goldPathNarrative:
      "1) Anamnesi: rigidità oltre un'ora, simmetria, durata di dieci settimane, assenza di febbre. 2) Primo livello: RX mani 30 euro, FR 8 euro, anti-CCP 15 euro, emocromo 4,80, VES 3,50, PCR 28 euro. Non la RM da 220 euro. 3) Screening prima del metotrexato: beta-HCG 15 euro, transaminasi 10 euro, sierologia epatitica 35 euro, RX torace 25 euro. 4) Metotrexato 10 mg a settimana, 12,50 euro, più folato. Non adalimumab da 450 euro. 5) Follow-up a 4-6 settimane con emocromo e transaminasi. Il ritardo del DMARD lascia erodere le articolazioni.",
    examLatencies: {
      "anamnesi-infiammatoria": 8,
      "rx-ossa": 40,
      fr: 1440,
      "anti-ccp": 4320,
      "beta-hcg": 120,
      "enzimi-epatici": 240,
      "hiv-hcv-hbv": 1440,
      "azione-metotrexato": 10,
      "azione-followup-laboratorio": 15,
      rm: 2880,
      ana: 4320,
      ena: 4320,
    },
    anamnesisQuestions: [
      q("aq-rigidita", "Quanto dura la rigidità al risveglio e da quante settimane?", ["rigidità", "settimane"], "Oltre sei settimane e oltre un'ora al mattino separano l'artrite reumatoide dal dolore meccanico."),
      q("aq-simmetria", "Quali articolazioni sono gonfie, e sono entrambe le mani?", ["mani", "entrambe"], "La simmetria di MCF e IFP è il pattern dell'esordio, non l'artrosi del solo pollice dominante."),
      q("aq-redflag", "Ha febbre, un'articolazione caldissima isolata, o potrebbe essere incinta?", ["febbre", "gravidanza"], "La febbre sposta verso l'artrite settica. La gravidanza vieta il metotrexato."),
    ],
    physicalSummary:
      "Sinovite palpabile e simmetrica di metacarpo-falangee e interfalangee prossimali, polsi tumefatti, presa debole. Non noduli, non monartrite bollente, non rush malare. Il quadro è infiammatorio cronico, non artrosi isolata del pollice.",
    citations: [
      {
        chunkId: "reuma-001-dmard",
        source: "Sintesi operativa EULAR — trattamento precoce dell'artrite reumatoide",
        quote: "Alla diagnosi si inizia un csDMARD, in prima linea il metotrexato, senza attendere le erosioni. Il biologico non è il primo farmaco se il csDMARD non è stato provato.",
      },
      {
        chunkId: "reuma-001-costi",
        source: "Tariffe didattiche REUMA-001 — RX 30 €, FR 8 €, anti-CCP 15 €, RM 220 €, adalimumab 450 €",
        quote: "Il primo livello sta nel budget di 210 euro. La RM articolare immediata costa 220 euro da sola e non cambia la decisione di iniziare il metotrexato.",
      },
    ],
    indicators: [
      "Anamnesi di rigidità, simmetria e durata raccolta prima degli esami.",
      "RX, FR e anti-CCP prima di qualunque risonanza.",
      "Screening di gravidanza, fegato ed epatite prima del metotrexato.",
      "Nessun biologico di prima linea. Spesa entro 210 euro.",
    ],
    art5:
      "Legge 24/2017, art. 5: in cartella restano il pattern infiammatorio, gli esami di primo livello, lo screening pre-metotrexato e il motivo per cui la RM e il biologico non sono il primo passo.",
    legalCriteria: [
      "Metotrexato non consegnato senza beta-HCG e senza funzionalità epatica.",
      "Nessuna dimissione con solo FANS dopo dieci settimane di sinovite.",
      "Biologico non prescritto come prima linea.",
    ],
    mandatoryExams: [
      { examId: "rx-ossa", name: "RX mani", finding: "Osteopenia iuxta-articolare delle MCF, non ancora erosioni grosse. Utile e sufficiente come imaging di esordio. Costo 30 euro.", isAbnormal: true, priceEuro: 30 },
      { examId: "fr", name: "Fattore reumatoide", finding: "FR 86 UI/mL, sopra 14. Sieropositività coerente con l'esame clinico. Costo 8 euro.", isAbnormal: true, priceEuro: 8 },
      { examId: "anti-ccp", name: "Anticorpi anti-CCP", finding: "Anti-CCP 124 U/mL, sopra 20. Conferma l'artrite reumatoide. Costo 15 euro. Non serve un pannello ANA/ENA.", isAbnormal: true, priceEuro: 15 },
      { examId: "beta-hcg", name: "Beta-HCG", finding: "Beta-HCG inferiore a 5 mUI/mL. Non è in gravidanza: il metotrexato non è vietato per questo motivo. Costo 15 euro.", isAbnormal: false, priceEuro: 15 },
      { examId: "enzimi-epatici", name: "Transaminasi", finding: "AST 22 U/L, ALT 24 U/L. Fegato idoneo a iniziare il metotrexato, da ricontrollare. Costo 10 euro.", isAbnormal: false, priceEuro: 10 },
      { examId: "hiv-hcv-hbv", name: "Sierologia epatite", finding: "HBsAg negativo, anti-HBc negativo, anti-HCV negativo. Nessuna epatite attiva da riattivare. Costo 35 euro.", isAbnormal: false, priceEuro: 35 },
    ],
    inappropriateExams: [
      { examId: "rm", name: "RM articolare immediata", finding: "RM delle mani: sinovite, nessun dato che non fosse già clinico. Costo 220 euro, sopra il budget di 210. Non anticipa il metotrexato.", isAbnormal: true, priceEuro: 220, wasteRationale: "RM di primo livello senza RX: 220 euro, fuori budget, e ritarda il DMARD." },
      { examId: "ana", name: "ANA non giustificati", finding: "ANA negativi. Costo 12 euro. Non c'è un sospetto di connettivite oltre l'artrite reumatoide già definita da FR e anti-CCP.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA a pioggia su un'artrite reumatoide già sieropositiva." },
      { examId: "ena", name: "ENA non giustificato", finding: "Pannello ENA negativo. Costo 25 euro. Non cambia la decisione terapeutica.", isAbnormal: false, priceEuro: 25, wasteRationale: "ENA senza un pattern clinico di overlap. Costo aggiunto inutile." },
    ],
    budget: 210,
    name: "Giulia Ferrara",
    age: 46,
    sex: "F",
    context: "Ambulatorio di reumatologia. Sinovite delle mani da dieci settimane.",
    vitals: { heartRate: 78, bloodPressure: "128/76", spo2: 98, temperature: 36.8, respiratoryRate: 16 },
    signs: [
      { signName: "Sinovite simmetrica delle mani", result: "MCF e IFP tumefatte e dolenti in modo simmetrico, rigidità prolungata.", isPositive: true },
      { signName: "Monartrite settica", result: "Nessuna articolazione isolata, calda e febbrile.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Pratica e spaventata dal lavoro perso. Accetta la risonanza se proposta. Si fida del metotrexato solo se le si dice che le radiografie e gli esami del sangue bastano e che il fegato verrà ricontrollato.",
    steps: [
      { phase: "anamnesi", title: "Pattern infiammatorio", prompt: "Come inquadri il dolore alle mani prima di prescrivere esami?", cost: 0, score: 15, correctLabel: "Chiedere rigidità mattutina, simmetria, durata e febbre", wrongs: [{ label: "Chiamarla artrosi da lavoro e dimetterla con il solo ibuprofene", next: "res-ritardo" }] },
      { phase: "diagnostica", title: "Primo livello", prompt: "Quale imaging e quale sierologia sono il primo livello?", cost: 89.3, score: 20, correctLabel: "RX mani, FR, anti-CCP, emocromo, VES e PCR", wrongs: [{ label: "RM delle mani subito, senza radiografie", next: "res-rm" }] },
      { phase: "screening", title: "Sicurezza pre-metotrexato", prompt: "Prima di consegnare il metotrexato, cosa controlli?", cost: 85, score: 20, correctLabel: "Beta-HCG, transaminasi, sierologia epatite e RX torace", wrongs: [{ label: "Iniziare il metotrexato oggi, gli esami di sicurezza al prossimo mese", next: "res-noscreen" }] },
      { phase: "terapia", title: "Farmaco di fondo", prompt: "Quale terapia di fondo avvii dopo lo screening negativo?", cost: 12.5, score: 25, correctLabel: "Metotrexato 10 mg a settimana più folato", wrongs: [{ label: "Adalimumab 40 mg subito, senza provare il DMARD", next: "res-biologico" }] },
      { phase: "follow-up", title: "Controllo nel tempo", prompt: "Come programmi il controllo dopo l'avvio?", cost: 14.8, score: 20, correctLabel: "Emocromo e transaminasi tra 4-6 settimane, e attività di malattia", wrongs: [{ label: "Controllo fra un anno, se il dolore torna", next: "res-ritardo" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "DMARD avviato in sicurezza", prompt: "Artrite reumatoide riconosciuta, screening fatto, metotrexato iniziato, follow-up fissato. Nessuna RM e nessun biologico di prima linea.", cost: 201.6, score: 100 },
      { id: "res-ritardo", outcome: "negative", trap: "medico-legale", title: "Danno da ritardo del DMARD", prompt: "La sinovite resta senza farmaco di fondo. A sei mesi compaiono erosioni e limitazione permanente della presa. Il ritardo diagnostico-terapeutico è il vizio medico-legale.", cost: 0, score: 0 },
      { id: "res-rm", outcome: "negative", trap: "economico", title: "RM immediata fuori budget", prompt: "La RM articolare costa 220 euro e supera da sola il budget di 210. Non aggiunge la decisione che radiografie e anticorpi già sostengono.", cost: 220, score: 0 },
      { id: "res-noscreen", outcome: "negative", trap: "medico-legale", title: "Metotrexato senza screening", prompt: "Il metotrexato parte senza beta-HCG e senza fegato. Il rischio è una gravidanza esposta o un'epatite non vista. Lo screening omesso è l'errore legale.", cost: 12.5, score: 0 },
      { id: "res-biologico", outcome: "negative", trap: "economico", title: "Biologico senza fallimento del DMARD", prompt: "Adalimumab 450 euro di prima linea, senza fallimento del metotrexato. È spreco e non è il percorso di prima scelta.", cost: 450, score: 0 },
    ],
  },
  {
    n: 2,
    title: "Artrite settica del ginocchio",
    description:
      "Marco De Santis, 62 anni, diabetico, arriva in pronto soccorso con il ginocchio destro bollente da trenta ore e febbre. Non è una riacutizzazione di artrosi da trattare con un pannello autoimmune. Il percorso è l'artrocentesi prima di qualunque antibiotico, poi la terapia mirata e il controllo ortopedico. L'antibiotico alla cieca e gli autoanticorpi a pioggia sono le trappole.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "PRONTO_SOCCORSO",
    condition: "Artrite settica: artrocentesi prima dell'antibiotico, non pannello autoimmune",
    guidelineRef: "Artrite settica — prelievo sinoviale prima dell'antibiotico empirico",
    diagnosis:
      "Artrite settica del ginocchio destro. L'artrocentesi precede l'antibiotico. FR, anti-CCP, ANA ed ENA non diagnosticano l'infezione.",
    pastMedicalHistory:
      "Diabete di tipo 2 in metformina, glicemie ballerane. Artrosi nota del ginocchio destro, mai operato. Non assume immunosoppressori. Una settimana fa un'iniezione intra-articolare di cortisone dal medico di famiglia. Allergie: nessuna. Non ha gotta documentata, uricemia mai alta. Prostata ingrossata, nessuna ferita cutanea attiva oltre al punto dell'infiltrazione.",
    presentation:
      "Non appoggia il piede. Il ginocchio è caldo, teso, con versamento. Se le si propone di «dare subito la flebo e poi si vede», accetta perché ha paura. Se le si spiega che l'ago serve prima dell'antibiotico, ha timore dell'ago ma resta. Temperatura 38,7 °C.",
    redHerrings: [
      "L'artrosi nota fa sembrare il dolore una riacutizzazione meccanica.",
      "Il cortisone della settimana scorsa viene scambiato per la causa di tutto, e si rinvia il prelievo.",
      "Un FR debolmente positivo, se cercato, non spiega la febbre.",
    ],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 20,
    patientPrompt:
      "ROLEPLAY. Sei Marco De Santis, 62 anni, pronto soccorso, ginocchio destro che non tocchi. Registro: sofferente, frasi corte. Alla «Come sta?»: «Brucia. Non ci appoggio. Ho i brividi.» [tiene il ginocchio] Non dire tu che è artrite settica. Se chiedono febbre, da quanto, iniezioni, diabete, altre articolazioni: da ieri sera, 38 e mezzo a casa, un'infiltrazione sette giorni fa, diabete, solo questo ginocchio. Se ti danno l'antibiotico prima dell'ago, ti calmi a metà e poi il ginocchio resta distrutto nel racconto, ma tu in scena dici solo «fate qualcosa». Se spiegano l'artrocentesi prima della flebo, accetti dopo un rifiuto breve. Non nominare budget né diagnosi.",
    correctSolution:
      "Artrite settica. Artrocentesi con conta, Gram, coltura e ricerca cristalli prima dell'antibiotico. Poi antibiotico empirico e consulenza ortopedica per il drenaggio. Controllo seriato. Non pannello FR, anti-CCP, ANA, ENA, ANCA.",
    goldStandardPath: [
      "anamnesi-monoartrite",
      "artrocentesi",
      "emocromo",
      "pcr-pct",
      "azione-antibiotico-dopo-prelievo",
      "azione-followup-ortopedico",
    ],
    goldPathNarrative:
      "1) Anamnesi: febbre, infiltrazione recente, diabete, una sola articolazione. 2) Artrocentesi 55 euro prima di ogni antibiotico: liquido purulento, Gram positivo. Emocromo 4,80 euro e PCR 28 euro completano il primo livello. 3) Screening: non serve un pannello autoimmune; serve la coltura in corso e l'assenza di cristalli. 4) Antibiotico solo dopo il prelievo, e drenaggio. 5) Follow-up: rivalutazione del ginocchio e della coltura, non una RM. Il pannello FR+CCP+ANA+ENA+ANCA costa 80 euro e non identifica il germe.",
    examLatencies: {
      "anamnesi-monoartrite": 6,
      artrocentesi: 30,
      emocromo: 20,
      "pcr-pct": 60,
      "azione-antibiotico-dopo-prelievo": 10,
      "azione-followup-ortopedico": 20,
      fr: 1440,
      "anti-ccp": 4320,
      ana: 4320,
      ena: 4320,
      anca: 4320,
    },
    anamnesisQuestions: [
      q("aq-febbre", "Da quante ore è così il ginocchio, e ha avuto febbre?", ["febbre", "ore"], "La monoartrite febbrile è settica finché il liquido non dice il contrario."),
      q("aq-iniezione", "Le hanno punto il ginocchio di recente, ed è diabetico?", ["iniezione", "diabete"], "L'infiltrazione e il diabete sono la porta d'ingresso del germe."),
      q("aq-altre", "È solo questo ginocchio, o si sono gonfiate altre articolazioni?", ["solo", "ginocchio"], "La monoartrite acuta non si studia con un pannello da connettivite."),
    ],
    physicalSummary:
      "Ginocchio destro caldo, tumefatto, con versamento in tensione. Cute intatta salvo il punto di un'infiltrazione recente. Le altre articolazioni sono fredde. Febbre presente. Non è una poliartrite.",
    citations: [
      { chunkId: "reuma-002-tap", source: "Sintesi operativa — artrite settica acuta", quote: "Nella monoartrite febbrile il liquido sinoviale si preleva prima dell'antibiotico, salvo instabilità che impedisca l'ago. La coltura dopo la prima dose è già sporcata." },
      { chunkId: "reuma-002-costi", source: "Tariffe didattiche REUMA-002 — artrocentesi 55 €, pannello autoimmune circa 80 €", quote: "L'artrocentesi costa 55 euro ed è l'esame che decide. FR, anti-CCP, ANA, ENA e ANCA sommati non trovano lo stafilococco e sforano un budget di 140 euro se si aggiungono al resto." },
    ],
    indicators: [
      "Artrocentesi eseguita prima della prima dose di antibiotico.",
      "Nessun pannello autoimmune al posto del liquido sinoviale.",
      "Antibiotico e drenaggio solo dopo il prelievo.",
      "Spesa del primo livello entro 140 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano l'ora del prelievo, il fatto che precede l'antibiotico, e il motivo per cui gli autoanticorpi non sostituiscono la coltura.",
    legalCriteria: [
      "Nessun antibiotico documentato prima dell'artrocentesi.",
      "Coltura del liquido richiesta, non solo un emocromo.",
      "Consulenza per il drenaggio non rinviata al giorno dopo senza motivo.",
    ],
    mandatoryExams: [
      { examId: "artrocentesi", name: "Artrocentesi del ginocchio", finding: "Liquido torbido, 72.000 globuli bianchi, Gram con cocchi Gram positivi, cristalli assenti. Costo 55 euro. Va fatto prima dell'antibiotico.", isAbnormal: true, priceEuro: 55, isFatal: true },
      { examId: "emocromo", name: "Emocromo", finding: "Leucociti 16.400/mm3, neutrofilia. Costo 4,80 euro. Conferma l'infiammazione sistemica, non sostituisce il liquido.", isAbnormal: true, priceEuro: 4.8 },
      { examId: "pcr-pct", name: "PCR", finding: "PCR 14 mg/dL. Costo 28 euro. Alta, come atteso in un'infezione articolare, non discriminante da sola.", isAbnormal: true, priceEuro: 28 },
    ],
    inappropriateExams: [
      { examId: "fr", name: "Fattore reumatoide", finding: "FR 18 UI/mL, debolmente sopra soglia. Costo 8 euro. Non spiega la febbre e non autorizza a saltare l'ago.", isAbnormal: true, priceEuro: 8, wasteRationale: "FR in una monoartrite febbrile: falso binario, costa e ritarda il prelievo." },
      { examId: "anti-ccp", name: "Anti-CCP", finding: "Anti-CCP negativo. Costo 15 euro. Inutile in acuto su un ginocchio settico.", isAbnormal: false, priceEuro: 15, wasteRationale: "Anti-CCP non diagnostica l'artrite settica." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA non hanno indicazione in una monoartrite febbrile." },
      { examId: "ena", name: "ENA", finding: "ENA negativo. Costo 25 euro.", isAbnormal: false, priceEuro: 25, wasteRationale: "Pannello ENA a pioggia, 25 euro senza un sospetto di connettivite." },
      { examId: "anca", name: "ANCA", finding: "ANCA negativi. Costo 20 euro.", isAbnormal: false, priceEuro: 20, wasteRationale: "ANCA non sostituiscono l'artrocentesi." },
    ],
    budget: 140,
    name: "Marco De Santis",
    age: 62,
    sex: "M",
    context: "Pronto soccorso. Monoartrite febbrile del ginocchio destro.",
    vitals: { heartRate: 108, bloodPressure: "100/64", spo2: 96, temperature: 38.7, respiratoryRate: 20 },
    signs: [
      { signName: "Ginocchio settica", result: "Calore, versamento in tensione, dolore alla minima mobilizzazione.", isPositive: true },
      { signName: "Poliartrite", result: "Le altre articolazioni sono fredde e non tumefatte.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "POOR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Vuole la flebo subito e teme l'ago. Si fida se gli si dice che l'antibiotico dato prima rovina l'esame che serve a salvargli il ginocchio.",
    steps: [
      { phase: "anamnesi", title: "Monoartrite febbrile", prompt: "Cosa devi sapere prima di scegliere l'esame?", cost: 0, score: 15, correctLabel: "Febbre, durata, infiltrazione recente, diabete, una sola articolazione", wrongs: [{ label: "Darla per artrosi riacutizzata e prenotare una RM", next: "res-autoimmune" }] },
      { phase: "diagnostica", title: "Artrocentesi prima di tutto", prompt: "Qual è il primo gesto diagnostico?", cost: 55, score: 20, correctLabel: "Artrocentesi con Gram, coltura, conta e cristalli", wrongs: [{ label: "Antibiotico endovena subito, il prelievo domani", next: "res-antibiotico" }] },
      { phase: "screening", title: "Cosa non cercare", prompt: "Quali esami completano il primo livello, e quali no?", cost: 32.8, score: 20, correctLabel: "Emocromo e PCR, in attesa della coltura. Nessun pannello autoimmune", wrongs: [{ label: "FR, anti-CCP, ANA, ENA e ANCA prima di decidere", next: "res-autoimmune" }] },
      { phase: "terapia", title: "Antibiotico dopo il prelievo", prompt: "Quando parte l'antibiotico?", cost: 8, score: 25, correctLabel: "Subito dopo l'artrocentesi, empirico, e drenaggio ortopedico", wrongs: [{ label: "Attendere cinque giorni l'antibiogramma senza coprire", next: "res-ritardo" }] },
      { phase: "follow-up", title: "Controllo del ginocchio", prompt: "Come segui le ore successive?", cost: 0, score: 20, correctLabel: "Rivalutare dolore, febbre e referto colturale, senza RM di routine", wrongs: [{ label: "Dimettere con un FANS e un controllo fra due settimane", next: "res-ritardo" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Prelievo fatto, poi antibiotico", prompt: "L'artrocentesi precede l'antibiotico, il germe è cercato, il drenaggio è avviato. Nessun pannello autoimmune.", cost: 95.8, score: 100 },
      { id: "res-antibiotico", outcome: "negative", trap: "medico-legale", title: "Antibiotico prima dell'ago", prompt: "La prima dose sterilizza il liquido o ne sporca la lettura. Il ginocchio va verso la distruzione cartilaginea senza un germe documentato. È il danno iatrogeno da omissione del prelievo.", cost: 8, score: 0 },
      { id: "res-autoimmune", outcome: "negative", trap: "economico", title: "Pannello autoimmune al posto del liquido", prompt: "FR, anti-CCP, ANA, ENA e ANCA costano circa 80 euro e non identificano l'infezione. Sommati al resto superano il budget di 140 euro e fanno perdere ore.", cost: 80, score: 0 },
      { id: "res-ritardo", outcome: "negative", trap: "medico-legale", title: "Ritardo del drenaggio", prompt: "Senza copertura dopo il prelievo, o con una dimissione, la sepsi articolare progredisce. Il ritardo è il vizio che costa l'articolazione.", cost: 0, score: 0 },
    ],
  },
  {
    n: 3,
    title: "Fibromialgia",
    description:
      "Elena Greco, 41 anni, riferisce dolore ovunque da otto mesi, sonno non ristoratore e stanchezza. Non ha sinovite, gli indici di flogosi sono normali, non ha rigidità prolungata. Il percorso è un laboratorio minimo per escludere l'infiammazione, la diagnosi clinica e un piano non farmacologico. Il pannello ANA/ENA e i DMARD sono l'iper-medicalizzazione.",
    difficulty: "EASY",
    matrixDifficulty: "BASE",
    frequencyCategory: "HIGH",
    setting: "AMBULATORIO",
    condition: "Fibromialgia: diagnosi clinica, laboratorio minimo, niente DMARD né pannello ANA",
    guidelineRef: "Fibromialgia — diagnosi clinica, no immunosoppressione, no pannello a pioggia",
    diagnosis:
      "Fibromialgia. Emocromo, VES, PCR e TSH normali. Non ANA, non ENA, non metotrexato, non steroide sistemico.",
    pastMedicalHistory:
      "Emicrania. Due anni di lavoro su turni. Nessuna psoriasi, nessun fenomeno di Raynaud, nessuna bocca secca. Ha letto online di lupus e porta un elenco di esami. Non fuma. Non è anemica nota. Ultimo TSH due anni fa, normale. Nessuna allergia. Assume paracetamolo ogni sera.",
    presentation:
      "Indica con il dito schiena, spalle, anche e mandibola. Le articolazioni non sono gonfie. Se le si dice che servirà «tutto il pannello», si illumina. Se le si spiega che il dolore diffuso senza sinovite si chiama fibromialgia e non si cura con il metotrexato, all'inizio si offende e poi ascolta.",
    redHerrings: [
      "Il referto di un ANA a basso titolo fatto altrove, 1:80, senza sintomi di lupus.",
      "La stanchezza le fa chiedere una risonanza total body.",
      "Il sonno pessimo viene scambiato per una miopatia infiammatoria.",
    ],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 40,
    patientPrompt:
      "ROLEPLAY. Sei Elena Greco, 41 anni, ambulatorio. Registro: stanca, convinta di avere qualcosa di autoimmune grave. Alla «Come sta?»: «Mi fa male tutto. Da mesi. Nessuno mi crede.» Non dire tu la parola fibromialgia finché non te la spiegano. Se chiedono gonfiore, rigidità lunga, febbre, Raynaud, sonno: niente gonfiore vero, la rigidità dura pochi minuti, niente febbre, niente dita che cambiano colore, dormi male. Se propongono ANA, ENA e risonanza li pretendi. Se ti visitano le articolazioni, ti dicono che gli esami di infiammazione bastano e ti parlano di sonno e movimento, resti delusa e poi chiedi cosa fare in concreto. Non nominare budget.",
    correctSolution:
      "Fibromialgia. Emocromo, VES, PCR e TSH, tutti senza infiammazione. Spiegazione della diagnosi, attività fisica e igiene del sonno. Non pannello ANA/ENA/FR/anti-CCP/ANCA. Non RM. Non metotrexato né prednisone.",
    goldStandardPath: [
      "anamnesi-dolore-diffuso",
      "emocromo",
      "ves",
      "pcr-pct",
      "tiroide",
      "azione-spiegazione",
      "azione-followup-funzione",
    ],
    goldPathNarrative:
      "1) Anamnesi: dolore diffuso, sonno non ristoratore, nessuna sinovite. 2) Primo livello: emocromo 4,80, VES 3,50, PCR 28, TSH 22 euro. Totale di laboratorio circa 58 euro, dentro un budget di 80. 3) Non si aggiungono ANA 12, ENA 25, FR 8, anti-CCP 15, ANCA 20 né RM 220. 4) Si nomina la fibromialgia e si avvia un piano di movimento e sonno, non un immunosoppressore. 5) Follow-up sulla funzione, non sulla ripetizione degli anticorpi.",
    examLatencies: {
      "anamnesi-dolore-diffuso": 10,
      emocromo: 240,
      ves: 120,
      "pcr-pct": 240,
      tiroide: 1440,
      "azione-spiegazione": 8,
      "azione-followup-funzione": 10,
      ana: 4320,
      ena: 4320,
      fr: 1440,
      "anti-ccp": 4320,
      anca: 4320,
      rm: 2880,
    },
    anamnesisQuestions: [
      q("aq-sinovite", "Le articolazioni si gonfiano davvero, o il dolore è nei muscoli?", ["gonfiore", "muscoli"], "Senza sinovite il pannello autoimmune non è il primo passo."),
      q("aq-sonno", "Il sonno la ristora, e da quanti mesi è così?", ["sonno", "mesi"], "Sonno non ristoratore e cronicità sostengono la fibromialgia."),
      q("aq-redflag", "Ha febbre, calo di peso, dita che diventano bianche o debolezza vera?", ["febbre", "debolezza"], "Questi segni sposterebbero verso connettivite o miopatia, e qui non ci sono."),
    ],
    physicalSummary:
      "Dolore alla digitopressione in più sedi, articolazioni fredde e senza versamento, forza conservata. Non rush, non Raynaud in visita, non tumefazione. L'obiettività esclude la sinovite.",
    citations: [
      { chunkId: "reuma-003-clinica", source: "Sintesi operativa — fibromialgia, diagnosi clinica", quote: "Il dolore diffuso cronico senza sinovite e con indici di flogosi normali si nomina e si tratta senza un pannello autoanticorpale esteso e senza immunosoppressori." },
      { chunkId: "reuma-003-costi", source: "Tariffe didattiche REUMA-003 — laboratorio minimo circa 58 €, RM 220 €", quote: "Emocromo, VES, PCR e TSH stanno nel budget di 80 euro. ANA, ENA e la RM lo superano senza cambiare la diagnosi." },
    ],
    indicators: [
      "Sinovite cercata e non trovata prima degli autoanticorpi.",
      "Laboratorio limitato a emocromo, VES, PCR e TSH.",
      "Nessun DMARD e nessuno steroide sistemico.",
      "Spesa entro 80 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano l'assenza di sinovite, gli indici normali e il rifiuto motivato del pannello esteso e della RM.",
    legalCriteria: [
      "Diagnosi detta al paziente, non un rinvio indefinito di esami.",
      "Nessun metotrexato né prednisone per un dolore non infiammatorio.",
      "ANA a basso titolo pregresso non usato per aprire un pannello ENA.",
    ],
    mandatoryExams: [
      { examId: "emocromo", name: "Emocromo", finding: "Emocromo normale. Costo 4,80 euro. Nessuna anemia o leucopenia da connettivite.", isAbnormal: false, priceEuro: 4.8 },
      { examId: "ves", name: "VES", finding: "VES 12 mm/h. Costo 3,50 euro. Non c'è flogosi.", isAbnormal: false, priceEuro: 3.5 },
      { examId: "pcr-pct", name: "PCR", finding: "PCR 0,2 mg/dL. Costo 28 euro. Normale.", isAbnormal: false, priceEuro: 28 },
      { examId: "tiroide", name: "TSH", finding: "TSH 2,1 µUI/mL. Costo 22 euro. La stanchezza non è un ipotiroidismo.", isAbnormal: false, priceEuro: 22 },
    ],
    inappropriateExams: [
      { examId: "ana", name: "ANA", finding: "ANA 1:80, titolo basso, senza specificità. Costo 12 euro. Non autorizza ENA né una diagnosi di lupus.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA non indicati in assenza di segni di connettivite." },
      { examId: "ena", name: "ENA", finding: "ENA negativo. Costo 25 euro.", isAbnormal: false, priceEuro: 25, wasteRationale: "ENA a cascata dopo un ANA non indicato." },
      { examId: "fr", name: "FR", finding: "FR negativo. Costo 8 euro.", isAbnormal: false, priceEuro: 8, wasteRationale: "FR senza artrite." },
      { examId: "anti-ccp", name: "Anti-CCP", finding: "Anti-CCP negativo. Costo 15 euro.", isAbnormal: false, priceEuro: 15, wasteRationale: "Anti-CCP senza sinovite." },
      { examId: "rm", name: "RM", finding: "RM senza lesioni infiammatorie. Costo 220 euro, molto sopra il budget di 80.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM total body o articolare non indicata nella fibromialgia." },
    ],
    budget: 80,
    name: "Elena Greco",
    age: 41,
    sex: "F",
    context: "Ambulatorio. Dolore diffuso cronico senza sinovite.",
    vitals: { heartRate: 82, bloodPressure: "118/74", spo2: 99, temperature: 36.5, respiratoryRate: 14 },
    signs: [
      { signName: "Sinovite", result: "Nessuna articolazione tumefatta.", isPositive: false },
      { signName: "Dolore diffuso alla pressione", result: "Più sedi dolenti, forza conservata.", isPositive: true },
    ],
    literacy: "CYBERCHONDRIA_AI",
    emotion: "DEFENSIVE",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "HIGH",
    support: "LIMITED",
    communicationStyle: "Ha già una lista di esami presa da internet. Si irrigidisce se le si dice che non serve il pannello, e si apre se le si visita davvero e le si dà un piano concreto su sonno e movimento.",
    steps: [
      { phase: "anamnesi", title: "Dolore diffuso o artrite", prompt: "Come distingui questo dolore da un'artrite?", cost: 0, score: 15, correctLabel: "Cercare sinovite, rigidità lunga, febbre, Raynaud e qualità del sonno", wrongs: [{ label: "Aprire subito ANA, ENA e una RM perché lo chiede la paziente", next: "res-pioggia" }] },
      { phase: "diagnostica", title: "Laboratorio minimo", prompt: "Quali esami bastano?", cost: 58.3, score: 20, correctLabel: "Emocromo, VES, PCR e TSH", wrongs: [{ label: "FR, anti-CCP, ANA, ENA e ANCA insieme", next: "res-pioggia" }] },
      { phase: "screening", title: "Non trasformarla in una connettivite", prompt: "L'ANA 1:80 fatto altrove cosa impone?", cost: 0, score: 20, correctLabel: "Niente ENA: il titolo basso senza segni clinici non si insegue", wrongs: [{ label: "Completare ENA, anti-DNA e una visita genetica", next: "res-pioggia" }] },
      { phase: "terapia", title: "Niente immunosoppressore", prompt: "Cosa prescrivi?", cost: 0, score: 25, correctLabel: "Spiegare la fibromialgia, movimento e igiene del sonno. Nessun metotrexato", wrongs: [{ label: "Prednisone 25 mg e metotrexato per «spegnere l'infiammazione»", next: "res-farmaci" }] },
      { phase: "follow-up", title: "Controllo sulla funzione", prompt: "Cosa ricontrolli fra due mesi?", cost: 0, score: 20, correctLabel: "Sonno, attività e dolore. Non si ripetono gli autoanticorpi", wrongs: [{ label: "Ripetere ANA ed ENA anche se negativi", next: "res-pioggia" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Fibromialgia detta e contenuta", prompt: "Diagnosi clinica, laboratorio minimo normale, nessun DMARD. Il budget di 80 euro regge.", cost: 58.3, score: 100 },
      { id: "res-pioggia", outcome: "negative", trap: "economico", title: "Eccesso diagnostico", prompt: "ANA, ENA, FR, anti-CCP, ANCA e RM costano 300 euro e non curano il dolore. È medicina difensiva.", cost: 300, score: 0 },
      { id: "res-farmaci", outcome: "negative", trap: "medico-legale", title: "Iper-medicalizzazione", prompt: "Prednisone e metotrexato su una fibromialgia espongono a infezione, epatotossicità e dipendenza dallo steroide senza un'infiammazione da trattare.", cost: 17, score: 0 },
    ],
  },
  {
    n: 4,
    title: "Lupus eritematoso sistemico",
    description:
      "Chiara Romano, 29 anni, ha rash malare, fotosensibilità, aftosi e artralgie da due mesi, con urine schiumose. Il percorso è ANA e poi anti-DNA e complemento, lo stick urinario, e l'idrossiclorochina con una contraccezione esplicita prima di qualunque immunosoppressore teratogeno. Il test genetico esteso è la trappola economica.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "LES: ANA, anti-DNA, complemento; contraccezione prima dell'immunosoppressore",
    guidelineRef: "LES — idrossiclorochina, contraccezione prima di MTX o micofenolato, no NGS",
    diagnosis:
      "Lupus eritematoso sistemico con impegno cutaneo e sospetto renale lieve. Idrossiclorochina e contraccezione. Non un pannello genetico.",
    pastMedicalHistory:
      "Nessuna malattia nota. Fuma cinque sigarette. Non è incinta, ha rapporti non protetti. Non assume farmaci. Una fotosensibilità ogni estate, quest'anno anche afta e gonfiore delle dita. Nessuna trombosi. Famiglia senza lupus noto. Allergie: nessuna.",
    presentation:
      "Ha il rash sulle guance che risparmia il solco naso-labiale, e lo copre con il fondotinta. Se le si propone un test del DNA «completo» accetta perché ha paura di una malattia genetica. Se le si parla di gravidanza e di farmaci che non si possono prendere in gravidanza, si irrigidisce e poi ascolta.",
    redHerrings: [
      "Chiede un test genetico perché un sito ha parlato di lupus ereditario.",
      "Le artralgie senza erosioni fanno pensare a una fibromialgia e si chiude il caso.",
      "La pressione è solo un po' alta e le urine schiumose vengono rimandate.",
    ],
    timeLimitMinutes: 55,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Chiara Romano, 29 anni, ambulatorio. Registro: allarmata, frasi medie, torni al viso. Alla «Come sta?»: «Ho la farfalla sulla faccia. E la pipì fa schiuma.» Non dire tu che è lupus finché non te lo spiegano. Se chiedono sole, afte, articolazioni, gravidanza, trombosi: il sole peggiora il viso, afte sì, dita gonfie, non sei incinta ma non usi precauzioni, niente trombosi. Se propongono un test genetico da mille euro dici «fatelo, voglio sapere». Se ti prescrivono l'idrossiclorochina e ti chiedono una contraccezione prima di altri farmaci, accetti se ti spiegano il rischio sul feto. Non nominare budget.",
    correctSolution:
      "LES. ANA, anti-DNA, C3/C4, urine e creatinina, beta-HCG. Idrossiclorochina 200 mg. Contraccezione documentata prima di metotrexato o micofenolato, che qui non sono il primo farmaco. Non NGS. Follow-up di proteinurìa e complemento.",
    goldStandardPath: [
      "anamnesi-lupus",
      "ana",
      "anti-dna",
      "c3-c4",
      "urine-sed",
      "beta-hcg",
      "azione-idrossiclorochina",
      "azione-contraccezione",
      "azione-followup-renale",
    ],
    goldPathNarrative:
      "1) Anamnesi: rash, sole, afte, artralgie, schiuma urinaria, rapporti non protetti. 2) ANA 12 euro, poi anti-DNA 15, complemento 14, urine 6, creatinina 4,50. 3) Beta-HCG 15 euro prima di qualunque farmaco teratogeno. 4) Idrossiclorochina 8 euro e contraccezione scritta. Non metotrexato. Non NGS da 1200 euro. 5) Follow-up di proteinuria e complemento, non un secondo test genetico.",
    examLatencies: {
      "anamnesi-lupus": 10,
      ana: 4320,
      "anti-dna": 4320,
      "c3-c4": 1440,
      "urine-sed": 60,
      "beta-hcg": 120,
      "azione-idrossiclorochina": 8,
      "azione-contraccezione": 8,
      "azione-followup-renale": 12,
      "ngs-panel": 7200,
      rm: 2880,
    },
    anamnesisQuestions: [
      q("aq-rash", "Il rossore peggiora al sole, e ha afte o gonfiore delle dita?", ["sole", "afte"], "Fotosensibilità e aftosi sono criteri clinici, non un pretesto per un test genetico."),
      q("aq-rene", "Le urine sono schiumose, e la pressione è stata misurata?", ["urine", "pressione"], "La schiuma urinaria è un possibile impegno renale e non si rimanda."),
      q("aq-gravidanza", "Potrebbe essere incinta, e usa un contraccettivo?", ["incinta", "contraccettivo"], "Senza questa domanda un immunosoppressore diventa un danno sul feto."),
    ],
    physicalSummary:
      "Eritema malare che risparmia il solco naso-labiale, due afte orali, sinovite lieve delle dita senza deformità. Non edema declive. Pressione 138/88. Il quadro è da lupus, non da sola fotosensibilità benigna.",
    citations: [
      { chunkId: "reuma-004-hcq", source: "Sintesi operativa — lupus, idrossiclorochina e contraccezione", quote: "L'idrossiclorochina è il farmaco di fondo. Metotrexato e micofenolato richiedono una gravidanza esclusa e una contraccezione, e non sono il primo passo cutaneo-articolare." },
      { chunkId: "reuma-004-ngs", source: "Tariffe didattiche REUMA-004 — NGS 1200 € contro un budget di 120 €", quote: "ANA, anti-DNA, complemento, urine e beta-HCG stanno nel budget. Un pannello genetico NGS da 1200 euro non diagnostica il lupus di questa visita." },
    ],
    indicators: [
      "ANA seguito da anti-DNA e complemento, non da un NGS.",
      "Urine e creatinina eseguite per la schiuma.",
      "Beta-HCG e contraccezione prima di qualunque teratogeno.",
      "Idrossiclorochina avviata. Spesa entro 120 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano i criteri clinici, gli esami mirati, il beta-HCG e la contraccezione discussa prima di un immunosoppressore.",
    legalCriteria: [
      "Nessun metotrexato né micofenolato senza beta-HCG e senza contraccezione.",
      "Proteinuria non rimandata.",
      "NGS non proposto come esame diagnostico del lupus.",
    ],
    mandatoryExams: [
      { examId: "ana", name: "ANA", finding: "ANA positivi, titolo 1:320, pattern omogeneo. Costo 12 euro. È il test di ingresso, non l'NGS.", isAbnormal: true, priceEuro: 12 },
      { examId: "anti-dna", name: "Anti-DNA", finding: "Anti-DNA nativo positivo. Costo 15 euro. Specifico per il lupus in questo contesto.", isAbnormal: true, priceEuro: 15 },
      { examId: "c3-c4", name: "Complemento", finding: "C3 62 mg/dL, C4 8 mg/dL, entrambi bassi. Costo 14 euro. Attività di malattia.", isAbnormal: true, priceEuro: 14 },
      { examId: "urine-sed", name: "Urine", finding: "Proteine 1+, emazie 10 per campo, nessun batterio. Costo 6 euro. Impegno renale da non ignorare.", isAbnormal: true, priceEuro: 6 },
      { examId: "beta-hcg", name: "Beta-HCG", finding: "Negativo. Costo 15 euro. Va documentato prima di parlare di immunosoppressori teratogeni.", isAbnormal: false, priceEuro: 15 },
    ],
    inappropriateExams: [
      { examId: "ngs-panel", name: "Pannello genetico NGS", finding: "Nessuna variante che spieghi il rash. Costo 1200 euro. Non è il test del lupus.", isAbnormal: false, priceEuro: 1200, wasteRationale: "NGS da 1200 euro, dieci volte il budget, senza indicazione." },
      { examId: "rm", name: "RM", finding: "RM encefalo non indicata: nessun deficit neurologico. Costo 220 euro.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM difensiva in assenza di segni neurologici." },
    ],
    budget: 120,
    name: "Chiara Romano",
    age: 29,
    sex: "F",
    context: "Ambulatorio. Rash malare, afte e urine schiumose.",
    vitals: { heartRate: 96, bloodPressure: "138/88", spo2: 98, temperature: 37.4, respiratoryRate: 16 },
    signs: [
      { signName: "Rash malare", result: "Eritema a farfalla che risparmia il solco naso-labiale.", isPositive: true },
      { signName: "Deficit neurologico", result: "Nessun deficit focale. La RM encefalo non ha un bersaglio.", isPositive: false },
    ],
    literacy: "HIGH",
    emotion: "ANXIOUS",
    adherence: "PARTIAL",
    sleep: "FAIR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Colta e spaventata dal viso. Chiede il test genetico. Accetta l'idrossiclorochina se le si collega il rash agli esami mirati e se la contraccezione è spiegata come tutela, non come divieto.",
    steps: [
      { phase: "anamnesi", title: "Criteri clinici", prompt: "Cosa raccogli prima degli esami?", cost: 0, score: 15, correctLabel: "Rash, sole, afte, articolazioni, urine e possibilità di gravidanza", wrongs: [{ label: "Saltare al test genetico che ha letto online", next: "res-ngs" }] },
      { phase: "diagnostica", title: "Sierologia mirata", prompt: "Quale sequenza di laboratorio?", cost: 51.5, score: 20, correctLabel: "ANA, e se positivo anti-DNA, complemento, urine e creatinina", wrongs: [{ label: "NGS e RM encefalo come primo livello", next: "res-ngs" }] },
      { phase: "screening", title: "Gravidanza e contraccezione", prompt: "Prima di un immunosoppressore, cosa documenti?", cost: 15, score: 20, correctLabel: "Beta-HCG negativo e un metodo contraccettivo scritto in cartella", wrongs: [{ label: "Metotrexato oggi: la contraccezione si discute al controllo", next: "res-contraccezione" }] },
      { phase: "terapia", title: "Farmaco di fondo", prompt: "Cosa avvii adesso?", cost: 8, score: 25, correctLabel: "Idrossiclorochina 200 mg. Non metotrexato di prima linea", wrongs: [{ label: "Micofenolato subito, senza nefrologo e senza contraccezione", next: "res-contraccezione" }] },
      { phase: "follow-up", title: "Rene nel tempo", prompt: "Cosa ricontrolli?", cost: 20, score: 20, correctLabel: "Proteinuria, complemento e pressione entro poche settimane", wrongs: [{ label: "Ripetere l'NGS e non le urine", next: "res-ngs" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Lupus inquadrato e coperto", prompt: "Sierologia mirata, urine viste, idrossiclorochina avviata, contraccezione documentata. Nessun NGS.", cost: 94.5, score: 100 },
      { id: "res-contraccezione", outcome: "negative", trap: "medico-legale", title: "Immunosoppressore senza contraccezione", prompt: "Metotrexato o micofenolato in una donna senza contraccezione e senza beta-HCG. Il rischio teratogeno è il danno legale.", cost: 12.5, score: 0 },
      { id: "res-ngs", outcome: "negative", trap: "economico", title: "Test genetico inutile", prompt: "Il pannello NGS costa 1200 euro contro un budget di 120. Non diagnostica questo lupus e ritarda anti-DNA e urine.", cost: 1200, score: 0 },
    ],
  },
  {
    n: 5,
    title: "Arterite di Horton",
    description:
      "Giuseppe Conti, 74 anni, ha da dieci giorni una cefalea temporale nuova, claudicatio masticatoria e dolore al cingolo. La vista è ancora integra, la VES è alta. Lo steroide ad alto dosaggio parte subito. Attendere la biopsia, o fermarsi su un eco-Doppler, è la trappola che porta alla cecità.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "PRONTO_SOCCORSO",
    condition: "Arterite a cellule giganti: steroide immediato, biopsia dopo, non eco che ritarda",
    guidelineRef: "Arterite di Horton — prednisone subito, biopsia senza ritardare lo steroide",
    diagnosis:
      "Arterite di Horton a rischio visivo. Prednisone ad alto dosaggio ora. La biopsia dell'arteria temporale si programma dopo, non prima.",
    pastMedicalHistory:
      "Ipertensione in amlodipina. Glaucoma dubbio mai studiato. Non diabetico. Da un mese dolore alle spalle attribuito all'età. Nessuna perdita visiva ancora, ma da stamattina vede «come attraverso un velo» a sinistra per pochi secondi. Allergie: nessuna. Vive con la moglie.",
    presentation:
      "Si tocca la tempia sinistra, che è dolente. Se gli si dice che serve prima l'istologico, si siede ad aspettare. Se gli si dà il prednisone spiegando il rischio sulla vista, accetta anche se teme il cortisone. Non ha un deficit neurologico da TC.",
    redHerrings: [
      "Il glaucoma noto fa rimandare tutto all'oculista di martedì.",
      "Un eco-Doppler delle temporali «per essere sicuri» occupa il pomeriggio.",
      "La cefalea sembra tensiva perché non vomita.",
    ],
    timeLimitMinutes: 35,
    patientDeteriorationThreshold: 15,
    patientPrompt:
      "ROLEPLAY. Sei Giuseppe Conti, 74 anni, pronto soccorso. Registro: spaventato, frasi lente. Alla «Come sta?»: «La tempia batte. E a sinistra ho visto un velo.» [si tocca la tempia] Non dire tu arterite o Horton. Se chiedono masticazione, spalle, da quanto, vista: fa male masticare la carne da una settimana, le spalle sono rigide da un mese, il velo è stato un attimo stamattina, la vista adesso c'è. Se ti dicono di aspettare una biopsia o un'ecografia prima della compressa, aspetti in silenzio. Se ti danno il cortisone subito e ti spiegano la vista, lo prendi. Non nominare budget.",
    correctSolution:
      "Arterite di Horton. VES e PCR, poi prednisone 60 mg subito, senza attendere la biopsia. La biopsia si prenota entro pochi giorni, sotto steroide. Non un eco-Doppler come pretesto per ritardare. Protezione gastrica e controllo della vista. Follow-up ravvicinato dello svezzamento.",
    goldStandardPath: [
      "anamnesi-cefalea-temporale",
      "ves",
      "pcr-pct",
      "azione-prednisone-immediato",
      "azione-biopsia-dopo",
      "azione-followup-vista",
    ],
    goldPathNarrative:
      "1) Anamnesi: età, cefalea nuova, claudicatio masticatoria, velo visivo, dolore al cingolo. 2) VES 3,50 euro e PCR 28 euro, alte, mentre si prepara lo steroide. 3) Non si attende l'eco-Doppler da 65 euro né la biopsia da 180. 4) Prednisone 60 mg, 4,50 euro a confezione didattica, subito. 5) Biopsia nei giorni successivi, già in steroide, e controllo della vista. Aspettare l'istologico è la strada della cecità.",
    examLatencies: {
      "anamnesi-cefalea-temporale": 5,
      ves: 60,
      "pcr-pct": 60,
      "azione-prednisone-immediato": 5,
      "azione-biopsia-dopo": 15,
      "azione-followup-vista": 10,
      ecocolordoppler: 180,
      biopsia: 1440,
      rm: 2880,
    },
    anamnesisQuestions: [
      q("aq-masticazione", "Masticare fa male alla mandibola, e la cefalea è nuova?", ["masticare", "cefalea"], "Claudicatio masticatoria e cefalea nuova nell'anziano sono Horton finché non si dimostra il contrario."),
      q("aq-vista", "Ha avuto un velo, una perdita di campo, o vede doppio?", ["velo", "vista"], "Qualunque sintomo visivo rende lo steroide immediato, non differibile."),
      q("aq-cingolo", "Le spalle e i fianchi sono rigidi al mattino?", ["spalle", "rigidi"], "Il dolore del cingolo è la polimialgia che spesso accompagna l'arterite."),
    ],
    physicalSummary:
      "Arteria temporale sinistra dolente e poco pulsatile. Spalle rigide, non deficit di forza. Acuità riferita integra in questo momento, con amaurosis fugace stamattina. Non segni meningei. Il cortisone non si può rimandare a un referto.",
    citations: [
      { chunkId: "reuma-005-steroide", source: "Sintesi operativa — arterite a cellule giganti", quote: "Se il sospetto è alto, soprattutto con sintomi visivi, il glucocorticoide ad alto dosaggio parte subito. La biopsia dell'arteria temporale non è un pretesto per aspettare." },
      { chunkId: "reuma-005-eco", source: "Tariffe didattiche REUMA-005 — eco-Doppler 65 €, biopsia 180 €", quote: "L'eco-Doppler non è il gradino che autorizza lo steroide. Farlo prima della prima dose consuma il tempo in cui la vista si perde." },
    ],
    indicators: [
      "Sintomi visivi e claudicatio masticatoria raccolti subito.",
      "Prednisone ad alto dosaggio prima della biopsia.",
      "Eco-Doppler non usato per ritardare la terapia.",
      "Follow-up della vista programmato.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano i sintomi cranici, l'ora della prima dose di steroide e il motivo per cui la biopsia è successiva, non precedente.",
    legalCriteria: [
      "Prima dose di prednisone non subordinata al referto bioptico.",
      "Sintomo visivo scritto, non liquidato come glaucoma.",
      "Eco-Doppler non anteposto alla terapia.",
    ],
    mandatoryExams: [
      { examId: "ves", name: "VES", finding: "VES 92 mm/h. Costo 3,50 euro. Alta, coerente. Non si attende questo numero per dare lo steroide se i sintomi visivi ci sono già.", isAbnormal: true, priceEuro: 3.5 },
      { examId: "pcr-pct", name: "PCR", finding: "PCR 8 mg/dL. Costo 28 euro. Alta. Conferma, non ritarda.", isAbnormal: true, priceEuro: 28 },
    ],
    inappropriateExams: [
      { examId: "ecocolordoppler", name: "Eco-Doppler delle temporali prima della terapia", finding: "Alone ipoecogeno possibile, referto nel pomeriggio. Costo 65 euro. Nel frattempo lo steroide non è partito.", isAbnormal: true, priceEuro: 65, wasteRationale: "Eco-Doppler usato come pretesto per non iniziare il prednisone: spreco di tempo e di 65 euro." },
      { examId: "rm", name: "RM encefalo", finding: "RM encefalo senza lesioni acute. Costo 220 euro. Non vede l'arterite temporale e fa scadere le ore utili.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM encefalo non diagnostica l'arterite di Horton e ritarda lo steroide." },
    ],
    budget: 50,
    name: "Giuseppe Conti",
    age: 74,
    sex: "M",
    context: "Pronto soccorso. Cefalea temporale nuova e amaurosis fugace.",
    vitals: { heartRate: 88, bloodPressure: "150/84", spo2: 97, temperature: 37.8, respiratoryRate: 16 },
    signs: [
      { signName: "Arteria temporale dolente", result: "Tempia sinistra dolente, polso temporale ridotto.", isPositive: true },
      { signName: "Deficit motorio", result: "Nessuna emiparesi. Non è un ictus da trombolisi.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "POOR",
    stress: "HIGH",
    support: "STRONG",
    communicationStyle: "Obbedisce a chi gli dice di aspettare un esame. Prende il cortisone se gli si nomina la vista con parole semplici, non se gli si promette un'ecografia.",
    steps: [
      { phase: "anamnesi", title: "Sintomi cranici", prompt: "Cosa chiedi nei primi minuti?", cost: 0, score: 15, correctLabel: "Cefalea nuova, claudicatio masticatoria, vista e dolore al cingolo", wrongs: [{ label: "Liquidarla come cefalea tensiva e dimetterlo", next: "res-cecita" }] },
      { phase: "diagnostica", title: "Indici, non imaging che ritarda", prompt: "Cosa chiedi mentre prepari la terapia?", cost: 31.5, score: 20, correctLabel: "VES e PCR, senza aspettare il referto per decidere", wrongs: [{ label: "Eco-Doppler delle temporali prima di ogni farmaco", next: "res-eco" }] },
      { phase: "screening", title: "Rischio visivo", prompt: "Il velo di stamattina cosa cambia?", cost: 0, score: 20, correctLabel: "Rende lo steroide immediato. Si annotano anche glicemia e pressione, senza ritardare", wrongs: [{ label: "Prenotare la biopsia e iniziare il cortisone solo se è positiva", next: "res-cecita" }] },
      { phase: "terapia", title: "Prednisone ora", prompt: "Quale dose e quando?", cost: 4.5, score: 25, correctLabel: "Prednisone 40-60 mg subito, gastroprotezione, poi biopsia entro pochi giorni", wrongs: [{ label: "FANS e controllo oculistico fra una settimana", next: "res-cecita" }] },
      { phase: "follow-up", title: "Vista e svezzamento", prompt: "Cosa controlli dopo la prima dose?", cost: 0, score: 20, correctLabel: "Vista a breve, poi svezzamento guidato dai sintomi e dagli indici", wrongs: [{ label: "Stop dello steroide dopo tre giorni perché la cefalea è passata", next: "res-cecita" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Steroide partito in tempo", prompt: "Prednisone ad alto dosaggio subito, biopsia dopo, vista sorvegliata. L'eco-Doppler non ha ritardato la prima dose.", cost: 36, score: 100 },
      { id: "res-cecita", outcome: "negative", trap: "medico-legale", title: "Cecità da attesa", prompt: "La biopsia o l'oculista arrivano dopo la neuropatia ottica ischemica. La vista non torna. L'attesa dello steroide è il danno permanente.", cost: 180, score: 0 },
      { id: "res-eco", outcome: "negative", trap: "economico", title: "Eco-Doppler che ritarda la cura", prompt: "L'eco-Doppler costa 65 euro e supera il budget di 50 se si somma agli indici già chiesti per decidere. Soprattutto occupa le ore in cui andava dato il prednisone.", cost: 65, score: 0 },
    ],
  },
  {
    n: 6,
    title: "Gotta, attacco acuto",
    description:
      "Paolo Ricci, 58 anni, si presenta con il primo dito del piede destro caldo e rosso da una notte. Ha già avuto due episodi identici. L'uricemia in acuto può essere normale e non si inizia l'allopurinolo durante l'attacco. Il percorso è la diagnosi clinica, la colchicina e, a fiamma spenta, il controllo dell'uricemia. La RM e l'allopurinolo immediato sono le trappole.",
    difficulty: "EASY",
    matrixDifficulty: "BASE",
    frequencyCategory: "HIGH",
    setting: "PRONTO_SOCCORSO",
    condition: "Attacco gottoso: colchicina in acuto, allopurinolo solo a fiamma spenta",
    guidelineRef: "Gotta acuta — colchicina o FANS, non allopurinolo nell'attacco, non RM",
    diagnosis:
      "Artrite gottosa acuta della prima metatarso-falangea. Colchicina ora. Allopurinolo non in acuto. RM non diagnostica.",
    pastMedicalHistory:
      "Ipertensione in idroclorotiazide. Beve birra la sera. Due episodi identici all'alluce, passati in una settimana con un antinfiammatorio. Uricemia l'anno scorso 8,2 mg/dL, mai trattato. Creatinina nota normale. Nessuna gotta tofacea. Allergie: nessuna. Non ha febbre alta, non ha ferite.",
    presentation:
      "Non mette la scarpa. L'alluce è lucido e non sopporta il lenzuolo. Se gli si propone una risonanza «per vedere l'osso» accetta. Se gli si dà l'allopurinolo subito, lo prende convinto di curare la causa. La colchicina lo convince se gli si dice che l'attacco si spegne prima e che l'uricemia si sistema dopo.",
    redHerrings: [
      "L'uricemia di oggi, se dosata, è 6,4 e sembra escludere la gotta.",
      "Il tiazidico viene sospeso e si crede di aver curato l'attacco.",
      "Chiede una RM perché teme una frattura da sforzo.",
    ],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Paolo Ricci, 58 anni, pronto soccorso, alluce destro che non tocchi. Registro: irritato, frasi secche. Alla «Come sta?»: «È un tizzone. Non ci entra la scarpa.» Non dire tu che è gotta finché non la nominano. Se chiedono episodi precedenti, birra, diuretico, febbre, trauma: è già successo due volte, bevi birra, prendi una pastiglia per la pressione, niente febbre alta, niente trauma. Se ti danno l'allopurinolo subito dici «finalmente la cura». Se ti danno la colchicina e ti spiegano che l'altra pastiglia si inizia a dolore finito, accetti. Se propongono la risonanza dici «fate, ho paura sia rotto». Non nominare budget.",
    correctSolution:
      "Gotta acuta. Diagnosi clinica sulla podagra recidivante. Colchicina 1 mg. Non allopurinolo durante l'attacco. Non RM. Uricemia e decisione ipouricemizzante a fiamma spenta, con il tiazidico rivalutato.",
    goldStandardPath: [
      "anamnesi-podagra",
      "uricemia",
      "azione-colchicina",
      "azione-non-allopurinolo",
      "azione-followup-uricemia",
    ],
    goldPathNarrative:
      "1) Anamnesi: podagra recidivante, birra, tiazidico, niente febbre settica. 2) Uricemia 3 euro, che in acuto può essere normale e non esclude la diagnosi. Non la RM da 220 euro. 3) Non serve uno screening autoimmune. 4) Colchicina 3,50 euro. L'allopurinolo da 5 euro non si inizia oggi. 5) Follow-up a fiamma spenta per l'uricemia e per togliere il diuretico se possibile.",
    examLatencies: {
      "anamnesi-podagra": 6,
      uricemia: 60,
      "azione-colchicina": 8,
      "azione-non-allopurinolo": 4,
      "azione-followup-uricemia": 8,
      rm: 2880,
      artrocentesi: 40,
      ana: 4320,
    },
    anamnesisQuestions: [
      q("aq-episodi", "È già successo a questo alluce, e quanto è durato?", ["già", "alluce"], "La podagra recidivante è clinica. Non le serve una RM."),
      q("aq-farmaci", "Assume un diuretico, e quanto alcol beve?", ["diuretico", "birra"], "Il tiazidico e la birra sono i fattori scatenanti, da toccare a fiamma spenta."),
      q("aq-settica", "Ha febbre alta, una ferita, o un ginocchio bollente insieme?", ["febbre", "ferita"], "Senza segni settici non si apre un percorso da artrite settica."),
    ],
    physicalSummary:
      "Prima metatarso-falangea destra eritematosa, lucida, dolente al minimo tocco. Nessuna porta d'ingresso cutanea, nessuna febbre alta, le altre articolazioni fredde. È una podagra, non una frattura e non una sepsi.",
    citations: [
      { chunkId: "reuma-006-acuto", source: "Sintesi operativa — attacco gottoso acuto", quote: "Nell'attacco si usa colchicina, un FANS o uno steroide breve. L'allopurinolo non si inizia a fiamma accesa: può prolungare la crisi. Si avvia dopo, con copertura." },
      { chunkId: "reuma-006-rm", source: "Tariffe didattiche REUMA-006 — uricemia 3 €, RM 220 €, colchicina 3,50 €", quote: "La diagnosi di podagra recidivante non passa dalla RM. Duecentoventi euro non vedono meglio l'attacco di quanto faccia l'esame clinico." },
    ],
    indicators: [
      "Podagra riconosciuta senza RM.",
      "Colchicina in acuto.",
      "Allopurinolo non iniziato durante l'attacco.",
      "Uricemia interpretata senza usarla per escludere la gotta. Spesa entro 40 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano gli episodi precedenti, la scelta della colchicina e il rinvio esplicito dell'allopurinolo a fiamma spenta.",
    legalCriteria: [
      "Allopurinolo non consegnato in piena crisi.",
      "RM non richiesta per una podagra tipica.",
      "Segni settici cercati e assenti prima di chiudere come gotta.",
    ],
    mandatoryExams: [
      { examId: "uricemia", name: "Uricemia", finding: "Uricemia 6,4 mg/dL, nel range. In acuto non esclude la gotta. Costo 3 euro. L'anno scorso era 8,2.", isAbnormal: false, priceEuro: 3 },
      { examId: "creat-urea-gfr", name: "Creatinina", finding: "Creatinina 0,9 mg/dL. Costo 4,50 euro. Il rene consente la colchicina senza un pannello ulteriore.", isAbnormal: false, priceEuro: 4.5 },
    ],
    inappropriateExams: [
      { examId: "rm", name: "RM del piede", finding: "RM senza frattura, edema aspecifico. Costo 220 euro. Non diagnostica i cristalli e sfora il budget di 40.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM per diagnosticare una podagra: 220 euro, inutili." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro. Non c'è un sospetto di connettivite.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA in una podagra tipica." },
    ],
    budget: 40,
    name: "Paolo Ricci",
    age: 58,
    sex: "M",
    context: "Pronto soccorso. Podagra recidivante dell'alluce destro.",
    vitals: { heartRate: 90, bloodPressure: "142/86", spo2: 98, temperature: 37.6, respiratoryRate: 16 },
    signs: [
      { signName: "Podagra", result: "Prima metatarso-falangea calda, rossa, intollerante al tocco.", isPositive: true },
      { signName: "Porta d'ingresso settica", result: "Nessuna ferita né febbre alta.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "DEFENSIVE",
    adherence: "PARTIAL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Vuole la pastiglia che «scioglie l'acido urico» oggi. Accetta la colchicina se gli si dice che l'allopurinolo adesso allunga il fuoco e che si inizierà a dolore finito.",
    steps: [
      { phase: "anamnesi", title: "Podagra o altro", prompt: "Cosa rende clinica la diagnosi?", cost: 0, score: 15, correctLabel: "Episodi identici, birra, tiazidico, assenza di febbre settica", wrongs: [{ label: "RM del piede per escludere la frattura prima di curare", next: "res-rm" }] },
      { phase: "diagnostica", title: "Uricemia senza farsi ingannare", prompt: "L'uricemia di oggi è 6,4. Cosa ne fai?", cost: 3, score: 20, correctLabel: "Non escludi la gotta: in acuto l'uricemia può essere normale", wrongs: [{ label: "Escludere la gotta e chiedere ANA e una RM", next: "res-rm" }] },
      { phase: "screening", title: "Rene prima della colchicina", prompt: "Cosa verifichi in una riga, senza allargare gli esami?", cost: 4.5, score: 20, correctLabel: "Creatinina già nota normale: la colchicina si può usare. Nessun pannello", wrongs: [{ label: "Artrocentesi, ANA, ENA e RM prima di ogni compressa", next: "res-rm" }] },
      { phase: "terapia", title: "Acuto, non ipouricemizzante", prompt: "Cosa consegni oggi?", cost: 3.5, score: 25, correctLabel: "Colchicina per l'attacco. Allopurinolo rinviato a fiamma spenta", wrongs: [{ label: "Allopurinolo 300 mg da stamattina", next: "res-allo" }] },
      { phase: "follow-up", title: "A fiamma spenta", prompt: "Cosa programmi dopo?", cost: 5, score: 20, correctLabel: "Uricemia a crisi finita e solo allora valutare l'allopurinolo, sospendendo il tiazidico se si può", wrongs: [{ label: "Nessun follow-up: l'attacco passa da solo e basta", next: "res-allo" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Attacco trattato, urato dopo", prompt: "Colchicina in acuto, allopurinolo rinviato, nessuna RM. Il follow-up dell'uricemia è fissato.", cost: 16, score: 100 },
      { id: "res-allo", outcome: "negative", trap: "medico-legale", title: "Allopurinolo in piena crisi", prompt: "L'allopurinolo iniziato nell'attacco mobilita l'urato e prolunga l'artrite. Il paziente torna con un dolore peggiore e una cura sbagliata nel timing.", cost: 5, score: 0 },
      { id: "res-rm", outcome: "negative", trap: "economico", title: "RM per diagnosticare la gotta", prompt: "La RM del piede costa 220 euro contro un budget di 40. Non vede i cristalli e non cambia la colchicina.", cost: 220, score: 0 },
    ],
  },
  {
    n: 7,
    title: "Spondilite anchilosante",
    description:
      "Andrea Villa, 27 anni, ha da due anni un mal di schiena infiammatorio, risvegli notturni e una uveite l'anno scorso. Le radiografie mostrano già una sacroileite. Il percorso è un ciclo adeguato di due FANS prima di qualunque biologico, e il Quantiferon se e solo quando il biologico diventa indicato. Il biologico subito, con o senza screening per la tubercolosi, è la trappola.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Spondilite anchilosante: due FANS prima del biologico, Quantiferon se si scala",
    guidelineRef: "Spondiloartrite assiale — FANS a dose piena, biologico dopo fallimento e dopo IGRA",
    diagnosis:
      "Spondilite anchilosante radiografica. Due FANS a dose piena in sequenza. Adalimumab solo dopo il fallimento e dopo Quantiferon, epatite e RX torace.",
    pastMedicalHistory:
      "Uveite anteriore destra un anno fa, trattata dall'oculista. Non ha psoriasi, non ha diarrea ematica. Non fuma. Nessun contatto tubercolare noto, nessun viaggio recente. Ha preso ibuprofene «quando fa male», mai a dose piena per un mese. Allergie: nessuna. Lavora in magazzino e solleva pesi.",
    presentation:
      "Sta meglio dopo essersi mosso, peggio alle tre di notte. Se gli si offre l'iniezione biologica subito, la vuole per tornare al lavoro. Se gli si dice che prima servono due antinfiammatori presi davvero e, solo dopo, gli esami della tubercolosi, si spazientisce ma capisce.",
    redHerrings: [
      "Il lavoro da magazziniere fa chiamare il dolore una lombalgia meccanica.",
      "L'HLA non è ancora dosato e sembra obbligatorio prima di ogni cura.",
      "Una RM delle sacroiliache viene chiesta anche se la radiografia è già positiva.",
    ],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 40,
    patientPrompt:
      "ROLEPLAY. Sei Andrea Villa, 27 anni, ambulatorio. Registro: impaziente, frasi dirette. Alla «Come sta?»: «Di notte mi sveglio. Se cammino passa.» Non dire tu spondilite. Se chiedono notte, rigidità, uveite, diarrea, psoriasi, FANS già presi: ti svegli alle tre, la schiena è rigida un'ora, un occhio rosso l'anno scorso, niente diarrea, niente pelle, l'ibuprofene lo prendi a spot. Se ti propongono l'iniezione cara subito dici «sì, datemela». Se ti spiegano due antinfiammatori a dose piena e gli esami della tbc prima di ogni biologico, accetti a malincuore. Non nominare budget.",
    correctSolution:
      "Spondilite anchilosante. RX del bacino già diagnostica. Due FANS a dose piena, in sequenza, per alcune settimane. Fisioterapia. Adalimumab non ora. Se più avanti il biologico serve: Quantiferon, sierologia epatite e RX torace prima della prima siringa.",
    goldStandardPath: [
      "anamnesi-schiena-infiammatoria",
      "rx-ossa",
      "azione-fans-1",
      "azione-fans-2",
      "azione-followup-basdai",
    ],
    goldPathNarrative:
      "1) Anamnesi: dolore notturno, migliora col movimento, uveite, FANS mai a dose piena. 2) RX del bacino 30 euro: sacroileite già visibile. La RM da 220 euro non serve. 3) Non si apre il biologico: lo screening tubercolare si fa solo se si decide di scalarlo. 4) Primo FANS a dose piena, poi un secondo FANS diverso se il primo fallisce. 5) Follow-up con attività di malattia. L'adalimumab da 450 euro senza questi passi, e senza Quantiferon da 60 euro, è l'errore.",
    examLatencies: {
      "anamnesi-schiena-infiammatoria": 8,
      "rx-ossa": 40,
      "azione-fans-1": 6,
      "azione-fans-2": 6,
      "azione-followup-basdai": 10,
      quantiferon: 5760,
      rm: 2880,
      "hiv-hcv-hbv": 1440,
    },
    anamnesisQuestions: [
      q("aq-notte", "Il dolore la sveglia, e migliora se si alza?", ["notte", "movimento"], "Il ritmo infiammatorio distingue la spondilite dalla lombalgia del magazzino."),
      q("aq-uveite", "Ha avuto un occhio rosso e doloroso, psoriasi o diarrea con sangue?", ["occhio", "diarrea"], "L'uveite sostiene la spondiloartrite. IBD e psoriasi cambierebbero il farmaco più avanti."),
      q("aq-fans", "Quale antinfiammatorio ha preso, a che dose e per quanti giorni di fila?", ["ibuprofene", "dose"], "Senza due FANS a dose piena il biologico non è indicato."),
    ],
    physicalSummary:
      "Schober ridotto, dolore alle sacroiliache, espansione toracica un po' ridotta. Non deficit neurologico, non lasègue. L'obiettività è assiale, coerente con la radiografia, e non chiede una RM urgente.",
    citations: [
      { chunkId: "reuma-007-fans", source: "Sintesi operativa — spondiloartrite assiale e biologico", quote: "Il biologico si considera dopo il fallimento di almeno due FANS a dose piena. Non è la prima ricetta di un mal di schiena infiammatorio già radiografico." },
      { chunkId: "reuma-007-tb", source: "Tariffe didattiche REUMA-007 — Quantiferon 60 €, adalimumab 450 €", quote: "Prima di un anti-TNF servono IGRA o equivalente, sierologia epatite e imaging del torace. Saltarli espone a una tubercolosi da riattivazione. Saltare i FANS costa 450 euro senza indicazione." },
    ],
    indicators: [
      "Dolore infiammatorio e uveite raccolti.",
      "RX sufficiente, RM non ripetuta a sacroileite già visibile.",
      "Due FANS prima di ogni biologico.",
      "Nessun adalimumab senza Quantiferon.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano i FANS già falliti oppure il loro avvio corretto, e lo screening tubercolare se si prescrive un anti-TNF.",
    legalCriteria: [
      "Adalimumab non avviato senza fallimento di due FANS.",
      "Quantiferon non omesso se il biologico viene comunque scelto.",
      "RM non usata al posto di un FANS quando la RX è già positiva.",
    ],
    mandatoryExams: [
      { examId: "rx-ossa", name: "RX bacino", finding: "Sacroileite bilaterale di grado 2-3. Costo 30 euro. La diagnosi radiografica c'è: la RM non è il passo successivo.", isAbnormal: true, priceEuro: 30 },
      { examId: "ves", name: "VES", finding: "VES 28 mm/h, mossa poco. Costo 3,50 euro. Non sostituisce la clinica e non autorizza il biologico.", isAbnormal: true, priceEuro: 3.5 },
    ],
    inappropriateExams: [
      { examId: "rm", name: "RM delle sacroiliache", finding: "Edema midollare, informazione ridondante sulla RX già positiva. Costo 220 euro.", isAbnormal: true, priceEuro: 220, wasteRationale: "RM con sacroileite già radiografica: 220 euro che non cambiano l'avvio dei FANS." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro. Non c'è un sospetto di lupus.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA non indicati in una spondilite tipica." },
    ],
    budget: 80,
    name: "Andrea Villa",
    age: 27,
    sex: "M",
    context: "Ambulatorio. Lombalgia infiammatoria e uveite pregressa.",
    vitals: { heartRate: 72, bloodPressure: "120/70", spo2: 99, temperature: 36.6, respiratoryRate: 14 },
    signs: [
      { signName: "Sacroileite clinica", result: "Dolore alle sacroiliache e Schober ridotto.", isPositive: true },
      { signName: "Deficit neurologico radicolare", result: "Lasègue negativo, forza integra. Non è un'ernia da operare.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "OPPOSITIONAL",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Vuole l'iniezione per smettere di svegliarsi. Minimizza l'ibuprofene preso a caso. Collabora se i due FANS gli vengono presentati come la condizione per arrivare, dopo, al biologico in sicurezza.",
    steps: [
      { phase: "anamnesi", title: "Schiena infiammatoria", prompt: "Cosa deve emergere dal colloquio?", cost: 0, score: 15, correctLabel: "Dolore notturno, miglioramento col movimento, uveite, FANS mai a dose piena", wrongs: [{ label: "Chiamarla lombalgia da lavoro e chiudere senza terapia di fondo", next: "res-ritardo" }] },
      { phase: "diagnostica", title: "RX, non RM ridondante", prompt: "La radiografia mostra già la sacroileite. Cosa fai?", cost: 30, score: 20, correctLabel: "Ti fermi alla RX e non chiedi la RM", wrongs: [{ label: "RM delle sacroiliache subito, e nel frattempo nessun FANS", next: "res-rm" }] },
      { phase: "screening", title: "Lo screening solo se serve il biologico", prompt: "Quando chiedi il Quantiferon?", cost: 0, score: 20, correctLabel: "Non ora: prima i FANS. Il Quantiferon precede solo un'eventuale siringa", wrongs: [{ label: "Adalimumab oggi e Quantiferon il mese prossimo", next: "res-tb" }] },
      { phase: "terapia", title: "Due FANS", prompt: "Qual è la prima terapia?", cost: 6, score: 25, correctLabel: "Un FANS a dose piena, poi un secondo FANS se il primo fallisce. Nessun biologico", wrongs: [{ label: "Adalimumab 40 mg come prima ricetta", next: "res-biologico" }] },
      { phase: "follow-up", title: "Attività nel tempo", prompt: "Cosa rivaluti fra un mese?", cost: 0, score: 20, correctLabel: "Dolore notturno, rigidità e aderenza al FANS, prima di parlare di biologico", wrongs: [{ label: "Biologico comunque, perché un solo FANS a spot non è bastato", next: "res-biologico" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "FANS prima del biologico", prompt: "Spondilite radiografica, due FANS avviati in sequenza, biologico non anticipato. Lo screening tubercolare resta agganciato a una eventuale scala.", cost: 36, score: 100 },
      { id: "res-tb", outcome: "negative", trap: "medico-legale", title: "Biologico senza Quantiferon", prompt: "L'anti-TNF senza IGRA riattiva una tubercolosi latente. L'omissione dello screening è il danno evitabile.", cost: 450, score: 0 },
      { id: "res-biologico", outcome: "negative", trap: "economico", title: "Biologico senza due FANS", prompt: "Adalimumab 450 euro senza il fallimento di due FANS a dose piena. Non è indicato e sfora qualunque budget di questo caso.", cost: 450, score: 0 },
      { id: "res-rm", outcome: "negative", trap: "economico", title: "RM non necessaria", prompt: "Con la sacroileite già in radiografia la RM costa 220 euro e non sblocca la terapia.", cost: 220, score: 0 },
      { id: "res-ritardo", outcome: "negative", trap: "medico-legale", title: "Dolore infiammatorio non trattato", prompt: "Dimettere una schiena infiammatoria come usura da lavoro lascia progredire la rigidità. Il ritardo è in cartella.", cost: 0, score: 0 },
    ],
  },
  {
    n: 8,
    title: "Artrite psoriasica",
    description:
      "Sara Colombo, 36 anni, ha psoriasi del cuoio capelluto, una dattilite del terzo dito e un'artrite asimmetrica. Uno steroide sistemico le spegnerebbe la pelle per poi farla rimbalzare. Il percorso è la diagnosi clinica, un FANS con gastroprotezione e un csDMARD dopo lo screening, non il prednisone.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Artrite psoriasica: niente steroide sistemico, FANS con gastroprotezione",
    guidelineRef: "Artrite psoriasica — evitare lo steroide sistemico, gastroprotezione col FANS",
    diagnosis:
      "Artrite psoriasica con dattilite. FANS più inibitore di pompa. Metotrexato dopo screening. Non prednisone sistemico.",
    pastMedicalHistory:
      "Psoriasi del cuoio capelluto da dieci anni, trattata a fasi con lozioni. Epigastralgia da FANS l'anno scorso, una gastrite documentata. Non è incinta, usa un contraccettivo. Non beve. Transaminasi mai alterate. Nessuna epatite nota. Allergie: nessuna. Unghie con pitting, non se ne è mai accorta.",
    presentation:
      "Mostra il dito a salsicciotto e si scosta i capelli per far vedere le placche. Se le si offre il prednisone «per spegnere tutto» lo vuole. Se le si spiega il rimbalzo sulla pelle e le si dà un FANS con la protezione allo stomaco, accetta.",
    redHerrings: [
      "La dattilite sembra un ascesso e si apre un percorso solo antibiotico.",
      "Le placche sono lievi e vengono separate dall'artrite come se non c'entrassero.",
      "Chiede lo stesso steroide che una volta le schiarì la pelle in cinque giorni.",
    ],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Sara Colombo, 36 anni, ambulatorio. Registro: pratica, infastidita dal dito. Alla «Come sta?»: «Il dito è una salsiccia. E la testa mi gratta da anni.» Non dire tu artrite psoriasica. Se chiedono pelle, unghie, stomaco, gravidanza, altri FANS: placche in testa, unghie bucate, lo stomaco brucia con l'ibuprofene, prendi la pillola, non sei incinta. Se ti offrono il cortisone in compresse dici «sì, l'altra volta la pelle è sparita». Se ti spiegano il rimbalzo e ti danno un antinfiammatorio con la pastiglia per lo stomaco, accetti. Non nominare budget.",
    correctSolution:
      "Artrite psoriasica. Nessun prednisone sistemico. FANS con gastroprotezione per la gastrite. Screening e poi metotrexato se l'artrite resta. Follow-up di pelle e fegato. Non una RM.",
    goldStandardPath: [
      "anamnesi-dattilite",
      "rx-ossa",
      "azione-fans-gastroprotezione",
      "beta-hcg",
      "enzimi-epatici",
      "azione-metotrexato",
      "azione-followup-cute",
    ],
    goldPathNarrative:
      "1) Anamnesi: psoriasi, pitting, dattilite, gastrite da FANS, contraccezione già in corso. 2) RX delle mani 30 euro, senza RM. 3) Beta-HCG 15 euro e transaminasi 10 euro prima del metotrexato, anche se riferisce la pillola. 4) FANS più gastroprotezione, non prednisone 4,50 euro che fa rimbalzare la pelle. Poi metotrexato 12,50. 5) Follow-up di cute, dito e fegato.",
    examLatencies: {
      "anamnesi-dattilite": 8,
      "rx-ossa": 40,
      "azione-fans-gastroprotezione": 6,
      "beta-hcg": 120,
      "enzimi-epatici": 240,
      "azione-metotrexato": 8,
      "azione-followup-cute": 10,
      rm: 2880,
      ana: 4320,
    },
    anamnesisQuestions: [
      q("aq-pelle", "Dov'è la psoriasi, e le unghie sono bucate o sollevate?", ["psoriasi", "unghie"], "Cute e unghie legano la dattilite all'artrite psoriasica."),
      q("aq-stomaco", "L'ibuprofene le ha già bruciato lo stomaco?", ["stomaco", "ibuprofene"], "La gastrite impone la gastroprotezione. Senza, il FANS è un sanguinamento."),
      q("aq-steroide", "Ha già preso cortisone in compresse, e cosa ha fatto la pelle dopo?", ["cortisone", "pelle"], "Il rimbalzo cutaneo è il motivo per non ripetere lo steroide sistemico."),
    ],
    physicalSummary:
      "Dattilite del terzo dito della mano destra, pitting ungueale, placche al cuoio capelluto. Nessun ascesso, nessun pus. Addome trattabile, epigastrio dolente alla pressione. Il prednisone sistemico è la scelta che la pelle pagherà.",
    citations: [
      { chunkId: "reuma-008-steroide", source: "Sintesi operativa — artrite psoriasica e cortisone sistemico", quote: "Lo steroide sistemico non è la terapia dell'artrite psoriasica: spegne e poi fa rimbalzare la psoriasi. Si usano FANS, csDMARD e, se serve, un biologico mirato." },
      { chunkId: "reuma-008-stomaco", source: "Sintesi operativa — FANS e gastroprotezione", quote: "Con una gastrite già documentata il FANS senza inibitore di pompa è un sanguinamento evitabile, non un risparmio." },
    ],
    indicators: [
      "Pelle, unghie e dattilite collegati nella stessa diagnosi.",
      "Nessun prednisone sistemico.",
      "FANS con gastroprotezione.",
      "Screening prima del metotrexato.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano il rifiuto dello steroide sistemico, la gastrite e la gastroprotezione prescritta insieme al FANS.",
    legalCriteria: [
      "Prednisone sistemico non avviato.",
      "FANS non dato da solo a una paziente con gastrite.",
      "Metotrexato non dato senza transaminasi e senza conferma della contraccezione.",
    ],
    mandatoryExams: [
      { examId: "rx-ossa", name: "RX mani", finding: "Tumefazione delle parti molli del terzo dito, non erosioni grosse. Costo 30 euro. Basta come imaging iniziale.", isAbnormal: true, priceEuro: 30 },
      { examId: "enzimi-epatici", name: "Transaminasi", finding: "AST e ALT normali. Costo 10 euro. Il metotrexato si può discutere.", isAbnormal: false, priceEuro: 10 },
      { examId: "beta-hcg", name: "Beta-HCG", finding: "Negativo, coerente con la contraccezione riferita. Costo 15 euro. Va comunque documentato.", isAbnormal: false, priceEuro: 15 },
    ],
    inappropriateExams: [
      { examId: "rm", name: "RM della mano", finding: "Sinovite del dito, dato già clinico. Costo 220 euro.", isAbnormal: true, priceEuro: 220, wasteRationale: "RM immediata su una dattilite clinica: 220 euro fuori budget." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA non servono a diagnosticare l'artrite psoriasica." },
    ],
    budget: 90,
    name: "Sara Colombo",
    age: 36,
    sex: "F",
    context: "Ambulatorio. Dattilite e psoriasi del cuoio capelluto.",
    vitals: { heartRate: 76, bloodPressure: "124/78", spo2: 99, temperature: 36.7, respiratoryRate: 14 },
    signs: [
      { signName: "Dattilite", result: "Terzo dito a salsicciotto, non fistolizzato.", isPositive: true },
      { signName: "Ascesso", result: "Nessun pus, nessuna porta d'ingresso. Non è un'infezione del dito.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "COLLABORATIVE",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Vuole il cortisone che le ha già schiarito la pelle. Cambia idea se le si descrive il rimbalzo e se lo stomaco viene protetto in modo esplicito.",
    steps: [
      { phase: "anamnesi", title: "Pelle e dito insieme", prompt: "Cosa leghi prima di curare?", cost: 0, score: 15, correctLabel: "Psoriasi, pitting, dattilite e storia di gastrite da FANS", wrongs: [{ label: "Trattare il dito come un ascesso e ignorare la pelle", next: "res-ritardo" }] },
      { phase: "diagnostica", title: "RX, non RM", prompt: "Quale imaging?", cost: 30, score: 20, correctLabel: "RX della mano. La dattilite è già clinica", wrongs: [{ label: "RM della mano prima di ogni terapia", next: "res-rm" }] },
      { phase: "screening", title: "Stomaco e fegato", prompt: "Cosa documenti prima delle compresse?", cost: 25, score: 20, correctLabel: "Gastrite già nota, beta-HCG e transaminasi", wrongs: [{ label: "FANS pieno senza gastroprotezione: lo stomaco si vedrà dopo", next: "res-stomaco" }] },
      { phase: "terapia", title: "Niente steroide sistemico", prompt: "Cosa prescrivi?", cost: 12.5, score: 25, correctLabel: "FANS con inibitore di pompa e, dopo lo screening, metotrexato. Non prednisone", wrongs: [{ label: "Prednisone 25 mg per spegnere pelle e dito insieme", next: "res-rebound" }] },
      { phase: "follow-up", title: "Cute e fegato", prompt: "Cosa rivedi fra un mese?", cost: 10, score: 20, correctLabel: "Pelle, dattilite e transaminasi. Nessuno steroide di richiamo", wrongs: [{ label: "Un ciclo di prednisone se la pelle non è sparita", next: "res-rebound" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Psoriasica senza steroide", prompt: "Dattilite inquadrata, FANS protetto, metotrexato dopo screening, pelle sorvegliata. Nessun prednisone sistemico.", cost: 77.5, score: 100 },
      { id: "res-rebound", outcome: "negative", trap: "medico-legale", title: "Rimbalzo da steroide sistemico", prompt: "Il prednisone spegne la pelle e l'artrite per giorni, poi la psoriasi riesplode più estesa. Il rimbalzo era prevedibile.", cost: 4.5, score: 0 },
      { id: "res-stomaco", outcome: "negative", trap: "medico-legale", title: "FANS senza gastroprotezione", prompt: "Con una gastrite già scritta, il FANS da solo causa un sanguinamento. L'omissione della protezione è il vizio.", cost: 6, score: 0 },
      { id: "res-rm", outcome: "negative", trap: "economico", title: "RM inutile sulla dattilite", prompt: "La RM costa 220 euro e supera il budget di 90. Il dito a salsicciotto non aveva bisogno di quell'imaging.", cost: 220, score: 0 },
      { id: "res-ritardo", outcome: "negative", trap: "medico-legale", title: "Dattilite scambiata per ascesso", prompt: "Un percorso solo antibiotico lascia l'artrite psoriasica senza diagnosi e senza farmaco di fondo.", cost: 0, score: 0 },
    ],
  },
  {
    n: 9,
    title: "Sclerosi sistemica iniziale",
    description:
      "Laura Bianchi, 52 anni, ha un Raynaud nuovo, dita gonfie al mattino e una piccola ulcera del polpastrello. Non è un Raynaud benigno da liquidare, e non è nemmeno un pretesto per FR, anti-CCP, ANCA e RM. Il percorso è la capillaroscopia e gli ANA, poi un ENA mirato se il quadro è sclerodermico, e la pressione sorvegliata.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "LOW",
    setting: "AMBULATORIO",
    condition: "Sclerosi sistemica iniziale: capillaroscopia e ANA, non pannello a pioggia",
    guidelineRef: "Raynaud secondario — capillaroscopia e ANA prima di un pannello esteso",
    diagnosis:
      "Sclerosi sistemica iniziale. Capillaroscopia con pattern sclerodermico e ANA. Non FR né RM. Niente steroide ad alto dosaggio.",
    pastMedicalHistory:
      "Raynaud da sei mesi, prima assente. Fuma dieci sigarette. Nessuna dispnea da sforzo dichiarata, ma fa le scale più piano. Pirosi notturna nuova. Non ha artrite. Pressione di casa 150/90, non curata. Nessuna allergia. Madre con tiroidite.",
    presentation:
      "Arriva con i guanti anche se non fa freddo. Un polpastrello ha una crosticina. Se le si dice che è il freddo e di non pensarci, si rimette i guanti e se ne va. Se le si chiede un pannello di dodici autoanticorpi più una RM, si spaventa del costo e del tempo. La capillaroscopia la accetta se le si mostra il dito.",
    redHerrings: [
      "Il fumo basta, per qualcuno, a spiegare il Raynaud e a chiudere la visita.",
      "La pirosi sembra solo un reflusso e si perde la dismotilità esofagea.",
      "La pressione alta viene rinviata al curante senza un'urina.",
    ],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Laura Bianchi, 52 anni, ambulatorio. Registro: preoccupata, frasi medie, guardi le dita. Alla «Come sta?»: «Diventano bianche, poi blu. E qui c'è una crosta.» [mostra il polpastrello] Non dire tu sclerosi sistemica. Se chiedono da quanto, fumo, fiato, bruciore, pressione: sei mesi, fumi, le scale ti stancano, bruciore di notte, pressione alta non curata. Se ti dicono che è solo freddo, ti alzi. Se ti elencano dieci esami e una risonanza, chiedi se servono tutti. Se ti propongono la capillaroscopia e gli ANA, accetti. Non nominare budget.",
    correctSolution:
      "Sclerosi sistemica iniziale. Capillaroscopia e ANA. ENA mirato solo dopo questo binomio, non FR, anti-CCP, ANCA e RM. Niente steroide ad alto dosaggio. Pressione, urine e creatinina, e invio per il follow-up cardiopolmonare. Calcio-antagonista per il Raynaud.",
    goldStandardPath: [
      "anamnesi-raynaud",
      "capillaroscopia",
      "ana",
      "creat-urea-gfr",
      "urine-sed",
      "azione-no-steroide-alto",
      "azione-followup-pressione",
    ],
    goldPathNarrative:
      "1) Anamnesi: Raynaud nuovo, ulcera digitale, pirosi, dispnea lieve, pressione alta. 2) Capillaroscopia 45 euro e ANA 12 euro. Insieme 57 euro, dentro un budget di 90. 3) Se il pattern è sclerodermico si chiede un ENA mirato, non FR 8, anti-CCP 15, ANCA 20 e RM 220. 4) Nessuno steroide ad alto dosaggio: il rischio è la crisi renale. Si cura il Raynaud e si misura il rene. 5) Follow-up di pressione, creatinina e fiato.",
    examLatencies: {
      "anamnesi-raynaud": 8,
      capillaroscopia: 1440,
      ana: 4320,
      "creat-urea-gfr": 240,
      "urine-sed": 60,
      "azione-no-steroide-alto": 5,
      "azione-followup-pressione": 8,
      fr: 1440,
      "anti-ccp": 4320,
      anca: 4320,
      rm: 2880,
      ena: 4320,
    },
    anamnesisQuestions: [
      q("aq-raynaud", "Da quanto le dita cambiano colore, e c'è stata un'ulcera?", ["bianche", "ulcera"], "Un Raynaud nuovo con ulcera non è benigno e chiede la capillaroscopia."),
      q("aq-visceri", "Ha bruciore nuovo, fiato corto o le dita dure?", ["bruciore", "fiato"], "Esofago e polmone iniziali cambiano il follow-up, non il pannello a pioggia."),
      q("aq-pressione", "Che pressione ha, e le urine sono schiumose?", ["pressione", "urine"], "La pressione trascurata è il terreno della crisi renale se poi si dà uno steroide alto."),
    ],
    physicalSummary:
      "Dita edematose, una crosta sul polpastrello dell'indice, Raynaud riferito a tre fasi. Non sinovite. Pressione 150/92. Non sclerosi cutanea estesa, ma il quadro non è un Raynaud primario.",
    citations: [
      { chunkId: "reuma-009-cap", source: "Sintesi operativa — Raynaud e capillaroscopia", quote: "Un Raynaud di nuova comparsa con ulcera digitale si studia con la capillaroscopia e gli ANA. Liquidarlo come freddo fa perdere la sclerosi sistemica iniziale." },
      { chunkId: "reuma-009-pioggia", source: "Tariffe didattiche REUMA-009 — capillaroscopia 45 €, ANA 12 €, RM 220 €", quote: "FR, anti-CCP, ANCA e RM non sono il pacchetto del Raynaud. Il binomio capillaroscopia più ANA sta nel budget di 90 euro." },
    ],
    indicators: [
      "Raynaud non archiviato come benigno.",
      "Capillaroscopia e ANA prima di un pannello esteso.",
      "Nessuno steroide ad alto dosaggio.",
      "Pressione e rene controllati. Spesa entro 90 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano l'ulcera digitale, la capillaroscopia, gli ANA e il motivo per cui FR, ANCA e RM non sono stati chiesti.",
    legalCriteria: [
      "Capillaroscopia non omessa davanti a un'ulcera.",
      "Steroide ad alto dosaggio non avviato.",
      "Pressione non rinviata senza un'urina e una creatinina.",
    ],
    mandatoryExams: [
      { examId: "capillaroscopia", name: "Capillaroscopia periungueale", finding: "Megacapillari e aree avascolari: pattern sclerodermico. Costo 45 euro. È l'esame che non si può saltare.", isAbnormal: true, priceEuro: 45, isFatal: true },
      { examId: "ana", name: "ANA", finding: "ANA positivi, pattern nucleolare. Costo 12 euro. Con la capillaroscopia basta a indirizzare, senza un pannello intero.", isAbnormal: true, priceEuro: 12 },
      { examId: "creat-urea-gfr", name: "Creatinina", finding: "Creatinina 0,9 mg/dL, GFR conservato. Costo 4,50 euro. È il basale da non perdere.", isAbnormal: false, priceEuro: 4.5 },
      { examId: "urine-sed", name: "Urine", finding: "Nessuna proteinuria oggi. Costo 6 euro. Va ripetuta se la pressione resta alta.", isAbnormal: false, priceEuro: 6 },
    ],
    inappropriateExams: [
      { examId: "fr", name: "FR", finding: "FR negativo. Costo 8 euro. Non c'entra con questo Raynaud.", isAbnormal: false, priceEuro: 8, wasteRationale: "FR su un Raynaud senza artrite." },
      { examId: "anti-ccp", name: "Anti-CCP", finding: "Anti-CCP negativo. Costo 15 euro.", isAbnormal: false, priceEuro: 15, wasteRationale: "Anti-CCP non studia la sclerosi sistemica." },
      { examId: "anca", name: "ANCA", finding: "ANCA negativi. Costo 20 euro.", isAbnormal: false, priceEuro: 20, wasteRationale: "ANCA a pioggia, senza vasculite." },
      { examId: "rm", name: "RM", finding: "RM delle mani senza una domanda clinica. Costo 220 euro.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM al posto della capillaroscopia: 220 euro e l'esame giusto non è stato fatto." },
    ],
    budget: 90,
    name: "Laura Bianchi",
    age: 52,
    sex: "F",
    context: "Ambulatorio. Raynaud nuovo con ulcera digitale.",
    vitals: { heartRate: 84, bloodPressure: "150/92", spo2: 97, temperature: 36.6, respiratoryRate: 16 },
    signs: [
      { signName: "Ulcera digitale", result: "Crosticina sul polpastrello, dita edematose.", isPositive: true },
      { signName: "Sinovite", result: "Nessuna artrite. FR e anti-CCP non hanno un bersaglio.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Minimizza se le si dice che è il freddo, e si allarma se le si elenca un pannello lungo. Si fida della capillaroscopia perché guarda le sue dita.",
    steps: [
      { phase: "anamnesi", title: "Raynaud benigno o no", prompt: "Quali elementi tolgono il Raynaud dalla forma benigna?", cost: 0, score: 15, correctLabel: "Esordio dopo i 50 anni, ulcera, pirosi, dispnea, pressione alta", wrongs: [{ label: "Dirle di coprirsi e chiudere la visita", next: "res-omessa" }] },
      { phase: "diagnostica", title: "Capillaroscopia e ANA", prompt: "Qual è il primo binomio?", cost: 57, score: 20, correctLabel: "Capillaroscopia periungueale e ANA", wrongs: [{ label: "FR, anti-CCP, ANCA e RM delle mani", next: "res-pioggia" }] },
      { phase: "screening", title: "Rene prima dello steroide", prompt: "Cosa misuri, e quale farmaco eviti?", cost: 10.5, score: 20, correctLabel: "Pressione, urine e creatinina. Nessuno steroide ad alto dosaggio", wrongs: [{ label: "Prednisone 25 mg per le dita gonfie", next: "res-rene" }] },
      { phase: "terapia", title: "Raynaud, non immunosoppressione cieca", prompt: "Cosa avvii?", cost: 4, score: 25, correctLabel: "Calcio-antagonista per il Raynaud e invio strutturato. Non metotrexato alla cieca", wrongs: [{ label: "Metotrexato e un ENA completo più FR oggi stesso", next: "res-pioggia" }] },
      { phase: "follow-up", title: "Pressione e fiato", prompt: "Cosa ricontrolli?", cost: 4.5, score: 20, correctLabel: "Pressione, creatinina e dispnea. Non una seconda RM", wrongs: [{ label: "Nessun controllo: la capillaroscopia basta per sempre", next: "res-omessa" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Sclerosi iniziale intercettata", prompt: "Capillaroscopia e ANA fatti, rene basale registrato, steroide alto evitato, follow-up fissato.", cost: 76, score: 100 },
      { id: "res-omessa", outcome: "negative", trap: "medico-legale", title: "Raynaud sottovalutato", prompt: "Senza capillaroscopia l'ulcera successiva e la sclerosi viscerale arrivano senza una diagnosi. L'omissione è il danno.", cost: 0, score: 0 },
      { id: "res-pioggia", outcome: "negative", trap: "economico", title: "Esami reumatologici a pioggia", prompt: "FR, anti-CCP, ANCA e RM superano il budget di 90 euro e non sostituiscono la capillaroscopia.", cost: 263, score: 0 },
      { id: "res-rene", outcome: "negative", trap: "medico-legale", title: "Steroide e crisi renale", prompt: "Lo steroide ad alto dosaggio, con la pressione già alta, è il terreno della crisi renale sclerodermica.", cost: 4.5, score: 0 },
    ],
  },
  {
    n: 10,
    title: "Osteoartrosi del ginocchio",
    description:
      "Roberto Gallo, 67 anni, ha male al ginocchio destro quando scende le scale, rigidità di dieci minuti e un ingrandimento osseo. Gli indici non sono infiammatori. Il percorso è la radiografia, il carico e un FANS breve, non il fattore reumatoide e non un immunosoppressore letto su una PCR normale.",
    difficulty: "EASY",
    matrixDifficulty: "BASE",
    frequencyCategory: "HIGH",
    setting: "AMBULATORIO",
    condition: "Osteoartrosi: RX e carico, non FR/anti-CCP né un DMARD",
    guidelineRef: "Osteoartrosi — terapia meccanica, autoanticorpi non indicati",
    diagnosis:
      "Gonartrosi meccanica. Radiografia e riabilitazione. Non FR, non anti-CCP, non metotrexato.",
    pastMedicalHistory:
      "Sovrappeso, ginocchio operato di menisco vent'anni fa. Diabete in dieta. Nessuna psoriasi, nessun gonfiore delle mani. Una PCR fatta in farmacia risulta 0,4 mg/dL e lui crede sia «infiammazione autoimmune» perché lo ha letto così. Allergie: nessuna. Cammina poco.",
    presentation:
      "Zoppica in discesa, il ginocchio non è caldo. Se gli si propone il metotrexato perché «gli esami sono accesi» si preoccupa e accetta. Se gli si mostra che la rigidità dura minuti e non ore, e che la cura è il carico, resta scettico e poi collabora.",
    redHerrings: [
      "La PCR 0,4 viene letta come patologica e apre i DMARD.",
      "Il menisco operato fa chiedere una RM prima della RX.",
      "Chiede FR e anti-CCP perché la sorella ha l'artrite reumatoide.",
    ],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 40,
    patientPrompt:
      "ROLEPLAY. Sei Roberto Gallo, 67 anni, ambulatorio. Registro: pratico, un po' diffidente. Alla «Come sta?»: «Scendo le scale e il ginocchio cede.» Non dire tu artrosi. Se chiedono rigidità, gonfiore, mani, febbre, peso: dieci minuti al mattino e poi passa, niente gonfiore vero, mani a posto, niente febbre, sei in sovrappeso. Se ti propongono FR, anti-CCP o il metotrexato perché tua sorella ha l'artrite, li vuoi. Se ti spiegano la radiografia e il dimagrimento, brontoli e accetti. Non nominare budget.",
    correctSolution:
      "Osteoartrosi. RX del ginocchio, calo ponderale, esercizio e un FANS topico o breve. Non FR, non anti-CCP, non metotrexato, non adalimumab. Follow-up sulla funzione, non sugli anticorpi.",
    goldStandardPath: [
      "anamnesi-meccanica",
      "rx-ossa",
      "azione-carico",
      "azione-no-dmard",
      "azione-followup-funzione",
    ],
    goldPathNarrative:
      "1) Anamnesi: dolore in discesa, rigidità breve, nessuna sinovite. 2) RX del ginocchio 30 euro, dentro un budget di 40. FR 8 e anti-CCP 15, sommati, lo sforano. 3) Non c'è uno screening da immunosoppressore perché l'immunosoppressore non si dà. 4) Carico, esercizio, FANS breve. Non metotrexato 12,50 e non adalimumab 450. 5) Follow-up sul cammino, non su un titolo anticorpale.",
    examLatencies: {
      "anamnesi-meccanica": 8,
      "rx-ossa": 40,
      "azione-carico": 8,
      "azione-no-dmard": 4,
      "azione-followup-funzione": 8,
      fr: 1440,
      "anti-ccp": 4320,
      ana: 4320,
      rm: 2880,
    },
    anamnesisQuestions: [
      q("aq-rigidita", "Quanti minuti dura la rigidità, e il dolore è peggio in movimento o a riposo?", ["minuti", "scale"], "Dieci minuti e il dolore meccanico escludono l'artrite infiammatoria."),
      q("aq-mani", "Le mani si gonfiano, ha psoriasi o febbre?", ["mani", "febbre"], "Senza sinovite sistemica FR e anti-CCP non hanno indicazione."),
      q("aq-pcr", "Chi le ha detto che la PCR è alta, e qual è il numero?", ["PCR", "numero"], "Una PCR normale letta come patologica è la porta del DMARD sbagliato."),
    ],
    physicalSummary:
      "Ginocchio destro con bozze ossee, non versamento, non calore. Arco doloroso in discesa. Mani senza sinovite. L'obiettività è artrosica. Un immunosoppressore qui è un errore di lettura, non una terapia.",
    citations: [
      { chunkId: "reuma-010-rx", source: "Sintesi operativa — osteoartrosi, niente DMARD", quote: "Il dolore meccanico con rigidità breve si studia con la radiografia e si tratta con carico, esercizio e analgesia. Il metotrexato non è un antidolorifico dell'artrosi." },
      { chunkId: "reuma-010-anticorpi", source: "Tariffe didattiche REUMA-010 — RX 30 €, FR 8 €, anti-CCP 15 €", quote: "FR e anti-CCP aggiunti a una RX già indicata superano un budget di 40 euro e non cambiano la gonartrosi." },
    ],
    indicators: [
      "Dolore meccanico distinto dall'artrite.",
      "RX fatta, RM non anticipata.",
      "FR e anti-CCP non richiesti.",
      "Nessun immunosoppressore. Spesa entro 40 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano la rigidità breve, la PCR normale e il rifiuto motivato di FR, anti-CCP e metotrexato.",
    legalCriteria: [
      "Metotrexato non prescritto su una PCR normale.",
      "FR e anti-CCP non richiesti per un dolore meccanico.",
      "Il numero della PCR è stato riletto, non dato per alto.",
    ],
    mandatoryExams: [
      { examId: "rx-ossa", name: "RX ginocchio", finding: "Restringimento della rima mediale, osteofiti. Costo 30 euro. È l'imaging indicato.", isAbnormal: true, priceEuro: 30 },
      { examId: "azione-carico", name: "Calo ponderale e esercizio", finding: "Il trattamento dell'artrosi è il carico, non un anticorpo. Nessun costo di nomenclatore.", isAbnormal: false, priceEuro: 0 },
    ],
    inappropriateExams: [
      { examId: "fr", name: "FR", finding: "FR negativo. Costo 8 euro. Inutile.", isAbnormal: false, priceEuro: 8, wasteRationale: "FR per un dolore meccanico senza sinovite." },
      { examId: "anti-ccp", name: "Anti-CCP", finding: "Anti-CCP negativo. Costo 15 euro.", isAbnormal: false, priceEuro: 15, wasteRationale: "Anti-CCP non diagnostica l'artrosi. Con il FR sfora il budget." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA senza segni di connettivite." },
    ],
    budget: 40,
    name: "Roberto Gallo",
    age: 67,
    sex: "M",
    context: "Ambulatorio. Gonalgia meccanica.",
    vitals: { heartRate: 70, bloodPressure: "136/80", spo2: 98, temperature: 36.5, respiratoryRate: 14 },
    signs: [
      { signName: "Gonartrosi", result: "Bozze ossee, dolore in carico, nessun versamento caldo.", isPositive: true },
      { signName: "Sinovite", result: "Assente. Non c'è un bersaglio per FR o metotrexato.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "DEFENSIVE",
    adherence: "PARTIAL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Vuole un farmaco forte perché la sorella «sta meglio con le pastiglie dell'artrite». Si convincere se gli si rilegge la PCR 0,4 e gli si mostra la radiografia.",
    steps: [
      { phase: "anamnesi", title: "Meccanico o infiammatorio", prompt: "Quale domanda separa i due dolori?", cost: 0, score: 15, correctLabel: "Durata della rigidità, carico, assenza di sinovite e il numero vero della PCR", wrongs: [{ label: "Dare per buona la PCR «accesa» e aprire un percorso da artrite reumatoide", next: "res-dmard" }] },
      { phase: "diagnostica", title: "Solo la radiografia", prompt: "Quali esami prescrivi?", cost: 30, score: 20, correctLabel: "RX del ginocchio. Non FR, non anti-CCP, non RM", wrongs: [{ label: "FR e anti-CCP perché in famiglia c'è l'artrite reumatoide", next: "res-anticorpi" }] },
      { phase: "screening", title: "Non c'è un immunosoppressore da schermare", prompt: "Serve uno screening pre-metotrexato?", cost: 0, score: 20, correctLabel: "No: il metotrexato non è indicato, quindi non si scherma una cura che non si dà", wrongs: [{ label: "Beta-HCG, Quantiferon ed epatite per poi dare comunque il metotrexato", next: "res-dmard" }] },
      { phase: "terapia", title: "Carico, non DMARD", prompt: "Cosa prescrivi?", cost: 0, score: 25, correctLabel: "Calo ponderale, esercizio e un FANS breve o topico", wrongs: [{ label: "Metotrexato 10 mg a settimana", next: "res-dmard" }] },
      { phase: "follow-up", title: "Funzione, non titoli", prompt: "Cosa rivedi fra tre mesi?", cost: 0, score: 20, correctLabel: "Cammino, peso e dolore. Nessun FR di controllo", wrongs: [{ label: "Ripetere FR e anti-CCP", next: "res-anticorpi" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Artrosi trattata da artrosi", prompt: "Radiografia, carico e analgesia. Nessun autoanticorpo e nessun DMARD.", cost: 30, score: 100 },
      { id: "res-dmard", outcome: "negative", trap: "medico-legale", title: "Immunosoppressore su una PCR normale", prompt: "Il metotrexato, letto su una PCR 0,4 scambiata per patologica, espone a tossicità senza una malattia infiammatoria. È un errore di lettura.", cost: 12.5, score: 0 },
      { id: "res-anticorpi", outcome: "negative", trap: "economico", title: "FR e anti-CCP nel dolore meccanico", prompt: "FR 8 euro e anti-CCP 15 euro, sopra la RX da 30, superano il budget di 40 e non modificano la gonartrosi.", cost: 23, score: 0 },
    ],
  },
  {
    n: 11,
    title: "Polimialgia reumatica",
    description:
      "Anna Marino, 71 anni, ha da tre settimane dolore e rigidità del cingolo scapolare e pelvico, tanto da non alzarsi dal letto. La VES di oggi è 18 mm/h. Una VES normale non cancella la polimialgia. Il percorso è la clinica, l'esclusione dell'arterite cranica e il prednisone a basso dosaggio, con la risposta come conferma. L'EMG è la trappola.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Polimialgia reumatica: diagnosi anche con VES normale, EMG non indicata",
    guidelineRef: "Polimialgia reumatica — clinica e prednisone basso, VES normale non esclude",
    diagnosis:
      "Polimialgia reumatica con VES normale. Prednisone 15 mg e risposta rapida attesa. Non EMG. Sintomi cranici cercati e assenti.",
    pastMedicalHistory:
      "Ipertensione. Nessuna cefalea nuova, nessuna claudicatio masticatoria, nessun velo visivo: va chiesto, non dato per scontato. Non ha debolezza vera, si veste da sola se la rigidità cede. Una VES fatta ieri è 18 e il collega ha escluso la polimialgia per questo. Diabete assente. Allergie: nessuna.",
    presentation:
      "Entra aiutata, le spalle non si alzano. Se le si dice che con la VES normale non può essere polimialgia, si scoraggia. Se le si dà il prednisone basso e le si chiede di tornare in tre giorni, accetta. Se le si prenota un'elettromiografia, chiede se deve soffrire ancora un mese.",
    redHerrings: [
      "La VES 18 viene usata per rifiutare la diagnosi.",
      "Il dolore alle cosce fa pensare a una polimiosite e si chiede l'EMG.",
      "Una cefalea tensiva vecchia di anni viene scambiata per Horton.",
    ],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Anna Marino, 71 anni, ambulatorio. Registro: sofferente, frasi lente. Alla «Come sta?»: «Non esco dal letto. Le spalle sono di legno.» Non dire tu polimialgia. Se chiedono rigidità, forza vera, testa, masticazione, vista: più di un'ora al mattino, la forza c'è ma il dolore blocca, niente cefalea nuova, mastichi, la vista è quella di sempre. Se ti dicono che la VES è normale e quindi non è niente, ti chiudi. Se ti danno il cortisone basso e un controllo a tre giorni, lo prendi. Se ti mandano all'elettromiografia, chiedi quanto devi aspettare. Non nominare budget.",
    correctSolution:
      "Polimialgia reumatica nonostante la VES normale. Esclusione dei sintomi di Horton. Prednisone 12,5-15 mg, risposta clinica a pochi giorni. Non EMG. Follow-up di glicemia, sintomi cranici e svezzamento.",
    goldStandardPath: [
      "anamnesi-cingolo",
      "ves",
      "pcr-pct",
      "azione-prednisone-basso",
      "azione-followup-risposta",
    ],
    goldPathNarrative:
      "1) Anamnesi: cingolo, età, rigidità, assenza di cefalea nuova e di deficit di forza. 2) VES 3,50 euro, qui normale, e PCR 28 euro che può essere solo poco mossa. La VES normale non chiude il caso. 3) Si esclude l'arterite cranica con le domande, non con un EMG. 4) Prednisone 15 mg, costo didattico 4,50 euro. 5) Controllo a 72 ore sulla vestizione. L'EMG costa 70 euro, sopra un budget di 45, e non diagnostica la polimialgia.",
    examLatencies: {
      "anamnesi-cingolo": 8,
      ves: 120,
      "pcr-pct": 240,
      "azione-prednisone-basso": 6,
      "azione-followup-risposta": 8,
      emg: 2880,
      ana: 4320,
      ena: 4320,
    },
    anamnesisQuestions: [
      q("aq-cingolo", "Sono bloccate spalle e anche, e da quante settimane?", ["spalle", "settimane"], "Il cingolo bilaterale nell'anziano è il nucleo della polimialgia."),
      q("aq-forza", "La forza c'è, una volta superato il dolore, o il muscolo cede?", ["forza", "dolore"], "Il dolore senza debolezza vera allontana la miopatia e rende inutile l'EMG."),
      q("aq-cranio", "Ha cefalea nuova, dolore a masticare o un calo della vista?", ["cefalea", "vista"], "Questi sintomi spostano verso l'arterite di Horton e uno steroide più alto."),
    ],
    physicalSummary:
      "Spalle e anche dolorose e limitate in modo simmetrico, forza conservata se si vince il dolore. Arterie temporali non dolenti. Nessun deficit neurologico. La VES normale non cancella questo esame.",
    citations: [
      { chunkId: "reuma-011-ves", source: "Sintesi operativa — polimialgia e VES normale", quote: "Una quota di polimialgie ha VES normale. Rifiutare la diagnosi su questo solo numero lascia il paziente bloccato a letto. La risposta al prednisone basso è il riscontro che conta." },
      { chunkId: "reuma-011-emg", source: "Tariffe didattiche REUMA-011 — EMG 70 €, budget 45 €", quote: "L'elettromiografia studia la miopatia e la neuropatia, non la polimialgia. Settanta euro sono sopra il budget e non cambiano il prednisone." },
    ],
    indicators: [
      "VES normale non usata per escludere la diagnosi.",
      "Sintomi cranici cercati.",
      "Prednisone a basso dosaggio, non un'EMG.",
      "Risposta clinica ricontrollata in pochi giorni.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano il cingolo, la VES normale reinterpretata, l'assenza di sintomi cranici e la dose di prednisone.",
    legalCriteria: [
      "Diagnosi non rifiutata per una VES di 18.",
      "Sintomi di Horton chiesti e negativi prima del dosaggio basso.",
      "EMG non richiesta al posto della prova terapeutica.",
    ],
    mandatoryExams: [
      { examId: "ves", name: "VES", finding: "VES 18 mm/h, nel limite per l'età. Costo 3,50 euro. Non esclude la polimialgia.", isAbnormal: false, priceEuro: 3.5 },
      { examId: "pcr-pct", name: "PCR", finding: "PCR 1,1 mg/dL, mossa poco. Costo 28 euro. Non è un argomento per negare la clinica.", isAbnormal: true, priceEuro: 28 },
    ],
    inappropriateExams: [
      { examId: "emg", name: "EMG", finding: "Conduzione e tracciato muscolare normali. Costo 70 euro. Non c'era debolezza da studiare.", isAbnormal: false, priceEuro: 70, wasteRationale: "EMG nella polimialgia: 70 euro, sopra il budget di 45, senza una miopatia." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA non diagnosticano la polimialgia." },
    ],
    budget: 45,
    name: "Anna Marino",
    age: 71,
    sex: "F",
    context: "Ambulatorio. Rigidità del cingolo e VES normale.",
    vitals: { heartRate: 80, bloodPressure: "146/82", spo2: 97, temperature: 37.2, respiratoryRate: 16 },
    signs: [
      { signName: "Cingolo doloroso", result: "Spalle e anche limitate dal dolore, forza conservata.", isPositive: true },
      { signName: "Arteria temporale dolente", result: "Tempie non dolenti, nessun sintomo visivo.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "PASSIVE",
    adherence: "FULL",
    sleep: "POOR",
    stress: "MEDIUM",
    support: "STRONG",
    communicationStyle: "Accetta il rifiuto della diagnosi se glielo dice un medico. Si illumina se le si promette un controllo a tre giorni dopo una compressa, e si abbatte se la si manda all'elettromiografia.",
    steps: [
      { phase: "anamnesi", title: "Cingolo e cranio", prompt: "Cosa chiedi prima di guardare la VES?", cost: 0, score: 15, correctLabel: "Età, cingolo, forza vera, cefalea, masticazione e vista", wrongs: [{ label: "Leggere VES 18 e chiudere: non è polimialgia", next: "res-ves" }] },
      { phase: "diagnostica", title: "Indici, non EMG", prompt: "Quali esami hanno senso?", cost: 31.5, score: 20, correctLabel: "VES e PCR, sapendo che la VES normale non esclude", wrongs: [{ label: "EMG per una sospetta polimiosite", next: "res-emg" }] },
      { phase: "screening", title: "Horton esclusa a voce", prompt: "I sintomi cranici sono assenti. Cosa cambia la dose?", cost: 0, score: 20, correctLabel: "Prednisone basso, non lo schema da arterite. Nessun imaging cranico", wrongs: [{ label: "RM encefalo e biopsia temporale prima di ogni compressa", next: "res-emg" }] },
      { phase: "terapia", title: "Prednisone basso", prompt: "Cosa prescrivi?", cost: 4.5, score: 25, correctLabel: "Prednisone 15 mg e un controllo a 72 ore sulla vestizione", wrongs: [{ label: "Nessuna terapia: la VES normale vieta il cortisone", next: "res-ves" }] },
      { phase: "follow-up", title: "La risposta è il test", prompt: "A tre giorni si veste da sola. Cosa fai?", cost: 0, score: 20, correctLabel: "Confermi la diagnosi e programmi lo svezzamento, con un occhio alla glicemia", wrongs: [{ label: "Chiedi comunque l'EMG prima di continuare", next: "res-emg" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Polimialgia riconosciuta", prompt: "Clinica rispettata nonostante la VES, Horton esclusa, prednisone basso, risposta usata come conferma. Nessuna EMG.", cost: 36, score: 100 },
      { id: "res-ves", outcome: "negative", trap: "medico-legale", title: "Diagnosi rifiutata per la VES", prompt: "La paziente resta allettata. Una VES normale non era un criterio di esclusione. Il ritardo è il danno.", cost: 0, score: 0 },
      { id: "res-emg", outcome: "negative", trap: "economico", title: "EMG inutile", prompt: "L'EMG costa 70 euro e supera il budget di 45. Non distingue la polimialgia e rinvia il prednisone.", cost: 70, score: 0 },
    ],
  },
  {
    n: 12,
    title: "Artrite reumatoide in follow-up",
    description:
      "Francesca Riva, 49 anni, è in metotrexato 10 mg da quattro mesi per un'artrite reumatoide già nota. Oggi sta meglio e non ha fatto gli esami del fegato da quando ha iniziato. Il percorso è emocromo e transaminasi, non la ripetizione di FR e anti-CCP. Saltare il fegato è la trappola legale.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "AMBULATORIO",
    condition: "Follow-up di artrite reumatoide: fegato ed emocromo, non ridosare gli autoanticorpi",
    guidelineRef: "Metotrexato — emocromo e transaminasi periodici, autoanticorpi non si ripetono",
    diagnosis:
      "Artrite reumatoide in metotrexato, attività buona. Monitoraggio di fegato ed emocromo obbligatorio. FR e anti-CCP non vanno ripetuti.",
    pastMedicalHistory:
      "Artrite reumatoide sieropositiva diagnosticata quattro mesi fa, metotrexato 10 mg a settimana e acido folico, che a volte dimentica. Niente alcol. Ultimo emocromo e ultime transaminasi: il giorno dell'inizio, normali. Nessuna infezione in corso, nessuna dispnea nuova. Beta-HCG negativo il mese scorso, contraccezione con spirale. Allergie: nessuna.",
    presentation:
      "Muove le mani meglio di quattro mesi fa. Se le si dice che si possono saltare gli esami perché sta bene, è contenta. Se le si ripetono FR e anti-CCP «per vedere se sono scesi», chiede se deve pagare di nuovo. Il fegato lo fa fare se le si spiega che il farmaco si ferma su quei numeri.",
    redHerrings: [
      "Il benessere clinico sembra autorizzare a non prelevare.",
      "Un FR di controllo viene scambiato per un marcatore di attività.",
      "Una tosse banale fa chiedere una TC torace senza una dispnea.",
    ],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 40,
    patientPrompt:
      "ROLEPLAY. Sei Francesca Riva, 49 anni, controllo di reumatologia. Registro: sollevata, collaborante. Alla «Come sta?»: «Le mani vanno meglio. Il metotrexato lo prendo, il folico a volte no.» Non dire tu che gli esami del fegato sono in ritardo finché non te lo chiedono. Se chiedono alcol, fiato, infezioni, gravidanza, ultima analisi: non bevi, respiri bene, niente febbre, hai la spirale, gli esami sono quelli del primo giorno. Se ti dicono che si può saltare il prelievo, ringrazi. Se ti spiegano fegato e globuli, tiri su la manica. Se ti ripetono gli anticorpi, chiedi a cosa servono. Non nominare budget.",
    correctSolution:
      "Continuare il metotrexato solo dopo emocromo e transaminasi di oggi. Rafforzare il folato. Non ripetere FR, anti-CCP, ANA ed ENA. Follow-up di laboratorio fra 8-12 settimane se i valori sono normali. Nessuna TC.",
    goldStandardPath: [
      "anamnesi-metotrexato",
      "emocromo",
      "enzimi-epatici",
      "creat-urea-gfr",
      "azione-continua-metotrexato",
      "azione-followup-laboratorio",
    ],
    goldPathNarrative:
      "1) Anamnesi: aderenza, alcol, dispnea, infezioni, contraccezione. 2) Emocromo 4,80, transaminasi 10, creatinina 4,50: circa 19 euro, dentro un budget di 40. 3) Non si ripete lo screening autoimmune. 4) Se i numeri sono buoni il metotrexato continua, col folato. 5) Nuovo prelievo fra 8-12 settimane. Ripetere FR, anti-CCP, ANA ed ENA costa circa 60 euro e non misura l'attività.",
    examLatencies: {
      "anamnesi-metotrexato": 8,
      emocromo: 240,
      "enzimi-epatici": 240,
      "creat-urea-gfr": 240,
      "azione-continua-metotrexato": 6,
      "azione-followup-laboratorio": 6,
      fr: 1440,
      "anti-ccp": 4320,
      ana: 4320,
      ena: 4320,
    },
    anamnesisQuestions: [
      q("aq-aderenza", "Ha preso il metotrexato ogni settimana, e il folato?", ["settimana", "folato"], "L'aderenza spiega sia il beneficio sia il rischio di un prelievo saltato."),
      q("aq-fegato", "Beve alcol, ha nausea o il bianco degli occhi giallo? Quando è stato l'ultimo prelievo?", ["alcol", "prelievo"], "Quattro mesi senza transaminasi sono il buco da chiudere oggi."),
      q("aq-polmone", "Ha tosse secca nuova o fiato corto?", ["tosse", "fiato"], "La dispnea nuova farebbe sospettare una tossicità polmonare. Qui non c'è, e non si fa una TC di routine."),
    ],
    physicalSummary:
      "Sinovite delle mani molto ridotta rispetto all'esordio. Nessun ittero, nessun crepitio polmonare, nessun segno di infezione. Il benessere clinico non sostituisce emocromo e transaminasi.",
    citations: [
      { chunkId: "reuma-012-fegato", source: "Sintesi operativa — monitoraggio del metotrexato", quote: "Emocromo e transaminasi si ripetono a intervalli regolari per tutta la durata del metotrexato. Il paziente che sta meglio non è esentato." },
      { chunkId: "reuma-012-anticorpi", source: "Tariffe didattiche REUMA-012 — laboratorio di monitoraggio circa 19 €, anticorpi circa 60 €", quote: "FR e anti-CCP non si usano per seguire l'attività. Ripeterli costa e non decide se continuare il farmaco." },
    ],
    indicators: [
      "Emocromo e transaminasi richiesti nonostante il benessere.",
      "FR e anti-CCP non ripetuti.",
      "Folato rinforzato.",
      "Prossimo prelievo già fissato.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano la data dell'ultimo prelievo, i valori di oggi e il motivo per cui gli autoanticorpi non sono stati ripetuti.",
    legalCriteria: [
      "Metotrexato non rinnovato senza un emocromo e delle transaminasi recenti.",
      "Autoanticorpi non usati come monitoraggio.",
      "Sintomi polmonari chiesti prima di archiviare la visita.",
    ],
    mandatoryExams: [
      { examId: "emocromo", name: "Emocromo", finding: "Leucociti 6.200, piastrine 240.000, emoglobina stabile. Costo 4,80 euro. Il metotrexato si può continuare.", isAbnormal: false, priceEuro: 4.8 },
      { examId: "enzimi-epatici", name: "Transaminasi", finding: "AST 28, ALT 31, normali. Costo 10 euro. Quattro mesi senza questo numero erano il buco della cartella.", isAbnormal: false, priceEuro: 10, isFatal: true },
      { examId: "creat-urea-gfr", name: "Creatinina", finding: "Creatinina 0,8 mg/dL. Costo 4,50 euro. Funzione renale adatta al farmaco.", isAbnormal: false, priceEuro: 4.5 },
    ],
    inappropriateExams: [
      { examId: "fr", name: "FR di controllo", finding: "FR ancora positivo, titolo simile. Costo 8 euro. Non misura l'attività.", isAbnormal: true, priceEuro: 8, wasteRationale: "Ripetere il FR in follow-up non cambia la cura." },
      { examId: "anti-ccp", name: "Anti-CCP di controllo", finding: "Anti-CCP ancora positivo. Costo 15 euro.", isAbnormal: true, priceEuro: 15, wasteRationale: "L'anti-CCP non si usa per monitorare la risposta." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA non indicati in un follow-up di artrite reumatoide stabile." },
      { examId: "ena", name: "ENA", finding: "ENA negativo. Costo 25 euro.", isAbnormal: false, priceEuro: 25, wasteRationale: "ENA di controllo: 25 euro senza una domanda clinica." },
    ],
    budget: 40,
    name: "Francesca Riva",
    age: 49,
    sex: "F",
    context: "Ambulatorio. Controllo di metotrexato a quattro mesi.",
    vitals: { heartRate: 74, bloodPressure: "122/74", spo2: 99, temperature: 36.6, respiratoryRate: 14 },
    signs: [
      { signName: "Sinovite residua", result: "Mani molto migliorate, dolore residuo lieve.", isPositive: false },
      { signName: "Ittero", result: "Assente. Il fegato si giudica con il prelievo, non con il colore.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "COLLABORATIVE",
    adherence: "PARTIAL",
    sleep: "GOOD",
    stress: "LOW",
    support: "ADEQUATE",
    communicationStyle: "Felice del miglioramento e pronta a saltare il prelievo. Accetta emocromo e transaminasi se le si dice che senza quei numeri la ricetta non si rinnova.",
    steps: [
      { phase: "anamnesi", title: "Farmaco e rischi", prompt: "Cosa chiedi a una paziente che sta meglio?", cost: 0, score: 15, correctLabel: "Aderenza, folato, alcol, dispnea, infezioni e data dell'ultimo prelievo", wrongs: [{ label: "Rinnovare il metotrexato senza domande, visto che sta bene", next: "res-fegato" }] },
      { phase: "diagnostica", title: "Fegato e emocromo", prompt: "Quali esami di oggi sono obbligatori?", cost: 19.3, score: 20, correctLabel: "Emocromo, transaminasi e creatinina", wrongs: [{ label: "Ripetere FR, anti-CCP, ANA ed ENA per vedere se sono scesi", next: "res-anticorpi" }] },
      { phase: "screening", title: "Cosa non riscreenare", prompt: "La contraccezione c'è e l'epatite fu negativa. Cosa non ripeti?", cost: 0, score: 20, correctLabel: "Non ripeti gli autoanticorpi. Il prelievo di sicurezza di oggi resta", wrongs: [{ label: "Un pannello autoimmune completo al posto delle transaminasi", next: "res-anticorpi" }] },
      { phase: "terapia", title: "Rinnovo condizionato", prompt: "I valori sono normali. Cosa fai?", cost: 12.5, score: 25, correctLabel: "Continui il metotrexato e insisti sul folato", wrongs: [{ label: "Lo continui senza aver visto i valori, li farà lei quando può", next: "res-fegato" }] },
      { phase: "follow-up", title: "Prossimo prelievo", prompt: "Quando la rivedi in laboratorio?", cost: 0, score: 20, correctLabel: "Emocromo e transaminasi fra 8-12 settimane, prima se nausea o ittero", wrongs: [{ label: "Controllo esami fra un anno", next: "res-fegato" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Metotrexato monitorato", prompt: "Fegato ed emocromo visti, farmaco rinnovato, folato rinforzato, anticorpi non ripetuti.", cost: 31.8, score: 100 },
      { id: "res-fegato", outcome: "negative", trap: "medico-legale", title: "Fegato non monitorato", prompt: "Quattro mesi più un rinnovo cieco. L'epatotossicità del metotrexato arriva senza un numero in cartella. L'omissione del monitoraggio è il vizio.", cost: 12.5, score: 0 },
      { id: "res-anticorpi", outcome: "negative", trap: "economico", title: "Autoanticorpi ripetuti", prompt: "FR, anti-CCP, ANA ed ENA costano circa 60 euro e superano il budget di 40. Non dicono se il metotrexato funziona.", cost: 60, score: 0 },
    ],
  },
  {
    n: 13,
    title: "Sindrome di Sjögren",
    description:
      "Marta Esposito, 55 anni, ha secchezza degli occhi e della bocca da un anno, e un gonfiore parotideo andato e venuto. Il percorso è ANA e ENA (anti-SSA/SSB) prima di qualunque biopsia salivare, più lacrime artificiali. La biopsia come primo gesto e i colliri di ciclosporina subito sono le trappole.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Sjögren: autoanticorpi prima della biopsia salivare, non ciclosporina di prima linea",
    guidelineRef: "Sjögren — ANA e anti-SSA/SSB prima della biopsia, lacrime prima della ciclosporina",
    diagnosis:
      "Sindrome di Sjögren. ANA e ENA positivi per anti-SSA. Biopsia salivare non indicata come primo esame. Lacrime artificiali, non collirio di ciclosporina subito.",
    pastMedicalHistory:
      "Nessuna artrite. Carie frequenti negli ultimi due anni. Non ha linfonodi noti, non ha calo di peso. Non usa lenti a contatto. Ha comprato da sola un collirio qualsiasi, con poco beneficio. Nessuna allergia. Non fuma. Una tiroide già sostituita, stabile.",
    presentation:
      "Beve mentre parla. Gli occhi sono rossi ai bordi. Se le si propone la biopsia del labbro come primo esame, si spaventa. Se le si prescrive subito la ciclosporina in collirio, la prende perché «è la cura seria». Le lacrime artificiali le sembrano troppo semplici finché non le si spiega la sequenza.",
    redHerrings: [
      "Le carie sembrano solo scarsa igiene e si perde la secchezza.",
      "Un oculista ha scritto «occhio secco» e sembra che la sierologia non serva.",
      "Chiede la biopsia perché ha letto che è l'esame definitivo.",
    ],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 40,
    patientPrompt:
      "ROLEPLAY. Sei Marta Esposito, 55 anni, ambulatorio. Registro: infastidita dalla sete, educata. Alla «Come sta?»: «Bevo di continuo. Gli occhi bruciano. Ho sempre carie.» Non dire tu Sjögren. Se chiedono bocca, occhi, ghiandole, articolazioni, peso: sete da un anno, sabbia negli occhi, una ghiandola sotto l'orecchio si è gonfiata due volte, niente gonfiore delle mani, peso stabile. Se ti prenotano la biopsia del labbro per prima, esiti. Se ti danno la ciclosporina subito, la preferisci alle lacrime. Se ti spiegano gli esami del sangue e le lacrime come primo passo, accetti. Non nominare budget.",
    correctSolution:
      "Sjögren. ANA e ENA con anti-SSA prima di ogni biopsia. Lacrime artificiali e igiene dentale. Collirio di ciclosporina solo se l'oculista, dopo, lo indica per un occhio secco che non risponde. Follow-up su ghiandole, denti e sintomi sistemici. Non una biopsia di apertura.",
    goldStandardPath: [
      "anamnesi-secchezza",
      "ana",
      "ena",
      "azione-lacrime",
      "azione-followup-ghiandole",
    ],
    goldPathNarrative:
      "1) Anamnesi: xeroftalmia, xerostomia, parotidi, carie, assenza di artrite. 2) ANA 12 euro ed ENA 25 euro, totale 37, dentro un budget di 80. L'anti-SSA è nel pannello ENA. 3) Non si biopsia il labbro prima di questo risultato. 4) Lacrime artificiali, non ciclosporina in collirio da circa 120 euro di prima linea. 5) Follow-up su gonfiori ghiandolari, denti e febbre. La biopsia costa 180 euro e qui non è il primo esame.",
    examLatencies: {
      "anamnesi-secchezza": 8,
      ana: 4320,
      ena: 4320,
      "azione-lacrime": 5,
      "azione-followup-ghiandole": 8,
      biopsia: 7200,
      anca: 4320,
      rm: 2880,
    },
    anamnesisQuestions: [
      q("aq-secchezza", "Da quanto ha sete e sabbia negli occhi, e le ghiandole si gonfiano?", ["sete", "ghiandole"], "Secchezza e parotidi intermittenti sono il nucleo del Sjögren, prima della biopsia."),
      q("aq-sistemico", "Ha febbre, linfonodi, calo di peso o articolazioni gonfie?", ["febbre", "peso"], "Questi segni cercano un linfoma o un overlap, non giustificano la biopsia come primo atto."),
      q("aq-occhio", "Ha già provato le lacrime artificiali, e chi le ha guardato la cornea?", ["lacrime", "cornea"], "La ciclosporina in collirio non è il primo prodotto, e non si dà senza un oculista."),
    ],
    physicalSummary:
      "Mucose orali asciutte, occhi arrossati senza secrezione purulenta, nessuna parotide gonfia oggi, nessun linfonodo grosso. Non sinovite. Il labbro non va punto prima degli anticorpi.",
    citations: [
      { chunkId: "reuma-013-siero", source: "Sintesi operativa — Sjögren, sierologia prima della biopsia", quote: "ANA e anti-SSA/SSB precedono la biopsia delle ghiandole salivari minori. La biopsia serve se la sierologia è negativa e la secchezza è oggettiva, non come primo esame." },
      { chunkId: "reuma-013-collirio", source: "Sintesi operativa — occhio secco, lacrime prima della ciclosporina", quote: "Il collirio di ciclosporina è un passo successivo, oculistico, quando le lacrime artificiali non bastano. Darlo in apertura è fuori sequenza e costa." },
    ],
    indicators: [
      "ANA ed ENA prima di ogni biopsia.",
      "Lacrime artificiali come primo trattamento oculare.",
      "Ciclosporina in collirio non avviata dal reumatologo di prima battuta.",
      "Segni di allarme ghiandolare raccolti.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano la secchezza, gli anticorpi chiesti per primi e il motivo per cui la biopsia e la ciclosporina non sono il primo gesto.",
    legalCriteria: [
      "Biopsia salivare non eseguita prima di ANA ed ENA.",
      "Collirio di ciclosporina non dato senza fallimento delle lacrime e senza oculista.",
      "Sintomi sistemici chiesti.",
    ],
    mandatoryExams: [
      { examId: "ana", name: "ANA", finding: "ANA positivi, titolo 1:320. Costo 12 euro. È il primo esame, insieme all'ENA.", isAbnormal: true, priceEuro: 12 },
      { examId: "ena", name: "ENA", finding: "Anti-SSA positivi, anti-SSB negativi. Costo 25 euro. La biopsia non serve più come primo passo.", isAbnormal: true, priceEuro: 25 },
    ],
    inappropriateExams: [
      { examId: "biopsia", name: "Biopsia delle ghiandole salivari", finding: "Infiltrato linfocitario, informazione vera ma tardiva: gli anticorpi c'erano già. Costo 180 euro e un gesto invasivo non necessario in apertura.", isAbnormal: true, priceEuro: 180, wasteRationale: "Biopsia prima dello screening anticorpale: 180 euro e un rischio evitabile." },
      { examId: "rm", name: "RM", finding: "RM delle parotidi senza una massa da caratterizzare. Costo 220 euro.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM ghiandolare di prima linea, sopra il budget di 80 euro." },
    ],
    budget: 80,
    name: "Marta Esposito",
    age: 55,
    sex: "F",
    context: "Ambulatorio. Secchezza oculare e orale.",
    vitals: { heartRate: 76, bloodPressure: "130/78", spo2: 98, temperature: 36.6, respiratoryRate: 14 },
    signs: [
      { signName: "Secchezza delle mucose", result: "Bocca asciutta, occhi irritati, nessuna secrezione purulenta.", isPositive: true },
      { signName: "Linfonodo sospetto", result: "Nessuna adenopatia grossolana oggi.", isPositive: false },
    ],
    literacy: "HIGH",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Ha letto che la biopsia è definitiva e che la ciclosporina è la cura vera. Cambia ordine se le si dice che il sangue può evitare il taglio e che le lacrime vengono prima del collirio costoso.",
    steps: [
      { phase: "anamnesi", title: "Secchezza oggettiva", prompt: "Cosa raccogli?", cost: 0, score: 15, correctLabel: "Occhi, bocca, parotidi, carie, febbre e peso", wrongs: [{ label: "Prenotare subito la biopsia del labbro", next: "res-biopsia" }] },
      { phase: "diagnostica", title: "Anticorpi prima del taglio", prompt: "Qual è il primo laboratorio?", cost: 37, score: 20, correctLabel: "ANA e ENA, cercando anti-SSA e anti-SSB", wrongs: [{ label: "Biopsia salivare oggi, la sierologia dopo", next: "res-biopsia" }] },
      { phase: "screening", title: "Cosa non aggiungere", prompt: "Gli anti-SSA sono positivi. Cosa non fai?", cost: 0, score: 20, correctLabel: "Non biopsi e non apri ANCA o una RM", wrongs: [{ label: "RM delle parotidi e ANCA per completezza", next: "res-rm" }] },
      { phase: "terapia", title: "Lacrime, non ciclosporina", prompt: "Cosa prescrivi per gli occhi?", cost: 8, score: 25, correctLabel: "Lacrime artificiali e invio oculistico. Non ciclosporina in collirio oggi", wrongs: [{ label: "Collirio di ciclosporina come prima ricetta", next: "res-collirio" }] },
      { phase: "follow-up", title: "Ghiandole nel tempo", prompt: "Cosa le fai controllare?", cost: 0, score: 20, correctLabel: "Denti, gonfiori persistenti, febbre. Biopsia solo se più avanti la sierologia non bastasse", wrongs: [{ label: "Biopsia di routine fra un mese anche con anti-SSA positivo", next: "res-biopsia" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Sjögren senza biopsia d'ingresso", prompt: "ANA ed ENA positivi, lacrime avviate, biopsia non fatta, ciclosporina rinviata all'oculista se servirà.", cost: 45, score: 100 },
      { id: "res-biopsia", outcome: "negative", trap: "medico-legale", title: "Biopsia prima degli anticorpi", prompt: "Il labbro viene punto mentre anti-SSA sarebbe bastato. È un gesto invasivo evitabile, con dolore e un rischio locale inutili.", cost: 180, score: 0 },
      { id: "res-collirio", outcome: "negative", trap: "economico", title: "Ciclosporina fuori sequenza", prompt: "Il collirio di ciclosporina, circa 120 euro, è fuori indicazione come primo prodotto. Le lacrime non sono state provate e l'oculista non ha visto la cornea.", cost: 120, score: 0 },
      { id: "res-rm", outcome: "negative", trap: "economico", title: "RM e ANCA di troppo", prompt: "RM 220 euro e ANCA 20 euro superano il budget di 80 e non diagnosticano il Sjögren meglio dell'ENA.", cost: 240, score: 0 },
    ],
  },
  {
    n: 14,
    title: "Lupus in gravidanza",
    description:
      "Silvia Greco, 32 anni, è incinta di 11 settimane e ha un lupus noto. Prende ancora metotrexato perché nessuno le ha detto di sospenderlo, più idrossiclorochina. Il percorso è lo stop immediato del metotrexato, il mantenimento dell'idrossiclorochina, gli esami di attività senza radiografie non schermate. Continuare il metotrexato è la trappola grave.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "LOW",
    setting: "AMBULATORIO",
    condition: "LES in gravidanza: stop immediato del metotrexato, idrossiclorochina sì",
    guidelineRef: "Lupus e gravidanza — sospendere il metotrexato, continuare l'idrossiclorochina",
    diagnosis:
      "Lupus in gravidanza al primo trimestre, ancora esposta al metotrexato. Sospensione immediata, idrossiclorochina mantenuta, nessun RX non schermato.",
    pastMedicalHistory:
      "LES diagnosticato tre anni fa, anti-Ro positivo noto, anti-DNA variabile. Metotrexato 10 mg a settimana fino a ieri, idrossiclorochina 200 mg. Ultimo ciclo non arrivato, test di gravidanza positivo a casa, ecografia ostetrica che data 11 settimane. Nessun rash in questo periodo, nessuna proteinuria nota nell'ultimo anno. Pressione normale. Allergie: nessuna. Fuma no.",
    presentation:
      "Tiene in mano il blister del metotrexato e chiede se prenderlo anche stasera. Se le si dice di continuare «per non far riaccendere il lupus», obbedisce. Se le si toglie il blister e le si lascia l'idrossiclorochina, si spaventa per il bambino e poi si fida. Rifiuta una radiografia se le si dice che non è schermata.",
    redHerrings: [
      "Il lupus quieto fa sembrare inutile cambiare terapia.",
      "Un dolore lombare di gravidanza fa chiedere una RX del rachide.",
      "L'anti-Ro noto viene dimenticato e non si programma l'eco fetale.",
    ],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 25,
    patientPrompt:
      "ROLEPLAY. Sei Silvia Greco, 32 anni, incinta di 11 settimane, ambulatorio. Registro: spaventata, frasi brevi, guardi il blister. Alla «Come sta?»: «Sono incinta. Il lupus sta zitto. Prendo ancora questa.» [mostra il metotrexato] Non dire tu che il metotrexato è teratogeno finché non te lo spiegano. Se chiedono settimane, altri farmaci, rash, pressione, anti-Ro: undici settimane, anche l'idrossiclorochina, niente rash, pressione normale, ti hanno detto anni fa che hai l'anti-Ro. Se ti dicono di continuare il metotrexato, lo prendi stasera. Se te lo fanno sospendere e ti lasciano l'altra pastiglia, chiedi del bambino e accetti. Se ti propongono una lastra non schermata, esiti. Non nominare budget.",
    correctSolution:
      "Stop immediato del metotrexato, acido folico, consulenza ostetrica. Idrossiclorochina continuata. Urine, pressione, emocromo e complemento senza RX. Eco fetale programmata per l'anti-Ro. Nessuna radiografia non schermata. Follow-up ogni trimestre.",
    goldStandardPath: [
      "anamnesi-gravidanza",
      "azione-stop-metotrexato",
      "urine-sed",
      "emocromo",
      "c3-c4",
      "azione-continua-idrossiclorochina",
      "azione-followup-fetale",
    ],
    goldPathNarrative:
      "1) Anamnesi: 11 settimane, metotrexato fino a ieri, idrossiclorochina, anti-Ro noto, lupus quieto. 2) Nessuna RX. Urine 6 euro, emocromo 4,80, complemento 14. 3) Lo screening qui è la gravidanza già certa: il teratogeno si ferma oggi. 4) Stop del metotrexato, si tiene l'idrossiclorochina da 8 euro. 5) Follow-up ostetrico ed ecografia fetale per il blocco da anti-Ro. Una RX non schermata e il metotrexato continuato sono i due danni.",
    examLatencies: {
      "anamnesi-gravidanza": 6,
      "azione-stop-metotrexato": 2,
      "urine-sed": 60,
      emocromo: 60,
      "c3-c4": 1440,
      "azione-continua-idrossiclorochina": 4,
      "azione-followup-fetale": 10,
      "rx-ossa": 40,
      rm: 2880,
    },
    anamnesisQuestions: [
      q("aq-farmaci", "Quali compresse ha preso questa settimana, e di quante settimane è?", ["metotrexato", "settimane"], "Il metotrexato in corso a 11 settimane è l'urgenza della visita."),
      q("aq-attivita", "Ha rash, gonfiore, mal di testa o urine schiumose?", ["rash", "urine"], "Si distingue un lupus quieto da una riacutizzazione, senza aprire radiografie."),
      q("aq-ro", "Le hanno mai detto anti-Ro o anti-La, e ha già un'ecografia ostetrica?", ["anti-Ro", "ecografia"], "L'anti-Ro programma il controllo del cuore fetale. Non si perde nel cambio di terapia."),
    ],
    physicalSummary:
      "Addome gravido compatibile con il primo trimestre, nessun rash, nessuna sinovite, pressione normale, niente edema. Il blister del metotrexato è il reperto che conta più di qualunque lastra.",
    citations: [
      { chunkId: "reuma-014-mtx", source: "Sintesi operativa — metotrexato e gravidanza", quote: "Il metotrexato si sospende appena la gravidanza è nota. Non si continua per tenere quieto il lupus. L'idrossiclorochina, se tollerata, si mantiene." },
      { chunkId: "reuma-014-rx", source: "Sintesi operativa — imaging in gravidanza", quote: "Una radiografia non schermata non è un esame di attività del lupus. Urine, emocromo e complemento rispondono senza irradiare." },
    ],
    indicators: [
      "Metotrexato sospeso in visita, non rimandato.",
      "Idrossiclorochina continuata.",
      "Nessuna RX non schermata.",
      "Anti-Ro collegato al follow-up fetale.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano l'ora dello stop del metotrexato, i farmaci mantenuti e il rifiuto della radiografia non schermata.",
    legalCriteria: [
      "Metotrexato non rinnovato.",
      "Idrossiclorochina non sospesa senza un motivo.",
      "RX non richiesta per lombalgia o per attività di malattia.",
    ],
    mandatoryExams: [
      { examId: "urine-sed", name: "Urine", finding: "Nessuna proteinuria. Costo 6 euro. Il rene, oggi, è quieto.", isAbnormal: false, priceEuro: 6 },
      { examId: "emocromo", name: "Emocromo", finding: "Emoglobina 11,8 in gravidanza, piastrine normali. Costo 4,80 euro.", isAbnormal: false, priceEuro: 4.8 },
      { examId: "c3-c4", name: "Complemento", finding: "C3 e C4 nei limiti. Costo 14 euro. Nessuna riacutizzazione sierologica.", isAbnormal: false, priceEuro: 14 },
    ],
    inappropriateExams: [
      { examId: "rx-ossa", name: "RX non schermata", finding: "RX del rachide lombare chiesta per il dolore di gravidanza, senza schermatura. Costo 30 euro. Non cambia la cura del lupus e irradia.", isAbnormal: false, priceEuro: 30, wasteRationale: "RX non schermata in gravidanza: danno evitabile, esame non indicato." },
      { examId: "rm", name: "RM", finding: "RM non indicata per un lupus quieto. Costo 220 euro.", isAbnormal: false, priceEuro: 220, wasteRationale: "RM difensiva in un lupus senza segno d'organo nuovo." },
    ],
    budget: 50,
    name: "Silvia Greco",
    age: 32,
    sex: "F",
    context: "Ambulatorio. Lupus noto, gravidanza a 11 settimane, metotrexato ancora in corso.",
    vitals: { heartRate: 92, bloodPressure: "118/72", spo2: 99, temperature: 36.7, respiratoryRate: 16 },
    signs: [
      { signName: "Attività di lupus", result: "Nessun rash, nessuna sinovite, pressione normale.", isPositive: false },
      { signName: "Esposizione a metotrexato", result: "Blister in mano, ultima dose ieri.", isPositive: true },
    ],
    literacy: "MEDIUM",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "HIGH",
    support: "STRONG",
    communicationStyle: "Obbedisce al foglio della terapia precedente. Lascia il metotrexato solo se le si dice, in modo chiaro, che quella compressa è il rischio per il feto e che l'idrossiclorochina si tiene.",
    steps: [
      { phase: "anamnesi", title: "Farmaci e settimane", prompt: "Cosa deve essere chiaro nei primi minuti?", cost: 0, score: 15, correctLabel: "Settimane di gravidanza, metotrexato fino a ieri, idrossiclorochina, anti-Ro", wrongs: [{ label: "Rinnovare lo schema precedente senza rileggere il blister", next: "res-mtx" }] },
      { phase: "diagnostica", title: "Attività senza lastre", prompt: "Come misuri il lupus oggi?", cost: 24.8, score: 20, correctLabel: "Urine, emocromo e complemento. Nessuna RX", wrongs: [{ label: "RX del rachide non schermata per la lombalgia", next: "res-rx" }] },
      { phase: "screening", title: "Teratogeno già in corso", prompt: "Lo screening di gravidanza è già positivo. Cosa fai del metotrexato?", cost: 0, score: 20, correctLabel: "Lo sospendi in questa visita e avvisi l'ostetricia", wrongs: [{ label: "Lo sospendi dal secondo trimestre, per non riaccendere il lupus", next: "res-mtx" }] },
      { phase: "terapia", title: "Cosa si tiene", prompt: "Quale farmaco resta?", cost: 8, score: 25, correctLabel: "Idrossiclorochina sì. Metotrexato no. Folato e invio ostetrico", wrongs: [{ label: "Metotrexato e idrossiclorochina insieme, come prima", next: "res-mtx" }] },
      { phase: "follow-up", title: "Madre e feto", prompt: "Cosa programmi?", cost: 0, score: 20, correctLabel: "Controlli di attività ogni trimestre ed eco fetale per l'anti-Ro", wrongs: [{ label: "Nessun follow-up fino al parto, il lupus è quieto", next: "res-ritardo" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "Metotrexato fermato", prompt: "Stop immediato del teratogeno, idrossiclorochina mantenuta, attività vista senza lastre, feto in follow-up per l'anti-Ro.", cost: 32.8, score: 100 },
      { id: "res-mtx", outcome: "negative", trap: "medico-legale", title: "Metotrexato mantenuto in gravidanza", prompt: "La dose successiva espone un embrione di 11 settimane a un teratogeno noto. Continuare il metotrexato è il danno grave.", cost: 12.5, score: 0 },
      { id: "res-rx", outcome: "negative", trap: "medico-legale", title: "RX non schermata", prompt: "La radiografia senza schermatura non risponde a nessuna domanda sul lupus e irradia la gravidanza. È un esame evitabile.", cost: 30, score: 0 },
      { id: "res-ritardo", outcome: "negative", trap: "economico", title: "RM al posto dei controlli", prompt: "Una RM da 220 euro, o un pacchetto di imaging, non sostituisce urine e complemento e sfora il budget di 50 euro.", cost: 220, score: 0 },
    ],
  },
  {
    n: 15,
    title: "Pseudogotta da cristalli di CPPD",
    description:
      "Luigi Barbieri, 78 anni, ha un ginocchio caldo da due giorni, senza la podagra dell'alluce. La radiografia di quel ginocchio mostra la condrocalcinosi. Non è gotta: l'allopurinolo non cura i cristalli di pirofosfato. Il percorso è la RX dell'articolazione malata, l'artrocentesi se il dubbio resta, e la colchicina. Radiografare ogni articolazione è la trappola economica.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "PRONTO_SOCCORSO",
    condition: "CPPD: colchicina, non allopurinolo; RX solo dell'articolazione colpita",
    guidelineRef: "Pseudogotta — cristalli di CPPD, ipouricemizzante non indicato",
    diagnosis:
      "Artrite acuta da pirofosfato (CPPD) del ginocchio, condrocalcinosi radiografica. Colchicina. Non allopurinolo. Non un RX di tutte le articolazioni.",
    pastMedicalHistory:
      "Gonartrosi nota. Uricemia sempre normale, mai gotta, mai tofi. Ipertensione in amlodipina, non in tiazidico. Una crisi simile al ginocchio tre anni fa, passata in una settimana. Non febbre a casa sopra 38. Nessuna ferita. Beve un bicchiere di vino a pranzo. Allergie: nessuna.",
    presentation:
      "Il ginocchio è gonfio, l'alluce è freddo. Se gli si dà l'allopurinolo «per gli acidi» lo prende. Se gli si chiede una lastra di mani, spalle, anche e caviglie oltre al ginocchio, si stanca e chiede se serve. La colchicina la accetta se gli si dice che i cristalli non sono quelli della gotta.",
    redHerrings: [
      "L'artrosi nota fa dare solo un FANS e una dimissione senza nome.",
      "L'uricemia normale viene usata per escludere ogni cristallo.",
      "Chiede lastre di tutte le articolazioni che gli hanno mai fatto male.",
    ],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Luigi Barbieri, 78 anni, pronto soccorso, ginocchio sinistro gonfio. Registro: burbero, frasi corte. Alla «Come sta?»: «Il ginocchio è un pallone. L'alluce sta bene.» Non dire tu pseudogotta. Se chiedono alluce, febbre, gotta precedente, diuretico, altre articolazioni: l'alluce è a posto, febbricola no, niente gotta, niente pastiglia per urinare, tre anni fa lo stesso ginocchio. Se ti danno l'allopurinolo dici «così abbasso gli acidi». Se ti fanno la lastra di quel ginocchio e la colchicina, accetti. Se ti elencano sei lastre, brontoli. Non nominare budget.",
    correctSolution:
      "CPPD del ginocchio. RX di quel ginocchio con condrocalcinosi. Artrocentesi se serve a vedere i cristalli romboidali. Colchicina o FANS. Non allopurinolo. Non RX seriali di tutte le articolazioni. Follow-up e, se ricorrente, ricerca mirata di causa associata, non un pacchetto di lastre.",
    goldStandardPath: [
      "anamnesi-ginocchio",
      "rx-ossa",
      "artrocentesi",
      "azione-colchicina",
      "azione-followup",
    ],
    goldPathNarrative:
      "1) Anamnesi: ginocchio, alluce risparmiato, uricemia storica normale, niente tiazidico, niente febbre settica. 2) RX del ginocchio 30 euro: condrocalcinosi. Artrocentesi 55 euro se si vogliono i cristalli. Totale 85, dentro un budget di 120. 3) Non si screena un percorso di gotta. 4) Colchicina 3,50 euro. Allopurinolo 5 euro vietato: non è urato. 5) Follow-up. Sei radiografie invece di una costano circa 180 euro e non cambiano la colchicina.",
    examLatencies: {
      "anamnesi-ginocchio": 6,
      "rx-ossa": 40,
      artrocentesi: 40,
      "azione-colchicina": 6,
      "azione-followup": 8,
      uricemia: 60,
      ana: 4320,
      anca: 4320,
    },
    anamnesisQuestions: [
      q("aq-sede", "È solo il ginocchio, o anche l'alluce è rosso come nelle crisi di gotta?", ["ginocchio", "alluce"], "L'alluce risparmiato e la storia senza gotta spostano verso il pirofosfato."),
      q("aq-settica", "Ha febbre alta, una ferita o un'iniezione recente nel ginocchio?", ["febbre", "ferita"], "Prima di chiamarla pseudogotta si esclude l'artrite settica."),
      q("aq-urato", "Le hanno mai trovato l'acido urico alto, o prende un diuretico?", ["urico", "diuretico"], "Uricemia storica normale e niente tiazidico tolgono l'allopurinolo dal tavolo."),
    ],
    physicalSummary:
      "Ginocchio sinistro caldo con versamento, alluce freddo, nessun tofo, nessuna porta d'ingresso. Non è una podagra. La lastra di questo ginocchio basta: non serve un giro di radiografie.",
    citations: [
      { chunkId: "reuma-015-cppd", source: "Sintesi operativa — artrite da pirofosfato", quote: "I cristalli di CPPD si vedono in artrocentesi o si sospettano dalla condrocalcinosi. L'allopurinolo non li scioglie e non va iniziato." },
      { chunkId: "reuma-015-rx", source: "Tariffe didattiche REUMA-015 — una RX 30 €, sei RX circa 180 €", quote: "Si radiografa l'articolazione colpita. Ripetere la lastra su ogni distretto che ha mai fatto male moltiplica il costo senza una domanda clinica." },
    ],
    indicators: [
      "Alluce risparmiato e settica esclusa.",
      "RX del solo ginocchio, condrocalcinosi vista.",
      "Allopurinolo non prescritto.",
      "Colchicina avviata. Spesa entro 120 euro.",
    ],
    art5: "Legge 24/2017, art. 5: in cartella restano la sede, la condrocalcinosi, il rifiuto dell'allopurinolo e il motivo per cui non si è radiografato tutto lo scheletro.",
    legalCriteria: [
      "Allopurinolo non consegnato per una CPPD.",
      "Segni settici esclusi prima di una dimissione.",
      "RX limitata al ginocchio malato.",
    ],
    mandatoryExams: [
      { examId: "rx-ossa", name: "RX del ginocchio", finding: "Condrocalcinosi dei menischi, rima artrosica. Costo 30 euro. È la lastra che serve, una sola.", isAbnormal: true, priceEuro: 30 },
      { examId: "artrocentesi", name: "Artrocentesi", finding: "Cristalli romboidali, birifrangenti, compatibili con pirofosfato. Nessun germe al Gram. Costo 55 euro.", isAbnormal: true, priceEuro: 55 },
    ],
    inappropriateExams: [
      { examId: "uricemia", name: "Uricemia usata per aprire l'allopurinolo", finding: "Uricemia 5,1 mg/dL, normale. Costo 3 euro. Non autorizza l'allopurinolo e non esclude i cristalli di CPPD.", isAbnormal: false, priceEuro: 3, wasteRationale: "Usare l'uricemia normale per negare ogni artropatia da cristalli, o per iniziare comunque l'allopurinolo." },
      { examId: "ana", name: "ANA", finding: "ANA negativi. Costo 12 euro.", isAbnormal: false, priceEuro: 12, wasteRationale: "ANA in una monoartrite da cristalli." },
      { examId: "anca", name: "ANCA", finding: "ANCA negativi. Costo 20 euro.", isAbnormal: false, priceEuro: 20, wasteRationale: "ANCA senza vasculite, a pioggia." },
    ],
    budget: 120,
    name: "Luigi Barbieri",
    age: 78,
    sex: "M",
    context: "Pronto soccorso. Monoartrite del ginocchio e condrocalcinosi.",
    vitals: { heartRate: 86, bloodPressure: "148/82", spo2: 97, temperature: 37.5, respiratoryRate: 16 },
    signs: [
      { signName: "Ginocchio con versamento", result: "Caldo, tumefatto, alluce risparmiato.", isPositive: true },
      { signName: "Podagra", result: "Prima metatarso-falangea fredda. Non è la gotta classica.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "DEFENSIVE",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Vuole la pastiglia degli acidi. Si convince della colchicina se gli si dice che i suoi cristalli non sono quelli della gotta e che una sola lastra del ginocchio basta.",
    steps: [
      { phase: "anamnesi", title: "Quale cristallo", prompt: "Cosa distingui prima degli esami?", cost: 0, score: 15, correctLabel: "Ginocchio sì, alluce no, niente gotta nota, niente febbre settica", wrongs: [{ label: "Chiamarla gotta e prescrivere allopurinolo subito", next: "res-allo" }] },
      { phase: "diagnostica", title: "Una lastra, non sei", prompt: "Quale imaging?", cost: 30, score: 20, correctLabel: "RX del solo ginocchio malato", wrongs: [{ label: "RX di ginocchia, mani, spalle, anche e caviglie", next: "res-rx" }] },
      { phase: "screening", title: "Cristalli, non urato", prompt: "La lastra mostra condrocalcinosi. Cosa confermi, e cosa non dosi per curare?", cost: 55, score: 20, correctLabel: "Artrocentesi per i cristalli di pirofosfato. L'uricemia non decide l'allopurinolo", wrongs: [{ label: "ANA e ANCA prima di trattare", next: "res-rx" }] },
      { phase: "terapia", title: "Colchicina, non allopurinolo", prompt: "Cosa consegni?", cost: 3.5, score: 25, correctLabel: "Colchicina per l'attacco. Nessun allopurinolo", wrongs: [{ label: "Allopurinolo 300 mg da oggi", next: "res-allo" }] },
      { phase: "follow-up", title: "Non un atlante radiografico", prompt: "Cosa programmi dopo?", cost: 0, score: 20, correctLabel: "Controllo clinico. Altre lastre solo se un'articolazione si accende", wrongs: [{ label: "Radiografare a priori tutte le articolazioni rimaste", next: "res-rx" }] },
    ],
    resolutions: [
      { id: "res-ok", outcome: "positive", title: "CPPD riconosciuta", prompt: "Condrocalcinosi e cristalli di pirofosfato, colchicina, allopurinolo non dato, una sola radiografia.", cost: 88.5, score: 100 },
      { id: "res-allo", outcome: "negative", trap: "medico-legale", title: "Ipouricemizzante sulla malattia sbagliata", prompt: "L'allopurinolo non scioglie il pirofosfato. Il paziente prende un farmaco inutile, con i suoi rischi, per una gotta che non ha.", cost: 5, score: 0 },
      { id: "res-rx", outcome: "negative", trap: "economico", title: "RX su ogni articolazione", prompt: "Sei radiografie costano circa 180 euro e superano il budget di 120. Il ginocchio malato ne chiedeva una.", cost: 180, score: 0 },
    ],
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const failures: string[] = [];
  for (const spec of CASES) {
    const id = `REUMA-${String(spec.n).padStart(3, "0")}`;
    let payload: ReturnType<typeof assemble>;
    try {
      payload = assemble(spec);
    } catch (error) {
      failures.push(`${id} build: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const parsed = KnowledgeBaseCaseSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      failures.push(`${id} schema: ${issue?.path.join(".") || "root"} — ${issue?.message}`);
      continue;
    }
    const playable = assertPlayableCase(payload);
    if (!playable.ok) {
      failures.push(`${id} playable: ${playable.issues.map((item) => `${item.path}: ${item.message}`).join("; ")}`);
      continue;
    }
    const decisions = payload.nodes.filter((node) => node.type === "decision").length;
    if (decisions < 5) {
      failures.push(`${id} decisioni ${decisions}`);
      continue;
    }
    await writeFile(resolve(OUT_DIR, `${id}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`scritto ${id}.json (${payload.nodes.length} nodi, ${decisions} decisioni)`);
  }
  if (CASES.length !== 15) {
    failures.push(`attesi 15 casi, trovati ${CASES.length}`);
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log("15 casi di reumatologia validati e scritti.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
