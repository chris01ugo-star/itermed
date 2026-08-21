/**
 * D-RIME Transazionale — Relational Impact Modeling Engine.
 * Deterministic state-transition model of Trust / Anxiety / Defensiveness.
 * Anchors: SPIKES (Baile), RIAS (Roter), CARE Measure.
 *
 * Intent classification uses compact lexical cues to label communicative *acts*.
 * The official 0–100 score is produced by the trajectory, not by regex hit counts.
 */

import type {
  AnamnesisQuestion,
  PatientEmotionalState,
  PatientProfile,
} from "@/lib/data/cases/types";

export type PatientStateVector = {
  trust: number;
  anxiety: number;
  defensiveness: number;
};

export type CommunicativeIntent =
  | "validation_deescalation"
  | "open_listening"
  | "paternalism_disdain"
  | "defensive_concession"
  | "information_spikes"
  | "alliance_shared_decision"
  | "neutral_clinical";

export type CommunicativeAct = {
  turnIndex: number;
  speaker: "doctor";
  utterance: string;
  intent: CommunicativeIntent;
  intentLabel: string;
  delta: PatientStateVector;
  stateAfter: PatientStateVector;
  addressedDistressCue: boolean;
};

export type DRimeTrajectoryStep = {
  turnIndex: number;
  intent: CommunicativeIntent;
  intentLabel: string;
  utteranceExcerpt: string;
  state: PatientStateVector;
};

export type DRimeResult = {
  score: number;
  qualitativeLabel: string;
  expertAnalysis: string;
  spikesEmpathyScore: number;
  riasAlignmentScore: number;
  careTrustScore: number;
  allianceScore: number;
  biasManagementScore: number;
  defensiveMedicineScore: number;
  initialState: PatientStateVector;
  finalState: PatientStateVector;
  acts: CommunicativeAct[];
  trajectory: DRimeTrajectoryStep[];
  relationalInsights: string[];
  framework: "d-rime";
};

const INTENT_LABELS: Record<CommunicativeIntent, string> = {
  validation_deescalation: "Validazione / de-escalation",
  open_listening: "Ascolto aperto",
  paternalism_disdain: "Paternalismo / sdegno",
  defensive_concession: "Concessione difensiva",
  information_spikes: "Informazione (SPIKES-Knowledge)",
  alliance_shared_decision: "Alleanza / decisione condivisa",
  neutral_clinical: "Atto clinico neutro",
};

const D_RIME_REFS = {
  spikes: "Rif. Protocollo SPIKES (Baile et al.) — Setting, Perception, Invitation, Knowledge, Emotions, Strategy",
  rias: "Rif. RIAS (Roter Interaction Analysis System) — allineamento socio-emotivo vs task-focused",
  care: "Rif. CARE Measure — ascolto, spiegazione, cura, supporto all'autonomia",
  art20:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 20 (Relazione di cura e tempo di comunicazione)",
} as const;

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampVector(s: PatientStateVector): PatientStateVector {
  return {
    trust: clamp100(s.trust),
    anxiety: clamp100(s.anxiety),
    defensiveness: clamp100(s.defensiveness),
  };
}

function addVector(a: PatientStateVector, b: PatientStateVector): PatientStateVector {
  return clampVector({
    trust: a.trust + b.trust,
    anxiety: a.anxiety + b.anxiety,
    defensiveness: a.defensiveness + b.defensiveness,
  });
}

function excerpt(s: string, max = 110): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function isCyberchondria(profile?: PatientProfile | null): boolean {
  return profile?.healthLiteracy === "CYBERCHONDRIA_AI";
}

function isBiasSensitive(profile?: PatientProfile | null): boolean {
  if (!profile) return false;
  return (
    isCyberchondria(profile) ||
    profile.adherence === "SELF_MEDICATED" ||
    profile.emotionalState === "DEFENSIVE" ||
    profile.emotionalState === "OPPOSITIONAL"
  );
}

/**
 * Parse a loosely-shaped profile (registry case or baselineExamFindings.patientProfile).
 */
