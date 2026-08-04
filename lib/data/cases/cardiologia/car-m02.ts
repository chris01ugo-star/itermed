/**
 * CAR-M02 — Edema Polmonare Acuto Cardiogeno (EPA) su Scompenso Riacutizzato
 * (Prassi Clinica → Cardiologia → Medio)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 5)
 * - _common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf (Art. 13)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const EGA_FINDING =
  "EGA arteriosa: PaO₂ 52 mmHg (ipossiemia acuta <60), PaCO₂ 38 mmHg (normocapnia iniziale), pH 7.32, " +
  "HCO₃⁻ 19 mmol/L — acidosi metabolica lieve / mista su stasi e lavoro respiratorio. Lactate 2.4 mmol/L.";

const ECG_FINDING =
  "Ritmo sinusale a 110 bpm. Nessun sopraslivellamento ST. Nessun sottoslivellamento ST significativo di nuova evidenza. " +
  "Possibili anomalie aspecifiche della ripolarizzazione su base di cardiopatia ischemico-ipertensiva nota. " +
  "QRS non allargato in modo critico. Esclusione immediata di STEMI come trigger primario obbligata.";

const RX_POCUS_FINDING =
  "RX torace bedside / Ecografia toracica POCUS: linee B diffuse bilaterali («wet lung» / comete ultrasonore) " +
  "fino ai campi medi-superiori; pattern di congestione alveolare acuta. Cardiomegalia nota. Non pneumotorace.";

const LAB_PANEL_FINDING =
  "NT-proBNP marcatamente elevato (congruo con scompenso acuto). Troponina hs: lieve elevazione possibile da strain " +
  "senza cinetica da SCA primaria. Creatinina 1.40 mg/dL · K 4.3 · Na 136 — monitorare pre-diuretico ad alte dosi.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: FE stimata ~30–35% (HFrEF nota). Dilatazione VS, ipocinesia globale. " +
  "Pressioni di riempimento elevate (E/e' aumentato). VCI dilatata scarsamente collassabile. " +
  "Nessun versamento pericardico tamponante. Valvola mitralica: rigurgito almeno moderato funzionale.";

const TC_WASTE_FINDING =
  "TC Torace HRCT / Coronaro-TC in acuto: assolutamente inappropriata — paziente incapace di decubito orizzontale, " +
  "ritarda CPAP/NIV salvavita e spreca ≈ €180 di risorsa SSN.";

const PHYSICAL_SUMMARY =
  "Uomo di 74 anni, seduto, cianotico, sudato, agitato, ortopnoico. Killip III (EPA). " +
  "PA 175/100 mmHg (drive simpatico), FC 110 bpm ritmica, FR 32 atti/min, SpO₂ 84% in aria ambiente. " +
  "Rantoli a marea montante fino ai campi medi-superiori. Toni con S3 (galoppo). Giugulari turgide a 45°.";

/** Budget I livello gold (12+11.60+24+38+43.90) ≈ €129.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 160;

export const CAR_M02: ClinicalCase = {
  code: "CAR-M02",
  id: "car-m02",
  title: "Edema Polmonare Acuto Cardiogeno (EPA) su Scompenso Riacutizzato",
  description:
    "Uomo, 74 anni, cardiopatia ischemico-ipertensiva e HFrEF (FE 35%), condotto in PS via 118 per grave dispnea " +
    "ad esordio iperacuto notturno (ortopnea marcata), fame d'aria, tachipnea (32 atti/min) e tosse con espettorato " +
    "schiumoso rosato. Caso gold standard Prassi Clinica — Cardiologia — Medio (CPAP + diuretico + nitrati).",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "MEDIUM",
  difficultyLabel: "medio",
  estimatedTimeMinutes: 25,
  estimatedDurationMinutes: 25,
  timeLimitMinutes: 25,
  patientDeteriorationThreshold: 8,
  patientPrompt: [
    "Sei Luigi, 74 anni. Di notte ti sei svegliato con fame d'aria terribile, non riesci a sdraiarti, tossisci una schiuma rosata.",
    "Sei seduto, sudato, agitato. Hai lo scompenso con FE bassa. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, a frasi brevi per la dispnea. Se chiedono: forse hai mangiato salato o saltato il diuretico, " +
      "peso aumentato, prendi ACE-inibitore/ARNI/SGLT2i/spirolattone a casa, NYHA II–III abituale, non sei un grande BPCO.",
    "Se ritardano ossigeno/CPAP o diuretico ev, peggiori rapidamente. Se ti mettono seduto con CPAP e diuretico, ti calmi un poco.",
  ].join(" "),
  pastMedicalHistory:
    "Cardiopatia ischemico-ipertensiva. HFrEF nota con FE ~35%. Terapia domiciliare: ACEi o ARNI, beta-bloccante, " +
    "SGLT2i, spirolattone, diuretico dell'ansa a bisogno. Possibile scarsa aderenza a dieta iposodica / diuretico nelle ultime 48h. " +
    "NYHA abituale II–III. Non BPCO severa documentata. Nessuna allergia nota a nitrati/furosemide.",
  diagnosis:
    "Edema polmonare acuto cardiogeno (Killip III) su riacutizzazione di scompenso a frazione di eiezione ridotta (HFrEF)",
  correctSolution:
    "Posizione seduta + O₂ / CPAP Boussignac o NIMV (PEEP 5–10 cmH₂O) immediate → furosemide ev 40–80 mg entro 30' → " +
    "nitroglicerina ev se PAS >110 mmHg → EGA + ECG + imaging congestione (RX/POCUS) + NT-proBNP/Tn/labs + eco bedside. " +
    "Vietare TC/Coronaro-TC in acuto che ritarda la ventilazione non invasiva.",
  goldStandardPath: [
    "ega",
    "ecg",
    "rx-torace",
    "nt-probnp",
    "troponina-hs",
    "elettroliti",
    "creat-urea-gfr",
    "ecocardio",
    "consenso-informato",
  ],
  examLatencies: {
    ega: 5,
    ecg: 8,
    "rx-torace": 15,
    "nt-probnp": 40,
    "troponina-hs": 35,
    elettroliti: 30,
    "creat-urea-gfr": 30,
    ecocardio: 15,
    angio: 45,
    tc: 40,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_aderenza_dieta_diuretici",
      prompt:
        "Deroga alla dieta iposodica o mancata aderenza ai diuretici nelle ultime 48 ore (trigger di riacutizzazione)",
      critical: true,
      expectedKeywords: ["sale", "sodico", "diuretico", "furosemide", "pastiglie", "aderenz", "saltato"],
      rationale: "Trigger classico di EPA su HFrEF — ESC HF 2021.",
    },
    {
      id: "aq_infezione_febbre",
      prompt: "Infezioni intercorrenti / febbre / sintomi respiratori infettivi come precipitante",
      critical: true,
      expectedKeywords: ["febbre", "infezione", "raffreddore", "polmonite", "tosse produttiva", "antibiot"],
      rationale: "Infezione è precipitante frequente di scompenso acuto; influenza anche la DD polmonare.",
    },
    {
      id: "aq_incremento_ponderale",
      prompt: "Incremento ponderale acuto (kg in pochi giorni) come marker di ritenzione idrosalina",
      critical: true,
      expectedKeywords: ["peso", "chili", "gonfio", "edemi", "ritenzione", "aumentato"],
      rationale: "Congestione progressiva pre-EPA; guida intensità diuresi e follow-up.",
    },
    {
      id: "aq_dolore_toracico",
      prompt: "Dolore toracico concomitante (possibile SCA come trigger di EPA)",
      critical: true,
      expectedKeywords: ["dolore", "petto", "angina", "oppress", "retrosternal"],
      rationale: "Escludere SCA come causa precipitante — ECG obbligatorio.",
    },
    {
      id: "aq_terapia_gdmt",
      prompt: "Terapia domiciliare GDMT: ACEi/ARNI, SGLT2i, spirolattone, beta-bloccante, diuretico",
      critical: true,
      expectedKeywords: [
        "ace",
        "arni",
        "sacubitril",
        "sglt",
        "dapagliflozin",
        "empagliflozin",
        "spirolattone",
        "bisoprololo",
      ],
      rationale: "Baseline terapeutico e interazioni (ipotensione da nitrati, iperkaliemia, funzione renale).",
    },
    {
      id: "aq_nyha_abituale",
      prompt: "Riserva funzionale NYHA abituale (baseline prima della riacutizzazione)",
      critical: true,
      expectedKeywords: ["nyha", "scale", "quanti piani", "a riposo", "sforzo", "abituale"],
      rationale: "Definisce la gravità relativa dell'episodio e il target di destressaggio.",
    },
    {
      id: "aq_bpco_broncopatia",
      prompt: "Anamnesi di broncopatia / COPD per diagnosi differenziale (EPA vs esacerbazione BPCO)",
      critical: true,
      expectedKeywords: ["bpco", "bronchite", "asma", "fum", "ossigeno a casa", "spirometria"],
      rationale: "DD critica: rantoli da stasi vs sibili/BPCO — influenza NIV settings e terapia.",
    },
    {
      id: "aq_esordio_ortopnea",
      prompt: "Caratteristiche dell'esordio: iperacuto notturno, ortopnea, espettorato schiumoso rosato",
      critical: true,
      expectedKeywords: ["notte", "ortopnea", "sdraiato", "schiuma", "rosato", "fame d'aria"],
      rationale: "Fenotipo clinico tipico di EPA cardiogeno — priorità a CPAP e diuresi ev.",
    },
  ],

  /* ── Esame obiettivo SSOT (Killip III) ─────────────────────────── */
  physicalExam: {
    killipClass: "III",
    summary: PHYSICAL_SUMMARY,
    districts: [
      {
        district: "generale",
        finding:
          "Seduto, cianotico, sudato, agitato, ortopnoico, tachipnoico (FR 32). Killip III — edema polmonare acuto.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 175/100 mmHg (ipertensione da drive simpatico), FC 110 bpm ritmica. " +
          "Toni ritmici in parafonia; terzo tono (S3 / galoppo). Giugulari turgide a 45°.",
      },
      {
        district: "torace_polmonare",
        finding:
          "SpO₂ 84% in aria ambiente. Rantoli a marea montante e subcrepitanti estesi fino ai campi medi e superiori " +
          "bilateralmente («polmone da stasi acuta»).",
      },
      {
        district: "addome",
        finding: "Addome trattabile; possibile epatomegalia da stasi; non peritonismo.",
      },
      {
        district: "neurologico",
        finding: "Vigile ma agitato per ipossiemia; GCS 15. Nessun deficit focale.",
      },
      {
        district: "periferico",
        finding:
          "Cute sudata, periferia fresca. Possibili edemi declivi da scompenso cronico. Polsi presenti, tachicardici.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "ega",
      name: "Emogasanalisi arteriosa (EGA) rapida",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 12.0,
      finding: EGA_FINDING,
    },
    {
      examId: "ecg",
      name: "ECG 12 derivazioni (esclusione ischemia acuta)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "rx-torace",
      name: "RX Torace bedside / Ecografia toracica POCUS (linee B / wet lung)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 20,
      priceEuro: 24.0,
      componentExamIds: ["rx-torace", "ecografia"],
      finding: RX_POCUS_FINDING,
    },
    {
      examId: "nt-probnp",
      name: "NT-proBNP / BNP + Troponina hs + Creatinina/Elettroliti",
      level: "I",
      mandatory: true,
      priceEuro: 38.0,
      componentExamIds: ["nt-probnp", "troponina-hs", "creat-urea-gfr", "elettroliti"],
      finding: LAB_PANEL_FINDING,
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico bedside",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 25,
      priceEuro: 43.9,
      finding: ECOCARDIO_FINDING,
    },
  ],

  /* ── Esami inappropriati / spreco SSN (−25%) ───────────────────── */
  inappropriateExams: [
    {
      examId: "tc",
      name: "TC Torace HRCT in acuto",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180.0,
      finding: TC_WASTE_FINDING,
      wasteRationale:
        "Impraticabile in ortopnea severa; ritarda CPAP salvavita; spreco ≈ €180.",
    },
    {
      examId: "angio",
      name: "Coronaro-TC / Angio-TC in acuto",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180.0,
      finding: TC_WASTE_FINDING,
      wasteRationale:
        "Assolutamente inappropriata in EPA: ritardo terapeutico e costo SSN non giustificato in fase acuta.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_cpap_niv",
        description:
          "Avvia precocemente CPAP (Boussignac) o NIMV con PEEP 5–10 cmH₂O insieme a posizione seduta e O₂",
        requiredMilestoneKeys: ["cpap", "niv", "nimv", "ossigenoterapia", "boussignac", "peep"],
      },
      {
        id: "leg_furosemide_30min",
        description: "Somministra furosemide / diuretico ev ad alte dosi entro 30 minuti dall'ingresso",
        requiredMilestoneKeys: ["furosemide", "diuretico_ev", "diuresi_ev"],
      },
      {
        id: "leg_ega_monitoraggio",
        description: "Esegue e monitora l'EGA arteriosa per guidare ossigenazione / ventilazione",
        requiredMilestoneKeys: ["ega", "gold_standard_ega", "richiesto_ega"],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf (Gestione Scompenso Cardiaco Acuto ed Edema Polmonare, indicazioni a CPAP e Nitrati/Diuretici)",
        documentPath: "cardiologia/02_protocolli_pdta/2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf",
        articles: [
          "Acute HF / Cardiogenic pulmonary oedema",
          "CPAP / NIV",
          "Loop diuretics",
          "Vasodilators / Nitrates",
        ],
        relevance:
          "Standardizza CPAP/NIV, diuretici ev e nitrati (se PAS adeguata) nell'edema polmonare acuto cardiogeno.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Tempestività nell'applicazione delle manovre salvavita)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 5"],
        relevance:
          "Tempestività delle manovre salvavita (CPAP, diuretico <30') come aderenza alle buone pratiche clinico-assistenziali.",
      },
      {
        sourceRef:
          "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Gestione delle emergenze cliniche)",
        documentPath: "_common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf",
        articles: ["Art. 13"],
        relevance:
          "Appropriatezza nella gestione dell'emergenza: priorità a ventilazione/diuresi vs imaging inappropriato.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 74,
      sex: "M",
      context: "Pronto Soccorso via 118 — EPA / scompenso acuto",
    },
    vitals: {
      bloodPressure: "175/100",
      heartRate: 110,
      spo2: 84,
      temperature: 36.4,
      respiratoryRate: 32,
      bp: "175/100",
      hr: 110,
      temp: 36.4,
      rr: 32,
      position: "sitting",
      hemodynamicStatus: "hypertensive_acute_HF",
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "III",
      s3Gallop: true,
      jugularDistension45: true,
      frothyPinkSputum: true,
    },
    thorax: {
      cardiacAuscultation: "Toni ritmici in parafonia a 110 bpm; terzo tono (S3 / galoppo).",
      lungAuscultation:
        "Rantoli a marea montante e subcrepitanti fino ai campi medi-superiori bilaterali (stasi acuta).",
    },
    abdomen: {
      inspection: "Addome piano / lievemente globoso.",
      palpation: "Trattabile; possibile epatomegalia da stasi.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Agitato per ipossiemia; nessun deficit focale",
    },
    peripheral: {
      finding: "Cute sudata, periferia fresca; edemi declivi possibili; polsi tachicardici.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-M02",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "medio",
    estimatedTimeMinutes: 25,
    goldTherapy: {
      immediate: [
        "posizione_seduta",
        "O2_CPAP_Boussignac_o_NIMV_PEEP_5_10",
        "furosemide_ev_40_80_mg_entro_30_min",
        "nitroglicerina_ev_se_PAS_gt_110",
      ],
    },
    legalConformityCriteria: [
      "cpap_niv_precoce",
      "furosemide_ev_entro_30_min",
      "ega_monitorata",
    ],
    ragSourceRefs: [
      "Rif. 2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf (Gestione Scompenso Cardiaco Acuto ed Edema Polmonare, indicazioni a CPAP e Nitrati/Diuretici)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Tempestività nell'applicazione delle manovre salvavita)",
      "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Gestione delle emergenze cliniche)",
    ],
    econModule: {
      mandatory: [
        { examId: "ega", priceEuro: 12.0 },
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "rx-torace", priceEuro: 24.0 },
        { examId: "nt-probnp", priceEuro: 38.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
      ],
      inappropriate: [
        { examId: "tc", priceEuro: 180.0, penaltyPercent: 25 },
        { examId: "angio", priceEuro: 180.0, penaltyPercent: 25 },
      ],
      goldPathCostEuro: 12.0 + 11.6 + 24.0 + 38.0 + 43.9,
    },
    stressProfile: {
      initialStress: 90,
      reactivityType: "hyper",
      timeDecayRate: 3.0,
      criticalMilestones: {
        reduceStress: [
          "cpap",
          "niv",
          "furosemide",
          "ossigenoterapia",
          "posizione_seduta",
          "nitroglicerina",
        ],
        increaseStress: ["tc", "angio", "decubito_supino", "ritardo_cpap"],
      },
      lifesavingMilestones: ["cpap", "niv", "furosemide", "ega"],
      relievingExams: ["ega", "ecg", "rx-torace", "ecocardio", "nt-probnp"],
      dangerousPrescriptions: ["tc", "angio"],
    },
    labPanel: { finding: LAB_PANEL_FINDING },
    ega: { finding: EGA_FINDING },
    ecg: { finding: ECG_FINDING },
    "rx-torace": { finding: RX_POCUS_FINDING },
    ecografia: { finding: RX_POCUS_FINDING },
    "nt-probnp": { finding: "NT-proBNP marcatamente elevato — congruo con scompenso acuto / EPA." },
    "troponina-hs": {
      finding: "Troponina hs: lieve elevazione da strain possibile — senza cinetica tipica di SCA primaria.",
    },
    elettroliti: { finding: "Na 136 · K 4.3 — monitorare sotto diuresi ad alte dosi." },
    "creat-urea-gfr": { finding: "Creatinina 1.40 mg/dL — rivalutare dopo diuresi / nitrati." },
    ecocardio: { finding: ECOCARDIO_FINDING },
    tc: { finding: TC_WASTE_FINDING, cost: 180 },
    angio: { finding: TC_WASTE_FINDING, cost: 180 },
    advancedExams: {
      notes:
        "CAR-M02 EPA Killip III su HFrEF · Prassi Clinica · Medio. " +
        "CPAP/NIV + furosemide <30' + nitrati se PAS>110. EGA obbligatoria. Vietare TC in acuto.",
      values: {
        ega: {
          price: 12.0,
          urgencyTiming: "immediata",
          routineTiming: "n.p.",
          routineMinutes: 5,
          normalFinding: EGA_FINDING,
          isAbnormal: true,
        },
        ecg: {
          price: 11.6,
          urgencyTiming: "≤10 min",
          routineTiming: "n.p.",
          routineMinutes: 8,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        "rx-torace": {
          price: 24.0,
          urgencyTiming: "15 min bedside / POCUS",
          routineTiming: "n.p.",
          routineMinutes: 15,
          normalFinding: RX_POCUS_FINDING,
          isAbnormal: true,
        },
        "nt-probnp": {
          price: 18.0,
          urgencyTiming: "40 min",
          routineTiming: "2h",
          routineMinutes: 40,
          normalFinding: "NT-proBNP marcatamente elevato — congruo con scompenso acuto / EPA.",
          isAbnormal: true,
        },
        "troponina-hs": {
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding:
            "Troponina hs: lieve elevazione da strain possibile — senza cinetica tipica di SCA primaria.",
          isAbnormal: true,
        },
        elettroliti: {
          price: 6.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Na 136 · K 4.3 — monitorare sotto diuresi ad alte dosi.",
        },
        "creat-urea-gfr": {
          price: 6.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Creatinina 1.40 mg/dL — rivalutare dopo diuresi / nitrati.",
          isAbnormal: true,
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "15 min bedside",
          routineTiming: "n.p.",
          routineMinutes: 15,
          normalFinding: ECOCARDIO_FINDING,
          isAbnormal: true,
        },
        tc: {
          price: 180.0,
          urgencyTiming: "non indicato in acuto",
          routineTiming: "n.p.",
          routineMinutes: 40,
          normalFinding: TC_WASTE_FINDING,
        },
        angio: {
          price: 180.0,
          urgencyTiming: "non indicato in acuto",
          routineTiming: "n.p.",
          routineMinutes: 45,
          normalFinding: TC_WASTE_FINDING,
        },
      },
    },
  },
};

export default CAR_M02;
