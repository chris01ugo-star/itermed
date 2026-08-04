/**
 * CAR-F02 — Fibrillazione Atriale ad Alta Risposta Ventricolare (FA-ARV)
 * (Prassi Clinica → Cardiologia → Facile)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/01_linee_guida/Linee-Guida-ESC-2020-sulla-Gestione-della-Fibrillazione-Atriale-1.pdf
 * - cardiologia/03_prontuario_ssn/nota-95.pdf
 * - _common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf (Art. 13)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Assenza di onde P; intervalli R-R irregolarmente irregolari; QRS stretto; frequenza ventricolare media ≈145 bpm. " +
  "Diagnosi: Fibrillazione Atriale ad Alta Risposta Ventricolare (FA-ARV). Nessun sopraslivellamento ST significativo.";

const LAB_PANEL_FINDING =
  "Ematochimici + elettroliti: Na 140 · K 4.0 · Mg 1.9 · Cl 103 mmol/L — nei limiti. " +
  "TSH 1.8 mU/L · FT4 nei range — tireotossicosi esclusa. Creatinina 0.90 mg/dL · eGFR >60. Emocromo nei limiti.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: atrio sinistro lievemente dilatato; FE stimata ~55–60% (preservata). " +
  "Nessun versamento pericardico. Valvole senza stenosi critica di nuova evidenza. Compatible con FA in cardiopatia ipertensiva.";

const ANGIO_WASTE_FINDING =
  "Coronarografia d'urgenza / Angio-TC torace: inappropriata in FA isolata emodinamicamente stabile — " +
  "spreco di risorsa SSN e assenza di indicazione (nessuna SCA, nessuna instabilità).";

const PHYSICAL_SUMMARY =
  "Donna di 71 anni, vigile, collaborante, riferisce palpitazioni e astenia. Emodinamicamente STABILE. " +
  "PA 135/80 mmHg, FC 145 bpm con toni cardiaci aritmici («delirium cordis»), SpO₂ 97% in aria ambiente. " +
  "Toni validi, non soffi di nuova insorgenza. Polmoni liberi da rantoli. Perfusione periferica conservata.";

/** Budget I livello gold (11.60+32+43.90) ≈ €87.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 120;

export const CAR_F02: ClinicalCase = {
  code: "CAR-F02",
  id: "car-f02",
  title: "Fibrillazione Atriale ad Alta Risposta Ventricolare (FA-ARV)",
  description:
    "Donna, 71 anni, ipertesa e cardiopatica, giunge in PS per palpitazioni «a battito irregolare», cardiopalmo ed astenia " +
    "comparsi da circa 6 ore. Caso gold standard Prassi Clinica — Cardiologia — Facile (rate control + CHA₂DS₂-VASc + DOAC).",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "EASY",
  difficultyLabel: "facile",
  estimatedTimeMinutes: 20,
  estimatedDurationMinutes: 20,
  timeLimitMinutes: 20,
  patientDeteriorationThreshold: 12,
  patientPrompt: [
    "Sei Anna, 71 anni. Da circa 6 ore senti il cuore che batte forte e irregolare, con debolezza. Sei ipertesa e «un po' cardiopatica».",
    "Sei stabile: non svenire e non descrivere dolore toracico anginoso intenso. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, preoccupata ma collaborante. Se chiedono: sintomi da ~6 ore (<48h), episodi simili in passato possibili, " +
      "non sei in terapia anticoagulante, prendi antiipertensivi, non hai avuto ictus/TIA, non sei diabetica.",
    "Se il medico propone subito coronarografia o Angio-TC senza motivo, aumenta ansia. Se spiega rate control e anticoagulante, ti calmi.",
  ].join(" "),
  pastMedicalHistory:
    "Ipertensione arteriosa in terapia con ACE-inibitore e calcio-antagonista. Cardiopatia ipertensiva nota. " +
    "Non diabetica. Nessun TIA/ictus pregresso. Non in terapia anticoagulante né antiaggregante cronica. " +
    "Possibili episodi di palpitazioni irregolari in passato non documentati. Nessuna allergia nota.",
  diagnosis:
    "Fibrillazione atriale di nuova insorgenza / parossistica ad alta risposta ventricolare — emodinamicamente stabile · CHA₂DS₂-VASc = 3",
  correctSolution:
    "ECG diagnostico di FA-ARV → rate control (beta-bloccante iv es. metoprololo/esmololo o diltiazem se appropriato) → " +
    "ematochimici/elettroliti/TSH → eco TT → calcolo CHA₂DS₂-VASc (=3: ipertensione, età ≥65, sesso femminile) → " +
    "prescrizione DOAC secondo Nota AIFA 95. Evitare coronarografia/Angio-TC in stabilità.",
  goldStandardPath: [
    "ecg",
    "elettroliti",
    "ecocardio",
    "consenso-informato",
  ],
  examLatencies: {
    ecg: 8,
    elettroliti: 30,
    emocromo: 30,
    "creat-urea-gfr": 30,
    ecocardio: 18,
    angio: 45,
    tc: 40,
    coronarografia: 40,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_timing_48h",
      prompt: "Timing esatto d'insorgenza delle palpitazioni (<48h vs >48h) per strategia di ritmo/anticoagulazione",
      critical: true,
      expectedKeywords: ["da quanto", "quando è iniziato", "ore", "48", "ieri", "insorgenza"],
      rationale: "Soglia 48h influenza cardioversione immediata vs necessità di anticoaugulazione/imaging — ESC AF 2020.",
    },
    {
      id: "aq_episodi_pregressi_fa",
      prompt: "Episodi pregressi di fibrillazione atriale o palpitazioni irregolari documentate",
      critical: true,
      expectedKeywords: ["già successo", "fibrillazione", "aritmia", "palpitazioni", "pregress"],
      rationale: "Inquadra FA di nuova diagnosi vs parossistica / persistente e la storia di gestione.",
    },
    {
      id: "aq_anticoagulante_antiaggregante",
      prompt: "Terapia anticoagulante o antiaggregante in uso (DOAC, warfarin, ASA, clopidogrel)",
      critical: true,
      expectedKeywords: ["anticoagulant", "coumadin", "eliquis", "xarelto", "aspirina", "cardioaspirin", "warfarin"],
      rationale: "Baseline emostatico prima di DOAC / eventuali procedure; evita duplicazioni pericolose.",
    },
    {
      id: "aq_ipertensione",
      prompt: "Anamnesi di ipertensione arteriosa (voce CHA₂DS₂-VASc)",
      critical: true,
      expectedKeywords: ["ipertens", "pression", "antiipertens"],
      rationale: "Componente dello score CHA₂DS₂-VASc — indica bisogno di anticoaugulazione se score ≥2 (donne ≥3).",
    },
    {
      id: "aq_diabete",
      prompt: "Diabete mellito (voce CHA₂DS₂-VASc)",
      critical: true,
      expectedKeywords: ["diabet", "glicem", "zucchero", "insulina"],
      rationale: "Fattore di rischio tromboembolico nello score CHA₂DS₂-VASc.",
    },
    {
      id: "aq_tia_ictus",
      prompt: "Pregresso TIA / ictus / tromboembolismo sistemico (voce CHA₂DS₂-VASc a 2 punti)",
      critical: true,
      expectedKeywords: ["ictus", "tia", "stroke", "paralisi", "trombo"],
      rationale: "Se presente eleva drasticamente lo score e rafforza l'indicazione assoluta al DOAC.",
    },
    {
      id: "aq_sintomi_emodinamici_sincope",
      prompt: "Sintomi emodinamici: sincope, lipotimia, pre-sincope",
      critical: true,
      expectedKeywords: ["svenut", "sincope", "lipotim", "nero davanti", "cadut"],
      rationale: "Instabilità → considerare cardioversione elettrica immediata invece del solo rate control.",
    },
    {
      id: "aq_sintomi_emodinamici_angor",
      prompt: "Sintomi emodinamici / ischemici: angor, dolore toracico, dispnea severa a riposo",
      critical: true,
      expectedKeywords: ["dolore", "petto", "angina", "dispnea", "affanno", "oppress"],
      rationale: "Angor o scompenso orientano verso pathway ACS/instabilità e non FA isolata stabile.",
    },
  ],

  /* ── Esame obiettivo SSOT (stabile) ────────────────────────────── */
  physicalExam: {
    killipClass: "I",
    summary: PHYSICAL_SUMMARY,
    districts: [
      {
        district: "generale",
        finding:
          "Vigile, orientata, collaborante, astenica, riferisce palpitazioni. Emodinamicamente stabile. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 135/80 mmHg, FC 145 bpm. Toni cardiaci aritmici («delirium cordis»), validi; non soffi di nuova insorgenza.",
      },
      {
        district: "torace_polmonare",
        finding: "SpO₂ 97% in aria ambiente. Polmoni liberi da rantoli; murmure vescicolare fisiologico.",
      },
      {
        district: "addome",
        finding: "Addome trattabile, non dolente, non epatomegalia da stasi.",
      },
      {
        district: "neurologico",
        finding: "GCS 15. Nessun deficit focale. Nessuna evidenza di TIA/ictus in atto.",
      },
      {
        district: "periferico",
        finding: "Perfusione periferica conservata. Polsi periferici presenti (aritmici). Edemi assenti/minimi.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni (diagnosi FA-ARV)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "ematochimici-elettroliti-tsh",
      name: "Ematochimici + Elettroliti (K, Mg) + TSH/FT4",
      level: "I",
      mandatory: true,
      priceEuro: 32.0,
      componentExamIds: ["elettroliti", "emocromo", "creat-urea-gfr", "tiroide"],
      finding: LAB_PANEL_FINDING,
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico bedside (atrio sinistro e FE)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 30,
      priceEuro: 43.9,
      finding: ECOCARDIO_FINDING,
    },
  ],

  /* ── Esami inappropriati / spreco SSN (−25%) ───────────────────── */
  inappropriateExams: [
    {
      examId: "coronarografia",
      name: "Coronarografia d'urgenza",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 1800.0,
      finding: ANGIO_WASTE_FINDING,
      wasteRationale:
        "Inappropriata in FA isolata emodinamicamente stabile: nessuna indicazione a pathway SCA invasivo immediato.",
    },
    {
      examId: "angio",
      name: "Angio-TC Torace d'urgenza",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180.0,
      finding: ANGIO_WASTE_FINDING,
      wasteRationale:
        "Spreco SSN senza indicazione in FA stabile (assenza di sospetto EP/dissezione/SCA).",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_cha2ds2_vasc",
        description:
          "Calcola e documenta lo score CHA₂DS₂-VASc (punteggio = 3: ipertensione, età ≥65, sesso femminile)",
        requiredMilestoneKeys: ["cha2ds2", "cha2ds2_vasc", "chas_vasc", "score_tromboembolico"],
      },
      {
        id: "leg_doac_nota95",
        description:
          "Prescrive anticoagulante orale diretto (DOAC) rispettando i criteri di rimborsabilità Nota AIFA 95",
        requiredMilestoneKeys: ["doac", "anticoagulazione", "eliquis", "xarelto", "pradaxa", "lixiana", "nota_95"],
      },
      {
        id: "leg_rate_control",
        description:
          "Esegue rate control appropriato con beta-bloccante (metoprololo/esmololo iv) o diltiazem in paziente stabile",
        requiredMilestoneKeys: [
          "rate_control",
          "metoprololo",
          "esmololo",
          "beta_bloccante",
          "diltiazem",
        ],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. Linee-Guida-ESC-2020-sulla-Gestione-della-Fibrillazione-Atriale-1.pdf (Algoritmo CC-ABC, CHA2DS2-VASc score e scelta DOAC)",
        documentPath:
          "cardiologia/01_linee_guida/Linee-Guida-ESC-2020-sulla-Gestione-della-Fibrillazione-Atriale-1.pdf",
        articles: ["Algoritmo CC-ABC", "CHA₂DS₂-VASc", "Rate control", "Scelta DOAC"],
        relevance:
          "Definisce pathway AF (CC-ABC), rate control in stabilità, score tromboembolico e preferenza DOAC.",
      },
      {
        sourceRef: "Rif. nota-95.pdf (Criteri di rimborsabilità SSN per anticoagulanti orali diretti)",
        documentPath: "cardiologia/03_prontuario_ssn/nota-95.pdf",
        articles: ["Nota AIFA 95"],
        relevance:
          "Criteri SSN di rimborsabilità dei DOAC in FA non valvolare con CHA₂DS₂-VASc idoneo.",
      },
      {
        sourceRef:
          "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Appropriatezza prescrittiva e sicurezza)",
        documentPath: "_common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf",
        articles: ["Art. 13"],
        relevance:
          "Appropriatezza e sicurezza prescrittiva: DOAC indicato, coronarografia/Angio-TC non indicate in stabilità.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 71,
      sex: "F",
      context: "Pronto Soccorso — Palpitazioni / FA-ARV",
    },
    vitals: {
      bloodPressure: "135/80",
      heartRate: 145,
      spo2: 97,
      temperature: 36.5,
      respiratoryRate: 18,
      bp: "135/80",
      hr: 145,
      temp: 36.5,
      rr: 18,
      rhythm: "irregularly irregular",
      hemodynamicStatus: "stable",
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      deliriumCordis: true,
    },
    thorax: {
      cardiacAuscultation:
        "Toni aritmici a ~145 bpm («delirium cordis»), validi; non soffi di nuova insorgenza.",
      lungAuscultation: "Polmoni liberi da rantoli; murmure vescicolare fisiologico.",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile, non dolente.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Nessun deficit focale",
    },
    peripheral: {
      finding: "Perfusione conservata; polsi presenti, aritmici; edemi assenti/minimi.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-F02",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "facile",
    estimatedTimeMinutes: 20,
    cha2ds2Vasc: {
      score: 3,
      components: {
        congestiveHF: 0,
        hypertension: 1,
        age75OrMore: 0,
        diabetes: 0,
        strokeTia: 0,
        vascularDisease: 0,
        age65to74: 1,
        femaleSex: 1,
      },
      interpretation: "Score = 3 → indicazione tassativa a DOAC (donna con FA)",
    },
    goldTherapy: {
      rateControl: ["metoprololo iv", "esmololo iv", "diltiazem"],
      anticoagulation: "DOAC (Nota AIFA 95)",
    },
    legalConformityCriteria: [
      "cha2ds2_vasc_calcolato_eq_3",
      "doac_prescritto_nota_95",
      "rate_control_appropriato",
    ],
    ragSourceRefs: [
      "Rif. Linee-Guida-ESC-2020-sulla-Gestione-della-Fibrillazione-Atriale-1.pdf (Algoritmo CC-ABC, CHA2DS2-VASc score e scelta DOAC)",
      "Rif. nota-95.pdf (Criteri di rimborsabilità SSN per anticoagulanti orali diretti)",
      "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Appropriatezza prescrittiva e sicurezza)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "ematochimici-elettroliti-tsh", priceEuro: 32.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
      ],
      inappropriate: [
        { examId: "coronarografia", priceEuro: 1800.0, penaltyPercent: 25 },
        { examId: "angio", priceEuro: 180.0, penaltyPercent: 25 },
      ],
      goldPathCostEuro: 11.6 + 32.0 + 43.9,
    },
    stressProfile: {
      initialStress: 55,
      reactivityType: "moderate",
      timeDecayRate: 1.5,
      criticalMilestones: {
        reduceStress: [
          "richiesto_ecg",
          "rate_control",
          "rassicurazione",
          "consenso_informato",
          "doac",
        ],
        increaseStress: ["coronarografia", "angio", "esame_inappropriato"],
      },
      lifesavingMilestones: ["ecg", "rate_control"],
      relievingExams: ["ecg", "elettroliti", "ecocardio"],
      dangerousPrescriptions: ["coronarografia", "angio"],
    },
    labPanel: { finding: LAB_PANEL_FINDING },
    ecg: { finding: ECG_FINDING },
    elettroliti: { finding: "Na 140 · K 4.0 · Mg 1.9 · Cl 103 — nei limiti." },
    emocromo: { finding: "Emocromo nei limiti." },
    "creat-urea-gfr": { finding: "Creatinina 0.90 mg/dL · eGFR >60." },
    tiroide: { finding: "TSH 1.8 mU/L · FT4 nei range — tireotossicosi esclusa." },
    tsh: { finding: "TSH 1.8 mU/L · FT4 nei range — tireotossicosi esclusa." },
    ecocardio: { finding: ECOCARDIO_FINDING },
    angio: { finding: ANGIO_WASTE_FINDING, cost: 180 },
    tc: { finding: ANGIO_WASTE_FINDING, cost: 180 },
    coronarografia: { finding: ANGIO_WASTE_FINDING, cost: 1800 },
    advancedExams: {
      notes:
        "CAR-F02 FA-ARV stabile · Prassi Clinica · Facile. " +
        "ECG → rate control BB/diltiazem → CHA₂DS₂-VASc=3 → DOAC Nota 95. Evitare coro/Angio-TC.",
      values: {
        ecg: {
          price: 11.6,
          urgencyTiming: "≤10 min",
          routineTiming: "n.p.",
          routineMinutes: 8,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        elettroliti: {
          price: 12.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Na 140 · K 4.0 · Mg 1.9 · Cl 103 — nei limiti.",
        },
        emocromo: {
          price: 8.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Emocromo nei limiti.",
        },
        "creat-urea-gfr": {
          price: 6.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Creatinina 0.90 mg/dL · eGFR >60.",
        },
        tiroide: {
          price: 6.0,
          urgencyTiming: "routine/urgente lab",
          routineTiming: "24h",
          routineMinutes: 60,
          normalFinding: "TSH 1.8 mU/L · FT4 nei range — tireotossicosi esclusa.",
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "18 min bedside",
          routineTiming: "24h",
          routineMinutes: 18,
          normalFinding: ECOCARDIO_FINDING,
          isAbnormal: true,
        },
        angio: {
          price: 180.0,
          urgencyTiming: "45 min",
          routineTiming: "48h",
          routineMinutes: 45,
          normalFinding: ANGIO_WASTE_FINDING,
        },
        coronarografia: {
          price: 1800.0,
          urgencyTiming: "non indicato",
          routineTiming: "n.p.",
          routineMinutes: 40,
          normalFinding: ANGIO_WASTE_FINDING,
        },
      },
    },
  },
};

export default CAR_F02;
