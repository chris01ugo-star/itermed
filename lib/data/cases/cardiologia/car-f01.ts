/**
 * CAR-F01 — STEMI Anteriore Acuto (Prassi Clinica → Cardiologia → Facile)
 * Gold Standard case anchored to Aequan `rag_knowledge_base`.
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 5)
 * - _common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf (Art. 13)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Ritmo sinusale a 90 bpm. Sopraslivellamento del tratto ST ≥1 mm in V1–V4 (STEMI anteriore). " +
  "Specchio inferiore assente. Nessun BAV. QTc nei limiti.";

const TROPONINA_FINDING =
  "Troponina hs (t0): 86 ng/L (URL <14 ng/L) — elevazione basale compatibile con danno miocardico acuto; " +
  "non ritardare la riperfusione in attesa del dosaggio.";

const LAB_PANEL_FINDING =
  "Ematochimici di routine — Elettroliti: Na 139 · K 4.1 · Cl 102 mmol/L. " +
  "Funzionalità renale: Creatinina 0.95 mg/dL · eGFR >90. " +
  "Coagulazione: INR 1.0 · aPTT 28 s. Emocromo: Hb 14.2 · PLT 245 · GB 9.8.";

const ECOCARDIO_FINDING =
  "Eco TT bedside focalizzato: acinesia / ipocinesia severa della parete antero-settale e apicale; " +
  "FE stimata ~40–45%. Nessun versamento pericardico significativo. VCI non congestizia. Killip I clinico confermato.";

const ANGIO_TC_WASTE_FINDING =
  "Esame non indicato di prima intenzione in STEMI tipico ECG-positivo: genera ritardo Door-to-Balloon " +
  "e spreco di risorsa SSN (~€180). Nessuna evidenza di dissezione aortica o EP nel quesito clinico attuale.";

const PHYSICAL_SUMMARY =
  "Uomo di 58 anni, vigile, collaborante, dolorante, diaforetico. Killip I. " +
  "PA 140/85 mmHg, FC 90 bpm ritmica, SpO₂ 97% in aria ambiente. Toni cardiaci validi, non soffi né sfregamenti. " +
  "Murmure vescicolare fisiologico su tutto l'ambito polmonare. Perfusione periferica valida, polsi simmetrici.";

/** Budget I livello gold (11.60+8+25+43.90) ≈ €88.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 120;

export const CAR_F01: ClinicalCase = {
  code: "CAR-F01",
  id: "car-f01",
  title: "STEMI Anteriore Acuto in Paziente di 58 anni",
  description:
    "Uomo, 58 anni, dolore toracico retrosternale oppressivo insorto da 40 minuti, irradiato al braccio sinistro " +
    "e alla mandibola, associato a diaforesi e nausea. Caso gold standard Prassi Clinica — Cardiologia — Facile.",
  category: "prassi-clinica",
  specialty: "cardiologia",
  specialtyLabel: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "EASY",
  difficultyLabel: "facile",
  estimatedTimeMinutes: 20,
  estimatedDurationMinutes: 20,
  timeLimitMinutes: 20,
  patientDeteriorationThreshold: 10,
  patientPrompt: [
    "Sei Roberto, 58 anni. Da circa 40 minuti hai un peso oppressivo dietro lo sterno che si irradia al braccio sinistro e alla mandibola.",
    "Sei sudato e nauseato. Hai paura di un infarto ma non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, ansioso ma collaborante. Se il medico chiede, conferma fumo attivo, ipertensione in terapia e padre morto di infarto.",
    "Se ritarda l'ECG o propone Angio-TC/Coronaro-TC, aumenta ansia e senso di morte imminente.",
  ].join(" "),
  pastMedicalHistory:
    "Ipertensione arteriosa in terapia con ACE-inibitore (ramipril 5 mg). Fumatore attivo (~15 sigarette/die, 25 pack-year). " +
    "Dislipidemia non trattata. Familiarità positiva per CAD (padre deceduto per IMA a 62 anni). " +
    "Nessuna allergia nota. Nessun sanguinamento maggiore, ulcera peptica attiva, ictus recente o chirurgia maggiore negli ultimi 30 giorni.",
  diagnosis: "STEMI anteriore acuto (occlusione tipica IVA) — Killip I",
  correctSolution:
    "STEMI anteriore: ECG 12 derivazioni entro 10' dal triage → DAPT (ASA + P2Y12) dopo verifica assenza sanguinamenti attivi → " +
    "invio immediato in Emodinamica (Primary PCI, Door-to-Balloon <90') → troponina hs t0 + ematochimici + eco TT bedside se non ritarda la sala. " +
    "Evitare Angio-TC/Coronaro-TC di prima intenzione.",
  goldStandardPath: [
    "ecg",
    "troponina-hs",
    "elettroliti",
    "creat-urea-gfr",
    "pt-ptt-inr",
    "ecocardio",
    "consenso-informato",
    "coronarografia",
  ],
  examLatencies: {
    ecg: 8,
    "troponina-hs": 35,
    elettroliti: 30,
    "creat-urea-gfr": 30,
    "pt-ptt-inr": 30,
    emocromo: 30,
    ecocardio: 18,
    angio: 45,
    tc: 40,
    coronarografia: 25,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_insorgenza",
      prompt: "Tempo di insorgenza del dolore (minuti/ore esatte dall'onset)",
      critical: true,
      expectedKeywords: ["da quanto", "quando è iniziato", "da quanti minuti", "insorgenza", "da 40"],
      rationale: "Finestra per riperfusione e Door-to-Balloon — ESC ACS 2023.",
    },
    {
      id: "aq_caratteristiche_dolore",
      prompt:
        "Caratteristiche del dolore: sede retrosternale, qualità oppressiva, irradiazione a braccio sinistro e mandibola",
      critical: true,
      expectedKeywords: [
        "dove fa male",
        "oppressiv",
        "retrosternal",
        "irradia",
        "braccio",
        "mandibola",
      ],
      rationale: "Fenotipo tipico di ischemia miocardica — priorità ECG e pathway STEMI.",
    },
    {
      id: "aq_ipertensione",
      prompt: "Anamnesi di ipertensione arteriosa e terapia antiipertensiva in atto",
      critical: true,
      expectedKeywords: ["ipertens", "pression", "ramipril", "antiipertens"],
      rationale: "Fattore di rischio CV maggiore; contesto terapeutico pre-PCI.",
    },
    {
      id: "aq_fumo",
      prompt: "Abitudine tabagica (fumo attivo / pack-year)",
      critical: true,
      expectedKeywords: ["fum", "sigarett", "tabag"],
      rationale: "Fattore di rischio modificabile ad alto impatto su CAD.",
    },
    {
      id: "aq_familiarita_cad",
      prompt: "Familiarità per coronaropatia / IMA (parenti di I grado)",
      critical: true,
      expectedKeywords: ["familiar", "padre", "infarto", "ima", "cuore in famiglia"],
      rationale: "Anamnesi familiare positiva per CAD — completa il profilo di rischio.",
    },
    {
      id: "aq_farmaci",
      prompt: "Farmaci in uso (antiipertensivi, antiaggreganti, anticoagulanti, nitrati)",
      critical: true,
      expectedKeywords: ["farmaci", "terapia", "assume", "pillol", "aspirina", "cardioaspirin"],
      rationale: "Baseline farmacologica prima di DAPT e sala di emodinamica.",
    },
    {
      id: "aq_controindicazioni_trombolisi",
      prompt:
        "Controindicazioni a fibrinolisi (se PCI non tempestiva): ictus, trauma/chirurgia recente, sanguinamento, neoplasia intracranica",
      critical: true,
      expectedKeywords: ["ictus", "emorragia", "sanguinamento", "chirurgia", "trauma", "controindicaz"],
      rationale: "Branch ESC: fibrinolisi solo se Primary PCI non raggiungibile e senza controindicazioni.",
    },
    {
      id: "aq_controindicazioni_antiaggreganti",
      prompt:
        "Controindicazioni / cautela ad antiaggregazione (DAPT): sanguinamento attivo, ulcera peptica attiva, allergia ASA/P2Y12",
      critical: true,
      expectedKeywords: ["sanguinamento", "ulcera", "allergia", "aspirina", "melena", "emorragia"],
      rationale: "Prerequisito obbligatorio prima della DAPT — tutela medico-legale e sicurezza prescrittiva.",
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
          "Vigile, orientato, collaborante, dolorante, diaforetico. Non cianosi. Nessun edemi declivi. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 140/85 mmHg, FC 90 bpm ritmica. Toni cardiaci validi, ritmici; non soffi, non sfregamenti pericardici.",
      },
      {
        district: "torace_polmonare",
        finding:
          "SpO₂ 97% in aria ambiente. Murmure vescicolare fisiologico su tutto l'ambito polmonare; non rantoli (Killip I).",
      },
      {
        district: "addome",
        finding: "Addome trattabile, non dolente, non epatomegalia da stasi.",
      },
      {
        district: "neurologico",
        finding: "GCS 15. Pupille isocoriche normoreagenti. Nessun deficit focale.",
      },
      {
        district: "periferico",
        finding:
          "Perfusione periferica valida. Polsi radiali e pedidi simmetrici e validi. Riempimento capillare <2 s.",
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
      name: "Troponina ad alta sensibilità (t0)",
      level: "I",
      mandatory: true,
      priceEuro: 8.0,
      finding: TROPONINA_FINDING,
    },
    {
      examId: "ematochimici-routine",
      name: "Ematochimici di routine (Elettroliti, Funzionalità Renale, Coagulazione)",
      level: "I",
      mandatory: true,
      priceEuro: 25.0,
      componentExamIds: ["elettroliti", "creat-urea-gfr", "pt-ptt-inr", "emocromo"],
      finding: LAB_PANEL_FINDING,
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
      name: "Angio-TC Torace / Coronaro-TC immediata",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180.0,
      finding: ANGIO_TC_WASTE_FINDING,
      wasteRationale:
        "Spreco risorsa SSN ≈ €180 e ritardo Door-to-Balloon: non indicato di prima intenzione in STEMI tipico ECG-positivo.",
    },
    {
      examId: "tc",
      name: "TC torace d'urgenza (non mirata)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180.0,
      finding: ANGIO_TC_WASTE_FINDING,
      wasteRationale:
        "TC torace generica non sostituisce né anticipa la Primary PCI; rischio di ritardo terapeutico e costo inappropriato.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_ecg_10min",
        description: "Richiede ECG 12 derivazioni entro 10 minuti dal triage",
        requiredMilestoneKeys: ["richiesto_ecg", "ecg", "gold_standard_ecg"],
      },
      {
        id: "leg_dapt_screen",
        description:
          "Somministra DAPT previa verifica anamnestica di assenza di controindicazioni / sanguinamenti attivi",
        requiredMilestoneKeys: ["dapt", "antiaggregazione", "asa_p2y12", "anamnesi_farmaci"],
      },
      {
        id: "leg_primary_pci_90",
        description:
          "Invio immediato in Emodinamica per Primary PCI con Door-to-Balloon < 90 minuti",
        requiredMilestoneKeys: ["coronarografia", "gold_standard_coronarografia", "richiesto_coronarografia"],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Timing PCI & Troponina hs)",
        documentPath:
          "cardiologia/02_protocolli_pdta/2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf",
        articles: ["Timing Primary PCI / Door-to-Balloon", "Troponina hs nel pathway ACS"],
        relevance:
          "Definisce ECG immediato, tempi di riperfusione <90' e ruolo della troponina hs senza ritardare la PCI.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Buone pratiche clinico-assistenziali)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 5"],
        relevance:
          "Adesione alle linee guida e buone pratiche clinico-assistenziali come parametro di conformità (L. 24/2017).",
      },
      {
        sourceRef: "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Prescrizione appropriata)",
        documentPath: "_common_legal/CODICE-DEONTOLOGIA-MEDICA-2014.pdf",
        articles: ["Art. 13"],
        relevance:
          "Obbligo di appropriatezza prescrittiva: evita Angio-TC/Coronaro-TC non indicate e sostiene DAPT consapevole.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 58,
      sex: "M",
      context: "Pronto Soccorso — Triage dolore toracico",
    },
    vitals: {
      bloodPressure: "140/85",
      heartRate: 90,
      spo2: 97,
      temperature: 36.6,
      respiratoryRate: 18,
      bp: "140/85",
      hr: 90,
      temp: 36.6,
      rr: 18,
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
    },
    thorax: {
      cardiacAuscultation: "Toni cardiaci validi, ritmici a 90 bpm; non soffi né sfregamenti.",
      lungAuscultation: "Murmure vescicolare fisiologico su tutto l'ambito; non rantoli (Killip I).",
    },
    abdomen: {
      inspection: "Addome piano, trattabile.",
      palpation: "Non dolente; non epatomegalia da stasi.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "15",
      deficits: "Nessun deficit focale",
    },
    peripheral: {
      finding: "Perfusione valida; polsi simmetrici; riempimento capillare <2 s.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-F01",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "facile",
    estimatedTimeMinutes: 20,
    legalConformityCriteria: [
      "ecg_entro_10_min",
      "dapt_dopo_screen_emorragico",
      "primary_pci_dtb_lt_90",
    ],
    ragSourceRefs: [
      "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Timing PCI & Troponina hs)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Buone pratiche clinico-assistenziali)",
      "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Prescrizione appropriata)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "troponina-hs", priceEuro: 8.0 },
        { examId: "ematochimici-routine", priceEuro: 25.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
      ],
      inappropriate: [{ examId: "angio", priceEuro: 180.0, penaltyPercent: 25 }],
      goldPathCostEuro: 11.6 + 8.0 + 25.0 + 43.9,
    },
    stressProfile: {
      initialStress: 70,
      reactivityType: "hyper",
      timeDecayRate: 2.0,
      criticalMilestones: {
        reduceStress: ["richiesto_ecg", "consenso_informato", "rassicurazione", "coronarografia"],
        increaseStress: ["ritardo_ecg", "esame_inappropriato", "angio", "tc"],
      },
      lifesavingMilestones: ["ecg", "coronarografia"],
      relievingExams: ["ecg", "troponina-hs", "ecocardio", "coronarografia"],
      dangerousPrescriptions: ["angio", "tc"],
    },
    labPanel: { finding: LAB_PANEL_FINDING },
    ecg: { finding: ECG_FINDING },
    "troponina-hs": { finding: TROPONINA_FINDING },
    troponina: { finding: TROPONINA_FINDING },
    elettroliti: { finding: "Na 139 · K 4.1 · Cl 102 — nei limiti." },
    "creat-urea-gfr": { finding: "Creatinina 0.95 mg/dL · eGFR >90." },
    "pt-ptt-inr": { finding: "INR 1.0 · aPTT 28 s." },
    emocromo: { finding: "Hb 14.2 · PLT 245 · GB 9.8 — nei limiti." },
    ecocardio: { finding: ECOCARDIO_FINDING },
    angio: { finding: ANGIO_TC_WASTE_FINDING, cost: 180 },
    tc: { finding: ANGIO_TC_WASTE_FINDING, cost: 180 },
    advancedExams: {
      notes:
        "CAR-F01 STEMI anteriore Killip I · Prassi Clinica · Facile. " +
        "ECG ≤10' · DAPT dopo screen · Primary PCI DTB <90'. Evitare Angio-TC.",
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
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: TROPONINA_FINDING,
          isAbnormal: true,
        },
        troponina: {
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: TROPONINA_FINDING,
          isAbnormal: true,
        },
        elettroliti: {
          price: 8.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Na 139 · K 4.1 · Cl 102 — nei limiti.",
        },
        "creat-urea-gfr": {
          price: 8.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Creatinina 0.95 mg/dL · eGFR >90.",
        },
        "pt-ptt-inr": {
          price: 9.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "INR 1.0 · aPTT 28 s.",
        },
        emocromo: {
          price: 0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Hb 14.2 · PLT 245 · GB 9.8 — nei limiti.",
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "18 min (bedside, non ritardare PCI)",
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
        coronarografia: {
          price: 1800,
          urgencyTiming: "Real-time · DTB <90 min",
          routineTiming: "n.p.",
          routineMinutes: 25,
          normalFinding:
            "Occlusione critica IVA prossimale; Primary PCI con stent DES — flusso TIMI 3. Door-to-Balloon rispettato.",
          isAbnormal: true,
        },
      },
    },
  },
};

export default CAR_F01;