export function parsePatientProfile(raw: unknown): PatientProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const literacy = p.healthLiteracy;
  const emotion = p.emotionalState;
  const adherence = p.adherence;
  if (typeof literacy !== "string" || typeof emotion !== "string" || typeof adherence !== "string") {
    return null;
  }
  const lifestyle =
    p.lifestyleAndSocial && typeof p.lifestyleAndSocial === "object" && !Array.isArray(p.lifestyleAndSocial)
      ? (p.lifestyleAndSocial as Record<string, unknown>)
      : {};
  return {
    healthLiteracy: literacy as PatientProfile["healthLiteracy"],
    emotionalState: emotion as PatientEmotionalState,
    adherence: adherence as PatientProfile["adherence"],
    lifestyleAndSocial: {
      sleepQuality:
        lifestyle.sleepQuality === "POOR" ||
        lifestyle.sleepQuality === "FAIR" ||
        lifestyle.sleepQuality === "GOOD"
          ? lifestyle.sleepQuality
          : "FAIR",
      stressLevel:
        lifestyle.stressLevel === "LOW" ||
        lifestyle.stressLevel === "MEDIUM" ||
        lifestyle.stressLevel === "HIGH"
          ? lifestyle.stressLevel
          : "MEDIUM",
      socialSupport:
        lifestyle.socialSupport === "ISOLATED" ||
        lifestyle.socialSupport === "LIMITED" ||
        lifestyle.socialSupport === "ADEQUATE" ||
        lifestyle.socialSupport === "STRONG"
          ? lifestyle.socialSupport
          : "ADEQUATE",
    },
    communicationStyle:
      typeof p.communicationStyle === "string" && p.communicationStyle.trim()
        ? p.communicationStyle
        : "Profilo relazionale non specificato.",
  };
}

export function initializePatientState(profile?: PatientProfile | null): PatientStateVector {
  if (profile?.healthLiteracy === "CYBERCHONDRIA_AI") {
    return clampVector(applyLifestyle({ trust: 25, anxiety: 80, defensiveness: 85 }, profile));
  }

  let trust = 52;
  let anxiety = 48;
  let defensiveness = 38;

  switch (profile?.healthLiteracy) {
    case "LOW":
      trust = 42;
      anxiety = 68;
      defensiveness = 44;
      break;
    case "HIGH":
      trust = 58;
      anxiety = 42;
      defensiveness = 36;
      break;
    case "MEDIUM":
    default:
      break;
  }

  switch (profile?.emotionalState) {
    case "ANXIOUS":
      anxiety += 22;
      trust -= 8;
      break;
    case "DEFENSIVE":
      defensiveness += 24;
      trust -= 14;
      anxiety += 8;
      break;
    case "OPPOSITIONAL":
      defensiveness += 32;
      trust -= 18;
      anxiety += 10;
      break;
    case "COLLABORATIVE":
      trust += 18;
      defensiveness -= 14;
      anxiety -= 10;
      break;
    case "PASSIVE":
      anxiety -= 4;
      defensiveness -= 6;
      break;
    default:
      break;
  }

  switch (profile?.adherence) {
    case "NON_COMPLIANT":
      defensiveness += 14;
      trust -= 10;
      break;
    case "SELF_MEDICATED":
      defensiveness += 18;
      anxiety += 10;
      trust -= 10;
      break;
    case "PARTIAL":
      defensiveness += 8;
      break;
    case "FULL":
      trust += 6;
      break;
    default:
      break;
  }

  return clampVector(applyLifestyle({ trust, anxiety, defensiveness }, profile));
}

function applyLifestyle(
  state: PatientStateVector,
  profile?: PatientProfile | null,
): PatientStateVector {
  if (!profile) return state;
  const next = { ...state };
  if (profile.lifestyleAndSocial.stressLevel === "HIGH") next.anxiety += 12;
  if (profile.lifestyleAndSocial.stressLevel === "LOW") next.anxiety -= 6;
  if (profile.lifestyleAndSocial.socialSupport === "ISOLATED") {
    next.anxiety += 8;
    next.trust -= 6;
  }
  if (profile.lifestyleAndSocial.sleepQuality === "POOR") next.anxiety += 6;
  return next;
}

/* ── Intent lexicons (act labels, not score formulas) ─────────────── */

