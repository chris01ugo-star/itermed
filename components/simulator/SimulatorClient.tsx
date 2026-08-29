"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCheck,
  FlaskConical,
  Clock,
  EuroIcon,
  FolderOpen,
  HelpCircle,
  MessageCircle,
  FileText,
  Pause,
  Play,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../app/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../app/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../app/ui/card";
import { Button } from "../../app/ui/button";
import { Textarea } from "../../app/ui/textarea";
import { handleTextareaEnterSubmit } from "@/lib/hooks/textarea-submit";
import { cn } from "@/app/utils/cn";
import { Badge } from "../../app/ui/badge";
import { AiTransparencyBadge } from "@/components/legal/AiTransparencyBadge";
import { ClinicalSimulationDisclaimer } from "@/components/legal/ClinicalSimulationDisclaimer";
import { OnboardingTutorialModal } from "@/components/simulator/OnboardingTutorialModal";
import {
  readTutorialCompleted,
} from "@/lib/simulator/onboarding-storage";
import { PhysicalExamTab } from "./PhysicalExamTab";
import { PatientStressBar } from "./PatientStressBar";
import { SafeLlmText } from "@/components/ui/safe-llm-content";
import { SkeletonChatBubble } from "@/components/ui/Skeleton";
import { VitalSignsBoard } from "./VitalSignsBoard";
import { ExamReportRecap } from "./ExamReportRecap";
import { DiagnosticCategoryPanel } from "./DiagnosticCategoryPanel";
import { SessionSideMetrics } from "./SessionSideMetrics";
import { PRASSI_TONE } from "@/lib/ui/prassi-pastels";
import {
  ClinicalDischargeReportPanel,
  composeClinicalReport,
  extractFinalDiagnosisFromReport,
  isClinicalReportComplete,
  type ClinicalReportSections,
} from "./ClinicalDischargeReportPanel";
import { MetricBar } from "@/app/case/[id]/results/MetricBar";
import { ScoreProgressRing } from "@/app/case/[id]/results/ScoreProgressRing";
import { deriveDemoVitals, patientDisplayName } from "@/lib/prassi/demo-vitals";
import { classifyVitals, maxVitalStatus } from "@/lib/clinical/vital-status";
import { resolveCaseStressProfile } from "@/lib/simulator/patient-stress-engine";
import { sanitizeLiveSessionId } from "@/lib/simulator/session-id";
import { resolveExamBudgetEuro } from "@/lib/services/evaluation-scoring";
import type { CaseDifficulty } from "@prisma/client";
import { EXAM_DEFAULT_VALUES, type ExamClinicalMeta } from "../../lib/exam-default-values";
import { EXAM_CATALOG_STRUCTURE } from "@/lib/exam-catalog-structure";
import {
  applyExamMeta,
  buildExamMacroCatalog,
  flattenExams,
  formatExamFinding,
  type ExamMacroCategory,
  type SimulatorExam,
} from "../../lib/simulator/exam-catalog";
import type { CaseExamOverride } from "../../lib/exam-values-meta";
import {
  formatAbnormalExamsFromBaseline,
  formatVitalSignsFromBaseline,
} from "../../lib/simulator/patientCaseContext";

type Exam = SimulatorExam;

type ChatMessageLike = {
  id: string;
  role: string;
  content?: string | Array<{ type?: string; text?: string } | string>;
  parts?: Array<{ type?: string; text?: string }>;
};

/** Costs/timings resolved at runtime from ExamMetadata DB + case overrides. */
const RAW_EXAM_CATALOG_STRUCTURE: ExamMacroCategory[] = EXAM_CATALOG_STRUCTURE;

/** Valori esami salvati in creazione caso (`baselineExamFindings.advancedExams.values`) */
type CaseExamStoredValues = CaseExamOverride;

type InitialCaseData = {
  id: string;
  title: string;
  description: string;
  specialty: string | null;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  patientPrompt: string;
  correctSolution?: string | null;
  demographics?: {
    age?: number | string | null;
    sex?: string | null;
    context?: string | null;
  };
  /** Da DB: include advancedExams.values compilati in creazione caso */
  baselineExamFindings?: Record<string, unknown>;
  timeLimitMinutes?: number | null;
  examLatencies?: Record<string, number> | null;
  goldStandardPath?: string[] | null;
  patientDeteriorationThreshold?: number | null;
};

type SimulatorClientProps = {
  initialCaseData: InitialCaseData;
  isVariant?: boolean;
  sessionId?: string;
  isAdmin?: boolean;
  /** Se false (casi demo senza DB), l’abbandono non crea SessionReport e torna solo al dashboard. */
  persistReports?: boolean;
  /** ExamMetadata catalog merged over static defaults. */
  examCatalog?: Record<string, ExamClinicalMeta>;
  /** Per-case exam values from CaseExamValue table + legacy JSON. */
  caseExamOverrides?: Record<string, CaseExamOverride>;
  /** Modalità embedded nella sezione Prassi (layout dashboard). */
  embedded?: boolean;
  /** Destinazione del pulsante di ritorno (default dashboard). */
  backHref?: string;
};

import type { EliteReportData } from "@/lib/services/simulation-report-data";

type SimulationReportData = EliteReportData;

type ReportStatusPayload = {
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress: number;
  progressMessage: string;
  reportData: SimulationReportData | null;
  error?: string;
};

const REPORT_POLL_INTERVAL_MS = 500;
const REPORT_POLL_TIMEOUT_MS = 3 * 60 * 1000;
/** Canonical gold / ESC action id for informed consent (must match registry paths). */
const CONSENT_INFORMED_ACTION_ID = "consenso-informato";

/**
 * Keep `sessionId` in the address bar without Next.js navigation.
 * `router.replace` on the play page remounts SimulatorClient and wipes in-progress game state.
 */
function syncSessionIdInUrl(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sessionId") === sessionId) return;
    url.searchParams.set("sessionId", sessionId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore malformed URL edge cases */
  }
}


type PollReportResult = {
  reportId: string;
  reportData: SimulationReportData;
};

async function pollReportUntilComplete(
  reportId: string,
  onProgress: (progress: number, message: string) => void,
  options?: { signal?: AbortSignal },
): Promise<PollReportResult> {
  const startedAt = Date.now();

  const pollOnce = async (): Promise<PollReportResult | null> => {
    if (options?.signal?.aborted) {
      throw new Error("Generazione report annullata.");
    }

    if (Date.now() - startedAt > REPORT_POLL_TIMEOUT_MS) {
      throw new Error(
        "Timeout durante la generazione del report. Riprova — il server potrebbe aver perso il task in background.",
      );
    }

    const res = await fetch(
      `/api/simulation/report/status?reportId=${encodeURIComponent(reportId)}`,
      { signal: options?.signal },
    );
    const data = (await res.json().catch(() => null)) as ReportStatusPayload | null;
    if (!res.ok || !data) {
      throw new Error(data?.error ?? "Errore nel recupero dello stato del report.");
    }

    onProgress(data.progress, data.progressMessage);

    if (data.status === "COMPLETED") {
      if (!data.reportData) {
        throw new Error("Report completato ma dati non disponibili.");
      }
      return { reportId, reportData: data.reportData };
    }
    if (data.status === "FAILED") {
      const detail =
        (typeof data.error === "string" && data.error.trim()) ||
        data.progressMessage ||
        "Errore durante la generazione.";
      throw new Error(detail);
    }
    return null;
  };

  const immediate = await pollOnce();
  if (immediate) {
    return immediate;
  }

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      void pollOnce()
        .then((result) => {
          if (result) {
            clearInterval(interval);
            resolve(result);
          }
        })
        .catch((error: unknown) => {
          clearInterval(interval);
          reject(error);
        });
    }, REPORT_POLL_INTERVAL_MS);

    options?.signal?.addEventListener("abort", () => {
      clearInterval(interval);
      reject(new Error("Generazione report annullata."));
    });
  });
}

function ReportGenerationProgress({
  progress,
  message,
}: {
  progress: number;
  message: string;
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-700">
        <span className="inline-flex items-center gap-2 min-w-0">
          <Activity className="h-4 w-4 shrink-0 animate-spin text-sky-600" />
          <span className="truncate">{message || "Generazione report in corso..."}</span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">{clampedProgress}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-[#345884] transition-all duration-500 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}

function SimulatorNavBar({
  dismissCase,
  backHref = "/dashboard",
  backLabel = "Dashboard",
  embedded = false,
}: {
  dismissCase?: { loading: boolean; onClick: () => void };
  backHref?: string;
  backLabel?: string;
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <header className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-2.5 shadow-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          {backLabel}
        </Link>
        {dismissCase ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs border-rose-200/80 text-rose-800 hover:bg-rose-50"
            disabled={dismissCase.loading}
            onClick={dismissCase.onClick}
            title="Dismiss case — all scores recorded as 0"
          >
            {dismissCase.loading ? "Uscita…" : "Abbandona caso"}
          </Button>
        ) : null}
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] flex h-12 items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-4 backdrop-blur-md shadow-sm">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
        {backLabel}
      </Link>
      {dismissCase ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs border-rose-200/80 text-rose-800 hover:bg-rose-50"
          disabled={dismissCase.loading}
          onClick={dismissCase.onClick}
          title="Dismiss case — all scores recorded as 0"
        >
          {dismissCase.loading ? "Uscita…" : "Abbandona caso"}
        </Button>
      ) : null}
    </header>
  );
}

