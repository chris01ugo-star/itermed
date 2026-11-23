import { z } from "zod";

/** Generazione corrente del banco. I casi `nodes` senza questo contratto restano v1. */
export const LAB_WORKBENCH_VERSION = 2 as const;

export const LAB_VALIDATION_NOTE_MIN_CHARS = 25;

export const LAB_PRIORITIES = ["PS_URGENZA", "REPARTO", "AMBULATORIO"] as const;
export const LAB_ANALYTE_FLAGS = [
  "NORMAL",
  "HIGH",
  "LOW",
  "CRITICAL_HIGH",
  "CRITICAL_LOW",
] as const;
export const LAB_DISPOSITIONS = ["VALIDATE", "SUPPRESS", "HOLD"] as const;
export const LAB_INVESTIGATION_TARGETS = [
  "sampleInspection",
  "hilIndices",
  "qcStatus",
  "morphologyOrTrace",
  "deltaCheck",
] as const;
export const LAB_REFLEX_ACTIONS = ["MANDATORY", "OPTIONAL", "INAPPROPRIATE"] as const;
export const LAB_NOTIFY_CHANNELS = ["PHONE", "FAX", "EMAIL", "VOICEMAIL", "NONE"] as const;
export const LAB_NOTIFY_RECIPIENTS = ["REPARTO", "PS", "CURANTE_AMBULATORIALE"] as const;
/** Linea interna: tecnico di banco oppure medico richiedente. */
export const LAB_INTERLOCUTORS = ["tslb", "clinician"] as const;
/** Finestra recente inviata al modello, per tenere bassi i token. */
export const LAB_CONVERSATION_WINDOW = 12;
export const LAB_LOG_MAX_ENTRIES = 80;
export const LAB_REASON_CODES = [
  "EMOLISI",
  "LIPEMIA",
  "ITTERO",
  "COAGULO",
  "MATRICE_ERRATA",
  "RIEMPIMENTO",
  "WBIT",
  "INTERFERENZA_BIOTINA",
  "CQI_WESTGARD",
  "POCT_DISCORDANTE",
  "CONFERMA_PENDENTE",
  "INCOMPATIBILITA_TRASFUSIONALE",
  "INTERFERENZA_FARMACO",
] as const;

export type LabPriority = (typeof LAB_PRIORITIES)[number];
export type LabAnalyteFlag = (typeof LAB_ANALYTE_FLAGS)[number];
export type LabDisposition = (typeof LAB_DISPOSITIONS)[number];
export type LabInvestigationTarget = (typeof LAB_INVESTIGATION_TARGETS)[number];
export type LabReflexAction = (typeof LAB_REFLEX_ACTIONS)[number];
export type LabNotifyChannel = (typeof LAB_NOTIFY_CHANNELS)[number];
export type LabNotifyRecipient = (typeof LAB_NOTIFY_RECIPIENTS)[number];
export type LabInterlocutor = (typeof LAB_INTERLOCUTORS)[number];
export type LabReasonCode = (typeof LAB_REASON_CODES)[number];

const ReasonCodeSchema = z.string().trim().min(2).max(48);

export const LabAnalyteSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(80),
  unit: z.string().trim().min(1).max(40),
  refRange: z.string().trim().min(1).max(80),
  flag: z.enum(LAB_ANALYTE_FLAGS),
  instrumentFlags: z.array(z.string().trim().min(1).max(80)).max(12),
  deltaCheck: z
    .object({
      previousValue: z.string().trim().min(1).max(80),
      previousDate: z.string().trim().min(4).max(40),
      deltaPercent: z.number(),
      deltaFlag: z.boolean(),
    })
    .optional(),
  expectedDisposition: z.enum(LAB_DISPOSITIONS),
  expectedReasonCode: ReasonCodeSchema.optional(),
});

export const LabKillerTriggerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("VALIDATE_UNRELIABLE_ANALYTE"),
    analyteId: z.string().trim().min(1).max(80),
    whenReasonCodes: z.array(ReasonCodeSchema).max(8).optional(),
  }),
  z.object({
    kind: z.literal("OMIT_SYNCHRONOUS_CRITICAL_CALL"),
  }),
  z.object({
    kind: z.literal("ACCEPT_PHONE_RELABEL"),
    analyteId: z.string().trim().min(1).max(80).optional(),
  }),
  z.object({
    kind: z.literal("AUTHORIZE_CONTRAINDICATED_ACTION"),
    reflexId: z.string().trim().min(1).max(80),
  }),
]);

