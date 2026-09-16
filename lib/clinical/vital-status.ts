/** Adult clinical thresholds for multiparameter monitor status badges. */

export type VitalStatus = "stable" | "borderline" | "critical";

export type ClassifiedVital = {
  id: string;
  /** Short clinical acronym shown on the monitor (PA, FC, …). */
  label: string;
  /** Full Italian clinical name for tooltips / accessibility. */
  fullLabel: string;
  value: string;
  unit: string;
  status: VitalStatus;
};

export type DemoVitalsLike = {
  bp: string;
  hr: number;
  spo2: number;
  temp: string;
  rr: number;
};

const STATUS_RANK: Record<VitalStatus, number> = {
  stable: 0,
  borderline: 1,
  critical: 2,
};

export function maxVitalStatus(statuses: VitalStatus[]): VitalStatus {
  return statuses.reduce<VitalStatus>(
    (acc, s) => (STATUS_RANK[s] > STATUS_RANK[acc] ? s : acc),
    "stable",
  );
}

function hrStatus(hr: number): VitalStatus {
  if (!Number.isFinite(hr)) return "stable";
  if (hr < 45 || hr > 130) return "critical";
  if (hr < 55 || hr > 100) return "borderline";
  return "stable";
}

function spo2Status(spo2: number): VitalStatus {
  if (!Number.isFinite(spo2)) return "stable";
  if (spo2 < 90) return "critical";
  if (spo2 < 94) return "borderline";
  return "stable";
}

function rrStatus(rr: number): VitalStatus {
  if (!Number.isFinite(rr)) return "stable";
  if (rr < 8 || rr > 28) return "critical";
  if (rr < 12 || rr > 20) return "borderline";
  return "stable";
}

function tempStatus(temp: number): VitalStatus {
  if (!Number.isFinite(temp)) return "stable";
  if (temp < 35 || temp >= 39) return "critical";
  if (temp < 36 || temp >= 37.8) return "borderline";
  return "stable";
}

function bpStatus(bp: string): VitalStatus {
  const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return "stable";
  const sys = Number(match[1]);
  const dia = Number(match[2]);
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return "stable";
  if (sys < 90 || sys > 180 || dia > 110 || dia < 50) return "critical";
  if (sys < 100 || sys > 140 || dia > 90 || dia < 60) return "borderline";
  return "stable";
}

function displayNumeric(value: number): string {
  return Number.isFinite(value) ? String(value) : "—";
}

export function classifyVitals(vitals: DemoVitalsLike): ClassifiedVital[] {
  const tempNum = Number(String(vitals.temp).replace(",", "."));
  const bpValue = vitals.bp?.trim() ? vitals.bp : "—/—";
  return [
    {
      id: "bp",
      label: "PA",
      fullLabel: "Pressione Arteriosa",
      value: bpValue,
      unit: "mmHg",
      status: bpStatus(vitals.bp),
    },
    {
      id: "hr",
      label: "FC",
      fullLabel: "Frequenza Cardiaca",
      value: displayNumeric(vitals.hr),
      unit: "bpm",
      status: hrStatus(vitals.hr),
    },
    {
      id: "spo2",
      label: "SpO₂",
      fullLabel: "Saturazione Ossigeno",
      value: displayNumeric(vitals.spo2),
      unit: "%",
      status: spo2Status(vitals.spo2),
    },
    {
      id: "temp",
      label: "T",
      fullLabel: "Temperatura",
      value: vitals.temp?.trim() ? String(vitals.temp) : "—",
      unit: "°C",
      status: Number.isFinite(tempNum) && vitals.temp?.trim() ? tempStatus(tempNum) : "stable",
    },
    {
      id: "rr",
      label: "FR",
      fullLabel: "Frequenza Respiratoria",
      value: displayNumeric(vitals.rr),
      unit: "/min",
      status: rrStatus(vitals.rr),
    },
  ];
}

/** Clinical status labels for the multiparameter monitor. */
export function vitalStatusLabel(status: VitalStatus): string {
  switch (status) {
    case "critical":
      return "Critico";
    case "borderline":
      return "Alterato";
    default:
      return "Normale";
  }
}

/** Short clinical finding labels (mockup-style: TACHICARDIA, IPOSSIA, …). */
export function vitalFindingLabel(vital: ClassifiedVital): string {
  const n = Number(String(vital.value).replace(",", "."));
  switch (vital.id) {
    case "hr":
      if (!Number.isFinite(n)) return vitalStatusLabel(vital.status);
      if (n > 100) return "Tachicardia";
      if (n < 55) return "Bradicardia";
      return "Normale";
    case "bp": {
      const match = vital.value.match(/(\d+)\s*\/\s*(\d+)/);
      if (!match) return vitalStatusLabel(vital.status);
      const sys = Number(match[1]);
      if (sys >= 140) return "Ipertesa";
      if (sys < 100) return "Ipotesa";
      return "Normale";
    }
    case "spo2":
      if (!Number.isFinite(n)) return vitalStatusLabel(vital.status);
      if (n < 90) return "Ipossia";
      if (n < 94) return "Borderline";
      return "Normale";
    case "rr":
      if (!Number.isFinite(n)) return vitalStatusLabel(vital.status);
      if (n > 20) return "Tachipnea";
      if (n < 12) return "Bradipnea";
      return "Normale";
    case "temp":
      if (!Number.isFinite(n)) return vitalStatusLabel(vital.status);
      if (n >= 37.8) return "Febbre";
      if (n < 36) return "Ipotermia";
      return "Normale";
    default:
      return vitalStatusLabel(vital.status);
  }
}
