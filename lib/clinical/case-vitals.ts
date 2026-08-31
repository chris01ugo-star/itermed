import type { DemoVitals } from "@/lib/prassi/demo-vitals";
import { deriveDemoVitals } from "@/lib/prassi/demo-vitals";
import { normalizeStepId } from "@/lib/cases/simulation-time";

export type CaseBaselineVitals = DemoVitals;

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

/** Parse case baseline vitals; null when the case has no usable vitals block. */
export function parseBaselineVitals(
  baseline: Record<string, unknown> | null | undefined,
): CaseBaselineVitals | null {
  if (!baseline || typeof baseline !== "object") return null;
  const raw = baseline.vitals;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;

  const hr = asNumber(v.heartRate ?? v.hr);
  const spo2 = asNumber(v.spo2 ?? v.sat ?? v.saturation);
  const rr = asNumber(v.respiratoryRate ?? v.rr);
  const tempNum = asNumber(v.temperature ?? v.temp);
  const bp =
    asBp(v.bloodPressure ?? v.bp) ??
    (asNumber(v.systolic) != null && asNumber(v.diastolic) != null
      ? `${Math.round(asNumber(v.systolic)!)}/${Math.round(asNumber(v.diastolic)!)}`
      : null);

  if (hr == null && spo2 == null && rr == null && tempNum == null && !bp) {
    return null;
  }

  return {
    bp: bp ?? "120/80",
    hr: hr != null ? Math.round(hr) : 78,
    spo2: spo2 != null ? Math.round(spo2) : 97,
    temp: tempNum != null ? tempNum.toFixed(1) : "36.5",
    rr: rr != null ? Math.round(rr) : 16,
  };
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

function parseBp(bp: string): { sys: number; dia: number } {
  const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    sys: match ? Number(match[1]) : 120,
    dia: match ? Number(match[2]) : 80,
  };
}

/**
 * Monitor vitals = case baseline + slow clinical drift.
 * Physical exam does not drive SpO₂; O₂ / ECG / gold path stabilize.
 */
export function resolveMonitorVitals(input: ResolveMonitorVitalsInput): CaseBaselineVitals {
  const baseline =
    parseBaselineVitals(input.baselineExamFindings) ??
    deriveDemoVitals(input.caseId, 0);

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

  const { sys, dia } = parseBp(baseline.bp);
  const tempBase = Number(String(baseline.temp).replace(",", "."));

  const spo2 = Math.max(78, Math.min(100, Math.round(baseline.spo2 + spo2Delta)));
  const hr = Math.max(35, Math.min(190, Math.round(baseline.hr + hrDelta)));
  const rr = Math.max(6, Math.min(48, Math.round(baseline.rr + rrDelta)));
  const sysOut = Math.max(70, Math.min(230, Math.round(sys + sysDelta)));
  const diaOut = Math.max(40, Math.min(130, Math.round(dia + diaDelta)));
  const temp = Number.isFinite(tempBase)
    ? Math.max(34, Math.min(41, tempBase + tempDelta)).toFixed(1)
    : baseline.temp;

  return {
    bp: `${sysOut}/${diaOut}`,
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