export const LabCaseBlueprintSchema = z.object({
  version: z.literal(LAB_WORKBENCH_VERSION),
  accessionNumber: z.string().trim().min(3).max(40),
  ward: z.string().trim().min(2).max(120),
  priority: z.enum(LAB_PRIORITIES),
  slaMinutes: z.number().int().positive().max(24 * 60),
  clinicalOrderSummary: z.string().trim().min(8).max(2000),
  patientDemographics: z.object({
    age: z.number().int().min(0).max(130),
    sex: z.enum(["F", "M", "ND"]),
    wardContext: z.string().trim().min(2).max(240),
  }),
  budgetEuro: z.number().min(0).max(100_000),
  analytes: z.array(LabAnalyteSchema).min(1).max(24),
  investigations: z.object({
    sampleInspection: z.object({
      tubeType: z.string().trim().min(2).max(80),
      fillLevel: z.enum(["ADEQUATE", "UNDERFILLED", "OVERFILLED", "EMPTY"]),
      clotCheck: z.enum(["ABSENT", "PRESENT", "NOT_ASSESSED"]),
      labelIntegrity: z.enum(["INTACT", "MISMATCH", "MISSING"]),
      collectionToReceiptMin: z.number().int().min(0).max(10_000),
      visualNote: z.string().trim().min(2).max(500),
      anomalyDetected: z.boolean(),
    }),
    hilIndices: z.object({
      hemolysisIndex: z.number().min(0),
      icterusIndex: z.number().min(0),
      lipemiaIndex: z.number().min(0),
      wavelengthNote: z.string().trim().min(2).max(400),
      affectedAnalytes: z.array(z.string().trim().min(1).max(80)).max(24),
    }),
    qcStatus: z.object({
      analyzerLine: z.string().trim().min(2).max(80),
      status: z.enum(["IN_CONTROL", "WESTGARD_WARNING"]),
      summary: z.string().trim().min(2).max(500),
      leveyJennings: z
        .object({
          analyteName: z.string().trim().min(1).max(80),
          unit: z.string().trim().min(1).max(40),
          mean: z.number(),
          sd: z.number().positive(),
          lotNumber: z.string().trim().min(2).max(40),
          points: z
            .array(
              z.object({
                runLabel: z.string().trim().min(1).max(24),
                value: z.number(),
              }),
            )
            .min(8)
            .max(20),
        })
        .optional(),
    }),
    morphologyOrTrace: z
      .object({
        kind: z.enum(["SMEAR", "ELECTROPHORESIS", "SCATTERGRAM", "MIXING"]),
        title: z.string().trim().min(2).max(160),
        findings: z.string().trim().min(2).max(2000),
        keyMetrics: z.record(z.string(), z.string()).optional(),
        visual: z
          .discriminatedUnion("type", [
            z.object({
              type: z.literal("ELECTROPHORESIS"),
              fractions: z
                .array(
                  z.object({
                    label: z.enum(["Alb", "α1", "α2", "β1", "β2", "γ"]),
                    percent: z.number().min(0).max(100),
                    refRange: z.string().trim().min(2).max(40),
                  }),
                )
                .min(6)
                .max(6),
              curvePoints: z.array(z.number().min(0).max(200)).min(24).max(120),
              highlightZone: z.string().trim().min(1).max(8).optional(),
            }),
            z.object({
              type: z.literal("SCATTERGRAM"),
              xAxisLabel: z.string().trim().min(1).max(40),
              yAxisLabel: z.string().trim().min(1).max(40),
              clusters: z
                .array(
                  z.object({
                    label: z.string().trim().min(1).max(40),
                    colorToken: z.enum(["neutral", "accent", "warning", "danger"]),
                    cx: z.number().min(0).max(100),
                    cy: z.number().min(0).max(100),
                    rx: z.number().positive().max(40),
                    ry: z.number().positive().max(40),
                    density: z.number().int().min(1).max(48),
                  }),
                )
                .min(1)
                .max(8),
            }),
            z.object({
              type: z.literal("MICROSCOPY"),
              specimen: z.enum(["PERIPHERAL_SMEAR", "URINE_SEDIMENT", "CSF_CYTOSPIN", "ANA_IFI"]),
              magnification: z.string().trim().min(2).max(40),
              stain: z.string().trim().min(2).max(80),
              elements: z
                .array(
                  z.object({
                    kind: z.enum([
                      "RBC_NORMAL",
                      "SCHISTOCYTE",
                      "PLT_CLUMP",
                      "AUER_BLAST",
                      "ACANTHOCYTE",
                      "RBC_CAST",
                      "NEUTROPHIL",
                      "BACTERIA",
                      "IFI_HOMOGENEOUS",
                      "IFI_SPECKLED",
                    ]),
                    count: z.number().int().min(0).max(80),
                  }),
                )
                .max(12),
              caption: z.string().trim().min(2).max(240),
            }),
            z.object({
              type: z.literal("MIXING_STUDY"),
              baselineSec: z.number().positive(),
              immediateMixSec: z.number().positive(),
              incubatedMixSec: z.number().positive(),
              controlSec: z.number().positive(),
              refRangeSec: z.string().trim().min(2).max(40),
            }),
          ])
          .optional(),
      })
      .optional(),
  }),
  reflexCatalog: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(2).max(160),
        costEuro: z.number().min(0).max(100_000),
        category: z.string().trim().min(2).max(80),
        expectedAction: z.enum(LAB_REFLEX_ACTIONS),
        resultSummary: z.string().trim().min(2).max(2000),
        resultAnalytes: z.array(LabAnalyteSchema).max(12).optional(),
        clinicalRationale: z.string().trim().min(2).max(800),
      }),
    )
    .max(16),
  criticalValuePolicy: z.object({
    required: z.boolean(),
    mustUseSynchronousPhone: z.boolean(),
    requiresReadBack: z.boolean(),
    targetRecipient: z.enum(LAB_NOTIFY_RECIPIENTS),
    slaMinutes: z.number().int().positive().max(24 * 60),
    rationale: z.string().trim().min(2).max(800),
  }),
  personas: z.object({
    tslb: z.object({
      briefing: z.string().trim().min(8).max(2000),
      allowedChecks: z.array(z.string().trim().min(2).max(160)).min(1).max(12),
      limits: z.string().trim().min(8).max(800),
    }),
    clinician: z.object({
      hiddenHistory: z.string().trim().min(8).max(2000),
      medicationsAndSupplements: z.array(z.string().trim().min(2).max(160)).max(12),
      pressures: z.array(z.string().trim().min(2).max(240)).max(8),
      readBackScript: z.string().trim().min(8).max(800),
    }),
  }),
  evaluation: z.object({
    requiredInvestigations: z.array(z.enum(LAB_INVESTIGATION_TARGETS)).max(5),
    expectedValidationNoteConcepts: z.array(z.string().trim().min(2).max(80)).min(1).max(8),
    ragTopics: z.array(z.string().trim().min(2).max(80)).max(8).optional(),
    killerSwitches: z
      .array(
        z.object({
          id: z.string().trim().min(2).max(80),
          label: z.string().trim().min(4).max(240),
          trigger: LabKillerTriggerSchema,
          maxScoreCap: z.number().min(0).max(30),
        }),
      )
      .max(8),
  }),
});