const PATERNALISM_RE =
  /\b(è (solo )?ansia|esagera|non è niente|si inventa|è (tutta )?nella sua testa|ipocondriac|google non (è|serve)|basta con internet|lasci perdere (google|internet|dr\.?\s*google)|non capisce|faccia come dico|deve stare zitt|sbrighi?ati|non mi interessa|non perdiamo tempo|basta cos[iì]|solo s[iì] o no)\b|!{2,}/i;

const CONCESSION_RE =
  /\b(va bene facciamo (tutto|tutti|la tac|la rm|la pet)|le prescrivo tutto|facciamo tutti gli esami che (vuole|chiede)|ok facciamo la (risonanza|tac|pet|scintigrafia) se insiste|come vuole lei facciamo|le faccio (la pet|tutti gli esami)|prescrivo quello che chiede)\b/i;

const VALIDATION_RE =
  /capisco|comprendo|mi dispiace|la sua (ansia|preoccupazione|paura)|è normale sentirsi|è comprensibile|riconosco (che|il)|dev['’]?essere difficil|la capisco|la rassicuro|non è sola|non è solo|stia (tranquill|seren)|la sua preoccupazione|capisco la preoccupazione|ha letto molto|è legittimo (avere paura|preoccuparsi)|prendiamo sul serio/i;

const OPEN_LISTEN_RE =
  /cosa (la|le) (spaventa|preoccupa|fa paura)|di cosa ha (paura|timore)|come (sta )?vivendo|cosa pensa (che sia|di)|cosa ha (letto|capito|sentito)|mi dica|mi racconti|come si sente|ha domande|quanto (ne )?vuole sapere|cosa (le )interessa sap/i;

const INFORMATION_RE =
  /le spiego|in parole semplic|significa che|l['’]esame serve|serve a (capire|escludere|valutare)|passo dopo passo|in termini semplici|le dico (cosa|perché)|senza (dolore|rischio)|evidenza|linee guida|non è indicato (ora|adesso)|appropriatezza/i;

const ALLIANCE_RE =
  /insieme (a lei|facciamo|decidiamo)|d['’]accordo\s*\?|procediamo insieme|piano (di cura|condiviso)|prossimo passo|si senta liber|posso (aiutarla|rispondere)|decidiamo insieme/i;

const PATIENT_DISTRESS_RE =
  /paura|ansios[oa]|ansia|preoccupat[oa]|ho paura|non ce la faccio|sto malissimo|aiuto|terrorizzat|agitato|ho letto su internet|google dice|dr\.?\s*google|chatgpt|l['’]ia dice/i;

const JARGON_RE =
  /\b(STEMI|NSTEMI|FE\b|LVEF|BNP|NT-proBNP|PCI|FEV1|PaO2|ipossiemia|dissecazione|tamponamento|Killip)\b/;

const SPIKES_SETTING_RE = /buongiorno|buonasera|mi chiamo|sono (il |la )?(dott|dr)/i;
const SPIKES_PERCEPTION_RE = /cosa (pensa|sa|ha letto|ha capito)|cosa le hanno detto/i;
const SPIKES_INVITATION_RE = /quanto (ne )?vuole sapere|preferisce (che|sapere)|ha domande/i;
const SPIKES_STRATEGY_RE = /piano|insieme|prossimo passo|procediamo|follow-?up|controlli/i;

function classifyDoctorIntent(text: string): CommunicativeIntent {
  const t = text.trim();
  if (!t) return "neutral_clinical";
  if (PATERNALISM_RE.test(t)) return "paternalism_disdain";
  if (CONCESSION_RE.test(t)) return "defensive_concession";
  if (VALIDATION_RE.test(t)) return "validation_deescalation";
  if (OPEN_LISTEN_RE.test(t)) return "open_listening";
  if (ALLIANCE_RE.test(t)) return "alliance_shared_decision";
  if (INFORMATION_RE.test(t)) return "information_spikes";
  if (/\?/.test(t) && t.length > 18) return "open_listening";
  return "neutral_clinical";
}

function matchAnamnesisHits(doctorText: string, questions: AnamnesisQuestion[]): number {
  if (questions.length === 0) return 0;
  const lower = doctorText.toLowerCase();
  let hits = 0;
  for (const q of questions) {
    const hit = (q.expectedKeywords ?? []).some((kw) => {
      const k = kw.trim().toLowerCase();
      return k.length > 0 && lower.includes(k);
    });
    if (hit) hits += 1;
  }
  return hits;
}

function deltaForIntent(params: {
  intent: CommunicativeIntent;
  state: PatientStateVector;
  profile?: PatientProfile | null;
  pendingDistress: boolean;
  anamnesisHit: boolean;
}): PatientStateVector {
  const cyber = isCyberchondria(params.profile);
  const highDef = params.state.defensiveness >= 70;
  const bias = isBiasSensitive(params.profile);

  let d: PatientStateVector = { trust: 0, anxiety: 0, defensiveness: 0 };

  switch (params.intent) {
    case "validation_deescalation":
      d = {
        trust: cyber ? (highDef ? 6 : 10) : 12,
        anxiety: cyber ? -10 : -14,
        defensiveness: cyber ? -8 : -11,
      };
      break;
    case "open_listening":
      d = {
        trust: cyber ? 7 : 9,
        anxiety: -5,
        defensiveness: cyber ? -7 : -6,
      };
      if (params.anamnesisHit) d.trust += 3;
      break;
    case "information_spikes":
      d = {
        trust: cyber ? 8 : 6,
        anxiety: cyber ? -12 : -8,
        defensiveness: cyber ? -6 : -3,
      };
      break;
    case "alliance_shared_decision":
      d = {
        trust: 10,
        anxiety: -6,
        defensiveness: -8,
      };
      break;
    case "paternalism_disdain":
      d = {
        trust: cyber ? -26 : -16,
        anxiety: cyber ? 16 : 9,
        defensiveness: cyber ? 28 : 18,
      };
      break;
    case "defensive_concession":
      // Short-term appeasement; in cyberchondria it reinforces the bias.
      d = cyber
        ? { trust: 2, anxiety: -4, defensiveness: 8 }
        : { trust: 5, anxiety: -6, defensiveness: -3 };
      break;
    default:
      d = {
        trust: params.pendingDistress ? -2 : 1,
        anxiety: params.pendingDistress ? 3 : 0,
        defensiveness: params.pendingDistress ? 4 : 0,
      };
      break;
  }

  if (params.pendingDistress && params.intent !== "validation_deescalation" && params.intent !== "open_listening") {
    d.anxiety += bias ? 8 : 5;
    d.defensiveness += bias ? 7 : 4;
    d.trust -= 3;
  }

  if (params.pendingDistress && params.intent === "paternalism_disdain") {
    d.trust -= 8;
    d.defensiveness += 10;
  }

  return d;
}

function spikesScore(acts: CommunicativeAct[], doctorTurns: string[]): number {
  if (doctorTurns.length === 0) return 0;
  const blob = doctorTurns.join("\n");
  const steps = [
    SPIKES_SETTING_RE.test(blob) || doctorTurns.length > 0,
    SPIKES_PERCEPTION_RE.test(blob) || acts.some((a) => a.intent === "open_listening"),
    SPIKES_INVITATION_RE.test(blob),
    acts.some((a) => a.intent === "information_spikes") || INFORMATION_RE.test(blob),
    acts.some((a) => a.intent === "validation_deescalation"),
    SPIKES_STRATEGY_RE.test(blob) || acts.some((a) => a.intent === "alliance_shared_decision"),
  ];
  const met = steps.filter(Boolean).length;
  let score = Math.round((met / 6) * 100);
  const paternalism = acts.filter((a) => a.intent === "paternalism_disdain").length;
  score -= paternalism * 18;
  if (acts.some((a) => a.addressedDistressCue)) score += 8;
  return clamp100(score);
}

function riasScore(acts: CommunicativeAct[], doctorTurns: string[]): number {
  if (doctorTurns.length === 0) return 0;
  const socio = acts.filter((a) =>
    a.intent === "validation_deescalation" ||
    a.intent === "open_listening" ||
    a.intent === "alliance_shared_decision",
  ).length;
  const task = acts.filter((a) => a.intent === "information_spikes" || a.intent === "neutral_clinical").length;
  const hostile = acts.filter((a) => a.intent === "paternalism_disdain").length;
  const total = Math.max(1, acts.length);
  const socioRatio = socio / total;
  const balance = task === 0 && socio === 0 ? 0 : 1 - Math.abs(socioRatio - 0.45);
  let score = Math.round(socioRatio * 55 + balance * 35);
  const jargonBare = doctorTurns.filter((t) => JARGON_RE.test(t) && !INFORMATION_RE.test(t)).length;
  score -= jargonBare * 8;
  score -= hostile * 16;
  return clamp100(score);
}

function careScore(params: {
  acts: CommunicativeAct[];
  final: PatientStateVector;
  initial: PatientStateVector;
}): number {
  const listened = params.acts.some((a) => a.intent === "open_listening") ? 25 : 0;
  const explained = params.acts.some((a) => a.intent === "information_spikes") ? 22 : 0;
  const cared = params.acts.some((a) => a.intent === "validation_deescalation") ? 28 : 0;
  const helped = params.acts.some((a) => a.intent === "alliance_shared_decision") ? 15 : 0;
  const trustGain = Math.max(0, params.final.trust - params.initial.trust);
  let score = listened + explained + cared + helped + Math.min(18, Math.round(trustGain * 0.35));
  if (params.acts.some((a) => a.intent === "paternalism_disdain")) score -= 22;
  if (params.final.trust < 35) score = Math.min(score, 42);
  return clamp100(score);
}

function allianceScore(initial: PatientStateVector, final: PatientStateVector): number {
  const level = final.trust * 0.5 + (100 - final.defensiveness) * 0.3 + (100 - final.anxiety) * 0.2;
  const deltaTrust = final.trust - initial.trust;
  const deltaDef = initial.defensiveness - final.defensiveness;
  const improvement = Math.max(-20, Math.min(25, (deltaTrust + deltaDef) * 0.35));
  return clamp100(level + improvement);
}

function biasManagementScore(params: {
  profile?: PatientProfile | null;
  acts: CommunicativeAct[];
  initial: PatientStateVector;
  final: PatientStateVector;
}): number {
  const bias = isBiasSensitive(params.profile);
  const cyber = isCyberchondria(params.profile);
  const validations = params.acts.filter((a) => a.intent === "validation_deescalation").length;
  const listening = params.acts.filter((a) => a.intent === "open_listening").length;
  const info = params.acts.filter((a) => a.intent === "information_spikes").length;
  const paternalism = params.acts.filter((a) => a.intent === "paternalism_disdain").length;
  const concessions = params.acts.filter((a) => a.intent === "defensive_concession").length;

  if (!bias && !cyber) {
    let score = 62 + validations * 8 + listening * 5 + info * 4 - paternalism * 18 - concessions * 8;
    if (params.acts.length === 0) score = 0;
    return clamp100(score);
  }

  // Cyberchondria / defensive: de-escalate without arrogance, hold the line on appropriateness.
  let score = 28;
  score += Math.min(24, validations * 10);
  score += Math.min(16, listening * 7);
  score += Math.min(18, info * 8);
  score -= paternalism * 22;
  score -= concessions * 14;
  const anxietyDrop = params.initial.anxiety - params.final.anxiety;
  const defDrop = params.initial.defensiveness - params.final.defensiveness;
  score += Math.min(16, Math.round(Math.max(0, anxietyDrop) * 0.25));
  score += Math.min(12, Math.round(Math.max(0, defDrop) * 0.2));
  if (paternalism === 0 && validations > 0 && info > 0) score += 10;
  if (params.acts.length === 0) score = 0;
  return clamp100(score);
}

function defensiveMedicineScore(acts: CommunicativeAct[]): number {
  if (acts.length === 0) return 0;
  const concessions = acts.filter((a) => a.intent === "defensive_concession").length;
  const infoHold = acts.filter((a) => a.intent === "information_spikes").length;
  const empathicHold = acts.filter(
    (a) => a.intent === "validation_deescalation" || a.intent === "alliance_shared_decision",
  ).length;
  let score = 78 - concessions * 28 + Math.min(12, infoHold * 4) + Math.min(10, empathicHold * 3);
  if (concessions === 0 && empathicHold > 0) score += 8;
  return clamp100(score);
}

function qualitativeLabel(score: number, profile?: PatientProfile | null): string {
  const cyber = isCyberchondria(profile);
  if (score >= 85) {
    return cyber
      ? "Alleanza solida su profilo ad alta reattività (cybercondria) — de-escalation senza concessioni difensive"
      : "Alleanza terapeutica eccellente (D-RIME: SPIKES / RIAS / CARE)";
  }
  if (score >= 70) return "Buona gestione relazionale — fiducia in crescita, bias contenuto";
  if (score >= 55) return "Relazione professionale parziale — gap di validazione o tenuta sull'appropriatezza";
  if (score >= 40) {
    return cyber
      ? "Profilo CYBERCHONDRIA_AI non de-escalato — paternalismo o concessione difensiva"
      : "Empatia insufficiente — fiducia bassa o difensività persistente";
  }
  return "Comunicazione a rischio — impatto psicologico negativo (ansia/difensività in aumento)";
}

function buildInsights(params: {
  profile?: PatientProfile | null;
  initial: PatientStateVector;
  final: PatientStateVector;
  acts: CommunicativeAct[];
  alliance: number;
  bias: number;
  defensive: number;
  spikes: number;
  rias: number;
  care: number;
}): string[] {
  const insights: string[] = [];
  const cyber = isCyberchondria(params.profile);
  const emotion = params.profile?.emotionalState;

  if (cyber) {
    insights.push(
      "Profilo CYBERCHONDRIA_AI: stato iniziale ad alta difensività (Trust 25 / Anxiety 80 / Defensiveness 85). Il medico deve de-escalare senza sminuire le fonti web e senza cedere a esami inappropriati.",
    );
  } else if (emotion === "ANXIOUS") {
    insights.push(
      "Stato emotivo ANXIOUS: la priorità D-RIME è ridurre l'ansia con validazione (SPIKES-Emotions) prima dell'informazione tecnica.",
    );
  } else if (emotion === "DEFENSIVE" || emotion === "OPPOSITIONAL") {
    insights.push(
      `Stato ${emotion}: l'ascolto aperto e la percezione (SPIKES-Perception) precedono qualsiasi riformulazione del piano.`,
    );
  }

  const dTrust = params.final.trust - params.initial.trust;
  const dAnx = params.final.anxiety - params.initial.anxiety;
  const dDef = params.final.defensiveness - params.initial.defensiveness;
  insights.push(
    `Traiettoria: Fiducia ${params.initial.trust}→${params.final.trust} (${dTrust >= 0 ? "+" : ""}${dTrust}) · Ansia ${params.initial.anxiety}→${params.final.anxiety} (${dAnx >= 0 ? "+" : ""}${dAnx}) · Difensività ${params.initial.defensiveness}→${params.final.defensiveness} (${dDef >= 0 ? "+" : ""}${dDef}).`,
  );

  const paternalism = params.acts.filter((a) => a.intent === "paternalism_disdain").length;
  const concessions = params.acts.filter((a) => a.intent === "defensive_concession").length;
  const validations = params.acts.filter((a) => a.intent === "validation_deescalation").length;

  if (paternalism > 0) {
    insights.push(
      `Rilevati ${paternalism} atti di paternalismo/sdegno: su profili reattivi aumentano difensività e riducono CARE/RIAS.`,
    );
  }
  if (concessions > 0) {
    insights.push(
      `Rilevate ${concessions} concessioni difensive (medicina difensiva): appeasement a breve, rinforzo del bias e caduta del sotto-punteggio appropriatezza relazionale.`,
    );
  }
  if (validations === 0 && params.acts.length > 0) {
    insights.push(
      "Nessun atto esplicito di validazione emotiva (SPIKES-Emotions / RIAS socio-emotional). L'alleanza resta fragile.",
    );
  }
  if (params.acts.some((a) => a.addressedDistressCue)) {
    insights.push(
      "Distress cue del paziente raccolto nel turno successivo: sequenza RIAS corretta (legittimazione prima del task).",
    );
  } else if (params.acts.length > 0 && params.acts.some((a) => !a.addressedDistressCue) && dAnx > 0) {
    insights.push(
      "Possibile distress del paziente non validato nel turno successivo — costo su Anxiety e Defensiveness.",
    );
  }

  insights.push(
    `Sotto-punteggi: Alleanza ${params.alliance}/100 · Gestione bias ${params.bias}/100 · Evitamento medicina difensiva ${params.defensive}/100 · SPIKES ${params.spikes}/100 · RIAS ${params.rias}/100 · CARE ${params.care}/100.`,
  );
  insights.push(
    `${D_RIME_REFS.spikes}. ${D_RIME_REFS.rias}. ${D_RIME_REFS.care}. ${D_RIME_REFS.art20}.`,
  );

  return insights.slice(0, 8);
}

/**
 * Classify doctor acts, step the patient state, and compute the D-RIME score (0–100).
 */
export function evaluateInteractionTrajectory(
  chatHistory: Array<{ role: string; content: string }> | null | undefined,
  patientProfile?: PatientProfile | null,
  anamnesisQuestions?: AnamnesisQuestion[] | null,
): DRimeResult {
  const chat = Array.isArray(chatHistory) ? chatHistory : [];
  const questions = Array.isArray(anamnesisQuestions) ? anamnesisQuestions : [];
  const initialState = initializePatientState(patientProfile);
  let state = { ...initialState };
  const acts: CommunicativeAct[] = [];
  let pendingDistress = false;
  let doctorTurnIndex = 0;

  for (const message of chat) {
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (!content) continue;

    if (message.role === "assistant") {
      if (PATIENT_DISTRESS_RE.test(content)) pendingDistress = true;
      continue;
    }
    if (message.role !== "user") continue;

    const intent = classifyDoctorIntent(content);
    const anamnesisHit = matchAnamnesisHits(content, questions) > 0;
    const addressedDistressCue =
      pendingDistress &&
      (intent === "validation_deescalation" || intent === "open_listening" || intent === "alliance_shared_decision");
    const delta = deltaForIntent({
      intent,
      state,
      profile: patientProfile,
      pendingDistress,
      anamnesisHit,
    });
    state = addVector(state, delta);
    if (addressedDistressCue) pendingDistress = false;

    acts.push({
      turnIndex: doctorTurnIndex,
      speaker: "doctor",
      utterance: content,
      intent,
      intentLabel: INTENT_LABELS[intent],
      delta,
      stateAfter: { ...state },
      addressedDistressCue,
    });
    doctorTurnIndex += 1;
  }

  const doctorTurns = acts.map((a) => a.utterance);
  const engaged = acts.length > 0;

  const alliance = engaged ? allianceScore(initialState, state) : 0;
  const bias = engaged ? biasManagementScore({ profile: patientProfile, acts, initial: initialState, final: state }) : 0;
  const defensive = engaged ? defensiveMedicineScore(acts) : 0;
  const spikes = spikesScore(acts, doctorTurns);
  const rias = riasScore(acts, doctorTurns);
  const care = careScore({ acts, final: state, initial: initialState });

  const score = engaged
    ? clamp100(Math.round(alliance * 0.4 + bias * 0.3 + defensive * 0.3))
    : 0;

  const insights = buildInsights({
    profile: patientProfile,
    initial: initialState,
    final: state,
    acts,
    alliance,
    bias,
    defensive,
    spikes,
    rias,
    care,
  });

  const trajectory: DRimeTrajectoryStep[] = [
    {
      turnIndex: -1,
      intent: "neutral_clinical",
      intentLabel: "Stato iniziale",
      utteranceExcerpt: "",
      state: initialState,
    },
    ...acts.map((a) => ({
      turnIndex: a.turnIndex,
      intent: a.intent,
      intentLabel: a.intentLabel,
      utteranceExcerpt: excerpt(a.utterance),
      state: a.stateAfter,
    })),
  ];

  const expertAnalysis = insights.join(" ");

  return {
    score,
    qualitativeLabel: qualitativeLabel(score, patientProfile),
    expertAnalysis,
    spikesEmpathyScore: spikes,
    riasAlignmentScore: rias,
    careTrustScore: care,
    allianceScore: alliance,
    biasManagementScore: bias,
    defensiveMedicineScore: defensive,
    initialState,
    finalState: state,
    acts,
    trajectory,
    relationalInsights: insights,
    framework: "d-rime",
  };
}

export { D_RIME_REFS, INTENT_LABELS };
