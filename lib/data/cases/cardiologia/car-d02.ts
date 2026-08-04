/**
 * CAR-D02 — Tachicardia Ventricolare Monomorfa Sostenuta in Pregresso STEMI
 * (Prassi Clinica → Cardiologia → Difficile)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/01_linee_guida/PMID-36017572_ESCGuideline_Zeppenfeld.pdf
 * - cardiologia/02_protocolli_pdta/PCAC-Algorithm-ACLS-PCAC-250527.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 6)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Tachicardia a QRS largo (>140 ms) monomorfa a 175 bpm; deviazione assiale estrema («nord-ovest»); " +
  "concordanza negativa nelle precordiali; catture / dissociazione atrio-ventricolare. " +
  "Criteri di Brugada positivi per Tachicardia Ventricolare (TV). In pregresso STEMI: TV fino a prova contraria.";

const LAB_PANEL_FINDING =
  "Ematochimici rapidi: K⁺ e Mg⁺⁺ da valutare/correggere (substrato aritmogeno). " +
  "Troponina hs: possibile elevazione da strain / ischemia secondaria — non ritardare la stabilizzazione dell'aritmia. " +
  "Creatinina nei limiti o lievemente alterata.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: FE stimata ~30–35% (HFrEF nota post-STEMI anteriore); acinesia/ipocinesia antero-settale-apicale (cicatrice). " +
  "Nessun versamento tamponante. Compatible con TV da rientro su cicatrice.";

const FATAL_CA_FINDING =
  "ERRORE FATALE: verapamil / diltiazem (calcio-antagonisti nodali) su tachicardia a QRS largo senza certezza di TSV. " +
  "Causa collasso emodinamico / FV — tutela NON CONFORME (−50% Econ + rischio decesso).";

const TC_WASTE_FINDING =
  "TC encefalo o Coronaro-TC prima di stabilizzare l'aritmia: inappropriata — ritarda cardioversione/amiodarone " +
  "e espone a deterioramento / arresto.";

const PHYSICAL_SUMMARY =
  "Uomo di 68 anni, sensorio conservato ma provato. Lieve instabilità emodinamica. Killip I–II. " +
  "PA 95/60 mmHg, FC 175 bpm ritmica, SpO₂ 94% in aria ambiente. " +
  "Toni tachicardici ritmici ad altissima frequenza. Non rantoli polmonari franchi alle basi.";

/** Budget I livello gold (11.60+28+43.90) ≈ €83.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 120;

export const CAR_D02: ClinicalCase = {
  code: "CAR-D02",
  id: "car-d02",
  title: "Tachicardia Ventricolare Monomorfa Sostenuta in Pregresso STEMI",
  description:
    "Uomo, 68 anni, cardiopatico ischemico con pregresso infarto anteriore (FE 32%), giunge in PS per cardiopalmo ritmico " +
    "ad esordio improvviso da ~45 minuti, astenia marcata, senso di peso retrosternale e vertigini in ortostatismo. " +
    "Caso gold standard Prassi Clinica — Cardiologia — Difficile (TV monomorfa sostenuta).",
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
    "Sei Franco, 68 anni. Da circa 45 minuti il cuore batte fortissimo e regolare, ti senti debolissimo, hai un peso al petto e giramenti se stai in piedi.",
    "Hai avuto un infarto anteriore anni fa, FE bassa. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, ansioso e affaticato. Se chiedono: pregresso STEMI, magari ICD o arresti da chiarire, " +
      "beta-bloccante/amiodarone a casa, a volte potassio basso, aderenza non sempre perfetta.",
    "Se ti danno verapamil/diltiazem peggiori drasticamente (svenimento, collasso). Se fanno cardioversione o amiodarone con monitoraggio, ti stabilizzi.",
  ].join(" "),
  pastMedicalHistory:
    "Pregresso STEMI anteriore con cicatrice miocardica; FE residua ~32% (HFrEF). Possibile ICD o storia di aritmie ventricolari da verificare. " +
    "Terapia domiciliare tipica: beta-bloccante ± amiodarone/sotalolo. Possibili squilibri elettrolitici recenti (ipokaliemia). " +
    "Aderenza terapeutica variabile. Nessuna allergia nota ad amiodarone.",
  diagnosis:
    "Tachicardia ventricolare monomorfa sostenuta su cicatrice post-STEMI anteriore (HFrEF) — lieve instabilità emodinamica",
  correctSolution:
    "ECG immediato → QRS largo in pregresso infarto = TV fino a prova contraria (Brugada+) → " +
    "se ipotensione/shock/angor: cardioversione elettrica sincronizzata 100–200 J con sedazione rapida; " +
    "se più stabile: amiodarone ev 150 mg in 10' poi infusione → labs K/Mg/Tn + eco bedside → " +
    "consenso e ricovero UTIC per studio EP ± ICD. VIETATI verapamil/diltiazem. Non TC prima della stabilizzazione.",
  goldStandardPath: [
    "ecg",
    "elettroliti",
    "troponina-hs",
    "ecocardio",
    "consenso-informato",
  ],
  examLatencies: {
    ecg: 5,
    elettroliti: 25,
    "troponina-hs": 35,
    ecocardio: 12,
    tc: 30,
    angio: 40,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_pregresso_infarto",
      prompt: "Anamnesi di pregresso infarto / cicatrice miocardica (substrato per TV da rientro)",
      critical: true,
      expectedKeywords: ["infarto", "stemi", "cicatrice", "cuore", "bypass", "stent", "ima"],
      rationale: "Pregresso STEMI → QRS largo = TV fino a prova contraria (ESC VA/SCD).",
    },
    {
      id: "aq_icd_arresti",
      prompt: "Presenza di defibrillatore impiantabile (ICD) o pregressi arresti / TV documentate",
      critical: true,
      expectedKeywords: ["icd", "defibrillatore", "arresto", "shock", "pim", "aritmia"],
      rationale: "Storia di morte improvvisa evitata / ICD guida urgenza EP e gestione acuta.",
    },
    {
      id: "aq_terapia_antiaritmica",
      prompt: "Terapia antiaritmica domiciliare (amiodarone, sotalolo, beta-bloccanti)",
      critical: true,
      expectedKeywords: ["amiodarone", "sotalolo", "beta", "bisoprololo", "antiaritmic", "farmaci"],
      rationale: "Baseline farmacologico; evita interazioni e informa sulla scelta amiodarone ev.",
    },
    {
      id: "aq_instabilita_lipotimia",
      prompt: "Sintomi di instabilità emodinamica: lipotimia, presincope, sincope, angor, oliguria",
      critical: true,
      expectedKeywords: ["lipotim", "presincope", "svenut", "vertigin", "dolore", "petto", "debole"],
      rationale: "Guida la scelta tra cardioversione immediata vs amiodarone (ACLS tachycardia with pulse).",
    },
    {
      id: "aq_caratteristiche_cardiopalmo",
      prompt: "Caratteristiche del cardiopalmo: esordio improvviso, ritmo regolare vs irregolare, durata",
      critical: true,
      expectedKeywords: ["improvvis", "regolare", "ritmico", "da quanto", "palpitaz", "battito"],
      rationale: "Esordio improvviso ritmico prolungato orienta a TV/TSV sostenuta vs extrasistolia.",
    },
    {
      id: "aq_aderenza_terapeutica",
      prompt: "Aderenza alla terapia cardiologica (beta-bloccante, diuretici, IECA/ARNI)",
      critical: true,
      expectedKeywords: ["aderenz", "saltato", "pastiglie", "non prende", "terapia"],
      rationale: "Sospensione di beta-bloccante/antiaritmico può precipitare TV su cicatrice.",
    },
    {
      id: "aq_elettroliti_ipokaliemia",
      prompt: "Ipokaliemia o squilibri elettrolitici recenti (diuretici, gastroenterite, dialisi)",
      critical: true,
      expectedKeywords: ["potassio", "elettroliti", "magnesio", "diuretico", "basso", "analisi"],
      rationale: "Trigger metabolico corretto in parallelo alla terapia antiaritmica/CVE.",
    },
    {
      id: "aq_peso_retrosternale",
      prompt: "Senso di peso retrosternale / ischemia concomitante durante la tachicardia",
      critical: true,
      expectedKeywords: ["peso", "petto", "oppress", "angina", "retrosternal"],
      rationale: "Angor durante TV = criterio di instabilità → preferire cardioversione sincronizzata.",
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
          "Sensorio conservato ma provato; astenico; lieve instabilità. Non shock franco all'ingresso. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 95/60 mmHg (ipotensione borderline), FC 175 bpm ritmica. Toni tachicardici ritmici ad altissima frequenza. " +
          "Polsi rapidi, iposfigmici ma presenti (TV con polso).",
      },
      {
        district: "torace_polmonare",
        finding: "SpO₂ 94% in aria ambiente. Non rantoli polmonari franchi alle basi.",
      },
      {
        district: "addome",
        finding: "Addome trattabile, non dolente.",
      },
      {
        district: "neurologico",
        finding: "GCS 15. Sensorio conservato; vertigini in ortostatismo riferite.",
      },
      {
        district: "periferico",
        finding: "Cute tiepida/fresca; polsi simmetrici tachicardici; riempimento capillare ai limiti.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni completo immediato (diagnosi TV / Brugada+)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 5,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "ematochimici-k-mg-troponina",
      name: "Ematochimici rapidi + Potassio, Magnesio e Troponina hs",
      level: "I",
      mandatory: true,
      priceEuro: 28.0,
      componentExamIds: ["elettroliti", "troponina-hs", "creat-urea-gfr"],
      finding: LAB_PANEL_FINDING,
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico bedside (cinetica e FE)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 20,
      priceEuro: 43.9,
      finding: ECOCARDIO_FINDING,
    },
  ],

  /* ── Errori fatali / inappropriati (−50%) ──────────────────────── */
  inappropriateExams: [
    {
      examId: "verapamil",
      name: "Verapamil ev su tachicardia a QRS largo (senza certezza di TSV)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 50,
      iatrogenicCritical: true,
      recommendationClass: "III",
      priceEuro: 15.0,
      finding: FATAL_CA_FINDING,
      wasteRationale:
        "Errore medico-legale grave: collasso emodinamico/FV su TV — −50% Econ e rischio decesso.",
    },
    {
      examId: "diltiazem",
      name: "Diltiazem ev su tachicardia a QRS largo (senza certezza di TSV)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 50,
      iatrogenicCritical: true,
      recommendationClass: "III",
      priceEuro: 15.0,
      finding: FATAL_CA_FINDING,
      wasteRationale:
        "Calcio-antagonista nodale su QRS largo = errore fatale se TV — tutela a rischio NON CONFORME.",
    },
    {
      examId: "tc",
      name: "TC Encefalo prima di stabilizzare l'aritmia",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 50,
      priceEuro: 85.0,
      finding: TC_WASTE_FINDING,
      wasteRationale:
        "Ritarda cardioversione/amiodarone; inappropriata finché l'aritmia non è stabilizzata.",
    },
    {
      examId: "angio",
      name: "Coronaro-TC / Angio-TC prima di stabilizzare l'aritmia",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 50,
      priceEuro: 180.0,
      finding: TC_WASTE_FINDING,
      wasteRationale:
        "Imaging avanzato pre-stabilizzazione: ritardo pericoloso e spreco SSN.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_riconoscimento_tv",
        description:
          "Riconosce la TV (QRS largo in pregresso infarto = TV fino a prova contraria; criteri di Brugada)",
        requiredMilestoneKeys: ["ecg", "richiesto_ecg", "tv", "tachicardia_ventricolare"],
      },
      {
        id: "leg_no_calcio_antagonisti",
        description: "Evita calcio-antagonisti ev (verapamil/diltiazem) sulla tachicardia a QRS largo",
        requiredMilestoneKeys: [
          "no_verapamil",
          "no_diltiazem",
          "appropriatezza_antiaritmica",
          "monitoraggio",
        ],
      },
      {
        id: "leg_cve_o_amiodarone",
        description:
          "Impiega cardioversione elettrica sincronizzata e/o amiodarone ev con monitoraggio (secondo stabilità)",
        requiredMilestoneKeys: [
          "cardioversione",
          "cve",
          "amiodarone",
          "sedazione",
          "consenso_informato",
        ],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. PMID-36017572_ESCGuideline_Zeppenfeld.pdf (Linee Guida ESC Aritmie Ventricolari & Morte Improvvisa - Gestione TV sostenuta)",
        documentPath: "cardiologia/01_linee_guida/PMID-36017572_ESCGuideline_Zeppenfeld.pdf",
        articles: [
          "Sustained monomorphic VT",
          "Wide-complex tachycardia = VT until proven otherwise",
          "ICD / EP study",
        ],
        relevance:
          "Gestione della TV sostenuta su cardiopatia strutturale: riconoscimento, terapia acuta, prevenzione secondaria.",
      },
      {
        sourceRef:
          "Rif. PCAC-Algorithm-ACLS-PCAC-250527.pdf / ACLS (Algoritmo Tachicardia con Polso)",
        documentPath: "cardiologia/02_protocolli_pdta/PCAC-Algorithm-ACLS-PCAC-250527.pdf",
        articles: ["Tachycardia with pulse", "Synchronized cardioversion", "Antiarrhythmic infusion"],
        relevance:
          "Algoritmo ACLS: CVE se instabile; antiaritmico (amiodarone) se stabile; evitare CA nodali su QRS largo.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 6 (Responsabilità per imperizia nelle manovre rianimatorie ed aritmologiche)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 6"],
        relevance:
          "Responsabilità per imperizia in manovre aritmologiche/rianimatorie (es. verapamil su TV).",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 68,
      sex: "M",
      context: "Pronto Soccorso — Tachicardia a QRS largo / sospetta TV",
    },
    vitals: {
      bloodPressure: "95/60",
      heartRate: 175,
      spo2: 94,
      temperature: 36.5,
      respiratoryRate: 22,
      bp: "95/60",
      hr: 175,
      temp: 36.5,
      rr: 22,
      rhythm: "monomorphic_VT_175",
      hemodynamicStatus: "borderline_unstable",
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      pulsePresent: true,
    },
    thorax: {
      cardiacAuscultation: "Toni tachicardici ritmici a ~175 bpm; non soffi valutabili in acuzie.",
      lungAuscultation: "Non rantoli polmonari franchi alle basi.",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile, non dolente.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Sensorio conservato; vertigini ortostatiche riferite",
    },
    peripheral: {
      finding: "Polsi presenti, rapidi, iposfigmici; cute tiepida/fresca.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-D02",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "difficile",
    estimatedTimeMinutes: 30,
    goldTherapy: {
      ifUnstable: "cardioversione_elettrica_sincronizzata_100_200J_sedazione_rapida",
      ifMoreStable: "amiodarone_ev_150mg_in_10min_poi_infusione",
      disposition: "consenso_UTIC_studio_EP_valutazione_ICD",
      contraindicated: ["verapamil_ev", "diltiazem_ev", "tc_pre_stabilizzazione"],
    },
    legalConformityCriteria: [
      "riconoscimento_tv_qrs_largo_post_infarto",
      "no_calcio_antagonisti_nodali",
      "cve_o_amiodarone_con_monitoraggio",
    ],
    legalNonConformityTriggers: [
      "verapamil_su_qrs_largo",
      "diltiazem_su_qrs_largo",
      "imaging_pre_stabilizzazione_aritmia",
    ],
    ragSourceRefs: [
      "Rif. PMID-36017572_ESCGuideline_Zeppenfeld.pdf (Linee Guida ESC Aritmie Ventricolari & Morte Improvvisa - Gestione TV sostenuta)",
      "Rif. PCAC-Algorithm-ACLS-PCAC-250527.pdf / ACLS (Algoritmo Tachicardia con Polso)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 6 (Responsabilità per imperizia nelle manovre rianimatorie ed aritmologiche)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "ematochimici-k-mg-troponina", priceEuro: 28.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
      ],
      inappropriate: [
        { examId: "verapamil", priceEuro: 15.0, penaltyPercent: 50, fatal: true },
        { examId: "diltiazem", priceEuro: 15.0, penaltyPercent: 50, fatal: true },
        { examId: "tc", priceEuro: 85.0, penaltyPercent: 50 },
        { examId: "angio", priceEuro: 180.0, penaltyPercent: 50 },
      ],
      goldPathCostEuro: 11.6 + 28.0 + 43.9,
    },
    fatalErrors: {
      description:
        "Verapamil/diltiazem su QRS largo senza certezza di TSV → collasso/FV. TC/Coronaro-TC pre-stabilizzazione.",
      prescriptions: ["verapamil", "diltiazem"],
      legalImpactPercent: -50,
    },
    stressProfile: {
      initialStress: 88,
      reactivityType: "hyper",
      timeDecayRate: 2.8,
      criticalMilestones: {
        reduceStress: [
          "richiesto_ecg",
          "cardioversione",
          "amiodarone",
          "monitoraggio",
          "consenso_informato",
        ],
        increaseStress: ["verapamil", "diltiazem", "tc", "angio"],
      },
      lifesavingMilestones: ["ecg", "cardioversione", "amiodarone"],
      relievingExams: ["ecg", "elettroliti", "ecocardio"],
      dangerousPrescriptions: ["verapamil", "diltiazem", "tc", "angio"],
    },
    labPanel: { finding: LAB_PANEL_FINDING },
    ecg: { finding: ECG_FINDING },
    elettroliti: { finding: "K⁺ e Mg⁺⁺: correggere se bassi — substrato aritmogeno." },
    "troponina-hs": {
      finding: "Troponina hs: possibile elevazione da strain — non ritardare stabilizzazione TV.",
    },
    "creat-urea-gfr": { finding: "Creatinina nei limiti o lievemente alterata." },
    ecocardio: { finding: ECOCARDIO_FINDING },
    verapamil: { finding: FATAL_CA_FINDING, cost: 15, fatal: true },
    diltiazem: { finding: FATAL_CA_FINDING, cost: 15, fatal: true },
    tc: { finding: TC_WASTE_FINDING, cost: 85 },
    angio: { finding: TC_WASTE_FINDING, cost: 180 },
    advancedExams: {
      notes:
        "CAR-D02 TV monomorfa sostenuta post-STEMI · Prassi Clinica · Difficile. " +
        "QRS largo = TV. CVE se instabile / amiodarone se più stabile. VIETATI verapamil/diltiazem.",
      values: {
        ecg: {
          price: 11.6,
          urgencyTiming: "immediato",
          routineTiming: "n.p.",
          routineMinutes: 5,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        elettroliti: {
          price: 10.0,
          urgencyTiming: "25 min",
          routineTiming: "2h",
          routineMinutes: 25,
          normalFinding: "K⁺ e Mg⁺⁺: correggere se bassi — substrato aritmogeno.",
        },
        "troponina-hs": {
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding:
            "Troponina hs: possibile elevazione da strain — non ritardare stabilizzazione TV.",
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
        verapamil: {
          price: 15.0,
          urgencyTiming: "VIETATO",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_CA_FINDING,
          fatalIfOrdered: true,
        },
        diltiazem: {
          price: 15.0,
          urgencyTiming: "VIETATO",
          routineTiming: "n.p.",
          routineMinutes: 0,
          normalFinding: FATAL_CA_FINDING,
          fatalIfOrdered: true,
        },
        tc: {
          price: 85.0,
          urgencyTiming: "solo dopo stabilizzazione",
          routineTiming: "n.p.",
          routineMinutes: 30,
          normalFinding: TC_WASTE_FINDING,
        },
        angio: {
          price: 180.0,
          urgencyTiming: "solo dopo stabilizzazione",
          routineTiming: "n.p.",
          routineMinutes: 40,
          normalFinding: TC_WASTE_FINDING,
        },
      },
    },
  },
};

export default CAR_D02;
