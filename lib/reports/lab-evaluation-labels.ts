export type LabPillarCopy = {
  /** Omitted when the classic label must stay (Economia, Tutela medico-legale). */
  label?: string;
  description: string;
};

const LAB_PILLAR_COPY: Record<string, LabPillarCopy> = {
  empathy: {
    label: "Comunicazione Inter-professionale",
    description: "Tempestività nei Panic Values e chiarezza con i reparti.",
  },
  empatia: {
    label: "Comunicazione Inter-professionale",
    description: "Tempestività nei Panic Values e chiarezza con i reparti.",
  },
  clinicalAccuracy: {
    label: "Rigore Pre-analitico",
    description: "Capacità di intercettare campioni inidonei o non conformi.",
  },
  accuratezza: {
    label: "Rigore Pre-analitico",
    description: "Capacità di intercettare campioni inidonei o non conformi.",
  },
  clinical: {
    label: "Rigore Pre-analitico",
    description: "Capacità di intercettare campioni inidonei o non conformi.",
  },
  prescribingAppropriateness: {
    label: "Appropriatezza e Reflex Testing",
    description: "Gestione dei flussi analitici e refertazione.",
  },
  prescribing: {
    label: "Appropriatezza e Reflex Testing",
    description: "Gestione dei flussi analitici e refertazione.",
  },
  exams: {
    label: "Appropriatezza e Reflex Testing",
    description: "Gestione dei flussi analitici e refertazione.",
  },
  economicSustainability: {
    description: "Sprechi da Nomenclatore e richieste di laboratorio non rimborsabili.",
  },
  economicita: {
    description: "Sprechi da Nomenclatore e richieste di laboratorio non rimborsabili.",
  },
  economy: {
    description: "Sprechi da Nomenclatore e richieste di laboratorio non rimborsabili.",
  },
  legalComplianceGelliBianco: {
    description: "Consensi per i test genetici e tracciabilità della notifica critica.",
  },
  legal: {
    description: "Consensi per i test genetici e tracciabilità della notifica critica.",
  },
};

/** True only for the laboratory module. Other specialties stay on the classic labels. */
export function isLabEvaluationCase(input: {
  specialty?: string | null;
  caseId?: string | null;
}): boolean {
  const specialty = input.specialty?.trim().toLowerCase();
  return (
    specialty === "medicina_laboratorio" ||
    specialty === "laboratorio" ||
    specialty === "medicina di laboratorio" ||
    Boolean(input.caseId?.startsWith("LABO-"))
  );
}

export function labPillarCopy(key: string | undefined): LabPillarCopy | null {
  if (!key) return null;
  return LAB_PILLAR_COPY[key] ?? null;
}

/** Display label only. Returns the classic string when this pillar keeps its name. */
export function labPillarLabel(key: string | undefined, classicLabel: string): string {
  return labPillarCopy(key)?.label ?? classicLabel;
}