export const LabWorkbenchStateSchema = z.object({
  version: z.literal(LAB_WORKBENCH_VERSION),
  unlockedInvestigations: z
    .array(
      z.object({
        id: z.enum(LAB_INVESTIGATION_TARGETS),
        unlockedAtIso: z.string().min(10).max(40),
      }),
    )
    .max(8),
  requestedReflexIds: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        orderedAtIso: z.string().min(10).max(40),
        costEuro: z.number().min(0),
      }),
    )
    .max(16),
  reflexSpendEuro: z.number().min(0),
  dispositions: z.record(
    z.string(),
    z.object({
      action: z.enum(LAB_DISPOSITIONS),
      reasonCode: ReasonCodeSchema.optional(),
      decidedAtIso: z.string().min(10).max(40),
    }),
  ),
  criticalNotification: z
    .object({
      sent: z.boolean(),
      channel: z.enum(LAB_NOTIFY_CHANNELS),
      recipientName: z.string().max(120).optional(),
      readBackConfirmed: z.boolean(),
      notifiedAtIso: z.string().max(40).optional(),
      elapsedMinutes: z.number().min(0).optional(),
    })
    .optional(),
  validationNote: z.string().max(4000),
  signedAtIso: z.string().max(40).optional(),
  interprofessionalLog: z
    .array(
      z.object({
        role: z.enum(["user", "tslb", "clinician"]),
        /** A chi era rivolto un messaggio del patologo. Assente sui log precedenti. */
        target: z.enum(LAB_INTERLOCUTORS).optional(),
        content: z.string().min(1).max(2000),
        createdAtIso: z.string().min(10).max(40),
      }),
    )
    .max(LAB_LOG_MAX_ENTRIES),
});

