import type { DemoVitals } from "@/lib/prassi/demo-vitals";
import { normalizeStepId } from "@/lib/cases/simulation-time";

export type CaseBaselineVitals = DemoVitals;

/** Canonical keys stored in `clinicalCase.baselineExamFindings.vitals` (Prisma JSON). */
export const CANONICAL_VITAL_KEYS = [
  "heartRate",
  "bloodPressure",
  "spo2",
  "temperature",
  "respiratoryRate",
] as const;

export type CanonicalVitalKey = (typeof CANONICAL_VITAL_KEYS)[number];

/** SSOT vitals object shared by UI, examine API, and the patient LLM prompt. */
export type CanonicalVitalsJson = {
  heartRate?: number | string;
  bloodPressure?: string;
  spo2?: number | string;
  temperature?: number | string;
  respiratoryRate?: number | string;
  [extra: string]: unknown;
};

const VITAL_KEY_ALIASES: Record<string, CanonicalVitalKey> = {
  heartrate: "heartRate",
  heart_rate: "heartRate",
  hr: "heartRate",
  bloodpressure: "bloodPressure",
  blood_pressure: "bloodPressure",
  bp: "bloodPressure",
  spo2: "spo2",
  "spo₂": "spo2",
  sat: "spo2",
  saturation: "spo2",
  sao2: "spo2",
  sp_o2: "spo2",
  temp: "temperature",
  temperature: "temperature",
  rr: "respiratoryRate",
  respiratory_rate: "respiratoryRate",
  respiratoryrate: "respiratoryRate",
};

function aliasToCanonicalKey(rawKey: string): CanonicalVitalKey | null {
  const trimmed = rawKey.trim();
  if ((CANONICAL_VITAL_KEYS as readonly string[]).includes(trimmed)) {
    return trimmed as CanonicalVitalKey;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "spo2") return "spo2";
  return VITAL_KEY_ALIASES[lower] ?? null;
}

function firstPresent(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] != null && record[key] !== "") return record[key];
  }
  return undefined;
}

/**
 * Extract the case vitals JSON (canonical keys + non-alias extras like rhythm).
 * Never invents values. `spO2` / `hr` / `bp` aliases map onto the canonical names.
 */
export function extractCanonicalVitalsJson(
  baseline: Record<string, unknown> | null | undefined,
): CanonicalVitalsJson | null {
  if (!baseline || typeof baseline !== "object") return null;
  const raw = baseline.vitals;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;

  const heartRate = firstPresent(v, ["heartRate", "hr", "heart_rate", "heartRate"]);
  const bloodPressure = firstPresent(v, [
    "bloodPressure",
    "bp",
    "blood_pressure",
  ]);
  const spo2 = firstPresent(v, ["spo2", "spO2", "sat", "saturation", "sao2", "sp_o2"]);
  const temperature = firstPresent(v, ["temperature", "temp"]);
  const respiratoryRate = firstPresent(v, [
    "respiratoryRate",
    "rr",
    "respiratory_rate",
  ]);

  const out: CanonicalVitalsJson = {};
  if (heartRate != null) out.heartRate = heartRate as number | string;
  if (bloodPressure != null && String(bloodPressure).trim()) {
    out.bloodPressure = String(bloodPressure).trim();
  }
  if (spo2 != null) out.spo2 = spo2 as number | string;
  if (temperature != null && temperature !== "") {
    out.temperature = temperature as number | string;
  }
  if (respiratoryRate != null) out.respiratoryRate = respiratoryRate as number | string;

  for (const [key, value] of Object.entries(v)) {
    if (value == null || value === "") continue;
    if (aliasToCanonicalKey(key)) continue;
    out[key] = value;
  }

  if (Object.keys(out).length === 0) return null;
  return out;
}

/** Compact JSON string injected into the patient system prompt and chat body. */
export function serializeCanonicalVitalsJson(
  baseline: Record<string, unknown> | null | undefined,
): string {
  const canonical = extractCanonicalVitalsJson(baseline);
  if (!canonical) return "";
  return JSON.stringify(canonical);
}

