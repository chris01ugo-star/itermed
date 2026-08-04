/**
 * CAR-M03 — Sincope Aritmica da Blocco Atrio-Ventricolare (BAV) di III Grado
 * (Prassi Clinica → Cardiologia → Medio)
 *
 * RAG citations (verbatim paths under rag_knowledge_base/):
 * - cardiologia/01_linee_guida/PMID-36017572_ESCGuideline_Zeppenfeld.pdf
 * - cardiologia/02_protocolli_pdta/Algorithm-BLS-Adult-Healthcare-250701.pdf
 * - _common_legal/227-20170317-legge-cd-gelli.pdf (Art. 5)
 */

import type { ClinicalCase } from "@/lib/data/cases/types";

const ECG_FINDING =
  "Onde P regolari a ≈75 bpm; complessi QRS larghi da scappamento idioventricolare a ≈32 bpm; " +
  "P e QRS completamente indipendenti → DISSOCIAZIONE ATRIO-VENTRICOLARE. Diagnosi: BAV di III grado (completo). " +
  "Nessun sopraslivellamento ST tipico di STEMI. Indicazione tassativa a pacing / PMK.";

const LAB_PANEL_FINDING =
  "Ematochimici + elettroliti: K⁺ 4.2 · Ca⁺⁺ 9.1 · Mg⁺⁺ 1.9 mmol/L — nei limiti (bradicardia non da iperkaliemia). " +
  "Creatinina 1.15 mg/dL. Troponina hs: non diagnosticamente elevata per SCA/STEMI inferiore come causa primaria. " +
  "BAV completo da conduzione degenerativa / cardiopatia sclerotica più probabile.";

const TC_ENCEFALO_FINDING =
  "TC encefalo senza contrasto: non emorragia intracranica acuta. Lieve contusione cutanea / tessuto molle in sede " +
  "di trauma cranico minore da caduta. Nessuna lesione espansiva. Screening post-sincope traumatico negativo per ICH.";

const ECOCARDIO_FINDING =
  "Eco TT bedside: ipertrofia ventricolare sinistra / cardiopatia ipertrofica-sclerotica; FE stimata ~50–55%. " +
  "Nessun versamento pericardico. Nessun gradiente ostruttivo critico. Compatible con substrato degenerativo del BAV.";

const EEG_TSA_WASTE_FINDING =
  "EEG o Ecocolordoppler TSA in acuto come prima scelta: inappropriati — la causa della sincope è chiaramente " +
  "cardiogeno-aritmica all'ECG (BAV III). Ritardano il pacing e lo spreco di risorse SSN (−25% score Econ).";

const PHYSICAL_SUMMARY =
  "Uomo di 79 anni, vigilanza pronta dopo sincope, lieve sensorio rallentato. " +
  "PA 110/60 mmHg, FC 32 bpm (bradicardia spiccata), SpO₂ 96% in aria ambiente. " +
  "Toni brady-ritmici con «tono di cannone» intermittente al I tono. Polsi periferici iposfigmici e simmetrici. " +
  "Segni di trauma cranico minore da caduta. Killip I.";

/** Budget I livello gold (11.60+28+85+43.90) ≈ €168.50 — buffer operativo SSN. */
const EXAM_BUDGET_EURO = 200;

