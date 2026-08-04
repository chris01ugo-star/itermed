/**
 * CAR-D04 — Intossicazione Digitalica e Iperkaliemia da Inappropriatezza Prescrittiva
 * (Prassi Clinica → Cardiologia → Difficile)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf
 * - cardiologia/02_protocolli_pdta/51_ZAino.pdf
 * - cardiologia/03_prontuario_ssn/nota-95.pdf
 * - _common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf (Art. 13)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const DIGOSSINEMIA_FINDING =
  "Digossinemia: 3.2 ng/mL (range terapeutico tipico ~0.5–0.9 / tossico >2.0 ng/mL) — TOSSICITÀ DIGITALICA confermata. " +
  "Indicazione a sospensione e, se bradiaritmia severa / K⁺ elevato, a Fab anti-digossina.";

const LAB_PANEL_FINDING =
  "K⁺ 6.8 mEq/L (iperkaliemia severa) · Na⁺ 134 · Creatinina 2.4 mg/dL · Azotemia elevata · eGFR ≈28 mL/min/1.73 m². " +
  "Quadro di IRC scompensata + iperkaliemia da Digossina + Ramipril + Spironolattone ± FANS.";

const EGA_FINDING =
  "EGA arteriosa: K⁺ elevato confermato point-of-care; acidosi metabolica lieve/moderata da ipoperfusione / IRC. " +
  "Guida terapia immediata dell'iperkaliemia (calcio ev, insulina+glucosata).";

const ECG_FINDING =
  "Bradicardia da FA con blocco AV avanzato (FC media ≈38 bpm). Tratto ST con abbassamento a cupola " +
  "(«baffo di Dalí» / slivellamento a cucchiaio — tipico digitalico). Onde T apiculate a tenda nelle precordiali " +
  "(iperkaliemia K⁺ 6.8). Alto rischio di asistolia / ritmi letali.";

const INAPPROPRIATE_RX_FINDING =
  "Grave inappropriatezza prescrittiva: mancato monitoraggio digossinemia e prosecuzione Ramipril + Spironolattone " +
  "con eGFR <30 mL/min (± FANS) — violazione Note AIFA / prontuario, iatrogenesi e costi da ricovero prolungato (−25% Econ).";

const PHYSICAL_SUMMARY =
  "Donna di 82 anni, sensorio obnubilato (somnolenza/sindrome confusionale). Killip I (polmoni liberi). " +
  "PA 90/55 mmHg, FC 38 bpm bradicardica e aritmica, SpO₂ 94% in aria ambiente. " +
  "Toni brady-aritmici, parafonici. Polmoni liberi da stasi acuta. Segni clinici di tossicità digitalica (nausea, xantopsia in anamnesi).";

/** Budget I livello gold (14+24+12+11.60) ≈ €61.60 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 90;

export const CAR_D04: ClinicalCase = {
  code: "CAR-D04",
  id: "car-d04",
  title: "Intossicazione Digitalica e Iperkaliemia da Inappropriatezza Prescrittiva",
  description:
    "Donna, 82 anni, FA cronica, scompenso cardiaco e IRC (eGFR 28), condotta in PS per nausea, vomito, xantopsia, " +
    "confusione e bradicardia da 24 ore. Caso gold standard Prassi Clinica — Cardiologia — Difficile " +
    "(tossicità digitalica + iperkaliemia iatrogena).",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "HARD",
  difficultyLabel: "difficile",
  estimatedTimeMinutes: 30,
  estimatedDurationMinutes: 30,
  timeLimitMinutes: 30,
  patientDeteriorationThreshold: 6,
  patientPrompt: [
    "Sei Rosa, 82 anni. Da un giorno hai nausea, vomito, vedi aloni giallo-verdi, sei confusa e il cuore batte lentissimo.",
    "Prendi digossina, ramipril e spironolattone; di recente hai preso FANS per il ginocchio. Hai i reni malati. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, sonnolenta e confusa. Se chiedono: poco pipì, forse gastroenterite/disidratazione, " +
      "dose digossina forse non rivista sul peso/eGFR, esami renali recenti scadenti.",
    "Se continuano digossina/ACE/spirolattone senza dosare livelli e potassio, stai peggio. Se sospendono e danno calcio/insulina e antidoto, ti stabilizzi.",
  ].join(" "),
  pastMedicalHistory:
    "Fibrillazione atriale cronica. Scompenso cardiaco. Insufficienza renale cronica (eGFR ~28 mL/min). " +
    "Terapia domiciliare: Digossina, Ramipril, Spironolattone; recente autosomministrazione di FANS per gonalgia. " +
    "Possibile gastroenterite/disidratazione recente. Dose digossina non chiaramente aggiustata su peso/eGFR. Nessuna allergia nota.",
  diagnosis:
    "Intossicazione digitalica (digossinemia tossica) con bradiaritmia da FA + BAV avanzato e iperkaliemia severa (6.8) da inappropriatezza prescrittiva in IRC",
  correctSolution:
    "ECG + EGA + labs (K/Na/crea/eGFR) + digossinemia → diagnosi tossicità + iperkaliemia → " +
    "sospensione immediata Digossina, Ramipril, Spironolattone (± FANS) → calcio gluconato/cloruro ev (stabilizzazione membrana) → " +
    "insulina+glucosata ± resine/patiromer → Fab anti-digossina se bradiaritmia severa refrattaria o criteri di Digibind. " +
    "Non proseguire RAAS-i con eGFR <30 senza monitoraggio.",
  goldStandardPath: [
    "ecg",
    "ega",
    "elettroliti",
    "creat-urea-gfr",
    "digossinemia",
    "consenso-informato",
  ],
  examLatencies: {
    ecg: 5,
    ega: 5,
    elettroliti: 25,
    "creat-urea-gfr": 25,
    digossinemia: 60,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_terapia_domiciliare",
      prompt:
        "Terapia domiciliare completa: Digossina, Ramipril, Spironolattone e recente autosomministrazione di FANS per gonalgia",
      critical: true,
      expectedKeywords: [
        "digossina",
        "lanoxin",
        "ramipril",
        "spironolattone",
        "fans",
        "ibuprofene",
        "ginocchio",
        "farmaci",
      ],
      rationale:
        "Combinazione digossina + RAAS-i + antialdosteronico ± FANS in IRC = cocktail iatrogeno classico.",
    },
    {
      id: "aq_disidratazione_gastroenterite",
      prompt: "Recente disidratazione / gastroenterite (riduzione clearance digossina e peggioramento eGFR)",
      critical: true,
      expectedKeywords: ["vomito", "diarrea", "gastroenterite", "disidrat", "bevuto poco", "fluido"],
      rationale: "Trigger acuto di accumulo di digossina e iperkaliemia in anziana con IRC.",
    },
    {
      id: "aq_aggiustamento_digossina",
      prompt: "Aggiustamento posologico della digossina in base a peso corporeo / eGFR / età",
      critical: true,
      expectedKeywords: ["dose", "quanto ne prende", "aggiustat", "peso", "rene", "egfr", "ridotta"],
      rationale: "Inappropriatezza posologica nel grande anziano con eGFR basso — CdM Art. 13 / prontuario.",
    },
    {
      id: "aq_sintomi_visivi_digestivi",
      prompt: "Sintomi visivi/digestivi da intossicazione (xantopsia, alone giallo-verde, nausea, vomito, anoressia)",
      critical: true,
      expectedKeywords: ["giallo", "verde", "alone", "vista", "nausea", "vomito", "xantopsia"],
      rationale: "Sintomi tipici di tossicità digitalica — indicano dosaggio digossinemia urgente.",
    },
    {
      id: "aq_diuresi_24h",
      prompt: "Diuresi nelle ultime 24 ore (oliguria da scompenso renale acuto-su-cronico)",
      critical: true,
      expectedKeywords: ["pipì", "diuresi", "urine", "poco", "oliguria", "ritenzione"],
      rationale: "Oliguria conferma rischio di accumulo e necessità di rivalutare terapia e idratazione.",
    },
    {
      id: "aq_funzione_renale_recente",
      prompt: "Esami di funzionalità renale recenti (creatinina, eGFR, elettroliti)",
      critical: true,
      expectedKeywords: ["creatinina", "egfr", "analisi", "rene", "potassio", "esami recenti"],
      rationale: "Baseline IRC e mancato monitoraggio = elemento di inappropriatezza prescrittiva.",
    },
    {
      id: "aq_bradicardia_sintomi",
      prompt: "Sintomi correlati alla bradicardia (astenia, lipotimia, confusione, cadute)",
      critical: true,
      expectedKeywords: ["lento", "svenut", "confus", "debole", "caduta", "sonnolent"],
      rationale: "Gravità clinica della bradiaritmia digitalica — guida pacing/Fab.",
    },
    {
      id: "aq_aderenza_e_automedicazione",
      prompt: "Aderenza terapeutica e automedicazione (doppie dosi digossina, FANS OTC, diuretici)",
      critical: true,
      expectedKeywords: ["da sola", "due pastiglie", "farmacia", "senza ricetta", "dimenticat", "aderenz"],
      rationale: "Automedicazione con FANS e errori di dose sono cause frequenti di iatrogenesi nell'anziano.",
    },
  ],

  /* ── Esame obiettivo SSOT ──────────────────────────────────────── */
  physicalExam: {
    killipClass: "I",
    summary: PHYSICAL_SUMMARY,
    districts: [
      {
        district: "generale",
        finding:
          "Anziana, sensorio obnubilato (somnolenza/sindrome confusionale), astenica, nauseata. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 90/55 mmHg, FC 38 bpm bradicardica e aritmica. Toni brady-aritmici, parafonici. Polsi lenti, irregolari, iposfigmici.",
      },
      {
        district: "torace_polmonare",
        finding: "SpO₂ 94% in aria ambiente. Polmoni liberi da stasi acuta; non rantoli franchi.",
      },
      {
        district: "addome",
        finding: "Addome trattabile; possibile dolorabilità epigastrica da nausea/vomito.",
      },
      {
        district: "neurologico",
        finding:
          "Sensorio obnubilato, confusione. GCS ridotto rispetto al baseline. Nessun deficit focale franco. Xantopsia in anamnesi.",
      },
      {
        district: "periferico",
        finding: "Cute asciutta possibile da disidratazione; edemi declivi minimi/assenti in acuzie.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "digossinemia",
      name: "Digossinemia (livello ematico — tossico >2.0 ng/mL)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 90,
      priceEuro: 14.0,
      finding: DIGOSSINEMIA_FINDING,
    },
    {
      examId: "ematochimici-k-crea-egfr",
      name: "Ematochimici rapidi: K⁺, Na⁺, Creatinina, Azotemia, eGFR",
      level: "I",
      mandatory: true,
      priceEuro: 24.0,
      componentExamIds: ["elettroliti", "creat-urea-gfr"],
      finding: LAB_PANEL_FINDING,
    },
    {
      examId: "ega",
      name: "EGA arteriosa rapida (K⁺ immediato e stato acido-base)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 12.0,
      finding: EGA_FINDING,
    },
    {
      examId: "ecg",
      name: "ECG 12 derivazioni (monitoraggio continuo)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 5,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
  ],

  /* ── Inappropriatezza prescrittiva (−25%) ──────────────────────── */
  inappropriateExams: [
    {
      examId: "prosecuzione-raas-digossina",
      name:
        "Prosecuzione Digossina / Ramipril / Spironolattone senza digossinemia con eGFR <30 (violazione Note AIFA)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 200.0,
      finding: INAPPROPRIATE_RX_FINDING,
      wasteRationale:
        "Grave inappropriatezza prescrittiva e spreco da ricovero prolungato: mancato monitoraggio digossinemia + RAAS-i in eGFR <30.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_diagnosi_tossicita_iperkaliemia",
        description:
          "Diagnosi di tossicità digitalica + iperkaliemia (ECG tipico, K⁺ elevato, digossinemia tossica)",
        requiredMilestoneKeys: [
          "ecg",
          "digossinemia",
          "elettroliti",
          "ega",
          "iperkaliemia",
        ],
      },
      {
        id: "leg_sospensione_farmaci",
        description:
          "Sospende Digossina, Ramipril e Spironolattone (farmaci nefrotossici/iperkaliemizzanti in IRC)",
        requiredMilestoneKeys: [
          "sospensione_digossina",
          "sospensione_ramipril",
          "sospensione_spironolattone",
          "deprescribing",
        ],
      },
      {
        id: "leg_calcio_ev",
        description:
          "Somministra calcio ev (gluconato/cloruro) per proteggere il miocardio nell'iperkaliemia severa",
        requiredMilestoneKeys: [
          "calcio_gluconato",
          "calcio_cloruro",
          "stabilizzazione_membrana",
          "terapia_iperkaliemia",
        ],
      },
      {
        id: "leg_dosaggio_livelli",
        description: "Dosa i livelli ematici di digossina (digossinemia)",
        requiredMilestoneKeys: ["digossinemia", "livello_digossina"],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf (Uso appropriato e tossicità della Digossina nello scompenso)",
        documentPath: "cardiologia/02_protocolli_pdta/2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf",
        articles: ["Digoxin use in HF", "Toxicity", "Dose adjustment in renal impairment"],
        relevance:
          "Uso cauto della digossina nello scompenso, monitoraggio e riconoscimento della tossicità soprattutto nell'anziano con IRC.",
      },
      {
        sourceRef:
          "Rif. 51_ZAino.pdf / nota-95.pdf / Prontuario (Inappropriatezza prescrittiva nel grande anziano con insufficienza renale)",
        documentPath: "cardiologia/02_protocolli_pdta/51_ZAino.pdf",
        articles: ["Inappropriatezza prescrittiva", "Anziano fragile", "IRC / eGFR"],
        relevance:
          "Appropriatezza prescrittiva e Note AIFA/prontuario nel grande anziano con eGFR ridotto (RAAS-i, digossina, FANS).",
      },
      {
        sourceRef:
          "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Prescrizione e iatrogenesi)",
        documentPath: "_common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf",
        articles: ["Art. 13"],
        relevance:
          "Obbligo di appropriatezza prescrittiva e prevenzione della iatrogenesi da digossina/RAAS-i/FANS in IRC.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 82,
      sex: "F",
      context: "Pronto Soccorso — Bradicardia / sospetta intossicazione digitalica",
    },
    vitals: {
      bloodPressure: "90/55",
      heartRate: 38,
      spo2: 94,
      temperature: 36.2,
      respiratoryRate: 16,
      bp: "90/55",
      hr: 38,
      temp: 36.2,
      rr: 16,
      rhythm: "AF_with_advanced_AV_block",
      potassiumMeqL: 6.8,
      egfr: 28,
      digoxinNgMl: 3.2,
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      xanthopsiaHistory: true,
      confusionalState: true,
    },
    thorax: {
      cardiacAuscultation: "Toni brady-aritmici, parafonici a ~38 bpm.",
      lungAuscultation: "Polmoni liberi da stasi acuta; non rantoli franchi.",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile; possibile dolorabilità epigastrica.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche; riferita xantopsia",
      gcs: "13-14",
      deficits: "Obnubilamento / sindrome confusionale; nessun deficit focale franco",
    },
    peripheral: {
      finding: "Polsi lenti irregolari iposfigmici; cute asciutta possibile da disidratazione.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-D04",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "difficile",
    estimatedTimeMinutes: 30,
    goldTherapy: {
      immediate: [
        "sospensione_digossina_ramipril_spironolattone",
        "calcio_gluconato_o_cloruro_ev",
        "insulina_piu_glucosata_ev",
        "resine_o_patiromer",
        "Fab_anti_digossina_se_bradiaritmia_severa_o_K_gt_5_5",
      ],
      contraindicated: [
        "prosecuzione_digossina",
        "prosecuzione_ramipril_spironolattone_egfr_lt_30_senza_monitoraggio",
      ],
    },
    legalConformityCriteria: [
      "diagnosi_tossicita_digitalica_iperkaliemia",
      "sospensione_farmaci_iperkaliemizzanti",
      "calcio_ev_protezione_miocardio",
      "digossinemia_dosata",
    ],
    ragSourceRefs: [
      "Rif. 2021-SCOMPENSO-CARDIACO-LG-ESC-COMPLETE.pdf (Uso appropriato e tossicità della Digossina nello scompenso)",
      "Rif. 51_ZAino.pdf / nota-95.pdf / Prontuario (Inappropriatezza prescrittiva nel grande anziano con insufficienza renale)",
      "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Prescrizione e iatrogenesi)",
    ],
    econModule: {
      mandatory: [
        { examId: "digossinemia", priceEuro: 14.0 },
        { examId: "ematochimici-k-crea-egfr", priceEuro: 24.0 },
        { examId: "ega", priceEuro: 12.0 },
        { examId: "ecg", priceEuro: 11.6 },
      ],
      inappropriate: [
        {
          examId: "prosecuzione-raas-digossina",
          priceEuro: 200.0,
          penaltyPercent: 25,
          aifaNoteViolation: true,
        },
      ],
      goldPathCostEuro: 14.0 + 24.0 + 12.0 + 11.6,
    },
    stressProfile: {
      initialStress: 80,
      reactivityType: "hyper",
      timeDecayRate: 2.0,
      criticalMilestones: {
        reduceStress: [
          "ecg",
          "digossinemia",
          "calcio_gluconato",
          "sospensione_digossina",
          "fab_anti_digossina",
          "consenso_informato",
        ],
        increaseStress: [
          "prosecuzione-raas-digossina",
          "prosecuzione_digossina",
          "fans",
        ],
      },
      lifesavingMilestones: ["ecg", "ega", "calcio_gluconato", "digossinemia"],
      relievingExams: ["ecg", "ega", "elettroliti", "digossinemia"],
      dangerousPrescriptions: ["prosecuzione-raas-digossina", "digossina", "spironolattone", "ramipril"],
    },
    labPanel: { finding: LAB_PANEL_FINDING },
    digossinemia: { finding: DIGOSSINEMIA_FINDING, cost: 14 },
    elettroliti: { finding: "K⁺ 6.8 · Na⁺ 134 — iperkaliemia severa." },
    "creat-urea-gfr": {
      finding: "Creatinina 2.4 mg/dL · Azotemia elevata · eGFR ≈28 mL/min.",
    },
    ega: { finding: EGA_FINDING },
    ecg: { finding: ECG_FINDING },
    "prosecuzione-raas-digossina": { finding: INAPPROPRIATE_RX_FINDING, cost: 200 },
    advancedExams: {
      notes:
        "CAR-D04 Intossicazione digitalica + K⁺ 6.8 · Prassi Clinica · Difficile. " +
        "Sospendere Dig/ACE/Spiro → Ca ev + shift K⁺ ± Digibind. Dosare digossinemia. No RAAS-i ciechi se eGFR <30.",
      values: {
        digossinemia: {
          price: 14.0,
          urgencyTiming: "urgente",
          routineTiming: "24h",
          routineMinutes: 60,
          normalFinding: DIGOSSINEMIA_FINDING,
          isAbnormal: true,
        },
        elettroliti: {
          price: 12.0,
          urgencyTiming: "25 min",
          routineTiming: "2h",
          routineMinutes: 25,
          normalFinding: "K⁺ 6.8 · Na⁺ 134 — iperkaliemia severa.",
          isAbnormal: true,
        },
        "creat-urea-gfr": {
          price: 12.0,
          urgencyTiming: "25 min",
          routineTiming: "2h",
          routineMinutes: 25,
          normalFinding: "Creatinina 2.4 mg/dL · Azotemia elevata · eGFR ≈28 mL/min.",
          isAbnormal: true,
        },
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
          urgencyTiming: "immediato + monitoraggio continuo",
          routineTiming: "n.p.",
          routineMinutes: 5,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        "prosecuzione-raas-digossina": {
          price: 200.0,
          urgencyTiming: "VIETATO",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: INAPPROPRIATE_RX_FINDING,
        },
      },
    },
  },
};

export default CAR_D04;