export type LabAnalyte = z.infer<typeof LabAnalyteSchema>;
export type LabKillerTrigger = z.infer<typeof LabKillerTriggerSchema>;
export type LabCaseBlueprint = z.infer<typeof LabCaseBlueprintSchema>;
export type LabLeveyJennings = NonNullable<
  LabCaseBlueprint["investigations"]["qcStatus"]["leveyJennings"]
>;
export type LabTraceVisual = NonNullable<
  NonNullable<LabCaseBlueprint["investigations"]["morphologyOrTrace"]>["visual"]
>;
export type LabWorkbenchState = z.infer<typeof LabWorkbenchStateSchema>;
export type LabInterprofessionalEntry = LabWorkbenchState["interprofessionalLog"][number];
export type LabReflexDefinition = LabCaseBlueprint["reflexCatalog"][number];

export type LabBenchCommand =
  | { action: "INSPECT"; target: LabInvestigationTarget; atIso: string }
  | { action: "ORDER_REFLEX"; reflexId: string; atIso: string }
  | {
      action: "SET_DISPOSITION";
      analyteId: string;
      disposition: LabDisposition;
      reasonCode?: string;
      atIso: string;
    }
  | {
      action: "LOG_CRITICAL_NOTIFICATION";
      channel: LabNotifyChannel;
      recipientName?: string;
      readBackConfirmed: boolean;
      elapsedMinutes: number;
      atIso: string;
    }
  | { action: "SIGN_REPORT"; validationNote: string; atIso: string };

export type LabBenchFailure = {
  ok: false;
  status: 404 | 409 | 422;
  code: string;
  message: string;
  missingAnalyteIds?: string[];
};

export type LabBenchSuccess = {
  ok: true;
  state: LabWorkbenchState;
  evidence?: unknown;
  reflex?: {
    id: string;
    name: string;
    costEuro: number;
    resultSummary: string;
    resultAnalytes?: LabAnalyte[];
    clinicalRationale: string;
  };
  readyForReport: boolean;
};

export function emptyLabWorkbenchState(): LabWorkbenchState {
  return {
    version: LAB_WORKBENCH_VERSION,
    unlockedInvestigations: [],
    requestedReflexIds: [],
    reflexSpendEuro: 0,
    dispositions: {},
    validationNote: "",
    interprofessionalLog: [],
  };
}

const LAB_BLUEPRINT_NEST_KEYS = [
  "blueprint",
  "labBlueprint",
  "labBlueprintV2",
  "caseData",
  "rawData",
  "payload",
] as const;

/**
 * Blueprint v2 diretto (`version: 2`) oppure avvolto nel payload del case audit
 * (`{ blueprint }`, `{ caseData: { blueprint } }`, `{ rawData }`).
 */
export function extractLabBlueprintV2(raw: unknown): LabCaseBlueprint | null {
  return readLabBlueprint(raw, 0);
}

function readLabBlueprint(raw: unknown, depth: number): LabCaseBlueprint | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || depth > 4) return null;
  const record = raw as Record<string, unknown>;
  for (const key of LAB_BLUEPRINT_NEST_KEYS) {
    if (!(key in record)) continue;
    const nested = readLabBlueprint(record[key], depth + 1);
    if (nested) return nested;
  }
  const parsed = LabCaseBlueprintSchema.safeParse(record);
  return parsed.success ? parsed.data : null;
}