export function SimulatorClient({
  initialCaseData,
  isVariant,
  sessionId,
  isAdmin = false,
  persistReports = true,
  examCatalog = EXAM_DEFAULT_VALUES,
  caseExamOverrides = {},
  embedded = false,
  backHref = "/dashboard",
}: SimulatorClientProps) {
  const router = useRouter();

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialHydrated, setTutorialHydrated] = useState(false);
  const lastActivityAtRef = useRef<number>(Date.now());
  const [activeTab, setActiveTab] = useState<"history" | "exam" | "labs" | "imaging" | "notes">(
    "history",
  );
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const selectedExamIdsRef = useRef<string[]>([]);
  const [isPatientChartOpen, setIsPatientChartOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  /** User-initiated help/consult telemetry for evaluator autonomy tracking. */
  const [helpRequested, setHelpRequested] = useState(false);
  const [helpRequestCount, setHelpRequestCount] = useState(0);
  const helpRequestCountRef = useRef(0);
  /** Non-exam clinical actions (e.g. consenso-informato) for ESC executedActionIds. */
  const [extraExecutedActionIds, setExtraExecutedActionIds] = useState<string[]>([]);
  const extraExecutedActionIdsRef = useRef<string[]>([]);
  const [consentRequested, setConsentRequested] = useState(false);
  const [isConsentBusy, setIsConsentBusy] = useState(false);
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);
  const [patientChartTab, setPatientChartTab] = useState<"base" | "referto">("base");

  const [examFindings, setExamFindings] = useState<
    Record<string, { id: string; label: string; finding: string; numericValue: number | null }>
  >({});

  type GameStatus =
    | "playing"
    | "checking_diagnosis"
    | "wrong_diagnosis"
    | "success"
    | "complication"
    | "showing_report";

  const [gameStatus, setGameStatus] = useState<GameStatus>("playing");
  const [diagnosisCheckError, setDiagnosisCheckError] = useState<string | null>(null);
  const [enableAiSurprises, setEnableAiSurprises] = useState(false);
  const [forceAiSurprise, setForceAiSurprise] = useState(false);
  const [finalDiagnosis, setFinalDiagnosis] = useState("");
  const [reportSections, setReportSections] = useState<ClinicalReportSections>({
    anamnesisObjective: "",
    diagnosticFindings: "",
    diagnosisTreatment: "",
  });
  const [expectedConditionText, setExpectedConditionText] = useState<string | null>(null);
  const [debugTargetCondition, setDebugTargetCondition] = useState<string | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<
    "clinical" | "legal" | "prescribing" | "empathy" | "economy"
  >("clinical");

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportProgress, setReportProgress] = useState(0);
  const [reportProgressMessage, setReportProgressMessage] = useState("");
  const [reportData, setReportData] = useState<SimulationReportData | null>(null);

  const sanitizedIncomingSessionId = sanitizeLiveSessionId(sessionId);
  const [effectiveSessionId, setEffectiveSessionId] = useState<string | undefined>(
    sanitizedIncomingSessionId,
  );
  const [isStartingEmergency, setIsStartingEmergency] = useState(false);
  const [dismissLoading, setDismissLoading] = useState(false);
  /** 0–100: pressione temporale e carico simulato (chat, esami, errori, tempo). */
  const [patientStress, setPatientStress] = useState(0);
  const patientStressRef = useRef(patientStress);
  /** Minuti clinici trascorsi (timer simulato + interazioni), esclusi i tempi degli esami. */
  const [clockMinutes, setClockMinutes] = useState(0);
  /** Wall-clock session elapsed seconds for MM:SS display. */
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  /** User-triggered pause ("Interruzione") — freezes clocks without ending the session. */
  const [isPaused, setIsPaused] = useState(false);
  const effectiveSessionIdRef = useRef(effectiveSessionId);
  const sessionStartPromiseRef = useRef<Promise<string | null> | null>(null);
  const examIdsChargedForStressRef = useRef<Set<string>>(new Set());
  const stressInitializedRef = useRef(false);

  useEffect(() => {
    patientStressRef.current = patientStress;
  }, [patientStress]);

  // SSR-safe: read tutorial completion only after mount.
  useEffect(() => {
    setTutorialHydrated(true);
  }, []);

  // First-run tutorial — only after disclaimer acceptance + hydrated localStorage check.
  useEffect(() => {
    if (!tutorialHydrated || !disclaimerAccepted) return;
    if (readTutorialCompleted()) return;
    setTutorialOpen(true);
  }, [tutorialHydrated, disclaimerAccepted]);

  const markUserActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  // Apply case baseline stress once (e.g. STEMI seed initialStress: 75).
  useEffect(() => {
    if (stressInitializedRef.current) return;
    const profile = resolveCaseStressProfile({
      description: initialCaseData.description,
      baselineExamFindings: initialCaseData.baselineExamFindings as Record<string, unknown> | undefined,
      goldStandardPath: initialCaseData.goldStandardPath ?? undefined,
    });
    stressInitializedRef.current = true;
    setPatientStress(profile.initialStress);
    patientStressRef.current = profile.initialStress;
  }, [
    initialCaseData.description,
    initialCaseData.baselineExamFindings,
    initialCaseData.goldStandardPath,
  ]);

  useEffect(() => {
    effectiveSessionIdRef.current = effectiveSessionId;
  }, [effectiveSessionId]);

  useEffect(() => {
    selectedExamIdsRef.current = selectedExamIds;
  }, [selectedExamIds]);

  useEffect(() => {
    extraExecutedActionIdsRef.current = extraExecutedActionIds;
  }, [extraExecutedActionIds]);

  useEffect(() => {
    const onClinicalAction = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "prescribe") setActiveTab("labs");
      if (action === "consult") setActiveTab("history");
      if (action === "diagnose") {
        /* scroll handled by workspace shell */
      }
    };
    window.addEventListener("aequan-clinical-action", onClinicalAction);
    return () => window.removeEventListener("aequan-clinical-action", onClinicalAction);
  }, []);

  const advanceClock = useCallback((deltaMinutes = 1) => {
    if (deltaMinutes <= 0) return;
    setClockMinutes((m) => m + deltaMinutes);
  }, []);

  const bumpPatientStress = useCallback((delta: number) => {
    if (delta <= 0) return;
    setPatientStress((s) => Math.min(100, s + delta));
  }, []);

  // Timer clinico: +1 minuto simulato ogni 15s reali mentre il caso è in corso.
  useEffect(() => {
    if (!disclaimerAccepted || gameStatus !== "playing" || isPaused) return;
    const id = window.setInterval(() => {
      setClockMinutes((m) => m + 1);
      bumpPatientStress(1);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [disclaimerAccepted, gameStatus, isPaused, bumpPatientStress]);

  // Wall-clock MM:SS — increments every real second during active play.
  useEffect(() => {
    if (!disclaimerAccepted || gameStatus !== "playing" || isPaused) return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1_000);
    return () => window.clearInterval(id);
  }, [disclaimerAccepted, gameStatus, isPaused]);

  // Pressione temporale aggiuntiva (più lenta).
  useEffect(() => {
    if (!disclaimerAccepted || gameStatus !== "playing" || isPaused) return;
    const id = window.setInterval(() => {
      bumpPatientStress(2);
    }, 45_000);
    return () => window.clearInterval(id);
  }, [disclaimerAccepted, gameStatus, isPaused, bumpPatientStress]);

  const demoChat = initialCaseData.demographics ?? {};
  const patientAgeForChat = demoChat.age ?? 58;
  const patientSexForChat =
    demoChat.sex === "F" || demoChat.sex === "M" ? demoChat.sex : "M";

  const vitalSignsForChat = useMemo(
    () =>
      formatVitalSignsFromBaseline(
        initialCaseData.baselineExamFindings as Record<string, unknown> | undefined,
      ),
    [initialCaseData.baselineExamFindings],
  );

  const abnormalExamsForChat = useMemo(
    () =>
      formatAbnormalExamsFromBaseline(
        initialCaseData.baselineExamFindings as Record<string, unknown> | undefined,
      ),
    [initialCaseData.baselineExamFindings],
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: submitChatMessage,
    isLoading: isChatLoading,
    setMessages,
    append,
    error: chatError,
    reload: reloadChat,
  } = useChat({
    api: "/api/chat",
    streamProtocol: "data",
    experimental_throttle: 30,
    keepLastMessageOnError: true,
    body: {
      casePrompt: initialCaseData.patientPrompt,
      caseId: initialCaseData.id,
      patientAge: patientAgeForChat,
      patientSex: patientSexForChat,
      chiefComplaint: initialCaseData.description,
      vitalSigns: vitalSignsForChat,
      abnormalExams: abnormalExamsForChat,
      // Never send gold diagnosis from the browser — server loads it only for owned live sessions.
    },
    experimental_prepareRequestBody: ({ messages: chatMessages, requestBody }) => ({
      ...(requestBody ?? {}),
      sessionId: effectiveSessionIdRef.current,
      patientStress: patientStressRef.current,
      requestedExamIds: selectedExamIdsRef.current,
      messages: chatMessages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : "",
      })),
    }),
    onFinish: () => {
      // Dopo ogni risposta paziente: micro-incremento stress (ansia / tempo clinico).
      bumpPatientStress(1);
    },
    onError: () => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") {
          return [
            ...prev,
            {
              id: `chat-error-${Date.now()}`,
              role: "assistant" as const,
              content:
                "Connessione interrotta o timeout. Usa «Riprova invio» per ripetere l’ultimo messaggio.",
            },
          ];
        }
        const existing =
          typeof last.content === "string" && last.content.length > 0
            ? last.content
            : "Errore nella chat. Usa «Riprova invio» tra qualche secondo.";
        return [...prev.slice(0, -1), { ...last, content: existing }];
      });
    },
  });

  // Activity timestamp for session UX (no passive coaching nudges).
  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages],
  );

  useEffect(() => {
    markUserActivity();
  }, [userMessageCount, selectedExamIds.length, markUserActivity]);

  const ensureSessionId = useCallback(async (): Promise<string | null> => {
    if (effectiveSessionIdRef.current) return effectiveSessionIdRef.current;
    if (sessionStartPromiseRef.current) return sessionStartPromiseRef.current;

    const startPromise = (async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: initialCaseData.id,
            mode: "original",
          }),
        });
        const data = await res.json().catch(() => null);
        const newSessionId = sanitizeLiveSessionId(
          typeof data?.sessionId === "string" ? data.sessionId : undefined,
        );
        if (newSessionId) {
          setEffectiveSessionId(newSessionId);
          effectiveSessionIdRef.current = newSessionId;
          syncSessionIdInUrl(newSessionId);
          return newSessionId;
        }
        return null;
      } catch (err) {
        console.error("[SimulatorClient] ensureSessionId failed", err);
        return null;
      } finally {
        sessionStartPromiseRef.current = null;
      }
    })();

    sessionStartPromiseRef.current = startPromise;
    return startPromise;
  }, [initialCaseData.id]);

  const openHelpConsult = useCallback(() => {
    markUserActivity();
    const nextCount = helpRequestCountRef.current + 1;
    helpRequestCountRef.current = nextCount;
    setHelpRequestCount(nextCount);
    setHelpRequested(true);
    setIsHelpOpen(true);

    void (async () => {
      const sid = effectiveSessionIdRef.current ?? (await ensureSessionId());
      if (!sid) return;
      try {
        await fetch("/api/session/help", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            helpRequestCount: nextCount,
          }),
        });
      } catch {
        // Telemetry best-effort — never block the help dialog.
      }
    })();
  }, [ensureSessionId, markUserActivity]);

  const requestInformedConsent = useCallback(() => {
    console.log("[DEBUG CLICK] consenso-informato", initialCaseData.id);
    markUserActivity();
    if (consentRequested || isConsentBusy) return;
    setIsConsentBusy(true);

    const consentMessage =
      "Le spiego ora la procedura proposta, i benefici attesi, i rischi principali e le alternative cliniche. " +
      "Le chiedo di confermare di aver compreso le informazioni e di prestare il consenso informato prima di procedere.";

    try {
      void append({ role: "user", content: consentMessage });
    } catch (err) {
      console.error("[SimulatorClient] consent append failed", err);
    }

    setExtraExecutedActionIds((prev) => {
      if (prev.includes(CONSENT_INFORMED_ACTION_ID)) return prev;
      const next = [...prev, CONSENT_INFORMED_ACTION_ID];
      extraExecutedActionIdsRef.current = next;
      return next;
    });
    setConsentRequested(true);

    void (async () => {
      try {
        const sid = effectiveSessionIdRef.current ?? (await ensureSessionId());
        if (!sid) return;
        await fetch("/api/session/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        });
      } catch (err) {
        console.error("[SimulatorClient] consent telemetry failed", err);
      } finally {
        setIsConsentBusy(false);
      }
    })();
  }, [
    append,
    consentRequested,
    ensureSessionId,
    initialCaseData.id,
    isConsentBusy,
    markUserActivity,
  ]);

  const handleDismissCase = async () => {
    const confirmed = window.confirm(
      "Abbandonare il caso (Dismiss case)? Verrà registrato un punteggio di 0 su tutti gli assi di valutazione.",
    );
    if (!confirmed) return;

    if (!persistReports) {
      router.push(backHref);
      router.refresh();
      return;
    }

    setDismissLoading(true);
    try {
      const liveId = (await ensureSessionId()) ?? undefined;
      const res = await fetch("/api/session/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: initialCaseData.id,
          ...(liveId ? { liveSessionId: liveId } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as { sessionId?: string } | null;
      if (!res.ok || !data?.sessionId) {
        throw new Error("dismiss failed");
      }
      router.push(`/case/${initialCaseData.id}/results?sessionId=${data.sessionId}`);
      router.refresh();
    } catch {
      setDismissLoading(false);
    }
  };

  // Single-flight session start — only after clinical disclaimer (avoid orphan sessions).
  useEffect(() => {
    if (!disclaimerAccepted || !persistReports) return;
    if (effectiveSessionIdRef.current) return;
    void ensureSessionId();
  }, [disclaimerAccepted, persistReports, ensureSessionId]);

  useEffect(() => {
    if (!isAdmin || !effectiveSessionId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/session/state?sessionId=${effectiveSessionId}`);
      const data = await res.json().catch(() => null);
      if (!cancelled && data?.targetCondition) {
        setDebugTargetCondition(String(data.targetCondition));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveSessionId, isAdmin]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isChatLoading) return;

    const stressForRequest = Math.min(100, patientStress + 2);
    setPatientStress(stressForRequest);
    patientStressRef.current = stressForRequest;
    advanceClock(1);

    submitChatMessage(event);
  };

  const caseAdvancedExamValues = useMemo((): Record<string, CaseExamStoredValues> => {
    const bf = initialCaseData.baselineExamFindings as
      | { advancedExams?: { values?: Record<string, CaseExamStoredValues> } }
      | undefined;
    const legacy = bf?.advancedExams?.values ?? {};
    return { ...legacy, ...caseExamOverrides };
  }, [initialCaseData.baselineExamFindings, caseExamOverrides]);

  const examMacroCatalog = useMemo(
    () => buildExamMacroCatalog(RAW_EXAM_CATALOG_STRUCTURE, examCatalog),
    [examCatalog],
  );

  const availableExams = useMemo(() => flattenExams(examMacroCatalog), [examMacroCatalog]);

  const resolveExamForSelection = useCallback(
    (exam: Exam) => applyExamMeta(exam, examCatalog, caseAdvancedExamValues[exam.id]),
    [examCatalog, caseAdvancedExamValues],
  );

  const selectedExams = useMemo(
    () =>
      selectedExamIds
        .map((id) => availableExams.find((exam) => exam.id === id))
        .filter((exam): exam is Exam => Boolean(exam))
        .map(resolveExamForSelection),
    [selectedExamIds, availableExams, resolveExamForSelection],
  );
  const selectedExamsRecentFirst = useMemo(() => [...selectedExams].reverse(), [selectedExams]);
  const objectiveFindingsRecentFirst = useMemo(
    () => [...Object.values(examFindings)].reverse(),
    [examFindings],
  );

  const totalCost = selectedExams.reduce((sum, exam) => sum + exam.cost, 0);
  const examBudgetEuro = useMemo(
    () =>
      resolveExamBudgetEuro(
        initialCaseData.difficulty as CaseDifficulty,
        initialCaseData.baselineExamFindings,
      ),
    [initialCaseData.difficulty, initialCaseData.baselineExamFindings],
  );

  const reportGenerationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      reportGenerationAbortRef.current?.abort();
    };
  }, []);

  const generateReportAndNavigate = useCallback(async () => {
    reportGenerationAbortRef.current?.abort();
    const abortController = new AbortController();
    reportGenerationAbortRef.current = abortController;

    setReportError(null);
    setReportLoading(true);
    setReportProgress(10);
    setReportProgressMessage("Inizializzazione report...");

    try {
      const liveSessionId = await ensureSessionId();
      if (liveSessionId) {
        syncSessionIdInUrl(liveSessionId);
      }
      const diagnosisForEval =
        extractFinalDiagnosisFromReport(reportSections).trim() || finalDiagnosis.trim();
      const composedReport = composeClinicalReport(reportSections);

      if (liveSessionId) {
        setReportProgressMessage("Sincronizzazione milestone clinici...");
        const examLabels: Record<string, string> = {};
        for (const exam of selectedExams) {
          examLabels[exam.id] = exam.name;
        }
        const lastUserMessage = [...messages]
          .reverse()
          .find((m) => m.role === "user");
        await fetch("/api/session/sync-milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: liveSessionId,
            caseId: initialCaseData.id,
            requestedExamIds: selectedExamIdsRef.current,
            examLabels,
            prescribedExams: selectedExams.map((e) => ({ id: e.id, name: e.name })),
            lastUserMessage: lastUserMessage
              ? getChatMessageText(lastUserMessage)
              : undefined,
          }),
          signal: abortController.signal,
        });
      }

      setReportProgressMessage("Inizializzazione report...");
      const res = await fetch("/api/simulation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: initialCaseData.id,
          sessionId: liveSessionId ?? undefined,
          chatHistory: messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: getChatMessageText(m),
            })),
          exams: selectedExams,
          reportText: composedReport,
          caseContext: initialCaseData.patientPrompt,
          finalDiagnosis: diagnosisForEval,
          requestedExamIds: selectedExamIdsRef.current ?? [],
          executedActionIds: [
            ...(selectedExamIdsRef.current ?? []),
            ...(extraExecutedActionIdsRef.current ?? []),
          ],
          helpRequested: Boolean(helpRequested),
          helpRequestCount: helpRequestCountRef.current ?? 0,
        }),
        signal: abortController.signal,
      });

      const data = await res.json().catch(() => null);

      if (res.status !== 202 && !res.ok) {
        throw new Error(
          (data && (data.error as string | undefined)) || "Errore nella generazione del report.",
        );
      }

      const reportId =
        data &&
        (typeof data.reportId === "string"
          ? data.reportId
          : typeof data.sessionId === "string"
            ? data.sessionId
            : null);

      if (!reportId) {
        throw new Error("ID report non disponibile.");
      }

      if (typeof data.progress === "number") {
        setReportProgress(data.progress);
      }
      if (typeof data.progressMessage === "string") {
        setReportProgressMessage(data.progressMessage);
      }

      const { reportId: completedReportId } = await pollReportUntilComplete(
        reportId,
        (progress, message) => {
          setReportProgress(progress);
          setReportProgressMessage(message);
        },
        { signal: abortController.signal },
      );

      router.push(`/case/${initialCaseData.id}/results?sessionId=${completedReportId}`);
      router.refresh();
    } catch (e) {
      if (abortController.signal.aborted) {
        return;
      }
      const message =
        e instanceof Error ? e.message : "Errore nella generazione del report.";
      setReportError(message);
    } finally {
      if (reportGenerationAbortRef.current === abortController) {
        setReportLoading(false);
        reportGenerationAbortRef.current = null;
      }
    }
  }, [
    finalDiagnosis,
    initialCaseData.id,
    initialCaseData.patientPrompt,
    messages,
    reportSections,
    router,
    selectedExams,
  ]);

  const demo = initialCaseData.demographics ?? {};
  const ageValue = demo.age ?? 58;
  const sexValue = (demo.sex === "F" || demo.sex === "M") ? demo.sex : "M";
  const contextValue = demo.context ?? initialCaseData.specialty ?? "Specialità non specificata";

  const patient = {
    age: ageValue,
    sex: (sexValue === "F" ? "F" : "M") as "M" | "F",
    mainComplaint: initialCaseData.description,
    context: contextValue,
    id: `CASE-${String(initialCaseData.id ?? "").slice(0, 6).toUpperCase() || "DEMO"}`,
  };

  const handleExamFinding = (payload: {
    id: string;
    label: string;
    result: { finding: string; numericValue: number | null };
  }) => {
    setExamFindings((prev) => ({
      ...prev,
      [payload.id]: {
        id: payload.id,
        label: payload.label,
        finding: payload.result.finding,
        numericValue: payload.result.numericValue,
      },
    }));
    bumpPatientStress(3);
    advanceClock(2);
  };

  const toggleExam = (examId: string) => {
    markUserActivity();
    setSelectedExamIds((current) => {
      if (current.includes(examId)) {
        return current;
      }
      const charged = examIdsChargedForStressRef.current;
      if (!charged.has(examId)) {
        charged.add(examId);
        bumpPatientStress(2);
        advanceClock(1);
      }
      const next = [...current, examId];
      void (async () => {
        const sid = effectiveSessionIdRef.current ?? (await ensureSessionId());
        if (!sid) return;
        const labelFor = (id: string) =>
          availableExams.find((e) => e.id === id)?.name ?? id;
        await fetch("/api/session/sync-milestones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sid,
            caseId: initialCaseData.id,
            requestedExamIds: next,
            examLabels: Object.fromEntries(next.map((id) => [id, labelFor(id)])),
            prescribedExams: next.map((id) => ({ id, name: labelFor(id) })),
          }),
        }).catch(() => {
          /* non-blocking: evaluation will re-sync */
        });
      })();
      return next;
    });
  };

  const confirmDiagnosis = () => {
    const diagnosisText = extractFinalDiagnosisFromReport(reportSections).trim();
    if (!isClinicalReportComplete(reportSections) || !diagnosisText) return;
    setFinalDiagnosis(diagnosisText);
    setDiagnosisCheckError(null);
    setGameStatus("checking_diagnosis");

    window.setTimeout(async () => {
      try {
        const sid = effectiveSessionIdRef.current ?? (await ensureSessionId());
        const res = await fetch("/api/session/check-diagnosis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: initialCaseData.id,
            sessionId: sid,
            diagnosisText,
          }),
        });

        if (!res.ok) {
          setDiagnosisCheckError(
            "Verifica diagnosi non riuscita (errore di rete o server). Puoi correggere il referto e riprovare.",
          );
          setGameStatus("playing");
          return;
        }

        const verdict = (await res.json().catch(() => null)) as
          | { isCorrect: boolean; expectedCondition?: string }
          | null;

        if (!verdict) {
          setDiagnosisCheckError(
            "Risposta di verifica non valida. Riprendi l’anamnesi o correggi la diagnosi e riprova.",
          );
          setGameStatus("playing");
          return;
        }

        const isCorrect = Boolean(verdict.isCorrect);
        setExpectedConditionText(
          verdict.expectedCondition ? String(verdict.expectedCondition) : null,
        );

        if (isCorrect) {
          // Debug / QA: forza sempre l'imprevisto se richiesto
          if (forceAiSurprise) {
            setGameStatus("complication");
            return;
          }

          // Imprevisto: 20% se toggle attivo
          if (enableAiSurprises && Math.random() < 0.2) {
            setGameStatus("complication");
            return;
          }

          setGameStatus("success");

          if (sid) {
            await fetch("/api/session/outcome", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sid,
                caseId: initialCaseData.id,
                basePatientPrompt: initialCaseData.patientPrompt,
                outcome: "success",
              }),
            }).catch(() => {
              /* non-blocking */
            });
            // Sync sessionId in the URL without Next navigation — router.replace
            // remounts the play page and wipes gameStatus / report UI.
            syncSessionIdInUrl(sid);
          }
          return;
        }

        setGameStatus("wrong_diagnosis");
        bumpPatientStress(20);
        if (sid) {
          await fetch("/api/session/outcome", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sid,
              caseId: initialCaseData.id,
              basePatientPrompt: initialCaseData.patientPrompt,
              outcome: "wrong_diagnosis",
            }),
          }).catch(() => {
            /* non-blocking */
          });
          syncSessionIdInUrl(sid);
        }
      } catch {
        setDiagnosisCheckError(
          "Impossibile verificare la diagnosi (timeout o errore di rete). Lo stato torna a «in corso» — correggi e riprova.",
        );
        setGameStatus("playing");
      }
    }, 2000);
  };

  const resumeAfterWrongDiagnosis = () => {
    setDiagnosisCheckError(null);
    setGameStatus("playing");
    setIsDischargeOpen(true);
    setPatientChartTab("referto");
  };

  if (gameStatus === "showing_report") {
    return (
      <div
        className={
          embedded
            ? "flex w-full min-w-0 flex-col bg-transparent text-text-primary"
            : "flex min-h-screen w-full items-stretch justify-center bg-ui-bg px-4 pb-10 pt-16 text-text-primary"
        }
      >
        {!embedded ? (
          <SimulatorNavBar backHref={backHref} backLabel="Torna alla Prassi" />
        ) : null}
        <div className="flex w-full min-w-0 flex-col gap-6 pb-12">
          <Card className="w-full rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
            <CardHeader>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Report di performance
              </p>
              <CardTitle className="text-base font-semibold text-brand-primary">Report finale</CardTitle>
              <CardDescription>
                Naviga tra le sezioni del report per rivedere anamnesi, diagnostica e terapia.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="scrollbar-aequan flex items-center gap-2 overflow-x-auto pb-1">
                {(
                  [
                    { id: "clinical", label: "Accuratezza clinica" },
                    { id: "legal", label: "Legal compliance" },
                    { id: "prescribing", label: "Appropriatezza prescrittiva" },
                    { id: "empathy", label: "Empatia" },
                    { id: "economy", label: "Sostenibilità economica" },
                  ] as const
                ).map((t) => {
                  const isActive = t.id === activeReportTab;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveReportTab(t.id)}
                      className={
                        "relative -mb-px flex items-center gap-2 rounded-t-xl border px-4 py-2 text-[11px] font-medium transition-colors whitespace-nowrap " +
                        (isActive
                          ? "border-slate-200 bg-white text-slate-900 shadow-sm"
                          : "border-transparent bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900")
                      }
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-6 rounded-b-2xl rounded-tr-2xl border border-slate-100 bg-white p-5">
                {reportLoading && (
                  <ReportGenerationProgress
                    progress={reportProgress}
                    message={reportProgressMessage}
                  />
                )}
                {!reportLoading && reportError && (
                  <div className="text-sm text-rose-700">{reportError}</div>
                )}
                {!reportLoading && reportData && (
                  <>
                    <div className="flex flex-wrap items-center justify-center gap-10 border-b border-slate-100 pb-6">
                      <ScoreProgressRing
                        score={reportData.scores.clinical}
                        label="Accuratezza clinica"
                      />
                      <ScoreProgressRing score={reportData.scores.legal} label="Tutela medico-legale" />
                    </div>
                    <div className="space-y-4">
                      <MetricBar label="Accuratezza clinica" score={reportData.scores.clinical} />
                      <MetricBar label="Tutela medico-legale" score={reportData.scores.legal} />
                      <MetricBar label="Appropriatezza esami" score={reportData.scores.exams} />
                      <MetricBar label="Empatia" score={reportData.scores.empathy} />
                      <MetricBar label="Sostenibilità economica" score={reportData.scores.economy} />
                    </div>
                    {activeReportTab === "clinical" && (
                      <div className="rounded-xl border border-slate-100 border-l-4 border-l-[#345884] bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Feedback clinico
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                          {reportData.feedback?.clinicalNote ?? "—"}
                        </p>
                      </div>
                    )}
                    {activeReportTab === "legal" && (
                      <div className="rounded-xl border border-slate-100 border-l-4 border-l-[#345884] bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Feedback medico-legale
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                          {reportData.feedback?.legalComplianceNote ?? "—"}
                        </p>
                        {reportData.evidence?.legalSources?.length ? (
                          <div className="mt-3 text-xs text-slate-600">
                            <span className="font-medium">Fonti (tag: legale):</span>{" "}
                            {reportData.evidence.legalSources.join(" · ")}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {activeReportTab === "prescribing" && (
                      <div className="rounded-xl border border-slate-100 border-l-4 border-l-[#345884] bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Feedback prescrittivo
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                          {reportData.feedback?.prescribingNote ?? "—"}
                        </p>
                        {reportData.evidence?.protocolSources?.length ? (
                          <div className="mt-3 text-xs text-slate-600">
                            <span className="font-medium">Fonti (tag: protocolli):</span>{" "}
                            {reportData.evidence.protocolSources.join(" · ")}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {activeReportTab === "empathy" && (
                      <div className="rounded-xl border border-slate-100 border-l-4 border-l-[#345884] bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Feedback empatia
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                          {reportData.feedback?.empathyNote ?? "—"}
                        </p>
                      </div>
                    )}
                    {activeReportTab === "economy" && (
                      <div className="rounded-xl border border-slate-100 border-l-4 border-l-[#345884] bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                          Feedback economico
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                          {reportData.feedback?.economyNote ?? "—"}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {!reportLoading && !reportData && !reportError && (
                  <div className="text-sm text-slate-500">Report non disponibile.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-transparent text-text-primary"
          : "flex min-h-screen w-full items-stretch justify-center overflow-x-hidden bg-ui-bg px-4 pb-10 pt-16 text-text-primary"
      }
    >
      {!embedded ? (
        <SimulatorNavBar
          backHref={backHref}
          backLabel={backHref.includes("prassi") ? "Torna alla Prassi" : "Dashboard"}
          dismissCase={
            persistReports && disclaimerAccepted
              ? { loading: dismissLoading, onClick: handleDismissCase }
              : undefined
          }
        />
      ) : null}
      <div
        className={
          embedded
            ? "flex h-full min-h-0 w-full min-w-0 flex-col gap-2.5 overflow-hidden font-[family-name:var(--font-inter)]"
            : "flex w-full min-w-0 flex-col gap-3 overflow-x-hidden font-[family-name:var(--font-inter)]"
        }
      >
          {embedded ? (
          <header className="grid w-full min-w-0 shrink-0 grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-3 lg:px-5">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {patient.context?.trim() &&
                  patient.context.trim().toLowerCase() !== "pronto soccorso"
                    ? patient.context.trim()
                    : "Ospedale San Carlo"}
                </p>
              <span className="inline-flex shrink-0 items-center rounded-md bg-[#345884]/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#345884]">
                  Pronto Soccorso
                </span>
              </div>
              <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#345884]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#345884]" />
                Sessione attiva
              </span>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2.5 justify-self-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#345884] shadow-sm">
                <Clock className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="leading-tight">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Tempo simulazione
                </p>
                <p className="text-base font-bold tabular-nums text-slate-900">
                  {formatElapsedClock(elapsedSeconds)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 lg:justify-self-end">
              <button
                type="button"
                onClick={() => {
                  document.getElementById("aequan-sim-chat")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#345884]"
              >
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                Dialogo guidato
              </button>
              <button
                type="button"
                onClick={() => setIsPaused((v) => !v)}
                aria-pressed={isPaused}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition",
                  isPaused
                    ? "hover:brightness-[0.98]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800",
                )}
                style={
                  isPaused
                    ? {
                        backgroundColor: PRASSI_TONE.peach.fill,
                        color: PRASSI_TONE.peach.accent,
                      }
                    : undefined
                }
              >
                {isPaused ? (
                  <Play className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <Pause className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {isPaused ? "Riprendi" : "Interruzione"}
              </button>
              <span className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />
              {persistReports && disclaimerAccepted ? (
                <button
                  type="button"
                  disabled={dismissLoading}
                  onClick={handleDismissCase}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-semibold transition hover:brightness-[0.98] disabled:opacity-60"
                  style={{
                    backgroundColor: PRASSI_TONE.blush.fill,
                    color: PRASSI_TONE.blush.accent,
                  }}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {dismissLoading ? "Uscita…" : "Termina caso"}
                </button>
              ) : (
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Esci
                </Link>
              )}
            </div>
          </header>
        ) : null}
        {embedded && isPaused ? (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
            style={{
              backgroundColor: PRASSI_TONE.peach.fill,
              color: PRASSI_TONE.peach.accent,
            }}
          >
            <Pause className="h-4 w-4" strokeWidth={1.75} />
            Simulazione in pausa — i timer sono fermi. Premi &quot;Riprendi&quot; per continuare.
          </div>
        ) : null}

        {!embedded ? (
          <>
            <VitalSignsBoard
              caseId={initialCaseData.id}
              title={initialCaseData.title}
              age={patient.age}
              sex={patient.sex}
              stress={patientStress}
              className="w-full shrink-0 overflow-x-hidden rounded-xl shadow-md"
            />
            <header className="flex w-full items-center justify-between gap-4 overflow-x-hidden px-0.5">
              <div className="min-w-0 space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Simulazione attiva
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-lg font-semibold tracking-tight text-brand-primary">
                    {initialCaseData.title}
                  </h1>
                  {isVariant ? (
                    <Badge className="inline-flex items-center gap-1 border-brand-secondary/30 bg-brand-secondary/10 text-[10px] text-brand-secondary">
                      <Sparkles className="h-3 w-3" />
                      Variante IA
                    </Badge>
                  ) : (
                    <Badge className="text-[10px]">Caso originale</Badge>
                  )}
                </div>
              </div>
              <div className="inline-flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openHelpConsult}
                  aria-label="Aiuto / Richiesta consulto"
                  title="Aiuto / Richiesta consulto"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#345884]/30 bg-[#EEF2F9] px-2.5 py-2 text-xs font-medium text-[#345884] shadow-sm transition hover:bg-[#345884] hover:text-white"
                >
                  <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Aiuto</span>
                </button>
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel-bg px-3 py-1.5 text-xs text-slate-600 shadow-sm">
                  <Activity className="h-3.5 w-3.5 text-brand-secondary" />
                  <span>Sessione in corso</span>
                </div>
              </div>
            </header>
          </>
        ) : null}

        {/* Embedded: immersive 2-col full-height. Standalone: EHR 8 | diagnostic 4. */}
        <div
          className={
            embedded
              ? "grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-2.5 overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,1fr)] lg:items-stretch"
              : "grid w-full min-w-0 grid-cols-1 gap-6 overflow-x-hidden lg:grid-cols-12 lg:items-start"
          }
        >
          {embedded ? (
            <div
              id="aequan-sim-chat"
              className="flex min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden"
            >
              <div className="flex w-full min-w-0 shrink-0 flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Caso clinico attivo
                    </p>
                    <h1 className="mt-0.5 truncate font-display text-base font-bold tracking-tight text-[#345884] sm:text-lg">
                      {initialCaseData.title}
                    </h1>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {initialCaseData.specialty?.trim() || "Pronto Soccorso"}
                      <span className="mx-1.5 text-slate-300">·</span>
                      Paziente {patient.age} anni ({patient.sex})
                      <span className="mx-1.5 text-slate-300">·</span>
                      ID: {patient.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {maxVitalStatus(
                      classifyVitals(deriveDemoVitals(initialCaseData.id, patientStress)).map(
                        (v) => v.status,
                      ),
                    ) !== "stable" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-red-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                        Instabile
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#345884]" />
                        Stabile
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={openHelpConsult}
                      aria-label="Aiuto / Richiesta consulto"
                      title="Aiuto / Richiesta consulto"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#345884]/30 bg-[#EEF2F9] px-2.5 py-1.5 text-[11px] font-medium text-[#345884] transition hover:bg-[#345884] hover:text-white"
                    >
                      <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Aiuto
                    </button>
                  </div>
                </div>

                <VitalSignsBoard
                  caseId={initialCaseData.id}
                  title={initialCaseData.title}
                  age={patient.age}
                  sex={patient.sex}
                  stress={patientStress}
                  showHeader={false}
                  className="w-full shrink-0"
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#345884]/10 text-[#345884]">
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                        Dialogo clinico
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        Anamnesi con il paziente
                      </p>
                    </div>
                  </div>
                  <AiTransparencyBadge variant="workspace" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
                  <HistoryChat
                    messages={messages}
                    input={input}
                    onInputChange={handleInputChange}
                    onSubmit={handleSubmit}
                    isLoading={isChatLoading}
                    chatError={chatError}
                    onRetryChat={() => void reloadChat()}
                    onRequestConsent={requestInformedConsent}
                    consentRequested={consentRequested}
                    consentBusy={isConsentBusy}
                    compact
                    fill
                  />
                </div>
              </div>
            </div>
          ) : (
          <div
            id="aequan-sim-chat"
            className="flex min-w-0 flex-col gap-4 overflow-x-hidden lg:col-span-8"
          >
            {/* Compact patient banner (no duplicate Cartella Clinica Attiva card) */}
            <div className="flex w-full min-w-0 shrink-0 items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Sessione clinica
                </p>
                <p className="mt-0.5 truncate font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {patientDisplayName(
                    initialCaseData.id,
                    initialCaseData.title,
                    patient.sex,
                  )}
                  <span className="font-sans font-normal text-slate-500">
                    {" "}
                    · {patient.age} anni · {patient.sex === "M" ? "M" : "F"}
                  </span>
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {patient.mainComplaint ||
                    "Motivo di accesso da approfondire con il paziente."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPatientChartTab("base");
                  setIsPatientChartOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Cartella
              </button>
            </div>

            <Card className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-panel-bg shadow-aequan-panel">
              <CardHeader className="flex w-full min-w-0 flex-col gap-3 border-b border-border-subtle bg-ui-bg/80 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-0.5">
                  <CardTitle className="font-display text-sm font-bold tracking-tight text-brand-primary">
                    Cartella clinica elettronica
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Anamnesi, esame obiettivo, laboratorio e imaging.
                  </CardDescription>
                </div>
                <TabsList className="flex w-full min-w-0 flex-wrap sm:w-auto">
                  <TabsTrigger
                    value="history"
                    currentValue={activeTab}
                    onSelect={(value) => setActiveTab(value as typeof activeTab)}
                  >
                    Anamnesi
                  </TabsTrigger>
                  <TabsTrigger
                    value="exam"
                    currentValue={activeTab}
                    onSelect={(value) => setActiveTab(value as typeof activeTab)}
                  >
                    Esame obiettivo
                  </TabsTrigger>
                  <TabsTrigger
                    value="labs"
                    currentValue={activeTab}
                    onSelect={(value) => setActiveTab(value as typeof activeTab)}
                  >
                    Laboratorio
                  </TabsTrigger>
                  <TabsTrigger
                    value="imaging"
                    currentValue={activeTab}
                    onSelect={(value) => setActiveTab(value as typeof activeTab)}
                  >
                    Imaging
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="min-w-0 w-full pt-0">
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => setActiveTab(value as typeof activeTab)}
                >
                  <TabsContent value="history" currentValue={activeTab} className="mt-3 w-full min-w-0">
                    <HistoryChat
                      messages={messages}
                      input={input}
                      onInputChange={handleInputChange}
                      onSubmit={handleSubmit}
                      isLoading={isChatLoading}
                      chatError={chatError}
                      onRetryChat={() => void reloadChat()}
                      onRequestConsent={requestInformedConsent}
                      consentRequested={consentRequested}
                      consentBusy={isConsentBusy}
                      compact={embedded}
                    />
                  </TabsContent>
                  <TabsContent value="exam" currentValue={activeTab} className="mt-3 w-full min-w-0">
                    <PhysicalExamTab
                      sessionId={effectiveSessionId}
                      patientPrompt={initialCaseData.patientPrompt}
                      caseId={initialCaseData.id}
                      onExamResult={handleExamFinding}
                    />
                  </TabsContent>
                  <TabsContent value="labs" currentValue={activeTab} className="mt-3 w-full min-w-0">
                    <DiagnosticCategoryPanel
                      selectedExamIds={selectedExamIds}
                      onToggleExam={toggleExam}
                      caseExamValues={caseAdvancedExamValues}
                      examCatalog={examCatalog}
                      examMacroCatalog={examMacroCatalog}
                      macroFilter={["lab"]}
                    />
                  </TabsContent>
                  <TabsContent value="imaging" currentValue={activeTab} className="mt-3 w-full min-w-0">
                    <DiagnosticCategoryPanel
                      selectedExamIds={selectedExamIds}
                      onToggleExam={toggleExam}
                      caseExamValues={caseAdvancedExamValues}
                      examCatalog={examCatalog}
                      examMacroCatalog={examMacroCatalog}
                      macroFilter={["img", "strum", "endo"]}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Right clinical rail */}
          <div
            id="aequan-sim-exams"
            className={
              embedded
                ? "flex min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden"
                : "flex min-w-0 flex-col gap-4 overflow-x-hidden pb-8 lg:col-span-4"
            }
          >
            {embedded ? (
              <>
                <div className="grid shrink-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                  <SessionSideMetrics
                    totalCost={totalCost}
                    budget={examBudgetEuro}
                    patientStress={patientStress}
                    reportReady={isClinicalReportComplete(reportSections)}
                    onOpenDischarge={() => setIsDischargeOpen(true)}
                    className="min-h-0"
                  />
                </div>

                <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
                  <CardHeader className="shrink-0 border-b border-slate-100 py-3 pb-2.5">
                    <CardTitle className="text-sm font-semibold text-slate-800">
                      Cartella clinica
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2.5">
                    <TabsList wrap className="mb-2.5 w-full shrink-0">
                      <TabsTrigger
                        value="history"
                        currentValue={activeTab}
                        onSelect={(value) => setActiveTab(value as typeof activeTab)}
                        className="shrink-0 whitespace-nowrap"
                      >
                        Anamnesi
                      </TabsTrigger>
                      <TabsTrigger
                        value="exam"
                        currentValue={activeTab}
                        onSelect={(value) => setActiveTab(value as typeof activeTab)}
                        className="shrink-0 whitespace-nowrap"
                      >
                        Esame obiettivo
                      </TabsTrigger>
                      <TabsTrigger
                        value="labs"
                        currentValue={activeTab}
                        onSelect={(value) => setActiveTab(value as typeof activeTab)}
                        className="shrink-0 whitespace-nowrap"
                      >
                        Esami
                      </TabsTrigger>
                      <TabsTrigger
                        value="imaging"
                        currentValue={activeTab}
                        onSelect={(value) => setActiveTab(value as typeof activeTab)}
                        className="shrink-0 whitespace-nowrap"
                      >
                        Imaging
                      </TabsTrigger>
                      <TabsTrigger
                        value="notes"
                        currentValue={activeTab}
                        onSelect={(value) => setActiveTab(value as typeof activeTab)}
                        className="shrink-0 whitespace-nowrap"
                      >
                        Note
                      </TabsTrigger>
                    </TabsList>
                    <div className="scrollbar-aequan min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
                      <Tabs
                        value={activeTab}
                        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
                      >
                        <TabsContent value="history" currentValue={activeTab} className="mt-0">
                          <div className="space-y-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                Anamnesi iniziale
                              </p>
                              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                                {reportSections.anamnesisObjective?.trim() ||
                                  patient.mainComplaint ||
                                  "Usa il dialogo al centro per raccogliere l'anamnesi."}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                  Storia clinica
                                </p>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                                  {expectedConditionText && isAdmin
                                    ? expectedConditionText
                                    : "Nessuna patologia nota."}
                                </p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                  Allergie
                                </p>
                                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                                  Nessuna allergia nota.
                                </p>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPatientChartTab("base");
                              setIsPatientChartOpen(true);
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <FolderOpen className="h-4 w-4" />
                            Visualizza cartella completa
                          </button>
                        </TabsContent>
                        <TabsContent value="exam" currentValue={activeTab} className="mt-0">
                          <PhysicalExamTab
                            sessionId={effectiveSessionId}
                            patientPrompt={initialCaseData.patientPrompt}
                            caseId={initialCaseData.id}
                            onExamResult={handleExamFinding}
                          />
                        </TabsContent>
                        <TabsContent value="labs" currentValue={activeTab} className="mt-0">
                          <DiagnosticCategoryPanel
                            selectedExamIds={selectedExamIds}
                            onToggleExam={toggleExam}
                            caseExamValues={caseAdvancedExamValues}
                            examCatalog={examCatalog}
                            examMacroCatalog={examMacroCatalog}
                            macroFilter={["lab"]}
                          />
                        </TabsContent>
                        <TabsContent value="imaging" currentValue={activeTab} className="mt-0">
                          <DiagnosticCategoryPanel
                            selectedExamIds={selectedExamIds}
                            onToggleExam={toggleExam}
                            caseExamValues={caseAdvancedExamValues}
                            examCatalog={examCatalog}
                            examMacroCatalog={examMacroCatalog}
                            macroFilter={["img", "strum", "endo"]}
                          />
                        </TabsContent>
                        <TabsContent value="notes" currentValue={activeTab} className="mt-0">
                          <Textarea
                            rows={6}
                            value={sessionNotes}
                            onChange={(e) => setSessionNotes(e.target.value)}
                            placeholder="Appunti personali sulla sessione (non salvati nel referto)…"
                            className="rounded-xl border-slate-200 text-sm shadow-none focus:border-[#345884] focus:ring-2 focus:ring-[#345884]/20"
                          />
                        </TabsContent>
                      </Tabs>

                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <ExamReportRecap
                          exams={selectedExamsRecentFirst}
                          objectiveFindings={objectiveFindingsRecentFirst}
                          examCatalog={examCatalog}
                          caseExamValues={caseAdvancedExamValues}
                          examMacroCatalog={examMacroCatalog}
                        />
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Obiettivo del caso
                        </p>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">
                          {initialCaseData.description ||
                            "Gestisci il paziente in PS con appropriatezza clinica e medico-legale."}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}

            {!embedded ? (
              <>
            <div className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-panel-bg p-4 shadow-aequan-panel">
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-3.5 w-3.5 text-[#345884]" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Esami richiesti
                  </p>
                </div>
                {selectedExams.length > 0 ? (
                  <ul className="space-y-1.5 text-xs">
                    {selectedExamsRecentFirst.map((exam) => (
                      <li
                        key={exam.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-1.5"
                      >
                        <span className="min-w-0 truncate text-slate-800">{exam.name}</span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500">
                          €{exam.cost.toFixed(0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs leading-relaxed text-slate-500">
                    Nessun esame diagnostico richiesto.
                  </p>
                )}
              </section>

              <div className="rounded-xl border border-[#345884]/15 bg-slate-50 p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    <EuroIcon className="h-3.5 w-3.5 text-[#345884]" />
                    Costo SSN
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Budget rif. €{examBudgetEuro}
                  </span>
                </div>
                <p className="font-mono text-base font-semibold tracking-tight text-[#345884]">
                  Costo Appropriato: €{totalCost.toFixed(2)}
                </p>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-sm bg-white">
                  <div
                    className="h-full rounded-sm bg-[#345884] transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalCost / Math.max(1, examBudgetEuro)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  Tempo simulazione{" "}
                  <span className="font-semibold tabular-nums normal-case tracking-normal text-slate-700">
                    {formatElapsedClock(elapsedSeconds)}
                  </span>
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Stress paziente
                </p>
                <PatientStressBar value={patientStress} />
              </div>
            </div>

            <Card
              id="aequan-sim-conclusion"
              className="w-full min-w-0 overflow-x-hidden rounded-2xl border border-slate-100 bg-white shadow-md"
            >
              <CardHeader>
                <CardTitle className="font-display text-sm font-bold tracking-tight text-[#1E324E]">
                  Stilazione referto
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Compila il referto clinico strutturato, conferma la diagnosi e genera il report
                  finale.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {gameStatus === "playing" && (
                  <div className="space-y-4">
                    {diagnosisCheckError ? (
                      <div
                        role="alert"
                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
                      >
                        {diagnosisCheckError}
                      </div>
                    ) : null}
                    {isAdmin && debugTargetCondition && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
                        <span className="font-medium">Debug – patologia target (sessione):</span>{" "}
                        {debugTargetCondition}
                      </div>
                    )}

                    <ClinicalDischargeReportPanel
                      sections={reportSections}
                      onChange={setReportSections}
                      onConfirm={confirmDiagnosis}
                      confirmDisabled={!isClinicalReportComplete(reportSections)}
                      isAdminExtras={
                        isAdmin ? (
                          <>
                            <div className="rounded-2xl border border-zinc-200/80 bg-white px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                  <p className="text-[11px] font-medium text-zinc-800">
                                    Abilita Imprevisti AI (20% probabilità)
                                  </p>
                                  <p className="text-[11px] text-zinc-500">
                                    Se attivo, può comparire una complicazione improvvisa.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                                    enableAiSurprises
                                      ? "border-[#345884] bg-[#345884]"
                                      : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                                  }`}
                                  aria-pressed={enableAiSurprises}
                                >
                                  <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                                      enableAiSurprises ? "translate-x-5" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => setForceAiSurprise((v) => !v)}
                                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                                  forceAiSurprise
                                    ? "border-amber-200 bg-amber-50 text-amber-900"
                                    : "border-zinc-200/80 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                                }`}
                                title="Solo test: forza sempre l'imprevisto quando la diagnosi è corretta"
                              >
                                {forceAiSurprise ? "Forza imprevisto: ON" : "Forza imprevisto: OFF"}
                              </button>
                            </div>
                          </>
                        ) : undefined
                      }
                    />
                  </div>
                )}

                {gameStatus === "checking_diagnosis" && (
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 px-3 py-3 text-zinc-700">
                    <span className="inline-flex items-center gap-2">
                      <Activity className="h-4 w-4 animate-spin text-sky-600" />
                      Verifica diagnosi in corso...
                    </span>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Simulazione chiamata AI (2 secondi).
                    </p>
                  </div>
                )}

                {(gameStatus === "wrong_diagnosis" ||
                  gameStatus === "success" ||
                  gameStatus === "complication") && (
                  <div className="space-y-3">
                    {gameStatus === "wrong_diagnosis" && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
                        Diagnosi Errata. Il trattamento somministrato ha peggiorato il quadro.
                        {isAdmin && expectedConditionText && (
                          <div className="mt-2 text-[11px] text-rose-700">
                            <span className="font-medium">Patologia corretta:</span>{" "}
                            {expectedConditionText}
                          </div>
                        )}
                      </div>
                    )}
                    {gameStatus === "success" && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[#2F4156]">
                        Diagnosi Corretta! Il paziente è stato trattato con successo ed è in via di
                        dimissione.
                      </div>
                    )}
                    {gameStatus === "complication" && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                        Diagnosi Corretta, MA il paziente ha sviluppato una reazione allergica grave
                        e improvvisa!
                      </div>
                    )}

                    <div className="flex flex-col items-end gap-3">
                      {reportLoading ? (
                        <div className="w-full rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3">
                          <ReportGenerationProgress
                            progress={reportProgress}
                            message={reportProgressMessage}
                          />
                        </div>
                      ) : null}
                      {reportError ? (
                        <div className="w-full space-y-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          <p>{reportError}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => void generateReportAndNavigate()}
                            disabled={reportLoading}
                          >
                            Riprova
                          </Button>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-end gap-2">
                        {gameStatus === "complication" ? (
                          <Button
                            type="button"
                            size="md"
                            className="rounded-xl bg-gradient-to-r from-[#1E324E] to-[#345884] px-4 text-xs text-white shadow-sm transition-all duration-300 hover:opacity-95 hover:shadow-md"
                            onClick={async () => {
                              if (isStartingEmergency) return;
                              setIsStartingEmergency(true);
                              try {
                                const sid = await ensureSessionId();
                                if (!sid) return;

                                await fetch("/api/session/complication", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    sessionId: sid,
                                    caseId: initialCaseData.id,
                                    basePatientPrompt: initialCaseData.patientPrompt,
                                    complication: "anaphylaxis",
                                  }),
                                });

                                setDebugTargetCondition("Anafilassi / reazione allergica grave");
                                setFinalDiagnosis("");
                                setReportSections({
                                  anamnesisObjective: "",
                                  diagnosticFindings: "",
                                  diagnosisTreatment: "",
                                });
                                setGameStatus("playing");
                              } finally {
                                setIsStartingEmergency(false);
                              }
                            }}
                            disabled={isStartingEmergency}
                          >
                            {isStartingEmergency ? "Avvio emergenza..." : "Gestisci emergenza"}
                          </Button>
                        ) : gameStatus === "wrong_diagnosis" ? (
                          <>
                            <Button
                              type="button"
                              size="md"
                              variant="outline"
                              className="rounded-xl px-4 text-xs"
                              onClick={resumeAfterWrongDiagnosis}
                            >
                              Riprendi anamnesi / Correggi diagnosi
                            </Button>
                            <Button
                              type="button"
                              size="md"
                              className="rounded-xl bg-gradient-to-r from-[#1E324E] to-[#345884] px-4 text-xs text-white shadow-sm transition-all duration-300 hover:opacity-95 hover:shadow-md"
                              onClick={() => void generateReportAndNavigate()}
                              disabled={reportLoading}
                            >
                              {reportLoading ? "Generazione report..." : "Chiudi e vai al Report"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="md"
                            className="rounded-xl bg-gradient-to-r from-[#1E324E] to-[#345884] px-4 text-xs text-white shadow-sm transition-all duration-300 hover:opacity-95 hover:shadow-md"
                            onClick={() => void generateReportAndNavigate()}
                            disabled={reportLoading}
                          >
                            {reportLoading ? "Generazione report..." : "Vai al Report"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            ) : null}
          </div>
        </div>

        {embedded ? (
          <footer className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-sm">
            <nav
              className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1"
              aria-label="Risorse e documenti"
            >
              <Link
                href="/dashboard/guidelines"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#345884]"
              >
                <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                Linee guida correlate
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/terms"
                className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#345884]"
              >
                Termini di servizio
              </Link>
              <Link
                href="/privacy"
                className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#345884]"
              >
                Privacy Policy
              </Link>
              <Link
                href="/cookies"
                className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#345884]"
              >
                Cookie Policy
              </Link>
              <Link
                href="/ai-transparency"
                className="rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#345884]"
              >
                Trasparenza AI
              </Link>
            </nav>
            <button
              type="button"
              onClick={openHelpConsult}
              aria-label="Aiuto / Richiesta consulto"
              title="Aiuto / Richiesta consulto"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#345884]/25 bg-[#EEF2F9] px-2.5 py-1 text-[12px] font-medium text-[#345884] transition hover:bg-[#345884] hover:text-white"
            >
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
              Aiuto
            </button>
          </footer>
        ) : null}
      </div>

      <Dialog open={isDischargeOpen}>
        <DialogContent className="flex max-h-[min(90dvh,720px)] max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl">
          <div
            id="aequan-sim-conclusion"
            className="border-b border-slate-200 bg-white px-6 pb-1 pt-4"
          >
            <div className="flex items-start justify-between gap-3">
              <DialogHeader className="mb-0 min-w-0 space-y-0 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Documentazione clinica
                </p>
                <DialogTitle className="mt-0.5 text-base font-semibold text-slate-900">
                  Referto di dimissione
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Compila il referto clinico strutturato e conferma la diagnosi.
                </DialogDescription>
                {isAdmin && debugTargetCondition ? (
                  <p className="mt-2 border-l-2 border-slate-300 pl-2 text-[10px] italic leading-snug text-slate-500">
                    <span className="not-italic font-medium text-slate-600">
                      Debug · patologia target ·{" "}
                    </span>
                    {debugTargetCondition}
                  </p>
                ) : null}
              </DialogHeader>
              <button
                type="button"
                onClick={() => setIsDischargeOpen(false)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="scrollbar-aequan min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-5 pt-3 text-sm">
            {gameStatus === "playing" ? (
              <div className="space-y-4">
                {diagnosisCheckError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
                  >
                    {diagnosisCheckError}
                  </div>
                ) : null}
                <ClinicalDischargeReportPanel
                  sections={reportSections}
                  onChange={setReportSections}
                  onConfirm={confirmDiagnosis}
                  confirmDisabled={!isClinicalReportComplete(reportSections)}
                  isAdminExtras={
                    isAdmin ? (
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setForceAiSurprise((v) => !v)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium transition",
                            forceAiSurprise
                              ? "bg-slate-800 text-white"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
                          )}
                        >
                          {forceAiSurprise ? "Forza imprevisto: ON" : "Forza imprevisto: OFF"}
                        </button>
                      </div>
                    ) : undefined
                  }
                />
              </div>
            ) : null}

            {gameStatus === "checking_diagnosis" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <Activity className="h-4 w-4 animate-spin text-[#345884]" />
                  Verifica diagnosi in corso…
                </span>
              </div>
            ) : null}

            {gameStatus === "wrong_diagnosis" ||
            gameStatus === "success" ||
            gameStatus === "complication" ? (
              <div className="space-y-3">
                {gameStatus === "wrong_diagnosis" ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
                    Diagnosi errata. Il trattamento ha peggiorato il quadro.
                  </div>
                ) : null}
                {gameStatus === "success" ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-800">
                    Diagnosi corretta. Puoi generare il report finale.
                  </div>
                ) : null}
                {gameStatus === "complication" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                    Diagnosi corretta, ma è comparsa una complicazione improvvisa.
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
                  {gameStatus === "complication" ? (
                    <Button
                      type="button"
                      size="md"
                      className="rounded-xl bg-[#1E324E] px-4 text-sm text-white hover:bg-[#2A486D]"
                      onClick={async () => {
                        if (isStartingEmergency) return;
                        setIsStartingEmergency(true);
                        try {
                          const sid = await ensureSessionId();
                          if (!sid) return;
                          await fetch("/api/session/complication", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId: sid,
                              caseId: initialCaseData.id,
                              basePatientPrompt: initialCaseData.patientPrompt,
                              complication: "anaphylaxis",
                            }),
                          });
                          setDebugTargetCondition("Anafilassi / reazione allergica grave");
                          setFinalDiagnosis("");
                          setReportSections({
                            anamnesisObjective: "",
                            diagnosticFindings: "",
                            diagnosisTreatment: "",
                          });
                          setGameStatus("playing");
                        } finally {
                          setIsStartingEmergency(false);
                        }
                      }}
                      disabled={isStartingEmergency}
                    >
                      {isStartingEmergency ? "Avvio…" : "Gestisci emergenza"}
                    </Button>
                  ) : gameStatus === "wrong_diagnosis" ? (
                    <>
                      <Button
                        type="button"
                        size="md"
                        variant="outline"
                        className="rounded-xl px-4 text-sm"
                        onClick={resumeAfterWrongDiagnosis}
                      >
                        Riprendi anamnesi / Correggi diagnosi
                      </Button>
                      <Button
                        type="button"
                        size="md"
                        className="rounded-xl bg-[#1E324E] px-4 text-sm text-white hover:bg-[#2A486D]"
                        onClick={() => void generateReportAndNavigate()}
                        disabled={reportLoading}
                      >
                        {reportLoading ? "Generazione…" : "Chiudi e vai al Report"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="md"
                      className="rounded-xl bg-[#1E324E] px-4 text-sm text-white hover:bg-[#2A486D]"
                      onClick={() => void generateReportAndNavigate()}
                      disabled={reportLoading}
                    >
                      {reportLoading ? "Generazione…" : "Vai al Report"}
                    </Button>
                  )}
                </div>
                {reportError ? <p className="text-sm text-rose-700">{reportError}</p> : null}
                {reportLoading ? (
                  <ReportGenerationProgress
                    progress={reportProgress}
                    message={reportProgressMessage}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPatientChartOpen}>
        <DialogContent className="bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle>Cartella paziente</DialogTitle>
            <DialogDescription>
              Base: anagrafica e motivo di accesso. Referto: esame obiettivo di sessione ed esami diagnostici con valori dal caso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-zinc-100/70 p-1.5">
            <button
              type="button"
              onClick={() => setPatientChartTab("base")}
              className={
                "rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors " +
                (patientChartTab === "base"
                  ? "border-zinc-300 bg-white text-zinc-900 shadow-sm"
                  : "border-transparent text-zinc-600 hover:border-zinc-200/70 hover:bg-white/80")
              }
            >
              Base
            </button>
            <button
              type="button"
              onClick={() => setPatientChartTab("referto")}
              className={
                "rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-colors " +
                (patientChartTab === "referto"
                  ? "border-zinc-300 bg-white text-zinc-900 shadow-sm"
                  : "border-transparent text-zinc-600 hover:border-zinc-200/70 hover:bg-white/80")
              }
            >
              Referto
            </button>
          </div>

          <div className="space-y-4 text-xs min-h-[260px]">
            {patientChartTab === "base" ? (
              <>
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-zinc-700 mb-1">Dati anagrafici</p>
                  <p className="text-sm text-zinc-900">
                    {patient.age} anni – {patient.sex === "M" ? "Maschio" : "Femmina"}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">{patient.id}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-700">Sintomo principale</p>
                  <p className="text-sm text-zinc-900">{patient.mainComplaint}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-700">Contesto</p>
                  <p className="text-xs text-zinc-700 whitespace-pre-line">{patient.context}</p>
                </div>

              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-700">
                    Esame obiettivo (reperti di sessione)
                  </p>
                  {objectiveFindingsRecentFirst.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">
                      Nessun reperto di esame obiettivo ancora registrato.
                    </p>
                  ) : (
                    <ul className="scrollbar-aequan space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {objectiveFindingsRecentFirst.map((exam) => (
                        <li
                          key={exam.id}
                          className="rounded-2xl border border-zinc-200/80 bg-white px-3 py-1.5 text-xs"
                        >
                          <p className="font-medium text-zinc-800">{exam.label}</p>
                          <p className="text-zinc-700 mt-0.5">
                            {exam.finding}
                            {typeof exam.numericValue === "number" && (
                              <span className="ml-1 text-zinc-500">({exam.numericValue})</span>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1.5 border-t border-zinc-200/80 pt-3">
                  <p className="text-[11px] font-medium text-zinc-700">
                    Esami diagnostici richiesti (valori dal caso)
                  </p>
                  {selectedExams.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">
                      Nessun esame ancora richiesto in questa sessione.
                    </p>
                  ) : (
                    <ul className="scrollbar-aequan space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {selectedExamsRecentFirst.map((exam) => (
                        <li
                          key={exam.id}
                          className="rounded-xl border border-zinc-200/80 bg-white px-2.5 py-2 text-[11px]"
                        >
                          <p className="text-zinc-800 font-medium">{exam.name}</p>
                          <p className="text-zinc-600 mt-1 whitespace-pre-line">
                            {formatExamFinding(exam.id, examCatalog, caseAdvancedExamValues)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              size="sm"
              className="text-xs"
              onClick={() => setIsPatientChartOpen(false)}
            >
              Chiudi cartella
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!disclaimerAccepted}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Disclaimer medico-legale</DialogTitle>
            <DialogDescription>
              <p>
                Questa piattaforma è destinata esclusivamente a scopi formativi e di simulazione.
                Le decisioni proposte dall&apos;app, dai modelli di intelligenza artificiale o dai
                contenuti dei casi non sostituiscono in alcun modo il giudizio clinico,
                l&apos;esperienza professionale o le linee guida ufficiali in vigore.
              </p>
              <p className="mt-3">
                Non utilizzare Aequan per prendere decisioni reali su pazienti o situazioni cliniche.
                Qualsiasi uso improprio ricade interamente sotto la responsabilità dell&apos;utente.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-panel-bg px-3.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-ui-bg"
            >
              Torna al dashboard
            </Link>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-xl text-xs"
              onClick={() => {
                setDisclaimerAccepted(true);
                markUserActivity();
              }}
            >
              Accetto e desidero procedere
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHelpOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle>Aiuto / Richiesta consulto</DialogTitle>
            <DialogDescription>
              <p className="mb-3 text-sm leading-relaxed text-slate-600">
                Supporto disponibile su tua iniziativa. Questa richiesta viene registrata nella
                sessione ({helpRequestCount}{" "}
                {helpRequestCount === 1 ? "volta" : "volte"}) per il tracciamento dell&apos;autonomia
                clinica nel report — senza interrompere la simulazione.
              </p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-600">
                <li>Usa il dialogo per raccogliere l&apos;anamnesi ponendo domande aperte.</li>
                <li>
                  Consulta la <span className="font-medium text-slate-800">Cartella clinica</span> a
                  destra per anamnesi, esame obiettivo, esami e imaging.
                </li>
                <li>
                  I suggerimenti clinici non vengono proposti automaticamente: usa questo pulsante
                  Aiuto quando ti serve un consulto.
                </li>
                <li>Al termine, compila il referto di dimissione per chiudere il caso.</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                markUserActivity();
                setIsHelpOpen(false);
                setTutorialOpen(true);
              }}
            >
              Rivedi Tutorial
            </Button>
            <Button type="button" size="sm" onClick={() => setIsHelpOpen(false)}>
              Continua la simulazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OnboardingTutorialModal
        open={tutorialOpen}
        onComplete={() => {
          setTutorialOpen(false);
          markUserActivity();
        }}
      />
    </div>
  );
}

function getChatMessageText(message: ChatMessageLike): string {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof part.text === "string") return part.text;
        return "";
      })
      .join("");
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("");
  }
  return "";
}

