/**
 * CAR-F01 — STEMI Anteriore Acuto (Cardiologia, Livello Facile)
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

const LAB_FINDING =
  "Na 139 mmol/L, K 4.1 mmol/L, Cl 102 mmol/L. Creatinina 0.95 mg/dL, eGFR >90 mL/min/1.73m². " +
  "PT/INR 1.0, aPTT 28 s. Emocromo: Hb 14.2 g/dL, PLT 245×10⁹/L, GB 9.8×10⁹/L.";

const ECOCARDIO_FINDING =
  "Eco TT bedside focalizzato: acinesia / ipocinesia severa della parete antero-settale e apicale; " +
  "FE stimata ~40–45%. Nessun versamento pericardico significativo. VCI non congestizia. Killip I clinico confermato.";

const ANGIO_TC_WASTE_FINDING =
  "Esame non indicato di prima intenzione in STEMI tipico ECG-positivo: genera ritardo Door-to-Balloon " +
  "e consumo inappropriato di risorsa SSN (Angio-TC / Coronaro-TC). Nessuna evidenza di dissezione aortica o EP " +
  "nel quesito clinico attuale.";

const PHYSICAL_SUMMARY =
  "Uomo di 58 anni, vigile, collaborante, dolorante, diaforetico. Killip I. " +
  "PA 140/85 mmHg, FC 90 bpm ritmica, SpO₂ 97% in aria ambiente. Toni cardiaci validi, non soffi né sfregamenti. " +
  "Murmure vescicolare fisiologico su tutto l'ambito polmonare. Perfusione periferica valida, polsi simmetrici.";

export const CAR_F01: ClinicalCase = {
  code: "CAR-F01",
  id: "car-f01",
  title: "CAR-F01 · STEMI anteriore acuto (PS)",
  description:
    "Uomo, 58 anni, dolore toracico retrosternale oppressivo insorto da 40 minuti, irradiato all'arto superiore " +
    "sinistro e alla mandibola, associato a diaforesi e nausea. Presentazione tipica di sindrome coronarica acuta " +
    "con sopraslivellamento ST (STEMI anteriore) — percorso Easy di Cardiologia.",
  specialty: "Cardiologia",
  medicalSpecialtyKey: "cardiologia",
  difficulty: "EASY",
  estimatedDurationMinutes: 40,
  timeLimitMinutes: 40,
  patientDeteriorationThreshold: 12,
  patientPrompt: [
    "Sei Roberto, 58 anni. Da circa 40 minuti hai un peso oppressivo dietro lo sterno che si irradia al braccio sinistro e alla mandibola.",
    "Sei sudato e nauseato. Hai paura di un infarto ma non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, ansioso ma collaborante. Se il medico chiede, conferma fumo attivo e pressione alta in terapia.",
    "Se ritarda l'ECG o propone esami non urgenti (TC torace), aumenta ansia e senso di morte imminente.",
  ].join(" "),
  pastMedicalHistory:
    "Ipertensione arteriosa in terapia con ACE-inibitore (ramipril 5 mg). Fumatore attivo (~15 sigarette/die, 25 pack-year). " +
    "Dislipidemia non trattata. Nessuna allergia nota a farmaci. Nessun episodio di sanguinamento maggiore, ulcera peptica attiva, " +
    "ictus recente o chirurgia maggiore negli ultimi 30 giorni. Padre deceduto per IMA a 62 anni.",
  diagnosis: "STEMI anteriore acuto (occlusione tipica IVA) — Killip I",
  correctSolution:
    "STEMI anteriore: ECG 12 derivazioni entro 10' dal triage → attivazione Primary PCI (Door-to-Balloon <90') → " +
    "DAPT (ASA + inibitore P2Y12) dopo esclusione anamnestica di sanguinamento attivo → eco TT bedside se non ritarda la sala. " +
    "Troponina hs t0 e laboratorio di base. Evitare Angio-TC/Coronaro-TC di prima intenzione.",
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
    "troponina-hs": 40,
    elettroliti: 35,
    "creat-urea-gfr": 35,
    "pt-ptt-inr": 35,
    emocromo: 35,
    ecocardio: 20,
    angio: 45,
    tc: 40,
    coronarografia: 25,
  },

  /* ── 8 quesiti anamnestici critici ─────────────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_tempo_insorgenza",
      prompt: "Da quanto tempo è iniziato il dolore? (onset esatto in minuti/ore)",
      critical: true,
      expectedKeywords: ["da quanto", "quando è iniziato", "da quanti minuti", "da quante ore", "insorgenza"],
      rationale:
        "Finestra temporale per riperfusione e Door-to-Balloon; criterio ESC ACS 2023 sul timing.",
    },
    {
      id: "aq_caratteristiche_dolore",
      prompt:
        "Caratteristiche del dolore: sede, qualità (oppressivo/costrittivo), irradiazione (arto SX, mandibola), intensità",
      critical: true,
      expectedKeywords: [
        "dove fa male",
        "che tipo di dolore",
        "oppressiv",
        "irradia",
        "braccio",
        "mandibola",
        "retrosternal",
      ],
      rationale: "Fenotipo clinico tipico di ischemia miocardica — guida priorità ECG e pathway STEMI.",
    },
    {
      id: "aq_fattori_rischio_cv",
      prompt: "Fattori di rischio cardiovascolare: fumo, ipertensione, dislipidemia, diabete, familiarità per IMA",
      critical: true,
      expectedKeywords: ["fum", "pression", "ipertens", "colesterol", "dislipid", "diabet", "familiar"],
      rationale: "Profilo di rischio a priori e contesto prognostico; non ritarda comunque l'ECG.",
    },
    {
      id: "aq_episodicita",
      prompt: "Episodicità: episodi analoghi pregressi, angina da sforzo, durata degli episodi precedenti",
      critical: true,
      expectedKeywords: ["già avuto", "altre volte", "sforzo", "angina", "episodi precedenti"],
      rationale: "Distingue SCA di novo vs angina instabile / crescendo — refinement diagnostico.",
    },
    {
      id: "aq_farmaci_in_uso",
      prompt: "Farmaci in uso abituale (antiipertensivi, antiaggreganti, anticoagulanti, nitrati)",
      critical: true,
      expectedKeywords: ["farmaci", "terapia", "assume", "pillol", "ramipril", "aspirina", "cardioaspirin"],
      rationale: "Interazioni e baseline antiaggregante/anticoagulante prima di DAPT e sala di emodinamica.",
    },
    {
      id: "aq_controindicazioni_trombolisi",
      prompt:
        "Controindicazioni a fibrinolisi (se PCI non tempestiva): ictus recente, trauma/chirurgia recente, sanguinamento attivo, neoplasie intracraniche",
      critical: true,
      expectedKeywords: ["ictus", "emorragia", "sanguinamento", "chirurgia", "trauma cranico", "controindicaz"],
      rationale:
        "Branch ESC: se Primary PCI non raggiungibile entro tempi, valutare fibrinolisi solo senza controindicazioni.",
    },
    {
      id: "aq_controindicazioni_dapt",
      prompt:
        "Controindicazioni / cautela ad antiaggregazione: sanguinamento attivo, ulcera peptica attiva, allergia ad ASA/P2Y12, diatesi emorragica",
      critical: true,
      expectedKeywords: ["sanguinamento", "ulcera", "allergia", "aspirina", "emorragia", "feci nere", "melena"],
      rationale:
        "Prerequisito anamnestico obbligatorio prima della DAPT — tutela medico-legale e sicurezza prescrittiva.",
    },
    {
      id: "aq_sintomi_associati",
      prompt: "Sintomi associati: diaforesi, nausea/vomito, dispnea, sincope, palpitazioni",
      critical: true,
      expectedKeywords: ["sudor", "nause", "vomit", "fiato", "dispnea", "svenuto", "palpitaz"],
      rationale: "Completezza anamnestica SCA; supporta triage e monitoraggio continuo.",
    },
  ],

  /* ── Esame obiettivo — Single Source of Truth (Killip I) ───────── */
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
          "PA 140/85 mmHg, FC 90 bpm ritmica. Toni cardiaci validi, ritmici; non soffi, non sfregamenti pericardici. " +
          "Non rumori da scompenso (no S3 da congestione).",
      },
      {
        district: "torace_polmonare",
        finding:
          "SpO₂ 97% in aria ambiente. Murmure vescicolare fisiologico su tutto l'ambito polmonare; non rantoli, non sibili. " +
          "Torace espansibile simmetricamente.",
      },
      {
        district: "addome",
        finding: "Addome trattabile, non dolente, non epatomegalia da stasi. Non segni di peritonismo.",
      },
      {
        district: "neurologico",
        finding: "GCS 15. Pupille isocoriche normoreagenti. Nessun deficit focale.",
      },
      {
        district: "periferico",
        finding:
          "Perfusione periferica valida, estremità calde. Polsi radiali e pedidi simmetrici e validi bilateralmente. " +
          "Tempo di riempimento capillare <2 s.",
      },
    ],
  },

  /* ── Esami mandatori I livello ─────────────────────────────────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 10,
      priceEuro: 15,
      finding: ECG_FINDING,
    },
    {
      examId: "troponina-hs",
      name: "Troponina ad alta sensibilità (t0)",
      level: "I",
      mandatory: true,
      priceEuro: 18,
      finding: TROPONINA_FINDING,
    },
    {
      examId: "elettroliti",
      name: "Elettroliti sierici",
      level: "I",
      mandatory: true,
      priceEuro: 8,
      finding: "Na 139 · K 4.1 · Cl 102 · Ca 9.2 · Mg 2.0 mmol/L — nei limiti.",
    },
    {
      examId: "creat-urea-gfr",
      name: "Funzionalità renale (Creatinina/Urea/eGFR)",
      level: "I",
      mandatory: true,
      priceEuro: 8,
      finding: "Creatinina 0.95 mg/dL · Urea 32 mg/dL · eGFR >90 — idoneità a mdc / terapia.",
    },
    {
      examId: "pt-ptt-inr",
      name: "Coagulazione (PT, aPTT, INR)",
      level: "I",
      mandatory: true,
      priceEuro: 10,
      finding: "INR 1.0 · aPTT 28 s — coagulazione nella norma pre-PCI / DAPT.",
    },
    {
      examId: "ecocardio",
      name: "Ecocardiogramma transtoracico focalizzato bedside",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 30,
      priceEuro: 75,
      finding: ECOCARDIO_FINDING,
    },
  ],

  /* ── Esami inappropriati / spreco SSN (−25%) ───────────────────── */
  inappropriateExams: [
    {
      examId: "angio",
      name: "Angio-TC torace / Coronaro-TC d'urgenza",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 350,
      finding: ANGIO_TC_WASTE_FINDING,
      wasteRationale:
        "In STEMI tipico ECG-documentato, Angio-TC/Coronaro-TC non sono di prima intenzione: ritardano " +
        "Door-to-Balloon e configurano spreco di risorsa SSN (prescrizione inappropriata).",
    },
    {
      examId: "tc",
      name: "TC torace d'urgenza (non mirata)",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 180,
      finding: ANGIO_TC_WASTE_FINDING,
      wasteRationale:
        "TC torace generica non sostituisce né anticipa la Primary PCI in STEMI tipico; rischio di ritardo terapeutico.",
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
        id: "leg_primary_pci_90",
        description:
          "Invia in emodinamica per Primary PCI con obiettivo Door-to-Balloon < 90 minuti",
        requiredMilestoneKeys: ["coronarografia", "gold_standard_coronarografia", "richiesto_coronarografia"],
      },
      {
        id: "leg_dapt_after_bleed_screen",
        description:
          "Somministra doppia antiaggregazione (DAPT) previa verifica anamnestica di assenza di sanguinamenti attivi",
        requiredMilestoneKeys: ["dapt", "antiaggregazione", "asa_p2y12", "anamnesi_farmaci"],
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
    examBudgetEuro: 350,
    caseCode: "CAR-F01",
    legalConformityCriteria: [
      "ecg_entro_10_min",
      "primary_pci_dtb_lt_90",
      "dapt_dopo_screen_emorragico",
    ],
    ragSourceRefs: [
      "Rif. 2023-ESC-Linee-guida-per-la-gestione-delle-sindromi-coronariche-acute.pdf (Timing PCI & Troponina hs)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Buone pratiche clinico-assistenziali)",
      "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 13 (Prescrizione appropriata)",
    ],
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
    labPanel: { finding: LAB_FINDING },
    ecg: { finding: ECG_FINDING },
    "troponina-hs": { finding: TROPONINA_FINDING },
    troponina: { finding: TROPONINA_FINDING },
    elettroliti: { finding: "Na 139 · K 4.1 · Cl 102 — nei limiti." },
    "creat-urea-gfr": { finding: "Creatinina 0.95 mg/dL · eGFR >90." },
    "pt-ptt-inr": { finding: "INR 1.0 · aPTT 28 s." },
    ecocardio: { finding: ECOCARDIO_FINDING },
    angio: { finding: ANGIO_TC_WASTE_FINDING, cost: 350 },
    tc: { finding: ANGIO_TC_WASTE_FINDING, cost: 180 },
    advancedExams: {
      notes:
        "CAR-F01 STEMI anteriore Killip I. ECG ≤10' triage. Primary PCI DTB <90'. " +
        "DAPT dopo screen emorragico. Evitare Angio-TC/Coronaro-TC di prima intenzione.",
      values: {
        ecg: {
          price: 15,
          urgencyTiming: "≤10 min dal triage",
          routineTiming: "n.p.",
          routineMinutes: 8,
          normalFinding: ECG_FINDING,
          isAbnormal: true,
        },
        "troponina-hs": {
          price: 18,
          urgencyTiming: "40 min",
          routineTiming: "2h",
          routineMinutes: 40,
          normalFinding: TROPONINA_FINDING,
          isAbnormal: true,
        },
        troponina: {
          price: 18,
          urgencyTiming: "40 min",
          routineTiming: "2h",
          routineMinutes: 40,
          normalFinding: TROPONINA_FINDING,
          isAbnormal: true,
        },
        elettroliti: {
          price: 8,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: "Na 139 · K 4.1 · Cl 102 — nei limiti.",
        },
        "creat-urea-gfr": {
          price: 8,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: "Creatinina 0.95 mg/dL · eGFR >90.",
        },
        "pt-ptt-inr": {
          price: 10,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: "INR 1.0 · aPTT 28 s.",
        },
        emocromo: {
          price: 8,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding: "Hb 14.2 · PLT 245 · GB 9.8 — nei limiti.",
        },
        ecocardio: {
          price: 75,
          urgencyTiming: "20 min (bedside, non ritardare PCI)",
          routineTiming: "24h",
          routineMinutes: 20,
          normalFinding: ECOCARDIO_FINDING,
          isAbnormal: true,
        },
        angio: {
          price: 350,
          urgencyTiming: "45 min",
          routineTiming: "48h",
          routineMinutes: 45,
          normalFinding: ANGIO_TC_WASTE_FINDING,
          isAbnormal: false,
        },
        tc: {
          price: 180,
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
            "Occlusione critica IVA prossimale; Primary PCI con stent DES — flusso TIMI 3. " +
            "Door-to-Balloon rispettato.",
          isAbnormal: true,
        },
      },
    },
  },
};

export default CAR_F01;
