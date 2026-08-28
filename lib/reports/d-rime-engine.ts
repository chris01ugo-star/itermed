/**
 * D-RIME Transazionale — Relational Impact Modeling Engine.
 *
 * Intent labels may come from the LLM (evaluation pipeline) or a lexical fallback
 * (offline / client). Trust / Anxiety / Defensiveness are NEVER produced by the LLM:
 * they are stepped exclusively by `lib/services/d-rime-fsm.ts`.
 */

import type {
  AnamnesisQuestion,
  PatientEmotionalState,
  PatientProfile,
} from "@/lib/data/cases/types";
import {
  INTENT_LABELS,
  applyIntentSequence,
  compositeDRimeScore,
  scoreRelationalFrameworks,
  selectTurnIntents,
  type ClassifiedDoctorTurn,
  type DoctorIntentCategory,
  type FsmVariant,
  type PatientAffectState,
} from "@/lib/services/d-rime-fsm";

export type PatientStateVector = PatientAffectState;
export type CommunicativeIntent = DoctorIntentCategory;
export type { ClassifiedDoctorTurn, DoctorIntentCategory };

export type CommunicativeAct = {
  turnIndex: number;
  speaker: "doctor";
  utterance: string;
  intent: CommunicativeIntent;
  intents: CommunicativeIntent[];
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

const D_RIME_REFS = {
  spikes: "Rif. Protocollo SPIKES (Baile et al.) — Setting, Perception, Invitation, Knowledge, Emotions, Strategy",
  rias: "Rif. RIAS (Roter Interaction Analysis System) — allineamento socio-emotivo vs task-focused",
  care: "Rif. CARE Measure — ascolto, spiegazione, cura, supporto all'autonomia",
  art20:
    "Rif. CODICE-DEONTOLOGIA-MEDICA-2014.pdf - Art. 20 (Relazione di cura e tempo di comunicazione)",
} as const;

function excerpt(s: string, max = 110): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function isCyberchondria(profile?: PatientProfile | null): boolean {
  return profile?.healthLiteracy === "CYBERCHONDRIA_AI";
}

function fsmVariant(profile?: PatientProfile | null): FsmVariant {
  return isCyberchondria(profile) ? "cyberchondria" : "standard";
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
    return applyLifestyle({ trust: 25, anxiety: 80, defensiveness: 85 }, profile);
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

  return applyLifestyle({ trust, anxiety, defensiveness }, profile);
}

function applyLifestyle(
  state: PatientStateVector,
  profile?: PatientProfile | null,
): PatientStateVector {
  if (!profile) {
    return {
      trust: Math.max(0, Math.min(100, Math.round(state.trust))),
      anxiety: Math.max(0, Math.min(100, Math.round(state.anxiety))),
      defensiveness: Math.max(0, Math.min(100, Math.round(state.defensiveness))),
    };
  }
  const next = { ...state };
  if (profile.lifestyleAndSocial.stressLevel === "HIGH") next.anxiety += 12;
  if (profile.lifestyleAndSocial.stressLevel === "LOW") next.anxiety -= 6;
  if (profile.lifestyleAndSocial.socialSupport === "ISOLATED") {
    next.anxiety += 8;
    next.trust -= 6;
  }
  if (profile.lifestyleAndSocial.sleepQuality === "POOR") next.anxiety += 6;
  return {
    trust: Math.max(0, Math.min(100, Math.round(next.trust))),
    anxiety: Math.max(0, Math.min(100, Math.round(next.anxiety))),
    defensiveness: Math.max(0, Math.min(100, Math.round(next.defensiveness))),
  };
}

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

export function classifyDoctorIntentLexical(
  text: string,
  options?: { requireClearMatch?: boolean },
): DoctorIntentCategory {
  const t = text.trim();
  if (!t) return "NEUTRAL";
  if (PATERNALISM_RE.test(t)) return "PATERNALISTIC_COMMAND";
  if (CONCESSION_RE.test(t)) return "DEFENSIVE_REACTION";
  if (VALIDATION_RE.test(t)) return "VALIDATION";
  if (OPEN_LISTEN_RE.test(t) || ALLIANCE_RE.test(t)) return "EMPATHIC_EXPLORATION";
  if (INFORMATION_RE.test(t)) return "CLINICAL_DISCLOSURE";
  if (!options?.requireClearMatch && /\?/.test(t) && t.length > 18) return "EMPATHIC_EXPLORATION";
  return "NEUTRAL";
}

function isSupportiveIntent(intent: DoctorIntentCategory): boolean {
  return intent === "VALIDATION" || intent === "EMPATHIC_EXPLORATION";
}

function resolveTurnIntents(params: {
  utterance: string;
  turnIndex: number;
  classifiedTurns?: ClassifiedDoctorTurn[] | null;
  pendingDistress: boolean;
}): DoctorIntentCategory[] {
  const lexicalFallback = classifyDoctorIntentLexical(params.utterance, { requireClearMatch: true });
  const classified = params.classifiedTurns?.find((row) => row.turnIndex === params.turnIndex);
  const fromLlm = classified
    ? selectTurnIntents(classified.intents, lexicalFallback)
    : null;
  const primary = fromLlm ?? [classifyDoctorIntentLexical(params.utterance)];
  if (params.pendingDistress && !primary.some(isSupportiveIntent) && !primary.includes("DISCORDANCE")) {
    return ["DISCORDANCE", ...primary];
  }
  return primary;
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

  const paternalism = params.acts.filter((a) => a.intent === "PATERNALISTIC_COMMAND").length;
  const concessions = params.acts.filter((a) => a.intent === "DEFENSIVE_REACTION").length;
  const validations = params.acts.filter((a) => a.intent === "VALIDATION").length;
  const discord = params.acts.filter((a) => a.intents.includes("DISCORDANCE")).length;

  if (paternalism > 0) {
    insights.push(
      `Rilevati ${paternalism} atti di comando paternalistico: su profili reattivi aumentano difensività e riducono CARE/RIAS.`,
    );
  }
  if (concessions > 0) {
    insights.push(
      `Rilevate ${concessions} reazioni difensive (medicina difensiva): appeasement a breve, rinforzo del bias e caduta del sotto-punteggio appropriatezza relazionale.`,
    );
  }
  if (discord > 0) {
    insights.push(
      `Rilevate ${discord} discordanze (distress del paziente non raccolto): costo deterministico su Anxiety e Defensiveness.`,
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
  }

  insights.push(
    `Sotto-punteggi: Alleanza ${params.alliance}/100 · Gestione bias ${params.bias}/100 · Evitamento medicina difensiva ${params.defensive}/100 · SPIKES ${params.spikes}/100 · RIAS ${params.rias}/100 · CARE ${params.care}/100.`,
  );
  insights.push(
    `${D_RIME_REFS.spikes}. ${D_RIME_REFS.rias}. ${D_RIME_REFS.care}. ${D_RIME_REFS.art20}.`,
  );

  return insights.slice(0, 8);
}

export type EvaluateTrajectoryOptions = {
  /** LLM-extracted intents. When omitted, a lexical fallback labels the turn — FSM still owns T/A/D. */
  classifiedIntents?: ClassifiedDoctorTurn[] | null;
};

/**
 * Classify doctor acts (LLM or lexical), step the patient state via the FSM, score CARE/SPIKES/RIAS.
 */
export function evaluateInteractionTrajectory(
  chatHistory: Array<{ role: string; content: string }> | null | undefined,
  patientProfile?: PatientProfile | null,
  _anamnesisQuestions?: AnamnesisQuestion[] | null,
  options?: EvaluateTrajectoryOptions,
): DRimeResult {
  const chat = Array.isArray(chatHistory) ? chatHistory : [];
  const variant = fsmVariant(patientProfile);
  const initialState = initializePatientState(patientProfile);
  let state = { ...initialState };
  const acts: CommunicativeAct[] = [];
  const appliedIntents: DoctorIntentCategory[] = [];
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

    const turnIntents = resolveTurnIntents({
      utterance: content,
      turnIndex: doctorTurnIndex,
      classifiedTurns: options?.classifiedIntents,
      pendingDistress,
    });
    const addressedDistressCue = pendingDistress && turnIntents.some(isSupportiveIntent);
    const stepped = applyIntentSequence(state, turnIntents, variant);
    const netDelta: PatientStateVector = {
      trust: stepped.final.trust - state.trust,
      anxiety: stepped.final.anxiety - state.anxiety,
      defensiveness: stepped.final.defensiveness - state.defensiveness,
    };
    state = stepped.final;
    if (addressedDistressCue) pendingDistress = false;
    appliedIntents.push(...turnIntents);

    const primary = turnIntents[turnIntents.length - 1] ?? "NEUTRAL";
    acts.push({
      turnIndex: doctorTurnIndex,
      speaker: "doctor",
      utterance: content,
      intent: primary,
      intents: turnIntents,
      intentLabel: INTENT_LABELS[primary],
      delta: netDelta,
      stateAfter: { ...state },
      addressedDistressCue,
    });
    doctorTurnIndex += 1;
  }

  const engaged = acts.length > 0;
  const frameworks = scoreRelationalFrameworks({
    intents: appliedIntents,
    initial: initialState,
    final: state,
    variant,
  });
  const score = compositeDRimeScore(frameworks, engaged);

  const insights = buildInsights({
    profile: patientProfile,
    initial: initialState,
    final: state,
    acts,
    alliance: frameworks.alliance,
    bias: frameworks.biasManagement,
    defensive: frameworks.defensiveMedicine,
    spikes: frameworks.spikes,
    rias: frameworks.rias,
    care: frameworks.care,
  });

  const trajectory: DRimeTrajectoryStep[] = [
    {
      turnIndex: -1,
      intent: "NEUTRAL",
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

  return {
    score,
    qualitativeLabel: qualitativeLabel(score, patientProfile),
    expertAnalysis: insights.join(" "),
    spikesEmpathyScore: frameworks.spikes,
    riasAlignmentScore: frameworks.rias,
    careTrustScore: frameworks.care,
    allianceScore: frameworks.alliance,
    biasManagementScore: frameworks.biasManagement,
    defensiveMedicineScore: frameworks.defensiveMedicine,
    initialState,
    finalState: state,
    acts,
    trajectory,
    relationalInsights: insights,
    framework: "d-rime",
  };
}

export { D_RIME_REFS, INTENT_LABELS };
