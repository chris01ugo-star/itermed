/**
 * CAR-M04 — Pericardite Acuta Idiopatica / Post-Virale vs STEMI
 * (Prassi Clinica → Cardiologia → Medio)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf
 * - cardiologia/03_prontuario_ssn/nota-95.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 5)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Sopraslivellamento ST concavo verso l'alto «a sella», DIFFUSO in quasi tutte le derivazioni eccetto aVR/V1; " +
  "sottoslivellamento del segmento PR. Nessun ST convesso localizzato né specchio tipico di STEMI. " +
  "Quadro ECG tipico di pericardite acuta — non attivare emodinamica come STEMI primario.";

const FLOGOSI_TROPONINA_FINDING =
  "Indici di flogosi: PCR e VES elevate (congrue con pericardite acuta). " +
  "Troponina hs: lievemente mossa — possibile miopericardite concomitante senza cinetica da SCA occlusiva.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: falda di versamento pericardico lieve/moderato; assenza di collasso telediastolico del VD, " +
  "VCI non congestizia critica — nessun segno di tamponamento. FE preservata. Nessuna ipocinesia regionale tipica di STEMI.";

const RX_TORACE_FINDING =
  "RX torace: non infiltrato polmonare franco, non pneumotorace. Silhouette cardiaca ai limiti superiori / " +
  "compatibile con versamento. Esclusione polmonite/pneumotorace come causa primaria del dolore.";

const CORO_WASTE_FINDING =
  "Coronarografia d'urgenza / attivazione sala di emodinamica senza ST convesso localizzato: inappropriata. " +
  "Espone un giovane di 34 anni senza rischio CAD a cateterismo inutile con spreco > €1200.";

const PHYSICAL_SUMMARY =
  "Uomo di 34 anni, vigile, collaborante, dolorante (dolore pungente posizionale). Killip I. " +
  "PA 125/75 mmHg, FC 92 bpm ritmica, T 37.6 °C, SpO₂ 98% in aria ambiente. " +
  "Sfregamenti pericardici mesocardici a tre fasi, meglio udibili da seduto in espirazione. Polmoni liberi.";

/** Budget I livello gold (11.60+22+43.90+24) ≈ €101.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 140;

export const CAR_M04: ClinicalCase = {
  code: "CAR-M04",
  id: "car-m04",
  title: "Pericardite Acuta Idiopatica / Post-Virale vs STEMI",
  description:
    "Uomo, 34 anni, senza fattori di rischio CV noti, dolore toracico acuto pungente accentuato da inspirazione e " +
    "decubito supino, alleviato da posizione seduta col busto flesso in avanti; sindrome simil-influenzale ~10 giorni prima. " +
    "Caso gold standard Prassi Clinica — Cardiologia — Medio (DD pericardite vs STEMI).",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "MEDIUM",
  difficultyLabel: "medio",
  estimatedTimeMinutes: 25,
  estimatedDurationMinutes: 25,
  timeLimitMinutes: 25,
  patientDeteriorationThreshold: 12,
  patientPrompt: [
    "Sei Luca, 34 anni. Hai un dolore al petto pungente che peggiora se respiri fondo o ti sdrai, e migliora se ti siedi chino in avanti.",
    "Dieci giorni fa avevi mal di gola e un po' di febbre. Non fumi, non hai colesterolo alto. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, preoccupato che sia un infarto. Se chiedono: niente irradiazione alla mandibola, niente sincope, " +
      "niente malattie autoimmuni note, nessun sforzo fisico intenso recente oltre il lavoro normale.",
    "Se attivano subito la sala di emodinamica senza spiegare, aumenta ansia. Se riconoscono la pericardite e danno FANS+colchicina, ti calmi.",
  ].join(" "),
  pastMedicalHistory:
    "Nessun fattore di rischio CAD noto (non fumatore, non dislipidemia nota, non diabetico, non iperteso). " +
    "Sindrome simil-influenzale con faringodinia e febbricola circa 10 giorni prima. Nessuna malattia reumatologica/autoimmune nota. " +
    "Nessuna allergia nota a FANS/ASA/colchicina. Nessuna sincope pregressa.",
  diagnosis:
    "Pericardite acuta idiopatica / post-virale (possibile miopericardite lieve) — DD con STEMI escluso su base clinica-ECG-eco",
  correctSolution:
    "Riconoscere fenotipo pericarditico (dolore posizionale + sfregamenti + ST concavo diffuso + PR↓) → " +
    "non attivare emodinamica → PCR/VES + Tn hs + eco TT + RX torace → FANS/ASA ad alte dosi + colchicina 0.5 mg/die (o bid) per 3 mesi " +
    "+ protezione gastrica e riposo da sforzi intensi.",
  goldStandardPath: [
    "ecg",
    "pcr-pct",
    "ves",
    "troponina-hs",
    "ecocardio",
    "rx-torace",
    "consenso-informato",
  ],
  examLatencies: {
    ecg: 8,
    "pcr-pct": 35,
    ves: 40,
    "troponina-hs": 35,
    ecocardio: 18,
    "rx-torace": 20,
    coronarografia: 40,
    angio: 45,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_dolore_posizionale",
      prompt:
        "Caratteristica posizionale del dolore (peggiora a supino, migliora seduto col busto flesso in avanti)",
      critical: true,
      expectedKeywords: ["posizione", "sdraiato", "supino", "seduto", "in avanti", "chino", "migliora"],
      rationale: "Dolore posizionale tipico di pericardite — criterio diagnostico clinico chiave.",
    },
    {
      id: "aq_modificazione_respiratoria",
      prompt: "Modificazione del dolore con gli atti respiratori (accentuato dall'inspirazione profonda)",
      critical: true,
      expectedKeywords: ["respir", "inspiraz", "fiato", "pungent", "pleuritic", "costa"],
      rationale: "Componente pleuro-pericardica tipica; distingue da angina da sforzo.",
    },
    {
      id: "aq_sintomi_virali",
      prompt: "Sintomi virali recenti (faringodinia, febbricola, mialgie) nelle 1–3 settimane precedenti",
      critical: true,
      expectedKeywords: ["virus", "influenza", "mal di gola", "febbre", "raffreddore", "giorni fa"],
      rationale: "Eziologia post-virale / idiopatica frequente nella pericardite dell'adulto giovane.",
    },
    {
      id: "aq_assenza_rischio_cad",
      prompt: "Assenza di fattori di rischio CAD (fumo, ipercolesterolemia, diabete, ipertensione, familiarità precoce)",
      critical: true,
      expectedKeywords: ["fum", "colesterolo", "diabet", "ipertens", "familiar", "rischio"],
      rationale: "Bassa probabilità pre-test di STEMI in giovane senza rischio — riduce overtriage a sala.",
    },
    {
      id: "aq_no_irradiazione_mandibola",
      prompt: "Assenza di irradiazione tipica ischemica (mandibola, braccio sinistro tipico anginoso)",
      critical: true,
      expectedKeywords: ["mandibola", "braccio", "irradia", "gola", "angina"],
      rationale: "Assenza di pattern di irradiazione CAD tipico supporta DD pericardite vs SCA.",
    },
    {
      id: "aq_autoimmunita",
      prompt: "Pregresse malattie reumatologiche / autoimmuni (LES, AR, ecc.)",
      critical: true,
      expectedKeywords: ["reumat", "autoimmun", "lupus", "artrite", "connettiv"],
      rationale: "Cause sistemiche di pericardite da ricercare; influenza follow-up e terapia.",
    },
    {
      id: "aq_assenza_sincope",
      prompt: "Assenza di sincope / instabilità emodinamica (rischio tamponamento)",
      critical: true,
      expectedKeywords: ["svenut", "sincope", "lipotim", "debolezza improvvisa"],
      rationale: "Sincope orienterebbe a complicanze (tamponamento) o diagnosi alternativa ad alto rischio.",
    },
    {
      id: "aq_qualita_pungente",
      prompt: "Qualità del dolore: acuto/pungente (vs oppressivo retrosternale da SCA)",
      critical: true,
      expectedKeywords: ["pungent", "acuto", "tagliente", "oppressiv", "peso"],
      rationale: "Qualità pungente vs oppressiva aiuta la discriminazione clinica precoce pericardite/STEMI.",
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
          "Vigile, collaborante, dolorante. Febbricola 37.6 °C. Emodinamicamente stabile. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 125/75 mmHg, FC 92 bpm ritmica. Toni validi. Sfregamenti pericardici mesocardici rumorosi a tre fasi " +
          "(presistolica, sistolica, diastolica), meglio udibili da seduto in espirazione forzata.",
      },
      {
        district: "torace_polmonare",
        finding: "SpO₂ 98% in aria ambiente. Polmoni liberi, non rantoli. Non sfregamenti pleurici isolati.",
      },
      {
        district: "addome",
        finding: "Addome trattabile, non dolente.",
      },
      {
        district: "neurologico",
        finding: "GCS 15. Nessun deficit focale.",
      },
      {
        district: "periferico",
        finding: "Perfusione valida. Polsi simmetrici. Non edemi.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni (ST concavo diffuso «a sella» + PR↓)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "indici-flogosi-troponina",
      name: "Indici di flogosi (PCR e VES) + Troponina hs",
      level: "I",
      mandatory: true,
      priceEuro: 22.0,
      componentExamIds: ["pcr-pct", "ves", "troponina-hs"],
      finding: FLOGOSI_TROPONINA_FINDING,
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico bedside (versamento senza tamponamento)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 30,
      priceEuro: 43.9,
      finding: ECOCARDIO_FINDING,
    },
    {
      examId: "rx-torace",
      name: "RX Torace (esclusione polmonite/pneumotorace)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 30,
      priceEuro: 24.0,
      finding: RX_TORACE_FINDING,
    },
  ],

  /* ── Esami inappropriati / spreco SSN (−25%) ───────────────────── */
  inappropriateExams: [
    {
      examId: "coronarografia",
      name: "Coronarografia d'urgenza / attivazione sala di emodinamica",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 1200.0,
      finding: CORO_WASTE_FINDING,
      wasteRationale:
        "Inappropriata senza ST convesso localizzato: cateterismo inutile in giovane a basso rischio — spreco > €1200.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_riconoscimento_pericardite_ecg",
        description:
          "Identifica la natura pericarditica (ST concavo diffuso «a sella» + sottoslivellamento PR) e la distingue dallo STEMI",
        requiredMilestoneKeys: ["ecg", "richiesto_ecg", "gold_standard_ecg", "pericardite"],
      },
      {
        id: "leg_no_emodinamica_inappropriata",
        description:
          "Non avvia coronarografia / sala di emodinamica inappropriata in assenza di ST convesso localizzato",
        requiredMilestoneKeys: [
          "no_coronarografia",
          "no_emodinamica",
          "dd_pericardite",
          "appropriatezza",
        ],
      },
      {
        id: "leg_colchicina_fans",
        description: "Prescrive colchicina in associazione ai FANS/ASA ad alte dosi (terapia gold standard)",
        requiredMilestoneKeys: ["colchicina", "fans", "ibuprofene", "aspirina", "asa"],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Diagnosi differenziale Pericardite vs STEMI)",
        documentPath:
          "cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf",
        articles: ["DD pericardite vs STEMI", "ST-elevation mimics", "Avoid inappropriate reperfusion"],
        relevance:
          "Inquadra i mimi di STEMI (ST concavo diffuso, PR↓) e previene riperfusione/cateterismo inappropriati.",
      },
      {
        sourceRef:
          "Rif. nota-95.pdf / Prontuario Farmaceutico (Appropriatezza d'uso di FANS e Colchicina)",
        documentPath: "cardiologia/03_prontuario_ssn/nota-95.pdf",
        articles: ["Appropriatezza prescrittiva", "FANS", "Colchicina"],
        relevance:
          "Supporta appropriatezza terapeutica SSN per FANS ad alte dosi e colchicina nella pericardite (riduzione recidive).",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Prevenzione del danno iatrogeno da manovre invasive non appropriate)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 5"],
        relevance:
          "Prevenzione del danno iatrogeno: evitare manovre invasive (coronarografia) non indicate dalle buone pratiche.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 34,
      sex: "M",
      context: "Pronto Soccorso — Dolore toracico pungente / sospetta pericardite",
    },
    vitals: {
      bloodPressure: "125/75",
      heartRate: 92,
      spo2: 98,
      temperature: 37.6,
      respiratoryRate: 18,
      bp: "125/75",
      hr: 92,
      temp: 37.6,
      rr: 18,
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      pericardialFrictionRub: "three-component mesocardial",
    },
    thorax: {
      cardiacAuscultation:
        "Toni validi a 92 bpm. Sfregamenti pericardici mesocardici a tre fasi, meglio udibili da seduto in espirazione.",
      lungAuscultation: "Polmoni liberi, non rantoli.",
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
      finding: "Perfusione valida; polsi simmetrici; non edemi.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-M04",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "medio",
    estimatedTimeMinutes: 25,
    goldTherapy: {
      immediate: [
        "FANS_o_ASA_alte_dosi_ibuprofene_600_q8h_o_ASA_800_1000_q8h",
        "colchicina_0_5_mg_die_o_bid_per_3_mesi",
        "protezione_gastrica",
        "evitare_sforzi_fisici_intensi",
      ],
      contraindicatedAcute: ["coronarografia_urgente_senza_ST_convesso_localizzato"],
    },
    legalConformityCriteria: [
      "riconoscimento_pericardite_ST_concavo_PR_down",
      "no_emodinamica_inappropriata",
      "colchicina_piu_fans",
    ],
    ragSourceRefs: [
      "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Diagnosi differenziale Pericardite vs STEMI)",
      "Rif. nota-95.pdf / Prontuario Farmaceutico (Appropriatezza d'uso di FANS e Colchicina)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Prevenzione del danno iatrogeno da manovre invasive non appropriate)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "indici-flogosi-troponina", priceEuro: 22.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
        { examId: "rx-torace", priceEuro: 24.0 },
      ],
      inappropriate: [{ examId: "coronarografia", priceEuro: 1200.0, penaltyPercent: 25 }],
      goldPathCostEuro: 11.6 + 22.0 + 43.9 + 24.0,
    },
    stressProfile: {
      initialStress: 60,
      reactivityType: "moderate",
      timeDecayRate: 1.5,
      criticalMilestones: {
        reduceStress: [
          "richiesto_ecg",
          "pericardite",
          "colchicina",
          "fans",
          "rassicurazione",
          "consenso_informato",
        ],
        increaseStress: ["coronarografia", "emodinamica", "esame_inappropriato"],
      },
      lifesavingMilestones: ["ecg", "ecocardio"],
      relievingExams: ["ecg", "ecocardio", "pcr-pct", "rx-torace", "troponina-hs"],
      dangerousPrescriptions: ["coronarografia"],
    },
    labPanel: { finding: FLOGOSI_TROPONINA_FINDING },
    ecg: { finding: ECG_FINDING },
    "pcr-pct": { finding: "PCR elevata — congrua con pericardite acuta." },
    ves: { finding: "VES elevata — congrua con flogosi sistemica/pericardica." },
    "troponina-hs": {
      finding: "Troponina hs lievemente mossa — possibile miopericardite senza cinetica da SCA occlusiva.",
    },
    ecocardio: { finding: ECOCARDIO_FINDING },
    "rx-torace": { finding: RX_TORACE_FINDING },
    coronarografia: { finding: CORO_WASTE_FINDING, cost: 1200 },
    advancedExams: {
      notes:
        "CAR-M04 Pericardite post-virale vs STEMI · Prassi Clinica · Medio. " +
        "ST concavo diffuso + PR↓ → FANS+colchicina. Non attivare emodinamica.",
      values: {
        ecg: {
          price: 11.6,
          urgencyTiming: "≤10 min",
          routineTiming: "n.p.",
          routineMinutes: 8,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        "pcr-pct": {
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: "PCR elevata — congrua con pericardite acuta.",
          isAbnormal: true,
        },
        ves: {
          price: 6.0,
          urgencyTiming: "40 min",
          routineTiming: "2h",
          routineMinutes: 40,
          normalFinding: "VES elevata — congrua con flogosi sistemica/pericardica.",
          isAbnormal: true,
        },
        "troponina-hs": {
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding:
            "Troponina hs lievemente mossa — possibile miopericardite senza cinetica da SCA occlusiva.",
          isAbnormal: true,
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "18 min bedside",
          routineTiming: "24h",
          routineMinutes: 18,
          normalFinding: ECOCARDIO_FINDING,
          isAbnormal: true,
        },
        "rx-torace": {
          price: 24.0,
          urgencyTiming: "20 min",
          routineTiming: "24h",
          routineMinutes: 20,
          normalFinding: RX_TORACE_FINDING,
        },
        coronarografia: {
          price: 1200.0,
          urgencyTiming: "non indicato",
          routineTiming: "n.p.",
          routineMinutes: 40,
          normalFinding: CORO_WASTE_FINDING,
        },
      },
    },
  },
};

export default CAR_M04;