type HistoryChatProps = {
  messages: {
    id: string;
    role: "user" | "assistant" | "system" | "function" | "data" | "tool";
    content?: string | Array<{ type?: string; text?: string } | string>;
    parts?: Array<{ type?: string; text?: string }>;
  }[];
  input: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  /** Streaming / network failure from useChat. */
  chatError?: Error | undefined;
  /** Re-send last message after stream failure. */
  onRetryChat?: () => void;
  /** Request informed consent module (user-initiated). */
  onRequestConsent?: () => void;
  consentRequested?: boolean;
  consentBusy?: boolean;
  /** Bound height for embedded Prassi grid — avoids fixed 460px blowing layout. */
  compact?: boolean;
  /** Stretch to fill the parent container height instead of a fixed px height. */
  fill?: boolean;
};

function HistoryChat({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  chatError,
  onRetryChat,
  onRequestConsent,
  consentRequested = false,
  consentBusy = false,
  compact = false,
  fill = false,
}: HistoryChatProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const messageText = (message: HistoryChatProps["messages"][number]): string => {
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      const text = message.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && typeof part.text === "string") return part.text;
          return "";
        })
        .join("");
      if (text.trim()) return text;
    }
    if (Array.isArray(message.parts)) {
      const text = message.parts
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text as string)
        .join("");
      if (text.trim()) return text;
    }
    return "";
  };

  const visibleMessages = messages.filter(
    (m) => m.role === "user" || m.role === "assistant",
  );

  const scrollAnchor = visibleMessages
    .map((message) => messageText(message))
    .join("\u0000");

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [scrollAnchor, isLoading]);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden",
        fill
          ? "h-full"
          : compact
            ? "h-[min(420px,52vh)] min-h-[280px] rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
            : "h-[460px] rounded-xl border border-slate-100 bg-white p-4 shadow-sm",
      )}
    >
      {!fill ? <AiTransparencyBadge variant="workspace" className="shrink-0" /> : null}
      <div
        ref={scrollRef}
        className="scrollbar-aequan min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden pr-1.5"
        onWheel={(event) => {
          // Some mouse wheels on Arc do not scroll nested containers reliably.
          if (!scrollRef.current) return;
          scrollRef.current.scrollTop += event.deltaY;
        }}
      >
        {visibleMessages.length === 0 && (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-2.5 px-6 py-8 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E4EAF3] text-[#345884]">
              <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Inizia l&apos;anamnesi
              </p>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500">
                Fai una domanda aperta al paziente. Esempio: &quot;Mi racconti cosa è successo da
                quando sono iniziati i sintomi?&quot;
              </p>
            </div>
            <p className="max-w-sm border-l-2 border-[#345884]/30 pl-2.5 text-left text-[11px] leading-relaxed text-slate-500">
              Oppure usa il pulsante <span className="font-medium text-slate-700">Modulo consenso</span>{" "}
              sotto, quando serve spiegare una procedura.
            </p>
          </div>
        )}
        {visibleMessages.map((message) => {
          const isDoctor = message.role === "user";
          const text = messageText(message);
          if (!text) return null;
          return (
            <div
              key={message.id}
              className={`flex ${isDoctor ? "justify-end" : "justify-start"}`}
            >
              {isDoctor ? (
                <div className="flex max-w-[78%] flex-col items-end gap-1">
                  <div className="rounded-2xl rounded-br-md bg-[#1E324E] p-4 text-sm font-medium leading-relaxed text-white shadow-sm">
                    {text}
                  </div>
                  <CheckCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="Inviato" />
                </div>
              ) : (
                <div className="flex max-w-[78%] items-end gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 ring-2 ring-white shadow-sm">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-800 shadow-sm">
                    {text}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isLoading ? (
          <div className="flex justify-start">
            <div className="flex max-w-[78%] items-end gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 ring-2 ring-white shadow-sm">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <SkeletonChatBubble />
            </div>
          </div>
        ) : null}
      </div>
      <form ref={formRef} onSubmit={onSubmit} className="mt-1 shrink-0 space-y-1.5">
        {chatError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900"
          >
            <p className="min-w-0 flex-1 leading-snug">
              Chat interrotta (timeout o rete). Puoi riprovare l&apos;ultimo invio.
            </p>
            {onRetryChat ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 border-rose-300 bg-white text-xs text-rose-900 hover:bg-rose-100"
                onClick={onRetryChat}
                disabled={isLoading}
              >
                Riprova invio
              </Button>
            ) : null}
          </div>
        ) : null}
        {onRequestConsent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestConsent}
              disabled={isLoading || consentBusy || consentRequested}
              aria-label="Richiesta Modulo Consenso Informato"
              title="Richiesta Modulo Consenso Informato"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                consentRequested
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-[#345884]/25 bg-[#EEF2F9] text-[#345884] hover:bg-[#345884] hover:text-white disabled:opacity-50",
              )}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
              {consentRequested ? "Consenso registrato" : "Modulo consenso"}
            </button>
            <span className="text-[10px] leading-snug text-slate-400">
              Spiega rischi/benefici e acquisisci il consenso prima di procedure invasive.
            </span>
          </div>
        ) : null}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 pl-3 transition focus-within:border-[#345884] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#345884]/20">
          <Textarea
            className="min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent p-1.5 text-xs text-slate-800 shadow-none outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
            rows={2}
            placeholder="Scrivi la prossima domanda al paziente…"
            value={input}
            onChange={onInputChange}
            onKeyDown={(event) =>
              handleTextareaEnterSubmit(event, {
                getValue: () => input,
                isDisabled: isLoading,
                onSubmit: () => formRef.current?.requestSubmit(),
              })
            }
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            aria-label="Invia domanda"
            className="mb-0.5 h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#1E324E] to-[#345884] text-white shadow-sm transition-all duration-300 hover:opacity-95 hover:shadow-md disabled:opacity-40"
          >
            {isLoading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ClinicalSimulationDisclaimer />
        <p className="px-1 text-[11px] text-slate-400">
          Invio per inviare · Shift+Invio per andare a capo · l&apos;IA risponde solo come paziente
        </p>
      </form>
    </div>
  );
}

function formatElapsedClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

