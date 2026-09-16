/** Static exam catalog structure (ids + names). Costs/timings from ExamMetadata DB. */
export type CatalogExam = { id: string; name: string; cost: number; timeMinutes: number };
export type CatalogGroup = { id: string; label: string; exams: CatalogExam[] };
export type CatalogMacroCategory = { id: string; label: string; groups: CatalogGroup[] };

export const EXAM_CATALOG_STRUCTURE: CatalogMacroCategory[] = [
  {
    id: "lab",
    label: "Laboratorio",
    groups: [
      {
        id: "chimica",
        label: "Chimica Clinica e Indici di Flogosi",
        exams: [
          { id: "lattati", name: "Acido lattico (Lattati)", cost: 0, timeMinutes: 0 },
          { id: "ammoniemia", name: "Ammoniemia", cost: 0, timeMinutes: 0 },
          { id: "amilasi-lipasi", name: "Amilasemia e Lipasemia", cost: 0, timeMinutes: 0 },
          { id: "assetto-lipidico", name: "Assetto lipidico (Col Tot, HDL, LDL, TG)", cost: 0, timeMinutes: 0 },
          { id: "bilirubina", name: "Bilirubina (Totale e Frazionata)", cost: 0, timeMinutes: 0 },
          { id: "creat-urea-gfr", name: "Creatinina e Urea (Azotemia) con stima GFR", cost: 0, timeMinutes: 0 },
          { id: "elettroliti", name: "Elettroliti sierici (Na, K, Ca, Mg, Cl, P)", cost: 0, timeMinutes: 0 },
          { id: "protidogramma", name: "Elettroforesi proteica (Protidogramma)", cost: 0, timeMinutes: 0 },
          { id: "hba1c", name: "Emoglobina Glicata (HbA1c)", cost: 0, timeMinutes: 0 },
          { id: "glicemia", name: "Glicemia basale", cost: 0, timeMinutes: 0 },
          { id: "enzimi-epatici", name: "Indici di citolisi e colestasi (AST, ALT, GGT, FA)", cost: 0, timeMinutes: 0 },
          { id: "ldh", name: "Lattato deidrogenasi (LDH)", cost: 0, timeMinutes: 0 },
          { id: "mioglobina", name: "Mioglobina", cost: 0, timeMinutes: 0 },
          { id: "nt-probnp", name: "NT-proBNP (o BNP)", cost: 0, timeMinutes: 0 },
          { id: "pcr-pct", name: "Proteina C Reattiva (PCR) e Procalcitonina (PCT)", cost: 0, timeMinutes: 0 },
          { id: "troponina-hs", name: "Troponina (alta sensibilità)", cost: 0, timeMinutes: 0 },
          { id: "uricemia", name: "Uricemia", cost: 0, timeMinutes: 0 },
          { id: "vitamine", name: "Vitamine (D, B12, Folati)", cost: 0, timeMinutes: 0 },
        ],
      },
      {
        id: "ematologia",
        label: "Ematologia e Coagulazione",
        exams: [
          { id: "antitrombina", name: "Antitrombina III", cost: 0, timeMinutes: 0 },
          { id: "ddimero", name: "D-Dimero", cost: 0, timeMinutes: 0 },
          { id: "emocromo", name: "Emocromo completo con formula", cost: 0, timeMinutes: 0 },
          { id: "assetto-marziale", name: "Ferritina e assetto marziale", cost: 0, timeMinutes: 0 },
          { id: "fibrinogeno", name: "Fibrinogeno", cost: 0, timeMinutes: 0 },
          { id: "gruppo-rh", name: "Gruppo sanguigno e fattore Rh", cost: 0, timeMinutes: 0 },
          { id: "pt-ptt-inr", name: "Coagulazione (PT, PTT, INR)", cost: 0, timeMinutes: 0 },
          { id: "reticolociti", name: "Reticolociti", cost: 0, timeMinutes: 0 },
          { id: "ves", name: "VES", cost: 0, timeMinutes: 0 },
        ],
      },
      {
        id: "endocrino",
        label: "Endocrinologia e Marcatori",
        exams: [
          { id: "acth-cortisolo", name: "ACTH e Cortisolo", cost: 0, timeMinutes: 0 },
          { id: "aldosterone-renina", name: "Aldosterone e Renina (ARR)", cost: 0, timeMinutes: 0 },
          { id: "beta-hcg", name: "Beta-HCG (sierica/urinaria)", cost: 0, timeMinutes: 0 },
          { id: "catecolamine", name: "Catecolamine urinarie/plasmatiche", cost: 0, timeMinutes: 0 },
          { id: "fsh-lh-prl", name: "FSH, LH, Prolattina", cost: 0, timeMinutes: 0 },
          { id: "insulina-cpep", name: "Insulina e C-peptide", cost: 0, timeMinutes: 0 },
          { id: "gh-igf1", name: "GH e IGF-1", cost: 0, timeMinutes: 0 },
          { id: "tiroide", name: "Ormoni tiroidei (TSH, FT3, FT4)", cost: 0, timeMinutes: 0 },
          { id: "pth", name: "Paratormone (PTH)", cost: 0, timeMinutes: 0 },
          { id: "ormoni-sessuali", name: "Testosterone, Estradiolo, Progesterone", cost: 0, timeMinutes: 0 },
        ],
      },
      {
        id: "immuno",
        label: "Immunologia e Sierologia",
        exams: [
          { id: "hiv-hcv-hbv", name: "Ab anti HIV, HCV, HBV", cost: 0, timeMinutes: 0 },
          { id: "anca", name: "ANCA (p-ANCA e c-ANCA)", cost: 0, timeMinutes: 0 },
          { id: "anti-ccp", name: "Anti-CCP", cost: 0, timeMinutes: 0 },
          { id: "anti-dna", name: "Anti-DNA nativo", cost: 0, timeMinutes: 0 },
          { id: "ana-ena", name: "Autoanticorpi (ANA, ENA panel)", cost: 0, timeMinutes: 0 },
          { id: "c3-c4", name: "Complemento (C3, C4)", cost: 0, timeMinutes: 0 },
          { id: "fr", name: "Fattore Reumatoide", cost: 0, timeMinutes: 0 },
          { id: "immunoglobuline", name: "Immunoglobuline (IgA, IgG, IgM, IgE)", cost: 0, timeMinutes: 0 },
          { id: "torch", name: "Monotest e sierologia TORCH", cost: 0, timeMinutes: 0 },
          { id: "quantiferon", name: "Quantiferon", cost: 0, timeMinutes: 0 },
          { id: "sifilide", name: "Sifilide (VDRL, TPHA)", cost: 0, timeMinutes: 0 },
        ],
      },
      {
        id: "micro",
        label: "Microbiologia, Urine e Tossicologia",
        exams: [
          { id: "coprocultura", name: "Coprocultura e ricerca parassiti/uova", cost: 0, timeMinutes: 0 },
          { id: "emocolture", name: "Emocoltura (da due o più siti)", cost: 0, timeMinutes: 0 },
          { id: "urine-sed", name: "Esame urine chimico-fisico e sedimento", cost: 0, timeMinutes: 0 },
          { id: "cdiff", name: "Ricerca Tossina Clostridium Difficile", cost: 0, timeMinutes: 0 },
          { id: "tox-screen", name: "Screening tossicologico (urine/sangue)", cost: 0, timeMinutes: 0 },
          { id: "tamponi", name: "Specie microbiche da tampone", cost: 0, timeMinutes: 0 },
          { id: "urinocoltura", name: "Urinocoltura con antibiogramma", cost: 0, timeMinutes: 0 },
        ],
      },
      {
        id: "tumor",
        label: "Marcatori Tumorali",
        exams: [
          { id: "afp", name: "Alfa-fetoproteina (AFP)", cost: 0, timeMinutes: 0 },
          { id: "beta-hcg-onco", name: "Beta-HCG (marker oncologico)", cost: 0, timeMinutes: 0 },
          { id: "ca-markers", name: "CA 125, CA 15-3, CA 19-9", cost: 0, timeMinutes: 0 },
          { id: "cea", name: "CEA", cost: 0, timeMinutes: 0 },
          { id: "calcitonina", name: "Calcitonina", cost: 0, timeMinutes: 0 },
          { id: "nse", name: "Enolasi neurone-specifica (NSE)", cost: 0, timeMinutes: 0 },
          { id: "psa", name: "PSA (Totale, Libero e Ratio)", cost: 0, timeMinutes: 0 },
        ],
      },
    ],
  },
  {
    id: "img",
    label: "Immagini",
    /** Cartella tab «Imaging»: RX, eco, TC, RM, PET — never ECG/EEG/spirometria. */
    groups: [
      {
        id: "rad-eco",
        label: "Radiologia Tradizionale ed Ecografia",
        exams: [
          { id: "ecocolordoppler", name: "Ecocolordoppler (TSA, venoso/arterioso arti, aorta)", cost: 0, timeMinutes: 0 },
          { id: "ecografia", name: "Ecografia (addome, tiroide, mammella, muscolotendinea, pelvica)", cost: 0, timeMinutes: 0 },
          { id: "fast", name: "Ecografia FAST", cost: 0, timeMinutes: 0 },
          { id: "mammografia", name: "Mammografia", cost: 0, timeMinutes: 0 },
          { id: "moc", name: "MOC (DEXA)", cost: 0, timeMinutes: 0 },
          { id: "rx-addome", name: "RX Addome (diretta)", cost: 0, timeMinutes: 0 },
          { id: "rx-ossa", name: "RX Articolazioni e segmenti ossei", cost: 0, timeMinutes: 0 },
          { id: "rx-colonna", name: "RX Colonna vertebrale", cost: 0, timeMinutes: 0 },
          { id: "rx-torace", name: "RX Torace (2 proiezioni)", cost: 0, timeMinutes: 0 },
        ],
      },
      {
        id: "avanzate",
        label: "Tecniche Avanzate (TC, RM, Medicina Nucleare)",
        exams: [
          { id: "angio", name: "Angio-TC e Angio-RM", cost: 0, timeMinutes: 0 },
          { id: "colangio-rm", name: "Colangio-RM", cost: 0, timeMinutes: 0 },
          { id: "pet-tc", name: "PET-TC", cost: 0, timeMinutes: 0 },
          { id: "rm", name: "RM Addome/Pelvi/Encefalo/Colonna/Articolare", cost: 0, timeMinutes: 0 },
          { id: "rm-prostata", name: "RM Prostatica Multiparametrica", cost: 0, timeMinutes: 0 },
          { id: "scintigrafia", name: "Scintigrafia (ossea/miocardica/polmonare/tiroidea)", cost: 0, timeMinutes: 0 },
          { id: "tc", name: "TC Addome/Encefalo/Torace/Rachide (con-senza mdc)", cost: 0, timeMinutes: 0 },
          { id: "uro-tc", name: "Uro-TC", cost: 0, timeMinutes: 0 },
        ],
      },
    ],
  },
  {
    id: "strum",
    label: "Strumentale",
    /** Cartella tab «Strumentale»: ECG, Holter, EEG, spirometria, prove da sforzo. */
    groups: [
      {
        id: "funzionale",
        label: "Diagnostica Strumentale e Funzionale",
        exams: [
          { id: "audiometria", name: "Audiometria", cost: 0, timeMinutes: 0 },
          { id: "coronarografia", name: "Coronarografia (Invasiva)", cost: 0, timeMinutes: 0 },
          { id: "ecocardio", name: "Ecocardiografia (Transtoracica/Transesofagea)", cost: 0, timeMinutes: 0 },
          { id: "ecg", name: "ECG (riposo/sforzo/Holter)", cost: 0, timeMinutes: 0 },
          { id: "eeg", name: "Elettroencefalogramma (EEG)", cost: 0, timeMinutes: 0 },
          { id: "emg", name: "Elettromiografia (EMG)", cost: 0, timeMinutes: 0 },
          { id: "ega", name: "Emogasanalisi arteriosa (EGA)", cost: 0, timeMinutes: 0 },
          { id: "fundus", name: "Fundus Oculi", cost: 0, timeMinutes: 0 },
          { id: "abpm", name: "Monitoraggio pressorio 24h (ABPM)", cost: 0, timeMinutes: 0 },
          { id: "oct", name: "OCT (Tomografia Ottica)", cost: 0, timeMinutes: 0 },
          { id: "polisonnografia", name: "Polisonnografia", cost: 0, timeMinutes: 0 },
          { id: "pot-evocati", name: "Potenziali Evocati", cost: 0, timeMinutes: 0 },
          { id: "spirometria", name: "Spirometria (semplice/globale)", cost: 0, timeMinutes: 0 },
          { id: "6mwt", name: "Test del cammino (6MWT)", cost: 0, timeMinutes: 0 },
        ],
      },
    ],
  },
  {
    id: "endo",
    label: "Endoscopia",
    groups: [
      {
        id: "endo-biopsie",
        label: "Endoscopia, Biopsie e Liquidi",
        exams: [
          { id: "fna", name: "Agoaspirato (FNA)", cost: 0, timeMinutes: 0 },
          { id: "biopsia", name: "Biopsia (osteomidollare o tissutale mirata)", cost: 0, timeMinutes: 0 },
          { id: "broncoscopia", name: "Broncoscopia (e BAL)", cost: 0, timeMinutes: 0 },
          { id: "cistoscopia", name: "Cistoscopia", cost: 0, timeMinutes: 0 },
          { id: "colonscopia", name: "Colonscopia", cost: 0, timeMinutes: 0 },
          { id: "egds", name: "Esofagogastroduodenoscopia (EGDS)", cost: 0, timeMinutes: 0 },
          { id: "laringoscopia", name: "Laringoscopia", cost: 0, timeMinutes: 0 },
          { id: "liquidi", name: "Liquidi biologici (liquor/pleurico/ascitico/sinoviale)", cost: 0, timeMinutes: 0 },
          { id: "pap-test", name: "Pap-test e Citologia", cost: 0, timeMinutes: 0 },
        ],
      },
    ],
  },
];

export function flattenCatalogExams(): Array<{ id: string; name: string; category: string; subcategory: string }> {
  const rows: Array<{ id: string; name: string; category: string; subcategory: string }> = [];
  for (const macro of EXAM_CATALOG_STRUCTURE) {
    for (const group of macro.groups) {
      for (const exam of group.exams) {
        rows.push({
          id: exam.id,
          name: exam.name,
          category: macro.label,
          subcategory: group.label,
        });
      }
    }
  }
  return rows;
}
