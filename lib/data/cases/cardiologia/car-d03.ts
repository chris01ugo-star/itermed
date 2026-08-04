/**
 * CAR-D03 — Tamponamento Cardiaco Acuto e Shock Ostruttivo
 * (Prassi Clinica → Cardiologia → Difficile)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf
 * - cardiologia/02_protocolli_pdta/PCAC-Algorithm-ACLS-PCAC-250527.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 6)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECO_POCUS_FINDING =
  "Eco TT bedside / POCUS focus IMMEDIATO: abbondante versamento pericardico circonfuso; " +
  "collapse telediastolico dell'atrio destro e del ventricolo destro. Segni ecografici di tamponamento cardiaco. " +
  "Gold standard diagnostico — indica pericardiocentesi d'urgenza.";

const ECG_FINDING =
  "Bassi voltaggi diffusi dei complessi QRS; alternanza elettrica (alternating QRS amplitude). " +
  "Tachicardia sinusale. Nessun STEMI tipico. Congruo con versamento pericardico abbondante / tamponamento.";

const EGA_FINDING =
  "EGA arteriosa: acidosi lattica da ipoperfusione/shock ostruttivo (lattato elevato, BE negativo, " +
  "PaO₂ ridotta). Marker di gravità — non ritardare il drenaggio pericardico.";

const FATAL_DIURETIC_NITRATE_FINDING =
  "ERRORE FATALE: furosemide / diuretici o nitrati nel tamponamento. Azzera il precarico del VD e precipita " +
  "arresto in PEA. Tutela NON CONFORME (−100% score medico-legale).";

const TC_DELAY_FINDING =
  "TC Torace con attesa del referto prima di drenare: inappropriata e pericolosa — ritarda la pericardiocentesi " +
  "salvavita e consente l'evoluzione verso PEA/arresto.";

const PHYSICAL_SUMMARY =
  "Donna di 59 anni, ansiosa/agitata, dispnoica a riposo. Shock ostruttivo. Killip non applicabile come EPA (polmoni liberi). " +
  "PA 85/50 mmHg (ipotensione, pressione differenziale ridotta), FC 125 bpm, SpO₂ 91% in O₂. " +
  "Triade di Beck completa: ipotensione + giugulari turgide + toni parafonici. Polso paradosso presente. " +
  "Polsi periferici iposfigmici/filiformi. Polmoni liberi da stasi (≠ EPA).";

/** Budget I livello gold (43.90+11.60+12) ≈ €67.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 100;

export const CAR_D03: ClinicalCase = {
  code: "CAR-D03",
  id: "car-d03",
  title: "Tamponamento Cardiaco Acuto e Shock Ostruttivo",
  description:
    "Donna, 59 anni, neoplasia mammaria in chemio-radioterapia, giunge in PS via 118 per marcata astenia, " +
    "dispnea grave a riposo, oppressione toracica e agitazione nelle ultime 12 ore. Caso gold standard Prassi Clinica — " +
    "Cardiologia — Difficile (tamponamento / shock ostruttivo).",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "HARD",
  difficultyLabel: "difficile",
  estimatedTimeMinutes: 30,
  estimatedDurationMinutes: 30,
  timeLimitMinutes: 30,
  patientDeteriorationThreshold: 5,
  patientPrompt: [
    "Sei Elena, 59 anni. Da circa 12 ore ti senti debolissima, non riesci a respirare bene anche da ferma, hai un peso al petto e tanta ansia.",
    "Sei in cura per un tumore al seno (chemioterapia e radioterapia). Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, agitata e a fiato corto. Se chiedono: niente trauma toracico recente, magari anticoagulanti da chiarire, " +
      "dispnea progressiva, possibile lipotimia, poca febbre, riserva respiratoria ridotta.",
    "Se ti danno diuretici o nitrati, collassi. Se fanno eco subito e preparano il drenaggio del pericardio con liquidi in vena, ti senti più protetta.",
  ].join(" "),
  pastMedicalHistory:
    "Neoplasia mammaria in trattamento chemio-radioterapico (rischio versamento pericardico maligno / postradioterapico). " +
    "Possibile terapia anticoagulante da verificare. Nessun trauma toracico recente riferito. Nessuna procedura cardiaca invasiva recente nota. " +
    "Nessuna allergia nota.",
  diagnosis:
    "Tamponamento cardiaco acuto con shock ostruttivo (versamento pericardico abbondante su base oncologica) — emergenza di pericardiocentesi",
  correctSolution:
    "Riconoscere triade di Beck + polso paradosso + polmoni liberi → POCUS/eco IMMEDIATO → " +
    "espansione volemica rapida con fisiologica (sostenere precarico VD) → pericardiocentesi d'urgenza eco-guidata / chirurgica → " +
    "ECG + EGA in parallelo. VIETATI furosemide/nitrati. Evitare NIV/CPAP ad alte PEEP pre-drenaggio. Non attendere TC.",
  goldStandardPath: [
    "ecocardio",
    "ecg",
    "ega",
    "consenso-informato",
  ],
  examLatencies: {
    ecocardio: 5,
    ecg: 5,
    ega: 5,
    tc: 35,
    "rx-torace": 20,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_storia_oncologica_pericardite",
      prompt: "Storia oncologica (neoplasia, chemio/radioterapia) o pericardite recente",
      critical: true,
      expectedKeywords: ["tumore", "cancro", "chemio", "radio", "mammella", "pericardite", "oncolog"],
      rationale: "Versamento maligno / postradioterapico è causa frequente di tamponamento subacuto.",
    },
    {
      id: "aq_trauma_toracico",
      prompt: "Traumi toracici recenti (contusione, incidente, caduta)",
      critical: true,
      expectedKeywords: ["trauma", "incidente", "colpo", "caduta", "torace", "contusion"],
      rationale: "Emopericardio traumatico è diagnosi differenziale ad altissima urgenza.",
    },
    {
      id: "aq_procedure_invasive",
      prompt: "Procedure invasive cardiache recenti (ablazione, PMK, coronarografia, biopsia)",
      critical: true,
      expectedKeywords: ["pacemaker", "ablazione", "cateterismo", "coronarografia", "biopsia", "impianto"],
      rationale: "Iatrogenia (perforazione) è causa classica di tamponamento acuto post-procedura.",
    },
    {
      id: "aq_insorgenza_dispnea",
      prompt: "Insorgenza e progressione della dispnea (ore vs giorni)",
      critical: true,
      expectedKeywords: ["da quanto", "dispnea", "affanno", "ore", "progressiv", "riposo"],
      rationale: "Timeline aiuta a distinguere tamponamento subacuto maligno vs acuto iatrogeno/traumatico.",
    },
    {
      id: "aq_sincope_presincope",
      prompt: "Presenza di sincope / presincope (ipoperfusione cerebrale da basso gittata)",
      critical: true,
      expectedKeywords: ["svenut", "sincope", "lipotim", "presincope", "nero davanti"],
      rationale: "Marker di gravità emodinamica e rischio di PEA imminente.",
    },
    {
      id: "aq_anticoagulanti",
      prompt: "Uso di anticoagulanti / antiaggreganti (rischio emopericardio)",
      critical: true,
      expectedKeywords: ["anticoagulant", "coumadin", "eliquis", "eparina", "aspirina", "cardioaspirin"],
      rationale: "Anticoagulazione aumenta rischio emorragico pericardico e influenza la tecnica di drenaggio.",
    },
    {
      id: "aq_febbre_infezione",
      prompt: "Febbre / infezioni (pericardite batterica, mediastinite)",
      critical: true,
      expectedKeywords: ["febbre", "infezione", "brividi", "antibiot", "sepsi"],
      rationale: "Eziologia infettiva modifica urgenza chirurgica vs drenaggio e terapia antibiotica.",
    },
    {
      id: "aq_riserva_respiratoria",
      prompt: "Riserva funzionale respiratoria abituale e tolleranza allo sforzo/baseline",
      critical: true,
      expectedKeywords: ["prima respirava", "scale", "sforzo", "ossigeno a casa", "bpco", "baseline"],
      rationale: "Contestualizza la gravità della dispnea attuale e il rischio di fallimento respiratorio.",
    },
  ],

  /* ── Esame obiettivo SSOT — Triade di Beck + polso paradosso ───── */
  physicalExam: {
    killipClass: "I",
    summary: PHYSICAL_SUMMARY,
    districts: [
      {
        district: "generale",
        finding:
          "Agitata, ansiosa, dispnoica a riposo, astenica. Shock ostruttivo in evoluzione. Polmoni senza stasi (≠ EPA).",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 85/50 mmHg (ipotensione, pressione differenziale ridotta). FC 125 bpm (tachicardia riflessa). " +
          "Toni cardiaci fortemente parafonici/attenuati («lontani»). Giugulari con turgore imponente. " +
          "Polso paradosso: caduta PAS >10 mmHg in inspirazione profonda. Triade di Beck completa.",
      },
      {
        district: "torace_polmonare",
        finding:
          "SpO₂ 91% in O₂. Polmoni liberi da stasi — assenza di rantoli (critical cue vs EPA cardiogeno).",
      },
      {
        district: "addome",
        finding: "Addome trattabile; possibile epatomegalia da stasi venosa sistemica.",
      },
      {
        district: "neurologico",
        finding: "Vigile ma agitata; GCS 15. Ansia/agitazione da ipoperfusione e ipossiemia.",
      },
      {
        district: "periferico",
        finding:
          "Polsi periferici iposfigmici e filiformi. Cute fredda, sudata. Riempimento capillare prolungato.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "ecocardio",
      name: "Ecocardiogramma TT bedside / POCUS focus IMMEDIATO (gold standard tamponamento)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 43.9,
      finding: ECO_POCUS_FINDING,
    },
    {
      examId: "ecg",
      name: "ECG 12 derivazioni (bassi voltaggi + alternanza elettrica)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "ega",
      name: "Emogasanalisi arteriosa (acidosi lattica da shock)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 12.0,
      finding: EGA_FINDING,
    },
  ],

  /* ── Errori fatali (−100%) ─────────────────────────────────────── */
  inappropriateExams: [
    {
      examId: "furosemide",
      name: "Furosemide / diuretici ev (errore fatale nel tamponamento)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 100,
      priceEuro: 5.0,
      finding: FATAL_DIURETIC_NITRATE_FINDING,
      wasteRationale:
        "ERRORE FATALE: riduce il precarico → PEA. −100% score medico-legale.",
    },
    {
      examId: "nitroglicerina",
      name: "Nitrati / nitroglicerina (errore fatale nel tamponamento)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 100,
      priceEuro: 8.0,
      finding: FATAL_DIURETIC_NITRATE_FINDING,
      wasteRationale:
        "ERRORE FATALE: venodilatazione → collasso del ritorno venoso e arresto in PEA.",
    },
    {
      examId: "tc",
      name: "TC Torace con attesa del referto prima del drenaggio",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 100,
      priceEuro: 180.0,
      finding: TC_DELAY_FINDING,
      wasteRationale:
        "Ritardo diagnostico-terapeutico inaccettabile: pericardiocentesi non deve attendere la TC.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_diagnosi_tamponamento",
        description:
          "Diagnosi clinico-ecografica di tamponamento (Beck + POCUS con collapse camere destre)",
        requiredMilestoneKeys: [
          "ecocardio",
          "pocus",
          "tamponamento",
          "gold_standard_ecocardio",
        ],
      },
      {
        id: "leg_espansione_volemica",
        description: "Infusione di liquidi ev di supporto (fisiologica) per sostenere il precarico del VD",
        requiredMilestoneKeys: [
          "fluidi",
          "fisiologica",
          "espansione_volemica",
          "boli_cristalloidi",
        ],
      },
      {
        id: "leg_no_diuresi",
        description: "Evita diuretici e nitrati (non riduce il precarico)",
        requiredMilestoneKeys: ["no_furosemide", "no_nitrati", "appropriatezza"],
      },
      {
        id: "leg_pericardiocentesi",
        description:
          "Esegue o allerta immediatamente per pericardiocentesi d'urgenza eco-guidata / chirurgica",
        requiredMilestoneKeys: [
          "pericardiocentesi",
          "drenaggio_pericardico",
          "cardiochirurgia",
          "consenso_informato",
        ],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Gestione delle emergenze pericardiche e Tamponamento)",
        documentPath:
          "cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf",
        articles: ["Pericardial emergencies", "Cardiac tamponade", "Urgent pericardiocentesis"],
        relevance:
          "Inquadra riconoscimento e drenaggio urgente del tamponamento come emergenza tempo-dipendente.",
      },
      {
        sourceRef:
          "Rif. PCAC-Algorithm-ACLS-PCAC-250527.pdf / ACLS (Gestione dello Shock Ostruttivo e PEA)",
        documentPath: "cardiologia/02_protocolli_pdta/PCAC-Algorithm-ACLS-PCAC-250527.pdf",
        articles: ["Obstructive shock", "PEA reversible causes (Hs/Ts)", "Tamponade"],
        relevance:
          "Shock ostruttivo / PEA: cause reversibili — tamponamento richiede drenaggio immediato, non diuresi.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 6 (Manovre d'urgenza salvavita ed errore da somministrazione inappropriata di farmaci)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 6"],
        relevance:
          "Responsabilità per imperizia: omissione di pericardiocentesi o somministrazione di diuretici/nitrati inappropriati.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 59,
      sex: "F",
      context: "Pronto Soccorso via 118 — Shock ostruttivo / sospetto tamponamento",
    },
    vitals: {
      bloodPressure: "85/50",
      heartRate: 125,
      spo2: 91,
      temperature: 36.8,
      respiratoryRate: 28,
      bp: "85/50",
      hr: 125,
      temp: 36.8,
      rr: 28,
      pulsePressureNarrow: true,
      pulsusParadoxus: true,
      oxygenSupport: true,
      hemodynamicStatus: "obstructive_shock",
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      beckTriad: true,
      muffledHeartSounds: true,
      jugularDistension: "imponente",
      pulsusParadoxusMmHg: ">10",
      lungsClearNoRales: true,
    },
    thorax: {
      cardiacAuscultation:
        "Toni fortemente parafonici/attenuati («lontani») a 125 bpm; non soffi valutabili.",
      lungAuscultation:
        "Polmoni liberi da stasi — assenza di rantoli (critical cue vs EPA).",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile; possibile epatomegalia da stasi.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Agitazione/ansia da shock; nessun deficit focale",
    },
    peripheral: {
      finding: "Polsi iposfigmici filiformi; cute fredda sudata; CRT prolungato.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-D03",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "difficile",
    estimatedTimeMinutes: 30,
    goldTherapy: {
      immediate: [
        "espansione_volemica_rapida_fisiologica_ev",
        "pericardiocentesi_urgenza_eco_guidata_o_chirurgica",
        "evitare_NIV_CPAP_alte_PEEP_pre_drenaggio",
      ],
      contraindicated: ["furosemide", "diuretici", "nitrati", "nitroglicerina", "tc_prima_del_drenaggio"],
    },
    legalConformityCriteria: [
      "diagnosi_clinico_ecografica_tamponamento",
      "fluidi_ev_supporto_precarico",
      "no_diuretici_nitrati",
      "pericardiocentesi_immediata_o_allerta",
    ],
    legalNonConformityTriggers: [
      "furosemide_o_nitrati_in_tamponamento",
      "attesa_tc_prima_del_drenaggio",
    ],
    ragSourceRefs: [
      "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Gestione delle emergenze pericardiche e Tamponamento)",
      "Rif. PCAC-Algorithm-ACLS-PCAC-250527.pdf / ACLS (Gestione dello Shock Ostruttivo e PEA)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 6 (Manovre d'urgenza salvavita ed errore da somministrazione inappropriata di farmaci)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecocardio", priceEuro: 43.9 },
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "ega", priceEuro: 12.0 },
      ],
      inappropriate: [
        { examId: "furosemide", priceEuro: 5.0, penaltyPercent: 100, fatal: true },
        { examId: "nitroglicerina", priceEuro: 8.0, penaltyPercent: 100, fatal: true },
        { examId: "tc", priceEuro: 180.0, penaltyPercent: 100, fatal: true },
      ],
      goldPathCostEuro: 43.9 + 11.6 + 12.0,
    },
    fatalErrors: {
      description:
        "Furosemide/nitrati → PEA da caduta di precarico. Attesa TC prima del drenaggio → arresto in evoluzione.",
      prescriptions: ["furosemide", "nitroglicerina", "nitrati", "diuretico"],
      legalImpactPercent: -100,
    },
    stressProfile: {
      initialStress: 95,
      reactivityType: "hyper",
      timeDecayRate: 3.5,
      criticalMilestones: {
        reduceStress: [
          "ecocardio",
          "pocus",
          "pericardiocentesi",
          "fluidi",
          "espansione_volemica",
          "consenso_informato",
        ],
        increaseStress: ["furosemide", "nitroglicerina", "tc", "cpap_alta_peep"],
      },
      lifesavingMilestones: ["ecocardio", "pericardiocentesi", "fluidi"],
      relievingExams: ["ecocardio", "ecg", "ega"],
      dangerousPrescriptions: ["furosemide", "nitroglicerina", "tc"],
    },
    labPanel: { finding: EGA_FINDING },
    ecocardio: { finding: ECO_POCUS_FINDING },
    ecg: { finding: ECG_FINDING },
    ega: { finding: EGA_FINDING },
    furosemide: { finding: FATAL_DIURETIC_NITRATE_FINDING, cost: 5, fatal: true },
    nitroglicerina: { finding: FATAL_DIURETIC_NITRATE_FINDING, cost: 8, fatal: true },
    tc: { finding: TC_DELAY_FINDING, cost: 180, fatal: true },
    advancedExams: {
      notes:
        "CAR-D03 Tamponamento / shock ostruttivo · Prassi Clinica · Difficile. " +
        "Beck + POCUS → fluidi + pericardiocentesi. VIETATI diuretici/nitrati e attesa TC.",
      values: {
        ecocardio: {
          price: 43.9,
          urgencyTiming: "IMMEDIATO (POCUS)",
          routineTiming: "n.p.",
          routineMinutes: 5,
          normalFinding: ECO_POCUS_FINDING,
          isAbnormal: true,
        },
        ecg: {
          price: 11.6,
          urgencyTiming: "≤10 min",
          routineTiming: "n.p.",
          routineMinutes: 5,
          normalFinding: ECG_FINDING,
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
        furosemide: {
          price: 5.0,
          urgencyTiming: "VIETATO",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_DIURETIC_NITRATE_FINDING,
          fatalIfOrdered: true,
        },
        nitroglicerina: {
          price: 8.0,
          urgencyTiming: "VIETATO",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_DIURETIC_NITRATE_FINDING,
          fatalIfOrdered: true,
        },
        tc: {
          price: 180.0,
          urgencyTiming: "non prima del drenaggio",
          routineTiming: "n.p.",
          routineMinutes: 35,
          normalFinding: TC_DELAY_FINDING,
          fatalIfOrdered: true,
        },
      },
    },
  },
};

export default CAR_D03;