/** Monitor placeholder when the case has no vitals block — never a hash/mock. */
export const UNKNOWN_MONITOR_VITALS: CaseBaselineVitals = {
  bp: "",
  hr: Number.NaN,
  spo2: Number.NaN,
  temp: "",
  rr: Number.NaN,
};

export type MonitorStabilization = {
  /** O₂ / ventilatory support started */
  hasOxygen: boolean;
  /** ECG obtained (timely workup) */
  hasEcg: boolean;
  /** 0–1 share of gold-standard path steps already requested */
  goldProgress: number;
  /** Count of invasive procedures performed */
  invasiveCount: number;
  /** Wrong / dangerous therapy or diagnosis path */
  wrongTherapy: boolean;
};

export type ResolveMonitorVitalsInput = {
  caseId: string;
  baselineExamFindings?: Record<string, unknown> | null;
  /** Simulated clinical minutes on the case clock */
  clockMinutes?: number;
  /** Case deterioration threshold (minutes) when time-dependent */
  deteriorationThresholdMinutes?: number | null;
  /** Pathology / specialty text for time-dependence heuristic */
  caseContext?: string;
  specialty?: string | null;
  stabilization?: Partial<MonitorStabilization>;
  /**
   * Behavioral stress 0–100.
   * Affects mild sympathetic tone (HR/RR) only — not SpO₂ collapse.
   */
  behavioralStress?: number;
};

const TIME_DEPENDENT_PATTERN =
  /\b(stemi|nstemi|infarto|ictus|stroke|embolia|trombol|fibrinol|sepsi|shock|anafilassi|emorragia|politrauma|arresto|dispnea|edema polmonare|sca)\b/i;

const OXYGEN_PATTERN =
  /ossigen|o2\b|oxygen|venturi|cpap|niv|nimv|hfnc|cannul|mascher.*o2|ossigenoterap/i;
const ECG_PATTERN = /ecg|elettrocardi|ekg/;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(",", ".").replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBp(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/\d+\s*\/\s*\d+/.test(text)) return text.replace(/\s+/g, "");
  return null;
}

/** Parse case baseline vitals; null when the case has no usable vitals block. Never invents values. */
export function parseBaselineVitals(
  baseline: Record<string, unknown> | null | undefined,
): CaseBaselineVitals | null {
  const canonical = extractCanonicalVitalsJson(baseline);
  if (!canonical) return null;

  const rawVitals =
    baseline && typeof baseline === "object"
      ? (baseline.vitals as Record<string, unknown> | undefined)
      : undefined;

  const hr = asNumber(canonical.heartRate);
  const spo2 = asNumber(canonical.spo2);
  const rr = asNumber(canonical.respiratoryRate);
  const tempNum = asNumber(canonical.temperature);
  const bpFromCanonical = canonical.bloodPressure?.trim() || null;
  const bpNormalized = bpFromCanonical ? asBp(bpFromCanonical) ?? bpFromCanonical : null;
  const bpFromSysDia =
    rawVitals && asNumber(rawVitals.systolic) != null && asNumber(rawVitals.diastolic) != null
      ? `${Math.round(asNumber(rawVitals.systolic)!)}/${Math.round(asNumber(rawVitals.diastolic)!)}`
      : null;
  const bp = bpNormalized ?? bpFromSysDia;

  if (hr == null && spo2 == null && rr == null && tempNum == null && !bp) {
    return null;
  }

  const tempRaw = canonical.temperature;
  const temp =
    tempRaw != null && String(tempRaw).trim()
      ? String(tempRaw).trim()
      : tempNum != null
        ? tempNum.toFixed(1)
        : "";

  return {
    bp: bp ?? "",
    hr: hr != null ? Math.round(hr) : Number.NaN,
    spo2: spo2 != null ? Math.round(spo2) : Number.NaN,
    temp,
    rr: rr != null ? Math.round(rr) : Number.NaN,
  };
}

