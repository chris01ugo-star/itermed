/**
 * CAR-D01 — Dissezione Aortica Acuta Tipo A simulante STEMI Inferiore
 * (Prassi Clinica → Cardiologia → Difficile)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 6)
 * - _common_legal/Legge_219_2017_Consenso_Informato.pdf (Art. 1)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Ritmo sinusale a 95 bpm. Lieve sopraslivellamento ST in DII, DIII, aVF (STEMI inferiore «mimo»). " +
  "Compatibile con coinvolgimento dell'ostio della coronaria destra (RCA) nell'emato-dissezione della radice aortica. " +
  "Non trattare come STEMI primario senza escludere dissezione aortica.";

const PA_BIBRACHIALE_FINDING =
  "PA braccio destro 170/95 mmHg · PA braccio sinistro 125/70 mmHg — ASIMMETRIA PRESSORIA >20 mmHg. " +
  "Polso radiale sinistro iposfigmico. Critical cue di dissezione aortica / coinvolgimento dei tronchi sovra-aortici.";

const ANGIO_TC_FINDING =
  "Angio-TC Torace-Addome con MDC: flap intimale in aorta ascendente (Stanford A / DeBakey I) con estensione " +
  "verso l'arco e sospetto coinvolgimento ostiale RCA. Versamento pericardico. Gold standard diagnostico assoluto.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: flap intimale visualizzabile in aorta ascendente; insufficienza aortica almeno moderata; " +
  "versamento pericardico (rischio tamponamento). FE globale preservata. Indica Angio-TC / Cardiochirurgia in emergenza.";

const DDIMERO_MARKERS_FINDING =
  "D-Dimero: marcatamente elevato (tipico nella dissezione aortica acuta). " +
  "Marcatori di miocardiocitolisi (troponina hs): lievemente elevati per coinvolgimento ostiale RCA — " +
  "NON autorizzano riperfusione farmacologica prima dell'esclusione della dissezione.";

const FATAL_ANTITHROMBOTIC_FINDING =
  "ERRORE FATALE: trombolisi / eparina / DAPT (ASA + ticagrelor) prima di Angio-TC o Eco. " +
  "Innesca estensione del flap intimale e tamponamento cardiaco — exitus. Tutela NON CONFORME (−100% score medico-legale).";

const PHYSICAL_SUMMARY =
  "Uomo di 62 anni, vigile, collaborante, dolorante intenso (10/10), diaforetico. Killip I all'ingresso. " +
  "PA Dx 170/95 mmHg · PA Sx 125/70 mmHg (asimmetria >20 mmHg). FC 95 bpm ritmica, SpO₂ 96% aa. " +
  "Soffio diastolico dolce 2/6 al focus aortico (IAo acuta). Polso radiale sinistro iposfigmico.";

/** Budget I/II livello gold (11.60+180+43.90+20) ≈ €255.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 280;

export const CAR_D01: ClinicalCase = {
  code: "CAR-D01",
  id: "car-d01",
  title: "Dissezione Aortica Acuta Tipo A Simulante STEMI Inferiore",
  description:
    "Uomo, 62 anni, iperteso in scarso controllo farmacologico, giunge in PS via 118 per dolore toracico lacerante, " +
    "«a pugnalata», ad esordio iperacuto (10/10), irradiato alla regione interscapolare e al dorso. " +
    "Caso gold standard Prassi Clinica — Cardiologia — Difficile (DD dissezione vs STEMI).",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "HARD",
  difficultyLabel: "difficile",
  estimatedTimeMinutes: 30,
  estimatedDurationMinutes: 30,
  timeLimitMinutes: 30,
  patientDeteriorationThreshold: 8,
  patientPrompt: [
    "Sei Giorgio, 62 anni. Da pochi minuti hai un dolore lacerante al petto «a pugnalata» (10/10) che ti taglia fino alla schiena tra le scapole.",
    "Sei arrivato con il 118. Sei iperteso e spesso non prendi le pastiglie. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, terrorizzato. Se chiedono: esordio improvviso (non crescendo), irradiazione dorsale, " +
      "possibile lipotimia all'esordio, nessun infarto pregresso, pressione alta cronica.",
    "Se il medico dà subito trombolisi, eparina o doppia antiaggregazione senza TC/eco, peggiora drasticamente " +
      "(svenimento, senso di morte, collasso) — sta estendendo la dissezione.",
  ].join(" "),
  pastMedicalHistory:
    "Ipertensione arteriosa di lunga data in scarso controllo (spesso non assume ACE-inibitore / calcio-antagonista). " +
    "Nessuna CAD nota, nessun bypass né stent. Non diabetico. Ex-fumatore. Nessuna allergia nota. " +
    "Nessuna chirurgia aortica pregressa. Non in terapia antiaggregante/anticoagulante cronica.",
  diagnosis:
    "Dissezione aortica acuta Stanford A (DeBakey I) con coinvolgimento ostiale RCA (mimo STEMI inferiore) e IAo acuta — emergenza cardiochirurgica",
  correctSolution:
    "Sospetto dissezione (dolore iperacuto lacerante + irradiazione dorsale + asimmetria PA/polsi + soffio diastolico aortico) → " +
    "ECG + PA bibrachiale → Eco TT bedside e/o Angio-TC Torace-Addome con MDC in emergenza → attiva Cardiochirurgia. " +
    "VIETATO trombolisi / eparina / DAPT prima di aver escluso la dissezione (rischio tamponamento fatale).",
  goldStandardPath: [
    "ecg",
    "ecocardio",
    "angio",
    "ddimero",
    "troponina-hs",
    "consenso-informato",
  ],
  examLatencies: {
    ecg: 5,
    ecocardio: 12,
    angio: 25,
    ddimero: 30,
    "troponina-hs": 35,
    tc: 25,
    coronarografia: 40,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_esordio_iperacuto",
      prompt: "Esordio iperacuto (secondi/minuti) vs dolore a crescendo tipico di SCA",
      critical: true,
      expectedKeywords: ["improvvis", "iperacut", "da quanto", "secondi", "all'improvviso", "crescendo"],
      rationale: "Esordio iperacuto «a coltello» orienta verso dissezione aortica vs ACS crescendo.",
    },
    {
      id: "aq_qualita_lacerante",
      prompt: "Qualità del dolore: lacerante / a pugnalata / strappo (intensità massima all'esordio)",
      critical: true,
      expectedKeywords: ["lacerant", "pugnalata", "strappo", "tagliente", "10/10", "massimo"],
      rationale: "Fenotipo tipico di dissezione; distinguerlo dall'oppressione anginosa.",
    },
    {
      id: "aq_irradiazione_dorsale",
      prompt: "Irradiazione posteriore / interscapolare / al dorso",
      critical: true,
      expectedKeywords: ["schiena", "dorso", "interscapolar", "scapole", "posterior"],
      rationale: "Irradiazione dorsale è critical cue di patologia aortica acuta.",
    },
    {
      id: "aq_asimmetria_polsi_pa",
      prompt: "Asimmetria dei polsi e/o della pressione arteriosa agli arti (bibrachiale)",
      critical: true,
      expectedKeywords: ["asimmetr", "polso", "braccio", "pressione diversa", "bibrachiale", "iposfigm"],
      rationale: "Asimmetria PA >20 mmHg / polso iposfigmico → alta probabilità di dissezione.",
    },
    {
      id: "aq_sincope_esordio",
      prompt: "Sincope o lipotimia all'esordio del dolore",
      critical: true,
      expectedKeywords: ["svenut", "sincope", "lipotim", "nero davanti", "perso conoscenza"],
      rationale: "Sincope all'esordio aumenta probabilità di dissezione complicata / tamponamento.",
    },
    {
      id: "aq_deficit_neurologici",
      prompt: "Deficit neurologici sfumati (parestesie, debolezza, confusione, amaurosi)",
      critical: true,
      expectedKeywords: ["formicolio", "debolezza", "braccio", "visione", "neurolog", "confus"],
      rationale: "Coinvolgimento dei tronchi sovra-aortici / ipoperfusione cerebrale nella dissezione Tipo A.",
    },
    {
      id: "aq_ipertensione_non_controllata",
      prompt: "Anamnesi di ipertensione arteriosa non controllata / scarsa aderenza terapeutica",
      critical: true,
      expectedKeywords: ["ipertens", "pression", "pastiglie", "non prende", "scarso controllo"],
      rationale: "Ipertensione mal controllata è il principale fattore di rischio di dissezione aortica.",
    },
    {
      id: "aq_assenza_cad",
      prompt: "Assenza di CAD pregressa (IMA, stent, bypass) che riduca la probabilità di SCA tipica",
      critical: true,
      expectedKeywords: ["infarto", "stent", "bypass", "cuore", "coronar", "mai avuto"],
      rationale: "Assenza di CAD nota, con fenotipo aortico, rafforza la DD dissezione vs STEMI primario.",
    },
  ],

  /* ── Esame obiettivo SSOT + critical cues ──────────────────────── */
  physicalExam: {
    killipClass: "I",
    summary: PHYSICAL_SUMMARY,
    districts: [
      {
        district: "generale",
        finding:
          "Vigile, orientato, collaborante, dolorante intenso (10/10), diaforetico, ansioso. Killip I all'ingresso.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA Dx 170/95 mmHg · PA Sx 125/70 mmHg (asimmetria >20 mmHg). FC 95 bpm ritmica. " +
          "Soffio diastolico dolce 2/6 al focus aortico (IAo acuta da dissezione della radice). " +
          "Polso radiale sinistro iposfigmico; polso destro valido.",
      },
      {
        district: "torace_polmonare",
        finding: "SpO₂ 96% in aria ambiente. Murmure vescicolare presente; non rantoli franchi (Killip I).",
      },
      {
        district: "addome",
        finding: "Addome trattabile; non masse pulsanti evidenti all'esame rapido.",
      },
      {
        district: "neurologico",
        finding:
          "GCS 15. Possibili deficit sfumati da ricercare attivamente (parestesie / asimmetria motoria lieve).",
      },
      {
        district: "periferico",
        finding:
          "Polso radiale sinistro iposfigmico rispetto al destro. Riempimento capillare asimmetrico agli arti superiori.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I/II livello ────────────────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni + rilevazione PA bibrachiale (triage)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 11.6,
      finding: `${ECG_FINDING} ${PA_BIBRACHIALE_FINDING}`,
    },
    {
      examId: "angio",
      name: "Angio-TC Torace-Addome con M.D.C. (gold standard dissezione aortica)",
      level: "II",
      mandatory: true,
      maxLatencyMinutes: 30,
      priceEuro: 180.0,
      finding: ANGIO_TC_FINDING,
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico bedside",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 20,
      priceEuro: 43.9,
      finding: ECOCARDIO_FINDING,
    },
    {
      examId: "ddimero",
      name: "D-Dimero e marcatori di miocardiocitolisi",
      level: "I",
      mandatory: true,
      priceEuro: 20.0,
      componentExamIds: ["ddimero", "troponina-hs"],
      finding: DDIMERO_MARKERS_FINDING,
    },
  ],

  /* ── Errore fatale (−100% tutela + penalità economica max) ─────── */
  inappropriateExams: [
    {
      examId: "trombolisi",
      name: "Trombolisi / fibrinolisi immediata (pre-Angio-TC)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 100,
      priceEuro: 450.0,
      finding: FATAL_ANTITHROMBOTIC_FINDING,
      wasteRationale:
        "ERRORE FATALE: estensione del flap e tamponamento cardiaco. −100% score medico-legale e tutela NON CONFORME.",
    },
    {
      examId: "eparina",
      name: "Eparina a dose anticoagulante prima di esclusione dissezione",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 100,
      priceEuro: 25.0,
      finding: FATAL_ANTITHROMBOTIC_FINDING,
      wasteRationale:
        "Anticoagulazione pre-diagnosi in dissezione Tipo A: aggravamento emorragico intramurale / tamponamento.",
    },
    {
      examId: "dapt",
      name: "DAPT immediata (Aspirina + Ticagrelor) prima di Angio-TC / Eco",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 100,
      priceEuro: 40.0,
      finding: FATAL_ANTITHROMBOTIC_FINDING,
      wasteRationale:
        "DAPT prima di escludere dissezione: errore fatale — tutela NON CONFORME e penalità economica massima.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_asimmetria_sfigmica",
        description:
          "Rileva e documenta l'asimmetria sfigmica/pressoria bibrachiale (>20 mmHg) e il polso radiale iposfigmico",
        requiredMilestoneKeys: [
          "asimmetria_pa",
          "pa_bibrachiale",
          "esame_obiettivo",
          "polsi",
        ],
      },
      {
        id: "leg_angio_tc_emergenza",
        description: "Richiede Angio-TC Torace-Addome con MDC in emergenza (o Eco che dimostri flap) prima di terapia antitrombotica",
        requiredMilestoneKeys: ["angio", "gold_standard_angio", "richiesto_angio", "ecocardio"],
      },
      {
        id: "leg_cardiochirurgia",
        description: "Attiva la Cardiochirurgia in emergenza per dissezione Stanford A",
        requiredMilestoneKeys: [
          "cardiochirurgia",
          "chirurgia_emergenza",
          "consenso_informato",
          "consenso-informato",
        ],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Diagnosi differenziale Aortic Dissection vs ACS)",
        documentPath:
          "cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf",
        articles: ["DD Aortic Dissection vs ACS", "STEMI mimic", "No fibrinolysis if dissection suspected"],
        relevance:
          "Impone esclusione della dissezione aortica nei fenotipi atipici/mimo-STEMI prima di riperfusione farmacologica o DAPT aggressiva.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 6 (Imperizia e inosservanza delle linee guida nella DD ad alto rischio)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 6"],
        relevance:
          "Responsabilità per imperizia/inosservanza delle LG nella diagnosi differenziale ad alto rischio (dissezione vs STEMI).",
      },
      {
        sourceRef:
          "Rif. Legge_219_2017_Consenso_Informato.pdf - Art. 1 (Consenso e gestione dell'emergenza-urgenza vitale)",
        documentPath: "_common_legal/Legge_219_2017_Consenso_Informato.pdf",
        articles: ["Art. 1"],
        relevance:
          "Informativa e consenso nella gestione dell'emergenza-urgenza vitale verso Cardiochirurgia.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 62,
      sex: "M",
      context: "Pronto Soccorso via 118 — Dolore toracico lacerante",
    },
    vitals: {
      bloodPressure: "170/95 (Dx) · 125/70 (Sx)",
      bloodPressureRight: "170/95",
      bloodPressureLeft: "125/70",
      heartRate: 95,
      spo2: 96,
      temperature: 36.4,
      respiratoryRate: 22,
      bp: "170/95",
      hr: 95,
      temp: 36.4,
      rr: 22,
      pressureAsymmetryMmHg: 45,
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      aorticDiastolicMurmur: "2/6 focus aortico",
      leftRadialPulse: "iposfigmico",
    },
    thorax: {
      cardiacAuscultation:
        "Toni ritmici a 95 bpm; soffio diastolico dolce 2/6 al focus aortico (IAo acuta).",
      lungAuscultation: "Murmure vescicolare presente; non rantoli franchi (Killip I).",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile; non masse pulsanti evidenti.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Ricercare deficit sfumati (parestesie / asimmetria motoria lieve)",
    },
    peripheral: {
      finding:
        "Polso radiale sinistro iposfigmico vs destro; asimmetria pressoria bibrachiale >20 mmHg.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-D01",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "difficile",
    estimatedTimeMinutes: 30,
    legalConformityCriteria: [
      "asimmetria_sfigmica_documentata",
      "angio_tc_emergenza_pre_antitrombotici",
      "attivazione_cardiochirurgia",
    ],
    legalNonConformityTriggers: [
      "trombolisi_pre_esclusione_dissezione",
      "eparina_pre_esclusione_dissezione",
      "dapt_pre_esclusione_dissezione",
    ],
    ragSourceRefs: [
      "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Diagnosi differenziale Aortic Dissection vs ACS)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 6 (Imperizia e inosservanza delle linee guida nella DD ad alto rischio)",
      "Rif. Legge_219_2017_Consenso_Informato.pdf - Art. 1 (Consenso e gestione dell'emergenza-urgenza vitale)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "angio", priceEuro: 180.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
        { examId: "ddimero", priceEuro: 20.0 },
      ],
      inappropriate: [
        { examId: "trombolisi", priceEuro: 450.0, penaltyPercent: 100, fatal: true },
        { examId: "eparina", priceEuro: 25.0, penaltyPercent: 100, fatal: true },
        { examId: "dapt", priceEuro: 40.0, penaltyPercent: 100, fatal: true },
      ],
      goldPathCostEuro: 11.6 + 180.0 + 43.9 + 20.0,
    },
    fatalErrors: {
      description:
        "Somministrazione immediata di trombolitici / eparina / DAPT prima di Angio-TC o Eco → tutela NON CONFORME (−100%).",
      prescriptions: ["trombolisi", "eparina", "dapt", "ticagrelor", "fibrinolisi"],
      legalImpactPercent: -100,
    },
    stressProfile: {
      initialStress: 85,
      reactivityType: "hyper",
      timeDecayRate: 2.5,
      criticalMilestones: {
        reduceStress: [
          "richiesto_ecg",
          "pa_bibrachiale",
          "ecocardio",
          "angio",
          "cardiochirurgia",
          "consenso_informato",
        ],
        increaseStress: ["trombolisi", "eparina", "dapt", "coronarografia_cieca"],
      },
      lifesavingMilestones: ["angio", "ecocardio", "cardiochirurgia"],
      relievingExams: ["ecg", "ecocardio", "angio", "ddimero"],
      dangerousPrescriptions: ["trombolisi", "eparina", "dapt", "ticagrelor"],
    },
    labPanel: { finding: DDIMERO_MARKERS_FINDING },
    ecg: { finding: ECG_FINDING },
    pa_bibrachiale: { finding: PA_BIBRACHIALE_FINDING },
    angio: { finding: ANGIO_TC_FINDING, cost: 180 },
    tc: { finding: ANGIO_TC_FINDING, cost: 180 },
    ecocardio: { finding: ECOCARDIO_FINDING },
    ddimero: { finding: "D-Dimero marcatamente elevato — tipico in dissezione aortica acuta." },
    "troponina-hs": {
      finding:
        "Troponina hs lievemente elevata (coinvolgimento ostiale RCA) — non autorizza fibrinolisi/DAPT pre-esclusione dissezione.",
    },
    troponina: {
      finding:
        "Troponina hs lievemente elevata (coinvolgimento ostiale RCA) — non autorizza fibrinolisi/DAPT pre-esclusione dissezione.",
    },
    trombolisi: { finding: FATAL_ANTITHROMBOTIC_FINDING, cost: 450, fatal: true },
    eparina: { finding: FATAL_ANTITHROMBOTIC_FINDING, cost: 25, fatal: true },
    dapt: { finding: FATAL_ANTITHROMBOTIC_FINDING, cost: 40, fatal: true },
    advancedExams: {
      notes:
        "CAR-D01 Dissezione Stanford A mimo STEMI inferiore · Prassi Clinica · Difficile. " +
        "Asimmetria PA → Eco/Angio-TC → Cardiochirurgia. VIETATO trombolisi/eparina/DAPT pre-esclusione.",
      values: {
        ecg: {
          price: 11.6,
          urgencyTiming: "≤10 min + PA bibrachiale",
          routineTiming: "n.p.",
          routineMinutes: 5,
          normalFinding: `${ECG_FINDING} ${PA_BIBRACHIALE_FINDING}`,
          isAbnormal: true,
        },
        angio: {
          price: 180.0,
          urgencyTiming: "Emergenza (gold standard)",
          routineTiming: "n.p.",
          routineMinutes: 25,
          normalFinding: ANGIO_TC_FINDING,
          isAbnormal: true,
        },
        tc: {
          price: 180.0,
          urgencyTiming: "Emergenza",
          routineTiming: "n.p.",
          routineMinutes: 25,
          normalFinding: ANGIO_TC_FINDING,
          isAbnormal: true,
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "12 min bedside",
          routineTiming: "n.p.",
          routineMinutes: 12,
          normalFinding: ECOCARDIO_FINDING,
          isAbnormal: true,
        },
        ddimero: {
          price: 10.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "D-Dimero marcatamente elevato — tipico in dissezione aortica acuta.",
          isAbnormal: true,
        },
        "troponina-hs": {
          price: 10.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding:
            "Troponina hs lievemente elevata (coinvolgimento ostiale RCA) — non autorizza fibrinolisi/DAPT pre-esclusione dissezione.",
          isAbnormal: true,
        },
        trombolisi: {
          price: 450.0,
          urgencyTiming: "immediato",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_ANTITHROMBOTIC_FINDING,
          isAbnormal: true,
          fatalIfOrdered: true,
        },
        eparina: {
          price: 25.0,
          urgencyTiming: "immediato",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_ANTITHROMBOTIC_FINDING,
          isAbnormal: true,
          fatalIfOrdered: true,
        },
        dapt: {
          price: 40.0,
          urgencyTiming: "immediato",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_ANTITHROMBOTIC_FINDING,
          isAbnormal: true,
          fatalIfOrdered: true,
        },
        coronarografia: {
          price: 1800,
          urgencyTiming: "NON di prima intenzione se sospetto dissezione",
          routineTiming: "n.p.",
          routineMinutes: 40,
          normalFinding:
            "Se eseguita cieca come «STEMI»: rischio catastrofico di aggravamento. Preferire Angio-TC / sala cardiochirurgica.",
          isAbnormal: true,
        },
      },
    },
  },
};

export default CAR_D01;