export const CAR_M03: ClinicalCase = {
  code: "CAR-M03",
  id: "car-m03",
  title: "Sincope Aritmica da Blocco Atrio-Venticolare (BAV) di III Grado",
  description:
    "Uomo, 79 anni, iperteso con cardiopatia ipertrofica/sclerotica, condotto in PS dopo sincope improvvisa senza prodromi " +
    "(Adams-Stokes) in ortostatismo, con trauma cranico minore da caduta. Caso gold standard Prassi Clinica — Cardiologia — Medio " +
    "(BAV III → pacing / PMK).",
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
    "Sei Mario, 79 anni. Sei svenuto all'improvviso mentre eri in piedi, senza nausea né sudore prima. Ti sei sbattuto la testa cadendo.",
    "Ora sei sveglio ma un po' lento. Senti il cuore lentissimo. Non dare diagnosi né valori vitali numerici.",
    "Rispondi in prima persona, confuso lieve. Se chiedono: niente prodromi, perdita di sensi breve, niente morsi alla lingua, " +
      "prendi beta-bloccante per la pressione, a volte vertigini, creatinina/elettroliti di solito ok.",
    "Se danno altri farmaci che rallentano il cuore, stai peggio. Se preparano il pacing e chiamano la Cardiologia, ti senti più sicuro.",
  ].join(" "),
  pastMedicalHistory:
    "Ipertensione arteriosa. Cardiopatia ipertrofica/sclerotica. In terapia con beta-bloccante (es. bisoprololo). " +
    "Non digossina / non verapamil noti al momento, ma da verificare. Episodi di vertigini/lipotimie nei mesi precedenti possibili. " +
    "Nessuna allergia nota. Nessun PMK pregresso.",
  diagnosis:
    "Sincope aritmica Adams-Stokes da blocco atrio-ventricolare completo (BAV di III grado) su cardiopatia sclerotica — indicazione a PMK",
  correctSolution:
    "ECG immediato → diagnosi BAV III → monitoraggio continuo + placche per pacing transcutaneo pronte → " +
    "atropina 1 mg ev (spesso inefficace se QRS largo) / isoproterenolo o adrenalina in infusione se sintomatico → " +
    "allerta Cardiologia/Elettrofisiologia per PMK definitivo (± PMK provvisorio transvenoso). " +
    "Labs (K/Ca/Mg, Tn hs) + TC encefalo per trauma + eco TT. Non somministrare bradicardizzanti. Evitare EEG/TSA come prima scelta.",
  goldStandardPath: [
    "ecg",
    "elettroliti",
    "troponina-hs",
    "tc",
    "ecocardio",
    "consenso-informato",
  ],
  examLatencies: {
    ecg: 5,
    elettroliti: 30,
    "troponina-hs": 35,
    "creat-urea-gfr": 30,
    tc: 25,
    ecocardio: 15,
    eeg: 60,
    ecocolordoppler: 40,
  },
  examBudgetEuro: EXAM_BUDGET_EURO,

  /* ── 8 quesiti anamnestici critici (Prassi) ────────────────────── */
  anamnesisQuestions: [
    {
      id: "aq_prodromi_vs_improvviso",
      prompt:
        "Prodromi autonomici (nausea, sudorazione, visione offuscata) vs esordio improvviso senza prodromi (Adams-Stokes)",
      critical: true,
      expectedKeywords: ["prodrom", "nausea", "sudor", "improvvis", "senza preavviso", "all'improvviso"],
      rationale: "Esordio improvviso senza prodromi orienta a sincope aritmica vs riflessa/vasovagale.",
    },
    {
      id: "aq_durata_loc",
      prompt: "Durata della perdita di coscienza e modalità di ripresa",
      critical: true,
      expectedKeywords: ["quanto è durato", "minuti", "secondi", "ripreso", "sveglio"],
      rationale: "Caratterizza la severità e differenzia da crisi prolungata / stato post-ictale tipico.",
    },
    {
      id: "aq_dd_epilessia",
      prompt: "Morsi alla lingua, scosse cloniche, perdita di urine (DD con epilessia)",
      critical: true,
      expectedKeywords: ["lingua", "morso", "convuls", "scosse", "clonich", "urine", "epiless"],
      rationale: "Scosse brevi da ipoperfusione cerebrale possibili; morsi laterali tipici orientano a crisi comiziale.",
    },
    {
      id: "aq_farmaci_bradicardizzanti",
      prompt: "Farmaci bradicardizzanti in uso (beta-bloccanti, digossina, verapamil, diltiazem, amiodarone)",
      critical: true,
      expectedKeywords: [
        "beta",
        "bisoprololo",
        "digossina",
        "verapamil",
        "diltiazem",
        "amiodarone",
        "farmaci",
      ],
      rationale: "Cause iatrogene di BAV/bradicardia — da sospendere; non aggiungere altri bradicardizzanti.",
    },
    {
      id: "aq_vertigini_lipotimie",
      prompt: "Precedenti vertigini, lipotimie o pause percepite",
      critical: true,
      expectedKeywords: ["vertigin", "lipotim", "svenut", "già successo", "capogir"],
      rationale: "Storia di pre-sincope suggerisce disturbo conduttivo intermittente pre-BAV manifesto.",
    },
    {
      id: "aq_traumi_associati",
      prompt: "Traumi associati alla caduta (cranio, rachide, fratture)",
      critical: true,
      expectedKeywords: ["caduta", "testa", "trauma", "ferita", "colpito", "frattur"],
      rationale: "Indica necessità di TC encefalo e valutazione secondaria ATLS-oriented.",
    },
    {
      id: "aq_elettroliti_rene",
      prompt: "Elettroliti e funzione renale recenti (iperkaliemia, ipocalcemia come cause metaboliche)",
      critical: true,
      expectedKeywords: ["potassio", "elettroliti", "creatinina", "rene", "dialisi", "analisi"],
      rationale: "Cause metaboliche reversibili di bradiaritmia da escludere in parallelo al pacing.",
    },
    {
      id: "aq_contesto_ortostatismo",
      prompt: "Contesto dell'episodio: in piedi, a riposo, durante sforzo; attività al momento della sincope",
      critical: true,
      expectedKeywords: ["in piedi", "seduto", "sforzo", "riposo", "camminava", "dove si trovava"],
      rationale: "Sincope in ortostatismo senza prodromi rafforza il sospetto aritmico Adams-Stokes.",
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
          "Vigilanza pronta post-sincope, lieve sensorio rallentato. Segni di trauma cranico minore. Killip I.",
      },
      {
        district: "cardiovascolare",
        finding:
          "PA 110/60 mmHg, FC 32 bpm. Toni brady-ritmici; «tono di cannone» intermittente al I tono " +
          "(contrazione atriale su valvole AV chiuse). Non soffi significativi.",
      },
      {
        district: "torace_polmonare",
        finding: "SpO₂ 96% in aria ambiente. Murmure vescicolare fisiologico; non rantoli.",
      },
      {
        district: "addome",
        finding: "Addome trattabile, non dolente.",
      },
      {
        district: "neurologico",
        finding:
          "GCS 14–15, sensorio lievemente rallentato. Pupille isocoriche. Nessun deficit focale franco. " +
          "Ricercare segni di trauma cranico.",
      },
      {
        district: "periferico",
        finding: "Polsi periferici iposfigmici e simmetrici, bradicardici. Perfusione adeguata a riposo.",
      },
    ],
  },

  /* ── Modulo Econ — esami mandatori I livello ───────────────────── */
  mandatoryExams: [
    {
      examId: "ecg",
      name: "ECG 12 derivazioni immediato (diagnosi BAV III / dissociazione AV)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 5,
      priceEuro: 11.6,
      finding: ECG_FINDING,
    },
    {
      examId: "ematochimici-elettroliti-troponina",
      name: "Ematochimici + Elettroliti (K⁺, Ca⁺⁺, Mg⁺⁺) + Troponina hs",
      level: "I",
      mandatory: true,
      priceEuro: 28.0,
      componentExamIds: ["elettroliti", "troponina-hs", "creat-urea-gfr", "emocromo"],
      finding: LAB_PANEL_FINDING,
    },
    {
      examId: "tc",
      name: "TC Encefalo senza contrasto (screening ICH post-trauma)",
      level: "I",
      mandatory: true,
      maxLatencyMinutes: 45,
      priceEuro: 85.0,
      finding: TC_ENCEFALO_FINDING,
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
      examId: "eeg",
      name: "EEG in acuto come prima scelta",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 90.0,
      finding: EEG_TSA_WASTE_FINDING,
      wasteRationale:
        "Inappropriato: sincope chiaramente aritmica all'ECG — l'EEG ritarda il pacing.",
    },
    {
      examId: "ecocolordoppler",
      name: "Ecocolordoppler dei Tronchi Sovraortici (TSA) in acuto come prima scelta",
      level: "III",
      mandatory: false,
      inappropriate: true,
      inappropriatePenaltyPercent: 25,
      priceEuro: 70.0,
      finding: EEG_TSA_WASTE_FINDING,
      wasteRationale:
        "Inappropriato come first-line: causa cardiogeno-aritmica già evidente — ritardo al PMK.",
    },
  ],

  /* ── Tutela binaria + citazioni RAG ────────────────────────────── */
  legalConformity: {
    statusWhenMet: "CONFORME",
    statusWhenUnmet: "NON_CONFORME",
    criteria: [
      {
        id: "leg_diagnosi_bav3_ecg",
        description: "Diagnosi immediata di BAV di III grado all'ECG 12 derivazioni",
        requiredMilestoneKeys: ["ecg", "richiesto_ecg", "gold_standard_ecg", "bav"],
      },
      {
        id: "leg_no_bradicardizzanti",
        description:
          "Non somministra farmaci bradicardizzanti (beta-bloccanti, digossina, calcio-antagonisti non diidropiridinici, ecc.)",
        requiredMilestoneKeys: [
          "sospensione_bradicardizzanti",
          "no_beta_bloccante",
          "monitoraggio",
        ],
      },
      {
        id: "leg_allerta_pmk",
        description:
          "Allerta Cardiologia / Elettrofisiologia per impianto di pacemaker (provvisorio/definitivo) e prepara pacing esterno",
        requiredMilestoneKeys: [
          "pacemaker",
          "pmk",
          "pacing",
          "elettrofisiologia",
          "cardiologia",
          "consenso_informato",
        ],
      },
    ],
    ragReferences: [
      {
        sourceRef:
          "Rif. PMID-36017572_ESCGuideline_Zeppenfeld.pdf (Linee Guida ESC Pacing & Aritmie - Indicazioni a PMK in BAV III grado)",
        documentPath: "cardiologia/01_linee_guida/PMID-36017572_ESCGuideline_Zeppenfeld.pdf",
        articles: ["Class I indication for pacing in complete AV block", "Syncope / Adams-Stokes"],
        relevance:
          "Indicazione di Classe I all'impianto di PMK in BAV di III grado, indipendentemente dai sintomi in molti scenari.",
      },
      {
        sourceRef:
          "Rif. Algorithm-BLS-Adult-Healthcare-250701.pdf / ACLS (Algoritmo Bradicardia Sintomatica e Pacing)",
        documentPath: "cardiologia/02_protocolli_pdta/Algorithm-BLS-Adult-Healthcare-250701.pdf",
        articles: ["Bradycardia algorithm", "Transcutaneous pacing", "Atropine / chronotropes"],
        relevance:
          "Algoritmo bradicardia sintomatica: monitoraggio, atropina, pacing transcutaneo/transvenoso, catecolamine temporanee.",
      },
      {
        sourceRef:
          "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Prevenzione del rischio da arresto/asistolia)",
        documentPath: "_common_legal/227-20170317-legge-cd-gelli.pdf",
        articles: ["Art. 5"],
        relevance:
          "Aderenza alle buone pratiche per prevenire asistolia/arresto: diagnosi ECG precoce e attivazione del pathway pacing.",
      },
    ],
  },

  baselineExamFindings: {
    demographics: {
      age: 79,
      sex: "M",
      context: "Pronto Soccorso — Sincope Adams-Stokes / trauma cranico minore",
    },
    vitals: {
      bloodPressure: "110/60",
      heartRate: 32,
      spo2: 96,
      temperature: 36.3,
      respiratoryRate: 16,
      bp: "110/60",
      hr: 32,
      temp: 36.3,
      rr: 16,
      rhythm: "complete_AV_block_escape_32",
    },
    physicalExam: {
      finding: PHYSICAL_SUMMARY,
      killipClass: "I",
      cannonAWavesOrTone: true,
      minorHeadTrauma: true,
    },
    thorax: {
      cardiacAuscultation:
        "Toni brady-ritmici a 32 bpm; tono di cannone intermittente al I tono; non soffi significativi.",
      lungAuscultation: "Murmure vescicolare fisiologico; non rantoli.",
    },
    abdomen: {
      inspection: "Addome piano.",
      palpation: "Trattabile, non dolente.",
      percussion: "Timpanismo fisiologico.",
    },
    neuro: {
      pupils: "Isochoriche, normoreagenti",
      gcs: "14-15",
      deficits: "Sensorio lievemente rallentato; nessun deficit focale; trauma cranico minore",
    },
    peripheral: {
      finding: "Polsi iposfigmici simmetrici, bradicardici; perfusione a riposo adeguata.",
    },
    examBudgetEuro: EXAM_BUDGET_EURO,
    caseCode: "CAR-M03",
    category: "prassi-clinica",
    specialty: "cardiologia",
    difficultyLabel: "medio",
    estimatedTimeMinutes: 25,
    goldTherapy: {
      immediate: [
        "monitoraggio_ECG_continuo",
        "placche_pacing_transcutaneo_pronte",
        "atropina_1mg_ev_tentabile",
        "isoproterenolo_o_adrenalina_infusione_se_sintomatico",
        "PMK_definitivo_indicazione_tassativa_pmk_provvisorio_se_necessario",
      ],
      contraindicated: ["beta_bloccanti", "digossina", "verapamil", "diltiazem_bradicardizzante"],
    },
    legalConformityCriteria: [
      "diagnosi_bav3_ecg_immediata",
      "no_farmaci_bradicardizzanti",
      "allerta_cardiologia_elettrofisiologia_pmk",
    ],
    ragSourceRefs: [
      "Rif. PMID-36017572_ESCGuideline_Zeppenfeld.pdf (Linee Guida ESC Pacing & Aritmie - Indicazioni a PMK in BAV III grado)",
      "Rif. Algorithm-BLS-Adult-Healthcare-250701.pdf / ACLS (Algoritmo Bradicardia Sintomatica e Pacing)",
      "Rif. 227-20170317-legge-cd-gelli.pdf - Art. 5 (Prevenzione del rischio da arresto/asistolia)",
    ],
    econModule: {
      mandatory: [
        { examId: "ecg", priceEuro: 11.6 },
        { examId: "ematochimici-elettroliti-troponina", priceEuro: 28.0 },
        { examId: "tc", priceEuro: 85.0 },
        { examId: "ecocardio", priceEuro: 43.9 },
      ],
      inappropriate: [
        { examId: "eeg", priceEuro: 90.0, penaltyPercent: 25 },
        { examId: "ecocolordoppler", priceEuro: 70.0, penaltyPercent: 25 },
      ],
      goldPathCostEuro: 11.6 + 28.0 + 85.0 + 43.9,
    },
    stressProfile: {
      initialStress: 75,
      reactivityType: "hyper",
      timeDecayRate: 2.2,
      criticalMilestones: {
        reduceStress: [
          "richiesto_ecg",
          "pacing",
          "pacemaker",
          "monitoraggio",
          "consenso_informato",
        ],
        increaseStress: ["eeg", "ecocolordoppler", "beta_bloccante", "digossina", "verapamil"],
      },
      lifesavingMilestones: ["ecg", "pacing", "pacemaker"],
      relievingExams: ["ecg", "elettroliti", "tc", "ecocardio"],
      dangerousPrescriptions: ["eeg", "ecocolordoppler", "beta_bloccante", "digossina", "verapamil"],
    },
    labPanel: { finding: LAB_PANEL_FINDING },
    ecg: { finding: ECG_FINDING },
    elettroliti: { finding: "K⁺ 4.2 · Ca⁺⁺ 9.1 · Mg⁺⁺ 1.9 — nei limiti." },
    "troponina-hs": {
      finding: "Troponina hs non diagnosticamente elevata per STEMI/SCA come causa primaria del BAV.",
    },
    "creat-urea-gfr": { finding: "Creatinina 1.15 mg/dL — nei limiti per l'età." },
    emocromo: { finding: "Emocromo nei limiti; non anemizzazione acuta significativa." },
    tc: { finding: TC_ENCEFALO_FINDING, cost: 85 },
    ecocardio: { finding: ECOCARDIO_FINDING },
    eeg: { finding: EEG_TSA_WASTE_FINDING, cost: 90 },
    ecocolordoppler: { finding: EEG_TSA_WASTE_FINDING, cost: 70 },
    advancedExams: {
      notes:
        "CAR-M03 BAV III Adams-Stokes · Prassi Clinica · Medio. " +
        "ECG → pacing esterno pronto → no bradicardizzanti → Cardiologia/EP per PMK. TC encefalo per trauma. Evitare EEG/TSA first-line.",
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
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "K⁺ 4.2 · Ca⁺⁺ 9.1 · Mg⁺⁺ 1.9 — nei limiti.",
        },
        "troponina-hs": {
          price: 8.0,
          urgencyTiming: "35 min",
          routineTiming: "2h",
          routineMinutes: 35,
          normalFinding:
            "Troponina hs non diagnosticamente elevata per STEMI/SCA come causa primaria del BAV.",
        },
        "creat-urea-gfr": {
          price: 6.0,
          urgencyTiming: "30 min",
          routineTiming: "2h",
          routineMinutes: 30,
          normalFinding: "Creatinina 1.15 mg/dL — nei limiti per l'età.",
        },
        tc: {
          price: 85.0,
          urgencyTiming: "urgente post-trauma",
          routineTiming: "n.p.",
          routineMinutes: 25,
          normalFinding: TC_ENCEFALO_FINDING,
          isAbnormal: false,
        },
        ecocardio: {
          price: 43.9,
          urgencyTiming: "15–30 min bedside",
          routineTiming: "24h",
          routineMinutes: 15,
          normalFinding: ECOCARDIO_FINDING,
          isAbnormal: true,
        },
        eeg: {
          price: 90.0,
          urgencyTiming: "non first-line",
          routineTiming: "48h",
          routineMinutes: 60,
          normalFinding: EEG_TSA_WASTE_FINDING,
        },
        ecocolordoppler: {
          price: 70.0,
          urgencyTiming: "non first-line",
          routineTiming: "24h",
          routineMinutes: 40,
          normalFinding: EEG_TSA_WASTE_FINDING,
        },
      },
    },
  },
};

export default CAR_M03;
