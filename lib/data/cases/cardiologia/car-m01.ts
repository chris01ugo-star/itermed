/**
 * CAR-M01 — SCA-NSTEMI Atipica / Equivalente Anginoso (Prassi Clinica → Cardiologia → Medio)
 * Gold Standard case anchored to Aequan `rag_knowledge_base`.
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf
 * - _common_legal/Legge_219_2017_Consenso_Informato.pdf (Art. 1)
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 5)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Ritmo sinusale a 88 bpm. Sottoslivellamento del tratto ST di 1 mm in V4–V6 con onde T negative asimmetriche. " +
  "Nessun sopraslivellamento ST. Nessun BAV. QTc nei limiti. Quadro compatibile con ischemia subendocardica laterale.";

const TROPONINA_SERIAL_FINDING =
  "Troponina hs seriale (protocollo 0h/1h–2h): t0 28 ng/L (URL <14) → t1h/t2h 52 ng/L (delta +24 ng/L). " +
  "Cinetica incrementale diagnostica per danno miocardico acuto (NSTEMI). Non ritardare la stratificazione GRACE.";

const CREAT_EGFR_FINDING =
  "Creatinina 1.35 mg/dL · eGFR stimato ~42 mL/min/1.73 m² (CKD-EPI) — nefropatia diabetica stadio G3b. " +
  "Essenziale per rischio contrasto e timing della coronarografia.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: ipocinesia della parete infero-laterale; FE stimata ~50–55%. " +
  "Nessun versamento pericardico. VCI non congestizia. Compatible con ischemia regionale NSTEMI.";

const ANGIO_TC_WASTE_FINDING =
  "Angio-TC torace d'urgenza senza stratificazione Wells/D-Dimero: inappropriata in pathway SCA, " +
  "spreco SSN ≈ €180 e rischio nefropatia da contrasto su rene diabetico (eGFR ridotto).";

const EGDS_WASTE_FINDING =
  "EGDS in acuto per sospetta gastrite: inappropriata e pericolosa prima di aver escluso SCA. " +
  "Rischio di ritardo diagnostico e di complicanze in paziente potenzialmente antiaggregata.";

const PHYSICAL_SUMMARY =
  "Donna di 66 anni, vigile, collaborante, dispnoica da sforzo lieve, nauseata. Killip I. " +
  "PA 150/90 mmHg, FC 88 bpm ritmica, SpO₂ 95% in aria ambiente. Toni ritmici, soffio sistolico 2/6 al giugulo. " +
  "Lieve riduzione del murmure vescicolare alle basi senza rantoli franchi. Addome trattabile, dolorabile all'epigastrio senza peritonismo.";

/** Budget I livello gold (11.60+16+6+43.90) ≈ €77.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 110;

export const CAR_M01: ClinicalCase = {
  code: "CAR-M01",
  id: "car-m01",
  title: "SCA-NSTEMI Atipica e Equivalente Anginoso in Paziente Diabetico",
  description:
    "Donna, 66 anni, Diabete Mellito Tipo 2 da 15 anni in scarso controllo (HbA1c 8.8%), giunge in PS per " +
    "insorgenza improvvisa di profonda dispnea da sforzo lieve, nausea ed epigastralgia sfumata da circa 3 ore. " +
    "Caso gold standard Prassi Clinica — Cardiologia — Medio.",
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
    "Sei Maria, 66 anni. Da circa 3 ore hai una forte mancanza d'aria anche per sforzi lievi, nausea e un fastidio allo stomaco.",
    "Non descrivere un dolore toracico tipico: sei diabetica da anni e spesso i sintomi sono «strani». Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, ansiosa ma collaborante. Se il medico chiede, conferma scarsa aderenza agli ipoglicemizzanti, HbA1c alta, " +
      "ipertensione, dislipidemia e creatinina già alterata in passato.",
    "Se ritarda l'ECG, salta la troponina seriale, propone subito Angio-TC senza Wells o EGDS prima di escludere il cuore, aumenta ansia e dispnea.",
  ].join(" "),
  pastMedicalHistory:
    "Diabete Mellito Tipo 2 da 15 anni (HbA1c recente 8.8%), terapia con metformina 1000 mg ×2 e glargine notturna — aderenza irregolare. " +
    "Ipertensione arteriosa in terapia con ACE-inibitore. Dislipidemia in statina. Sospetta neuropatia diabetica autonoma (equivalenti anginosi pregressi). " +
    "Nefropatia diabetica nota (ultima creatinina ~1.3 mg/dL). Non fumatrice. Nessuna allergia nota. Nessun vomito né febbre nelle ultime 48 ore.",
  diagnosis:
    "SCA-NSTEMI atipica da equivalente anginoso in diabetica con neuropatia autonoma — Killip I · GRACE rischio intermedio-alto",
  correctSolution:
    "Riconoscere equivalente anginoso diabetico → ECG ≤10' → troponina hs seriale 0h/1h–2h con delta → creatinina/eGFR → " +
    "calcolo GRACE → eco TT bedside se non ritarda → Consenso Informato (L. 219/2017) → coronarografia urgente <24h. " +
    "Evitare Angio-TC senza Wells/D-Dimero e EGDS prima di esclusione SCA.",
  goldStandardPath: [
    "ecg",
    "troponina-hs",
    "creat-urea-gfr",
    "ecocardio",
    "consenso-informato",
    "coronarografia",
  ],
  examLatencies: {
    ecg: 8,
    "troponina-hs": 40,
    "creat-urea-gfr": 30,
    ecocardio: 18,
    angio: 45,
    tc: 40,
    egds: 90,
    coronarografia: 30,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_equivalente_anginoso",
      prompt:
        "Valutazione equivalente anginoso / neuropatia diabetica autonoma (dispnea, nausea, epigastralgia senza dolore toracico tipico)",
      critical: true,
      expectedKeywords: [
        "equivalente",
        "neuropatia",
        "autonoma",
        "dispnea",
        "epigastr",
        "senza dolore",
        "atipic",
      ],
      rationale:
        "Nei diabetici l'ischemia si manifesta spesso come equivalente anginoso — riconoscimento obbligatorio ESC ACS 2023.",
    },
    {
      id: "aq_insorgenza_sintomi",
      prompt: "Tempo di insorgenza e durata di dispnea / epigastralgia (ore dall'onset)",
      critical: true,
      expectedKeywords: ["da quanto", "quando è iniziato", "da quante ore", "insorgenza", "3 ore"],
      rationale: "Finestra temporale per protocollo troponina 0h/1h e timing coronarografia <24h.",
    },
    {
      id: "aq_aderenza_ipoglicemizzanti",
      prompt: "Aderenza alla terapia ipoglicemizzante e controllo glicemico recente (HbA1c / ipoglicemie)",
      critical: true,
      expectedKeywords: ["aderenz", "metformina", "insulina", "hba1c", "glicem", "comprimess"],
      rationale: "Scarso controllo metabolico aumenta rischio CV e influenza scelte peri-procedurali (metformina/contrasto).",
    },
    {
      id: "aq_nefropatia_egfr",
      prompt: "Controllo nefropatico: creatinina / eGFR noti, storia di nefropatia diabetica",
      critical: true,
      expectedKeywords: ["creatinina", "egfr", "rene", "nefropat", "dialisi", "filtrato"],
      rationale: "eGFR essenziale per rischio contrasto e stratificazione prima di imaging / PCI.",
    },
    {
      id: "aq_fattori_rischio_vascolare",
      prompt: "Fattori di rischio vascolare (ipertensione, dislipidemia, fumo, CAD pregressa, familiarità)",
      critical: true,
      expectedKeywords: ["ipertens", "colesterolo", "dislipid", "fum", "infarto", "familiar"],
      rationale: "Completa il profilo di rischio e supporta la probabilità pre-test di SCA.",
    },
    {
      id: "aq_dd_digestiva",
      prompt: "Assenza di vomito e febbre per diagnosi differenziale digestiva / infettiva",
      critical: true,
      expectedKeywords: ["vomit", "febbre", "diarrea", "bruciore", "gastrit"],
      rationale: "Riduce probabilità di patologia gastroenterica acuta e giustifica priorità al pathway SCA vs EGDS.",
    },
    {
      id: "aq_farmaci_attuali",
      prompt: "Farmaci in uso (antiaggreganti, anticoagulanti, metformina, SGLT2i, nitrati)",
      critical: true,
      expectedKeywords: ["farmaci", "terapia", "aspirina", "metformina", "assume", "cardioaspirin"],
      rationale: "Baseline farmacologica per DAPT, contrasto iodato e consenso alla procedura invasiva.",
    },
    {
      id: "aq_sintomi_autonomici",
      prompt:
        "Sintomi di neuropatia autonoma / equivalenti pregressi (ischemia silente, ortostatismo, sudorazione anomala)",
      critical: true,
      expectedKeywords: ["silente", "ortostat", "sudorazione", "già successo", "equivalenti", "neuropat"],
      rationale: "Conferma fenotipo autonomico e alza l'indice di sospetto per NSTEMI atipico.",
    },
  ],

  /* ── Esame obiettivo SSOT (Killip I) ───────────────────────────── */
  physicalExam: {
    killipClass: "I",
    summary: PHYSICAL_SUMMARY,
    districts: [
      {
        district: "generale",
        finding:
          "Vigile, orientata, collaborante, dispnoica da sforzo lieve, nauseata. Non cianosi franca. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 150/90 mmHg, FC 88 bpm ritmica. Toni ritmici; soffio sistolico 2/6 al giugulo. Non sfregamenti.",
      },
      {
        district: "torace_polmonare",
        finding:
          "SpO₂ 95% in aria ambiente. Lieve riduzione del murmure vescicolare alle basi senza rantoli franchi (Killip I).",
      },
      {
        district: "addome",
        finding:
          "Addome trattabile, dolorabile all'epigastrio; assenza di difesa e di segni di peritonismo.",
      },
      {
        district: "neurologico",
        finding: "GCS 15. Pupille isocoriche normoreagenti. Nessun deficit focale.",
      },
      {
        district: "periferico",
        finding:
          "Perfusione periferica adeguata. Polsi simmetrici. Edemi declivi assenti / minimi.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello (tariffe SSN) ─────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni (entro 10 min dal triage)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "troponina-hs",
      name: "Troponina hs seriale t0 + t1h/t2h (delta incrementale)",
      level: "I",
      mandatory: true,
      priceEuro: 16.0,
      componentExamIds: ["troponina-hs"],
      finding: TROPONINA_SERIAL_FINDING,
    },
    {
      examId: "creat-urea-gfr",
      name: "Creatinina e eGFR (stratificazione rischio contrasto)",
      level: "I",
      mandatory: true,
      priceEuro: 6.0,
      finding: CREAT_EGFR_FINDING,
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico bedside",
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
      examId: "angio",
      name: "Angio-TC Torace d'urgenza (senza Wells / D-Dimero)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180.0,
      finding: ANGIO_TC_WASTE_FINDING,
      wasteRationale:
        "Inappropriata senza stratificazione Wells/D-Dimero: spreco ≈ €180 e rischio nefropatia da contrasto su rene diabetico.",
    },
    {
      examId: "egds",
      name: "Gastroscopia (EGDS) in acuto per sospetta gastrite",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 140.0,
      finding: EGDS_WASTE_FINDING,
      wasteRationale:
        "Inappropriata e pericolosa prima di aver escluso SCA: ritardo diagnostico e rischio procedurale.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_equivalente_anginoso",
        description:
          "Identifica l'equivalente anginoso / presentazione atipica in paziente diabetica con neuropatia autonoma",
        requiredMilestoneKeys: [
          "anamnesi_equivalente",
          "equivalente_anginoso",
          "richiesto_ecg",
          "ecg",
        ],
      },
      {
        id: "leg_troponina_seriale",
        description: "Monitora la troponina hs seriale (protocollo 0h/1h–2h) documentando il delta",
        requiredMilestoneKeys: ["troponina-hs", "troponina", "gold_standard_troponina-hs"],
      },
      {
        id: "leg_grace_score",
        description: "Calcola / documenta la stratificazione di rischio GRACE",
        requiredMilestoneKeys: ["grace", "grace_score", "stratificazione_rischio"],
      },
      {
        id: "leg_consenso_coro_24h",
        description:
          "Acquisisce Consenso Informato per coronarografia urgente (<24h) dopo informativa al paziente",
        requiredMilestoneKeys: [
          "consenso_informato",
          "consenso-informato",
          "coronarografia",
          "gold_standard_coronarografia",
        ],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Protocollo Troponina hs 0h/1h & Stratificazione GRACE)",
        documentPath:
          "cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf",
        articles: ["Protocollo Troponina hs 0h/1h", "Stratificazione GRACE", "NSTE-ACS timing"],
        relevance:
          "Definisce algoritmo hs-cTn 0h/1h, riconoscimento degli equivalenti anginosi e timing invasivo in base a GRACE.",
      },
      {
        sourceRef:
          "Rif. Legge_219_2017_Consenso_Informato.pdf - Art. 1 (Informativa al paziente diabetico e consenso alla procedura invasiva)",
        documentPath: "_common_legal/Legge_219_2017_Consenso_Informato.pdf",
        articles: ["Art. 1"],
        relevance:
          "Obbligo di informativa e consenso libero e consapevole prima della coronarografia urgente nel paziente diabetico.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Aderenza ai protocolli diagnostici di I livello)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 5"],
        relevance:
          "Aderenza alle buone pratiche e protocolli di I livello (ECG, hs-cTn, eGFR) come parametro di conformità (L. 24/2017).",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 66,
      sex: "F",
      context: "Pronto Soccorso — Dispnea / epigastralgia in diabetica",
    },
    vitals: {
      bloodPressure: "150/90",
      heartRate: 88,
      spo2: 95,
      temperature: 36.5,
      respiratoryRate: 20,
      bp: "150/90",
      hr: 88,
      temp: 36.5,
      rr: 20,
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
    },
    thorax: {
      cardiacAuscultation:
        "Toni ritmici a 88 bpm; soffio sistolico 2/6 al giugulo; non sfregamenti.",
      lungAuscultation:
        "Lieve riduzione del murmure vescicolare alle basi; assenza di rantoli franchi (Killip I).",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile, dolorabile all'epigastrio; non difesa né peritonismo.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Nessun deficit focale",
    },
    peripheral: {
      finding: "Perfusione adeguata; polsi simmetrici; edemi assenti/minimi.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-M01",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "medio",
    estimatedTimeMinutes: 25,
    legalConformityCriteria: [
      "equivalente_anginoso_identificato",
      "troponina_hs_seriale_0h_1h",
      "grace_score_calcolato",
      "consenso_coronarografia_urgente_lt_24h",
    ],
    ragSourceRefs: [
      "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Protocollo Troponina hs 0h/1h & Stratificazione GRACE)",
      "Rif. Legge_219_2017_Consenso_Informato.pdf - Art. 1 (Informativa al paziente diabetico e consenso alla procedura invasiva)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Aderenza ai protocolli diagnostici di I livello)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "troponina-hs", priceEuro: 16.0 },
        { examId: "creat-urea-gfr", priceEuro: 6.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
      ],
      inappropriate: [
        { examId: "angio", priceEuro: 180.0, penaltyPercent: 25 },
        { examId: "egds", priceEuro: 140.0, penaltyPercent: 25 },
      ],
      goldPathCostEuro: 11.6 + 16.0 + 6.0 + 43.9,
    },
    stressProfile: {
      initialStress: 65,
      reactivityType: "hyper",
      timeDecayRate: 1.8,
      criticalMilestones: {
        reduceStress: [
          "richiesto_ecg",
          "consenso_informato",
          "rassicurazione",
          "troponina-hs",
          "coronarografia",
        ],
        increaseStress: ["ritardo_ecg", "esame_inappropriato", "angio", "egds"],
      },
      lifesavingMilestones: ["ecg", "troponina-hs", "coronarografia"],
      relievingExams: ["ecg", "troponina-hs", "creat-urea-gfr", "ecocardio", "coronarografia"],
      dangerousPrescriptions: ["angio", "egds", "tc"],
    },
    labPanel: { finding: CREAT_EGFR_FINDING },
    ecg: { finding: ECG_FINDING },
    "troponina-hs": { finding: TROPONINA_SERIAL_FINDING },
    troponina: { finding: TROPONINA_SERIAL_FINDING },
    "creat-urea-gfr": { finding: CREAT_EGFR_FINDING },
    ecocardio: { finding: ECOCARDIO_FINDING },
    angio: { finding: ANGIO_TC_WASTE_FINDING, cost: 180 },
    tc: { finding: ANGIO_TC_WASTE_FINDING, cost: 180 },
    egds: { finding: EGDS_WASTE_FINDING, cost: 140 },
    advancedExams: {
      notes:
        "CAR-M01 NSTEMI atipico diabetica Killip I · Prassi Clinica · Medio. " +
        "ECG ≤10' · hs-cTn 0h/1h · GRACE · Consenso → coro <24h. Evitare Angio-TC senza Wells e EGDS pre-SCA.",
      values: {
        ecg: {
          price: 11.6,
          urgencyTiming: "≤10 min dal triage",
          routineTiming: "n.p.",
          routineMinutes: 8,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        "troponina-hs": {
          price: 16.0,
          urgencyTiming: "t0 + t1h/t2h",
          routineTiming: "2h",
          routineMinutes: 40,
          normalFinding: TROPONINA_SERIAL_FINDING,
          isAbnormal: true,
        },
        troponina: {
          price: 16.0,
          urgencyTiming: "t0 + t1h/t2h",
          routineTiming: "2h",
          routineMinutes: 40,
          normalFinding: TROPONINA_SERIAL_FINDING,
          isAbnormal: true,
        },
        "creat-urea-gfr": {
          price: 6.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: CREAT_EGFR_FINDING,
          isAbnormal: true,
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "18 min (bedside)",
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
          normalFinding: ANGIO_TC_WASTE_FINDING,
        },
        tc: {
          price: 180.0,
          urgencyTiming: "40 min",
          routineTiming: "24h",
          routineMinutes: 40,
          normalFinding: ANGIO_TC_WASTE_FINDING,
        },
        egds: {
          price: 140.0,
          urgencyTiming: "1h",
          routineTiming: "7 gg",
          routineMinutes: 90,
          normalFinding: EGDS_WASTE_FINDING,
        },
        coronarografia: {
          price: 1800,
          urgencyTiming: "Urgente <24h (GRACE)",
          routineTiming: "n.p.",
          routineMinutes: 30,
          normalFinding:
            "Stenosi critica ramo circonflesso / laterale; PCI con stent DES — flusso TIMI 3. Timing <24h rispettato.",
          isAbnormal: true,
        },
      },
    },
  },
};

export default CAR_M01;