/** NIBP finding from case baseline — never invents a value when no vitals exist. */
export function formatBloodPressureFinding(
  baseline: Record<string, unknown> | null | undefined,
): { finding: string; numericValue: number | null } | null {
  if (!baseline || typeof baseline !== "object") return null;
  const canonical = extractCanonicalVitalsJson(baseline);
  const vitals = (baseline.vitals ?? {}) as Record<string, unknown>;
  const right = asFindingish(vitals.bloodPressureRight);
  const left = asFindingish(vitals.bloodPressureLeft);
  if (right && left && right !== left) {
    return {
      finding: `Pressione arteriosa Dx ${right} mmHg · Sx ${left} mmHg`,
      numericValue: null,
    };
  }

  const raw = canonical?.bloodPressure ?? vitals.bloodPressure ?? vitals.bp;
  if (raw != null) {
    const text = String(raw).trim();
    if (!text) {
      /* fall through */
    } else if (/^\d{2,3}\s*\/\s*\d{2,3}/.test(text)) {
      return {
        finding: `Pressione arteriosa ${text.replace(/\s+/g, "")} mmHg`,
        numericValue: null,
      };
    } else if (/^pressione/i.test(text)) {
      return { finding: text, numericValue: null };
    } else {
      return { finding: `Pressione arteriosa ${text}`, numericValue: null };
    }
  }

  const parsed = parseBaselineVitals(baseline);
  if (!parsed?.bp) return null;
  return {
    finding: `Pressione arteriosa ${parsed.bp} mmHg`,
    numericValue: null,
  };
}