export function parseLabCaseBlueprint(raw: unknown): LabCaseBlueprint | null {
  return extractLabBlueprintV2(raw);
}

export function parseLabWorkbenchState(raw: unknown): LabWorkbenchState | null {
  if (raw == null) return null;
  const parsed = LabWorkbenchStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function cloneState(state: LabWorkbenchState): LabWorkbenchState {
  return {
    ...state,
    unlockedInvestigations: state.unlockedInvestigations.map((row) => ({ ...row })),
    requestedReflexIds: state.requestedReflexIds.map((row) => ({ ...row })),
    dispositions: Object.fromEntries(
      Object.entries(state.dispositions).map(([id, row]) => [id, { ...row }]),
    ),
    criticalNotification: state.criticalNotification ? { ...state.criticalNotification } : undefined,
    interprofessionalLog: state.interprofessionalLog.map((row) => ({ ...row })),
  };
}

function interlocutorOf(
  log: readonly LabInterprofessionalEntry[],
  index: number,
): LabInterlocutor | null {
  const row = log[index];
  if (!row) return null;
  if (row.role === "tslb" || row.role === "clinician") return row.role;
  if (row.target === "tslb" || row.target === "clinician") return row.target;
  for (let cursor = index + 1; cursor < log.length; cursor += 1) {
    const next = log[cursor];
    if (next?.role === "tslb" || next?.role === "clinician") return next.role;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = log[cursor];
    if (previous?.role === "tslb" || previous?.role === "clinician") return previous.role;
    if (previous?.target === "tslb" || previous?.target === "clinician") return previous.target;
  }
  return null;
}

/**
 * Solo lo scambio con l'interlocutore scelto, poi la finestra più recente.
 * Un messaggio utente senza `target` resta nel thread del tecnico o del medico
 * a cui quel turno appartiene.
 */
export function filterLabConversationByTarget(
  log: readonly LabInterprofessionalEntry[],
  target: LabInterlocutor,
  maxTurns = LAB_CONVERSATION_WINDOW,
): LabInterprofessionalEntry[] {
  const limit = Number.isFinite(maxTurns) ? Math.max(0, Math.floor(maxTurns)) : LAB_CONVERSATION_WINDOW;
  const thread = log.filter((_, index) => interlocutorOf(log, index) === target);
  return thread.slice(-limit).map((row) => ({ ...row }));
}

/** Accoda domanda e risposta. Il messaggio utente porta il `target` del thread. */
export function appendLabInterprofessionalTurn(
  state: LabWorkbenchState,
  input: {
    target: LabInterlocutor;
    userMessage: string;
    reply: string;
    userAtIso: string;
    replyAtIso: string;
  },
): LabWorkbenchState {
  const userContent = input.userMessage.trim().slice(0, 1000);
  const replyContent = input.reply.trim().slice(0, 2000);
  const next = cloneState(state);
  if (!userContent || !replyContent) return next;
  const userEntry: LabInterprofessionalEntry = {
    role: "user",
    target: input.target,
    content: userContent,
    createdAtIso: input.userAtIso,
  };
  const replyEntry: LabInterprofessionalEntry = {
    role: input.target,
    target: input.target,
    content: replyContent,
    createdAtIso: input.replyAtIso,
  };
  next.interprofessionalLog = [...next.interprofessionalLog, userEntry, replyEntry].slice(
    -LAB_LOG_MAX_ENTRIES,
  );
  return next;
}

function fail(
  status: LabBenchFailure["status"],
  code: string,
  message: string,
  missingAnalyteIds?: string[],
): LabBenchFailure {
  return { ok: false, status, code, message, ...(missingAnalyteIds ? { missingAnalyteIds } : {}) };
}

function evidenceFor(blueprint: LabCaseBlueprint, target: LabInvestigationTarget): unknown | null {
  if (target === "deltaCheck") {
    return blueprint.analytes
      .filter((analyte) => analyte.deltaCheck)
      .map((analyte) => ({ analyteId: analyte.id, name: analyte.name, deltaCheck: analyte.deltaCheck }));
  }
  if (target === "morphologyOrTrace") {
    return blueprint.investigations.morphologyOrTrace ?? null;
  }
  return blueprint.investigations[target];
}

function spendOf(orders: LabWorkbenchState["requestedReflexIds"]): number {
  const total = orders.reduce((sum, order) => sum + order.costEuro, 0);
  return Math.round(total * 100) / 100;
}

export function missingDispositionIds(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
): string[] {
  return blueprint.analytes
    .filter((analyte) => !state.dispositions[analyte.id])
    .map((analyte) => analyte.id);
}

/**
 * Applica un comando di banco. Nessuna chiamata esterna: il risultato del reflex
 * e le evidenze escono solo dal blueprint.
 */
export function applyLabBenchCommand(
  blueprint: LabCaseBlueprint,
  current: LabWorkbenchState | null,
  command: LabBenchCommand,
): LabBenchSuccess | LabBenchFailure {
  const state = cloneState(current ?? emptyLabWorkbenchState());
  if (state.signedAtIso) {
    return fail(409, "LAB_ALREADY_SIGNED", "Il referto è già firmato.");
  }

  if (command.action === "INSPECT") {
    const evidence = evidenceFor(blueprint, command.target);
    if (evidence == null) {
      return fail(404, "EVIDENCE_UNAVAILABLE", "Questa evidenza non è nel caso.");
    }
    if (!state.unlockedInvestigations.some((row) => row.id === command.target)) {
      state.unlockedInvestigations.push({
        id: command.target,
        unlockedAtIso: command.atIso,
      });
    }
    return { ok: true, state, evidence, readyForReport: false };
  }

  if (command.action === "ORDER_REFLEX") {
    const reflex = blueprint.reflexCatalog.find((item) => item.id === command.reflexId);
    if (!reflex) {
      return fail(404, "UNKNOWN_REFLEX", "Reflex assente dal catalogo del caso.");
    }
    if (!state.requestedReflexIds.some((row) => row.id === reflex.id)) {
      state.requestedReflexIds.push({
        id: reflex.id,
        orderedAtIso: command.atIso,
        costEuro: reflex.costEuro,
      });
      state.reflexSpendEuro = spendOf(state.requestedReflexIds);
    }
    return {
      ok: true,
      state,
      readyForReport: false,
      reflex: {
        id: reflex.id,
        name: reflex.name,
        costEuro: reflex.costEuro,
        resultSummary: reflex.resultSummary,
        resultAnalytes: reflex.resultAnalytes,
        clinicalRationale: reflex.clinicalRationale,
      },
    };
  }

  if (command.action === "SET_DISPOSITION") {
    const analyte = blueprint.analytes.find((item) => item.id === command.analyteId);
    if (!analyte) {
      return fail(404, "UNKNOWN_ANALYTE", "Analita assente dal ticket.");
    }
    const reason = command.reasonCode?.trim();
    state.dispositions[analyte.id] = {
      action: command.disposition,
      ...(reason ? { reasonCode: reason } : {}),
      decidedAtIso: command.atIso,
    };
    return { ok: true, state, readyForReport: false };
  }

  if (command.action === "LOG_CRITICAL_NOTIFICATION") {
    const sent = command.channel !== "NONE";
    state.criticalNotification = {
      sent,
      channel: command.channel,
      ...(command.recipientName?.trim()
        ? { recipientName: command.recipientName.trim() }
        : {}),
      readBackConfirmed: sent && command.readBackConfirmed,
      notifiedAtIso: command.atIso,
      elapsedMinutes: Math.max(0, Math.round(command.elapsedMinutes)),
    };
    return { ok: true, state, readyForReport: false };
  }

  const note = command.validationNote.trim();
  const missing = missingDispositionIds(blueprint, state);
  if (missing.length > 0 || note.length < LAB_VALIDATION_NOTE_MIN_CHARS) {
    return fail(
      422,
      "SIGN_INCOMPLETE",
      missing.length > 0
        ? "Ogni analita deve avere una disposizione e la nota deve avere almeno 25 caratteri."
        : "La nota di validazione deve avere almeno 25 caratteri.",
      missing,
    );
  }
  state.validationNote = note;
  state.signedAtIso = command.atIso;
  return { ok: true, state, readyForReport: true };
}

type SampleInspection = LabCaseBlueprint["investigations"]["sampleInspection"];
type HilIndices = LabCaseBlueprint["investigations"]["hilIndices"];
type QcStatus = LabCaseBlueprint["investigations"]["qcStatus"];
type MorphologyTrace = NonNullable<LabCaseBlueprint["investigations"]["morphologyOrTrace"]>;

export type ClientLabLocked = { available: boolean; unlocked: false };
export type ClientLabOpen<T> = { available: true; unlocked: true } & T;
export type ClientLabGate<T> = ClientLabLocked | ClientLabOpen<T>;

export type ClientLabDelta =
  | { hasHistory: false }
  | { hasHistory: true }
  | {
      hasHistory: true;
      previousValue: string;
      previousDate: string;
      deltaPercent: number;
      deltaFlag: boolean;
    };

export type ClientLabAnalyte = {
  id: string;
  name: string;
  value: string;
  unit: string;
  refRange: string;
  flag: LabAnalyteFlag;
  instrumentFlags: string[];
  deltaCheck: ClientLabDelta;
};

export type ClientLabReflex = {
  id: string;
  name: string;
  costEuro: number;
  category: string;
  ordered: boolean;
  resultSummary?: string;
  resultAnalytes?: ClientLabAnalyte[];
};

/** Ticket visibile al patologo. Nessun gold standard, nessuna persona, nessuna policy. */
export type ClientLabBlueprint = {
  version: 2;
  accessionNumber: string;
  ward: string;
  priority: LabPriority;
  slaMinutes: number;
  clinicalOrderSummary: string;
  patientDemographics: LabCaseBlueprint["patientDemographics"];
  budgetEuro: number;
  analytes: ClientLabAnalyte[];
  investigations: {
    sampleInspection: ClientLabGate<SampleInspection>;
    hilIndices: ClientLabGate<HilIndices>;
    qcStatus: ClientLabGate<QcStatus>;
    morphologyOrTrace: ClientLabGate<MorphologyTrace>;
    deltaCheck: { available: boolean; unlocked: boolean };
  };
  reflexCatalog: ClientLabReflex[];
};

export type LabWorkbenchClientBundle = {
  blueprint: ClientLabBlueprint;
  state: LabWorkbenchState;
  startedAtIso: string;
};

function unlockedSet(state: LabWorkbenchState): Set<string> {
  return new Set(state.unlockedInvestigations.map((row) => row.id));
}

function publicAnalyte(analyte: LabAnalyte, deltaUnlocked: boolean): ClientLabAnalyte {
  const base = {
    id: analyte.id,
    name: analyte.name,
    value: analyte.value,
    unit: analyte.unit,
    refRange: analyte.refRange,
    flag: analyte.flag,
    instrumentFlags: [...analyte.instrumentFlags],
  };
  if (!analyte.deltaCheck) return { ...base, deltaCheck: { hasHistory: false } };
  if (!deltaUnlocked) return { ...base, deltaCheck: { hasHistory: true } };
  return {
    ...base,
    deltaCheck: {
      hasHistory: true,
      previousValue: analyte.deltaCheck.previousValue,
      previousDate: analyte.deltaCheck.previousDate,
      deltaPercent: analyte.deltaCheck.deltaPercent,
      deltaFlag: analyte.deltaCheck.deltaFlag,
    },
  };
}

function openOrLock<T extends object>(unlocked: boolean, data: T): ClientLabGate<T> {
  if (!unlocked) return { available: true, unlocked: false };
  return { available: true, unlocked: true, ...data };
}

function publicQcStatus(qc: LabCaseBlueprint["investigations"]["qcStatus"]) {
  const chart = qc.leveyJennings;
  return {
    analyzerLine: qc.analyzerLine,
    status: qc.status,
    summary: qc.summary,
    ...(chart
      ? {
          leveyJennings: {
            analyteName: chart.analyteName,
            unit: chart.unit,
            mean: chart.mean,
            sd: chart.sd,
            lotNumber: chart.lotNumber,
            points: chart.points.map((point) => ({ runLabel: point.runLabel, value: point.value })),
          },
        }
      : {}),
  };
}

function publicTraceVisual(
  visual: NonNullable<NonNullable<LabCaseBlueprint["investigations"]["morphologyOrTrace"]>["visual"]>,
) {
  if (visual.type === "ELECTROPHORESIS") {
    return {
      type: visual.type,
      fractions: visual.fractions.map((row) => ({
        label: row.label,
        percent: row.percent,
        refRange: row.refRange,
      })),
      curvePoints: [...visual.curvePoints],
      ...(visual.highlightZone ? { highlightZone: visual.highlightZone } : {}),
    };
  }
  if (visual.type === "SCATTERGRAM") {
    return {
      type: visual.type,
      xAxisLabel: visual.xAxisLabel,
      yAxisLabel: visual.yAxisLabel,
      clusters: visual.clusters.map((cluster) => ({
        label: cluster.label,
        colorToken: cluster.colorToken,
        cx: cluster.cx,
        cy: cluster.cy,
        rx: cluster.rx,
        ry: cluster.ry,
        density: cluster.density,
      })),
    };
  }
  if (visual.type === "MICROSCOPY") {
    return {
      type: visual.type,
      specimen: visual.specimen,
      magnification: visual.magnification,
      stain: visual.stain,
      elements: visual.elements.map((element) => ({ kind: element.kind, count: element.count })),
      caption: visual.caption,
    };
  }
  return {
    type: visual.type,
    baselineSec: visual.baselineSec,
    immediateMixSec: visual.immediateMixSec,
    incubatedMixSec: visual.incubatedMixSec,
    controlSec: visual.controlSec,
    refRangeSec: visual.refRangeSec,
  };
}

function publicMorphology(morph: NonNullable<LabCaseBlueprint["investigations"]["morphologyOrTrace"]>) {
  return {
    kind: morph.kind,
    title: morph.title,
    findings: morph.findings,
    ...(morph.keyMetrics ? { keyMetrics: { ...morph.keyMetrics } } : {}),
    ...(morph.visual ? { visual: publicTraceVisual(morph.visual) } : {}),
  };
}

/**
 * Vista client del blueprint. I campi di valutazione restano sul server.
 * Le evidenze e i risultati reflex compaiono solo dopo lo sblocco sul banco.
 */
export function sanitizeLabBlueprintForClient(
  blueprint: LabCaseBlueprint,
  state: LabWorkbenchState,
): ClientLabBlueprint {
  const unlocked = unlockedSet(state);
  const deltaUnlocked = unlocked.has("deltaCheck");
  const ordered = new Set(state.requestedReflexIds.map((row) => row.id));
  const morph = blueprint.investigations.morphologyOrTrace;
  return {
    version: 2,
    accessionNumber: blueprint.accessionNumber,
    ward: blueprint.ward,
    priority: blueprint.priority,
    slaMinutes: blueprint.slaMinutes,
    clinicalOrderSummary: blueprint.clinicalOrderSummary,
    patientDemographics: { ...blueprint.patientDemographics },
    budgetEuro: blueprint.budgetEuro,
    analytes: blueprint.analytes.map((analyte) => publicAnalyte(analyte, deltaUnlocked)),
    investigations: {
      sampleInspection: openOrLock(unlocked.has("sampleInspection"), blueprint.investigations.sampleInspection),
      hilIndices: openOrLock(unlocked.has("hilIndices"), blueprint.investigations.hilIndices),
      qcStatus: openOrLock(unlocked.has("qcStatus"), publicQcStatus(blueprint.investigations.qcStatus)),
      morphologyOrTrace: morph
        ? openOrLock(unlocked.has("morphologyOrTrace"), publicMorphology(morph))
        : { available: false, unlocked: false },
      deltaCheck: {
        available: blueprint.analytes.some((analyte) => Boolean(analyte.deltaCheck)),
        unlocked: deltaUnlocked,
      },
    },
    reflexCatalog: blueprint.reflexCatalog.map((reflex) => {
      const isOrdered = ordered.has(reflex.id);
      return {
        id: reflex.id,
        name: reflex.name,
        costEuro: reflex.costEuro,
        category: reflex.category,
        ordered: isOrdered,
        ...(isOrdered
          ? {
              resultSummary: reflex.resultSummary,
              ...(reflex.resultAnalytes
                ? { resultAnalytes: reflex.resultAnalytes.map((analyte) => publicAnalyte(analyte, deltaUnlocked)) }
                : {}),
            }
          : {}),
      };
    }),
  };
}