function asFindingish(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function isTimeDependentCase(caseContext?: string, specialty?: string | null): boolean {
  return TIME_DEPENDENT_PATTERN.test(`${caseContext ?? ""} ${specialty ?? ""}`);
}

/** Detect O₂ / ventilatory support from exam ids or free labels. */
export function detectOxygenSupport(idsOrLabels: string[]): boolean {
  return idsOrLabels.some((raw) => OXYGEN_PATTERN.test(normalizeStepId(raw)) || OXYGEN_PATTERN.test(raw));
}

/** Detect ECG request from exam ids or labels. */
export function detectEcgAction(idsOrLabels: string[]): boolean {
  return idsOrLabels.some((raw) => ECG_PATTERN.test(normalizeStepId(raw)) || ECG_PATTERN.test(raw));
}

export function goldPathProgress(
  goldStandardPath: string[] | null | undefined,
  doneIds: string[],
): number {
  const gold = (goldStandardPath ?? [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map(normalizeStepId);
  if (gold.length === 0) return 0;
  const done = new Set(doneIds.map(normalizeStepId));
  let met = 0;
  for (const step of gold) {
    const hit = [...done].some((d) => d === step || d.includes(step) || step.includes(d));
    if (hit) met += 1;
  }
  return Math.max(0, Math.min(1, met / gold.length));
}

function parseBp(bp: string): { sys: number; dia: number } | null {
  const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return {
    sys: Number(match[1]),
    dia: Number(match[2]),
  };
}

/** UI / NIBP / chat: case JSON only — no hash, no mock, no invented defaults. */
export function resolveCaseVitalsForUi(
  baseline: Record<string, unknown> | null | undefined,
): CaseBaselineVitals {
  return parseBaselineVitals(baseline) ?? UNKNOWN_MONITOR_VITALS;
}

/**
 * Monitor vitals = case baseline + slow clinical drift.
 * Never falls back to hash-generated demo vitals; missing case JSON → unknown.
 */
export function resolveMonitorVitals(input: ResolveMonitorVitalsInput): CaseBaselineVitals {
  const baseline = parseBaselineVitals(input.baselineExamFindings);
  if (!baseline) return UNKNOWN_MONITOR_VITALS;

  const clock = Math.max(0, input.clockMinutes ?? 0);
  const threshold =
    input.deteriorationThresholdMinutes != null && input.deteriorationThresholdMinutes > 0
      ? input.deteriorationThresholdMinutes
      : 30;
  const timeDependent = isTimeDependentCase(input.caseContext, input.specialty);
  const stab: MonitorStabilization = {
    hasOxygen: Boolean(input.stabilization?.hasOxygen),
    hasEcg: Boolean(input.stabilization?.hasEcg),
    goldProgress: Math.max(0, Math.min(1, input.stabilization?.goldProgress ?? 0)),
    invasiveCount: Math.max(0, input.stabilization?.invasiveCount ?? 0),
    wrongTherapy: Boolean(input.stabilization?.wrongTherapy),
  };

  // Grace window before clinical inertia starts biting.
  const grace = Math.max(4, Math.round(threshold * (timeDependent ? 0.2 : 0.35)));
  let inertiaMinutes = Math.max(0, clock - grace);

  // Stabilizing care slows / reverses physiological drift.
  if (stab.hasOxygen) inertiaMinutes *= 0.2;
  if (stab.hasEcg) inertiaMinutes *= 0.75;
  if (stab.goldProgress > 0) {
    inertiaMinutes *= Math.max(0.35, 1 - stab.goldProgress * 0.55);
  }

  const rate = timeDependent ? 1 : 0.45;
  let spo2Delta = -(inertiaMinutes * 0.22 * rate);
  let hrDelta = inertiaMinutes * 0.35 * rate;
  let rrDelta = inertiaMinutes * 0.18 * rate;
  let sysDelta = inertiaMinutes * 0.25 * rate;
  let diaDelta = inertiaMinutes * 0.12 * rate;
  let tempDelta = inertiaMinutes * 0.01 * rate;

  // O₂ actively improves saturation toward a safe floor/ceiling.
  if (stab.hasOxygen) {
    spo2Delta = Math.max(spo2Delta, 0) + Math.min(4, 1 + stab.goldProgress * 2);
  }

  // Invasive manoeuvres: sympathetic bump, not hypoxia.
  if (stab.invasiveCount > 0) {
    hrDelta += Math.min(14, stab.invasiveCount * 4);
    rrDelta += Math.min(4, stab.invasiveCount * 1.5);
  }

  if (stab.wrongTherapy) {
    spo2Delta -= timeDependent ? 6 : 3;
    hrDelta += timeDependent ? 18 : 10;
    rrDelta += 4;
  }

  // Behavioral stress → mild sympathetic tone only (no SpO₂ crash).
  const stressFactor = Math.max(0, Math.min(100, input.behavioralStress ?? 0)) / 100;
  hrDelta += stressFactor * 10;
  rrDelta += stressFactor * 3;
  sysDelta += stressFactor * 8;
  // Cap SpO₂ effect from anxiety alone.
  spo2Delta -= stressFactor * 1.5;

  const parsedBp = parseBp(baseline.bp);
  const tempBase = Number(String(baseline.temp).replace(",", "."));

  const spo2 = Number.isFinite(baseline.spo2)
    ? Math.max(78, Math.min(100, Math.round(baseline.spo2 + spo2Delta)))
    : Number.NaN;
  const hr = Number.isFinite(baseline.hr)
    ? Math.max(35, Math.min(190, Math.round(baseline.hr + hrDelta)))
    : Number.NaN;
  const rr = Number.isFinite(baseline.rr)
    ? Math.max(6, Math.min(48, Math.round(baseline.rr + rrDelta)))
    : Number.NaN;
  const bp = parsedBp
    ? `${Math.max(70, Math.min(230, Math.round(parsedBp.sys + sysDelta)))}/${Math.max(
        40,
        Math.min(130, Math.round(parsedBp.dia + diaDelta)),
      )}`
    : baseline.bp;
  const temp = Number.isFinite(tempBase)
    ? Math.max(34, Math.min(41, tempBase + tempDelta)).toFixed(1)
    : baseline.temp;

  return {
    bp,
    hr,
    spo2,
    temp,
    rr,
  };
}

/** Format live monitor vitals for the patient chat context. */
export function formatMonitorVitalsLine(vitals: CaseBaselineVitals): string {
  return `FC ${vitals.hr}; PA ${vitals.bp}; SpO₂ ${vitals.spo2}%; T ${vitals.temp} °C; FR ${vitals.rr}`;
}
