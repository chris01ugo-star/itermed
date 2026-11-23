"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Activity,
  Clock3,
  Droplets,
  FlaskConical,
  Loader2,
  Microscope,
  PenLine,
  Phone,
  Send,
  TestTube2,
} from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import { cn } from "@/app/utils/cn";
import { filterLabConversationByTarget } from "@/lib/simulator/laboratory-workbench";
import type {
  ClientLabAnalyte,
  ClientLabBlueprint,
  ClientLabDelta,
  LabDisposition,
  LabInterlocutor,
  LabInvestigationTarget,
  LabNotifyChannel,
  LabWorkbenchClientBundle,
  LabWorkbenchState,
} from "@/lib/simulator/laboratory-workbench";
import { LAB_VALIDATION_NOTE_MIN_CHARS } from "@/lib/simulator/laboratory-workbench";
import { HilPhotometricBars, LabTraceVisualView, LeveyJenningsChart } from "@/components/simulator/LabVisualDiagnostics";

type LaboratoryWorkbenchProps = {
  bundle: LabWorkbenchClientBundle;
  ensureSessionId: () => Promise<string | null>;
  disabled?: boolean;
  completing?: boolean;
  completeError?: string | null;
  onSigned: () => void;
};

type ConsoleTab = "bench" | "line" | "sign";

const PRIORITY_LABEL = {
  PS_URGENZA: "Urgenza PS",
  REPARTO: "Reparto",
  AMBULATORIO: "Ambulatorio",
} as const;

const FLAG_LABEL = {
  NORMAL: "Nei limiti",
  HIGH: "Alto",
  LOW: "Basso",
  CRITICAL_HIGH: "Critico alto",
  CRITICAL_LOW: "Critico basso",
} as const;

const REASONS = [
  ["EMOLISI", "Emolisi"],
  ["LIPEMIA", "Lipemia"],
  ["ITTERO", "Ittero"],
  ["COAGULO", "Coagulo"],
  ["MATRICE_ERRATA", "Matrice errata"],
  ["RIEMPIMENTO", "Riempimento"],
  ["WBIT", "WBIT"],
  ["INTERFERENZA_BIOTINA", "Interferenza da biotina"],
  ["CQI_WESTGARD", "CQI Westgard"],
  ["POCT_DISCORDANTE", "POCT discordante"],
  ["CONFERMA_PENDENTE", "Conferma pendente"],
  ["INCOMPATIBILITA_TRASFUSIONALE", "Incompatibilità trasfusionale"],
  ["INTERFERENZA_FARMACO", "Interferenza da farmaco"],
  ["ALTRO", "Altro"],
] as const;

const CHANNELS: Array<[Exclude<LabNotifyChannel, "NONE">, string]> = [
  ["PHONE", "Telefono (sincrono)"],
  ["FAX", "Fax"],
  ["EMAIL", "Email / Portale"],
  ["VOICEMAIL", "Segreteria telefonica"],
];

const PILLS: Array<{ id: LabInvestigationTarget; label: string; icon: typeof TestTube2 }> = [
  { id: "sampleInspection", label: "Provetta", icon: TestTube2 },
  { id: "hilIndices", label: "Indici HIL", icon: Droplets },
  { id: "deltaCheck", label: "Delta Check", icon: Clock3 },
  { id: "qcStatus", label: "CQI Linea", icon: Activity },
  { id: "morphologyOrTrace", label: "Morfologia / Tracciati", icon: Microscope },
];

const TSLB_CHIPS = [
  "Com'è la provetta in accettazione?",
  "Mi descrivi aspetto, riempimento e centrifugazione?",
  "La linea analitica è operativa?",
];

const CLINICIAN_CHIPS = [
  "Mi conferma paziente e reparto richiedente?",
  "Ci sono farmaci o integratori rilevanti?",
  "Qual è il quadro clinico in questo momento?",
];

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

function money(value: number): string {
  return euro.format(value);
}

function isDeltaOpen(
  delta: ClientLabDelta,
): delta is Extract<ClientLabDelta, { previousValue: string }> {
  return delta.hasHistory && "previousValue" in delta;
}

function gateUnlocked(blueprint: ClientLabBlueprint, target: LabInvestigationTarget): boolean {
  if (target === "deltaCheck") return blueprint.investigations.deltaCheck.unlocked;
  return blueprint.investigations[target].unlocked;
}

function actionErrorMessage(status: number, code: string | undefined, fallback: string): string {
  if (status === 503 || code === "LAB_SCHEMA_PENDING") {
    return "Il salvataggio del banco non è ancora attivo su questo ambiente.";
  }
  if (code === "LAB_ALREADY_SIGNED") return "Il referto è già firmato.";
  return fallback;
}

export function LaboratoryWorkbench({
  bundle,
  ensureSessionId,
  disabled = false,
  completing = false,
  completeError = null,
  onSigned,
}: LaboratoryWorkbenchProps) {
  const [blueprint, setBlueprint] = useState(bundle.blueprint);
  const [state, setState] = useState<LabWorkbenchState>(bundle.state);
  const [openId, setOpenId] = useState<LabInvestigationTarget | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ConsoleTab>("bench");
  const [lineTarget, setLineTarget] = useState<LabInterlocutor>("tslb");
  const [draft, setDraft] = useState("");
  const [chatPending, setChatPending] = useState(false);
  const [readBackHint, setReadBackHint] = useState(false);
  const [note, setNote] = useState(bundle.state.validationNote);
  const [highlightGaps, setHighlightGaps] = useState(false);
  const [channel, setChannel] = useState<Exclude<LabNotifyChannel, "NONE">>(
    bundle.state.criticalNotification?.channel === "FAX" ||
      bundle.state.criticalNotification?.channel === "EMAIL" ||
      bundle.state.criticalNotification?.channel === "VOICEMAIL"
      ? bundle.state.criticalNotification.channel
      : "PHONE",
  );
  const [recipient, setRecipient] = useState(bundle.state.criticalNotification?.recipientName ?? "");
  const [readBackConfirmed, setReadBackConfirmed] = useState(
    bundle.state.criticalNotification?.readBackConfirmed ?? false,
  );
  const [now, setNow] = useState(() => Date.now());
  const signRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const locked = disabled || Boolean(state.signedAtIso) || completing;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const thread = useMemo(
    () => filterLabConversationByTarget(state.interprofessionalLog, lineTarget),
    [state.interprofessionalLog, lineTarget],
  );

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [thread, chatPending, lineTarget]);

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - Date.parse(bundle.startedAtIso)) / 60_000),
  );
  const slaRatio = blueprint.slaMinutes > 0 ? elapsedMinutes / blueprint.slaMinutes : 0;
  const slaTone =
    slaRatio >= 1
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : slaRatio >= 0.75
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-border bg-slate-50 text-text-secondary";

  const missingIds = blueprint.analytes.filter((analyte) => !state.dispositions[analyte.id]).map((analyte) => analyte.id);
  const noteReady = note.trim().length >= LAB_VALIDATION_NOTE_MIN_CHARS;
  const canSign = missingIds.length === 0 && noteReady && !state.signedAtIso;
  const orderedReflexes = blueprint.reflexCatalog.filter((reflex) => reflex.ordered);

  async function postAction(body: Record<string, unknown>, key: string) {
    setError(null);
    setPending(key);
    try {
      const sessionId = await ensureSessionId();
      if (!sessionId) throw new Error("Sessione non disponibile. Ricarica il caso.");
      const response = await fetch("/api/session/lab-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, sessionId }),
      });
      const data = (await response.json().catch(() => null)) as {
        state?: LabWorkbenchState;
        blueprint?: ClientLabBlueprint;
        readyForReport?: boolean;
        error?: string;
        code?: string;
      } | null;
      if (!response.ok || !data?.state || !data.blueprint) {
        throw new Error(
          actionErrorMessage(response.status, data?.code, data?.error ?? "Operazione non riuscita."),
        );
      }
      setState(data.state);
      setBlueprint(data.blueprint);
      return data;
    } finally {
      setPending(null);
    }
  }

  async function inspect(target: LabInvestigationTarget) {
    if (locked) return;
    if (gateUnlocked(blueprint, target)) {
      setOpenId((current) => (current === target ? null : target));
      return;
    }
    try {
      await postAction({ action: "INSPECT", target }, `inspect:${target}`);
      setOpenId(target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Indagine non disponibile.");
    }
  }

  async function setDisposition(analyteId: string, disposition: LabDisposition, reasonCode?: string) {
    if (locked) return;
    try {
      await postAction(
        {
          action: "SET_DISPOSITION",
          analyteId,
          disposition,
          ...(reasonCode ? { reasonCode } : {}),
        },
        `disposition:${analyteId}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Disposizione non registrata.");
    }
  }

  async function orderReflex(reflexId: string) {
    if (locked) return;
    try {
      await postAction({ action: "ORDER_REFLEX", reflexId }, `reflex:${reflexId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reflex non eseguito.");
    }
  }

  async function registerNotification() {
    if (locked) return;
    try {
      await postAction(
        {
          action: "LOG_CRITICAL_NOTIFICATION",
          channel,
          ...(recipient.trim() ? { recipientName: recipient.trim() } : {}),
          readBackConfirmed,
        },
        "notify",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifica non registrata.");
    }
  }

  async function signReport() {
    if (locked) return;
    setTab("sign");
    if (!canSign) {
      setHighlightGaps(true);
      signRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    try {
      const data = await postAction({ action: "SIGN_REPORT", validationNote: note }, "sign");
      if (data?.readyForReport) onSigned();
    } catch (cause) {
      setHighlightGaps(true);
      setError(cause instanceof Error ? cause.message : "Firma non riuscita.");
    }
  }

  async function sendLine(text: string) {
    const message = text.trim();
    if (!message || locked || chatPending) return;
    setError(null);
    setChatPending(true);
    setDraft("");
    try {
      const sessionId = await ensureSessionId();
      if (!sessionId) throw new Error("Sessione non disponibile. Ricarica il caso.");
      const response = await fetch("/api/session/lab-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, target: lineTarget, message }),
      });
      const data = (await response.json().catch(() => null)) as {
        interprofessionalLog?: LabWorkbenchState["interprofessionalLog"];
        readBackDetected?: boolean;
        error?: string;
        code?: string;
      } | null;
      if (!response.ok || !data?.interprofessionalLog) {
        throw new Error(actionErrorMessage(response.status, data?.code, data?.error ?? "Linea interna non disponibile."));
      }
      setState((current) => ({ ...current, interprofessionalLog: data.interprofessionalLog ?? current.interprofessionalLog }));
      if (data.readBackDetected) setReadBackHint(true);
    } catch (cause) {
      setDraft(message);
      setError(cause instanceof Error ? cause.message : "Linea interna non disponibile.");
    } finally {
      setChatPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 text-text-primary">
      <header className="rounded-aequan-lg border border-border bg-panel-bg px-4 py-3 shadow-aequan-panel sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-base font-semibold tracking-tight text-brand-primary">
                {blueprint.accessionNumber}
              </p>
              <Badge variant="info">{blueprint.ward}</Badge>
              <Badge variant={blueprint.priority === "PS_URGENZA" ? "danger" : blueprint.priority === "REPARTO" ? "info" : "default"}>
                {PRIORITY_LABEL[blueprint.priority]}
              </Badge>
              <span className="text-xs text-text-secondary">
                {blueprint.patientDemographics.age} anni · {blueprint.patientDemographics.sex}
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-text-primary">{blueprint.clinicalOrderSummary}</p>
            <p className="text-xs text-text-secondary">{blueprint.patientDemographics.wardContext}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className={cn("rounded-aequan border px-3 py-2 text-xs", slaTone)}>
              <span className="block text-[10px] font-semibold uppercase tracking-wide">SLA</span>
              <span className="tabular-nums text-sm font-semibold">
                {elapsedMinutes} / {blueprint.slaMinutes} min
              </span>
            </div>
            <div className="rounded-aequan border border-border bg-slate-50 px-3 py-2 text-xs text-text-secondary">
              <span className="block text-[10px] font-semibold uppercase tracking-wide">Reflex SSN</span>
              <span className={cn("tabular-nums text-sm font-semibold", state.reflexSpendEuro > blueprint.budgetEuro ? "text-amber-900" : "text-brand-primary")}>
                {money(state.reflexSpendEuro)}
                <span className="font-medium text-text-secondary"> / {money(blueprint.budgetEuro)}</span>
              </span>
            </div>
            <Button size="sm" disabled={locked && !completing} onClick={() => void signReport()}>
              {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
              {state.signedAtIso ? "Referto firmato" : "Firma & Chiudi Referto"}
            </Button>
          </div>
        </div>
      </header>

      {error || completeError ? (
        <p role="alert" className="rounded-aequan border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error ?? completeError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-aequan-lg border border-border bg-panel-bg p-3 shadow-aequan-panel sm:p-4">
            <div className="flex flex-wrap gap-2">
              {PILLS.filter((pill) => pill.id !== "morphologyOrTrace" || blueprint.investigations.morphologyOrTrace.available).map((pill) => {
                const Icon = pill.icon;
                const unlocked = gateUnlocked(blueprint, pill.id);
                const active = openId === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    disabled={locked || pending === `inspect:${pill.id}`}
                    aria-pressed={active}
                    onClick={() => void inspect(pill.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "border-brand-secondary bg-[#EAF1FB] text-brand-primary"
                        : "border-border bg-white text-text-secondary hover:border-brand-secondary/40 hover:text-brand-primary",
                    )}
                  >
                    {pending === `inspect:${pill.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
                    {pill.label}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", unlocked ? "bg-white text-brand-secondary" : "bg-slate-100 text-text-secondary")}>
                      {unlocked ? "Aperto" : "Da aprire"}
                    </span>
                  </button>
                );
              })}
            </div>
            {openId ? <InvestigationPanel blueprint={blueprint} target={openId} /> : null}
          </div>

          <div className="overflow-hidden rounded-aequan-lg border border-border bg-panel-bg shadow-aequan-panel">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="font-display text-sm font-semibold">Foglio di validazione</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Analita</th>
                    <th className="px-3 py-2 font-semibold">Risultato e range</th>
                    <th className="px-3 py-2 font-semibold">Flag</th>
                    <th className="px-3 py-2 font-semibold">Delta check</th>
                    <th className="px-3 py-2 font-semibold">Disposizione</th>
                  </tr>
                </thead>
                <tbody>
                  {blueprint.analytes.map((analyte) => (
                    <AnalyteRow
                      key={analyte.id}
                      analyte={analyte}
                      disposition={state.dispositions[analyte.id]}
                      locked={locked}
                      pending={pending === `disposition:${analyte.id}`}
                      onDisposition={(disposition, reasonCode) => void setDisposition(analyte.id, disposition, reasonCode)}
                      onOpenDelta={() => void inspect("deltaCheck")}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {orderedReflexes.length > 0 ? (
            <div className="rounded-aequan-lg border border-border bg-panel-bg p-4 shadow-aequan-panel">
              <h2 className="font-display text-sm font-semibold">Reflex e conferme eseguiti</h2>
              <ul className="mt-3 space-y-3">
                {orderedReflexes.map((reflex) => (
                  <li key={reflex.id} className="rounded-aequan border border-border-subtle bg-slate-50 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{reflex.name}</p>
                      <span className="tabular-nums text-xs text-text-secondary">{money(reflex.costEuro)}</span>
                    </div>
                    {reflex.resultSummary ? <p className="mt-1 text-sm leading-relaxed text-text-primary">{reflex.resultSummary}</p> : null}
                    {reflex.resultAnalytes && reflex.resultAnalytes.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {reflex.resultAnalytes.map((analyte) => (
                          <li key={analyte.id} className="tabular-nums text-xs text-text-secondary">
                            {analyte.name}: {analyte.value} {analyte.unit}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <aside className="min-w-0 rounded-aequan-lg border border-border bg-panel-bg shadow-aequan-panel">
          <div className="flex border-b border-border">
            {(
              [
                ["bench", "Banco & Reflex"],
                ["line", "Linea Interna"],
                ["sign", "Notifica & Firma"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 px-2 py-3 text-xs font-semibold sm:text-sm",
                  tab === id ? "border-b-2 border-brand-primary text-brand-primary" : "text-text-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {tab === "bench" ? (
              <BenchTab
                blueprint={blueprint}
                locked={locked}
                pending={pending}
                onOrder={(id) => void orderReflex(id)}
              />
            ) : null}
            {tab === "line" ? (
              <LineTab
                target={lineTarget}
                thread={thread}
                draft={draft}
                pending={chatPending}
                locked={locked}
                readBackHint={readBackHint}
                chatRef={chatRef}
                onTarget={(next) => {
                  setLineTarget(next);
                  setDraft("");
                }}
                onDraft={setDraft}
                onSend={(text) => void sendLine(text)}
                onOpenSign={() => setTab("sign")}
              />
            ) : null}
            {tab === "sign" ? (
              <SignTab
                signRef={signRef}
                note={note}
                noteReady={noteReady}
                missingCount={missingIds.length}
                totalAnalytes={blueprint.analytes.length}
                highlightGaps={highlightGaps}
                notification={state.criticalNotification}
                channel={channel}
                recipient={recipient}
                readBackConfirmed={readBackConfirmed}
                locked={locked}
                pending={pending}
                canSign={canSign}
                onNote={setNote}
                onChannel={setChannel}
                onRecipient={setRecipient}
                onReadBack={setReadBackConfirmed}
                onNotify={() => void registerNotification()}
                onSign={() => void signReport()}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function AnalyteRow({
  analyte,
  disposition,
  locked,
  pending,
  onDisposition,
  onOpenDelta,
}: {
  analyte: ClientLabAnalyte;
  disposition: LabWorkbenchState["dispositions"][string] | undefined;
  locked: boolean;
  pending: boolean;
  onDisposition: (disposition: LabDisposition, reasonCode?: string) => void;
  onOpenDelta: () => void;
}) {
  const critical = analyte.flag === "CRITICAL_HIGH" || analyte.flag === "CRITICAL_LOW";
  const needsReason = disposition?.action === "SUPPRESS" || disposition?.action === "HOLD";
  return (
    <tr className={cn("border-t border-border-subtle align-top", critical && "bg-rose-50/60")}>
      <td className="px-3 py-3 font-medium">{analyte.name}</td>
      <td className="px-3 py-3">
        <p className={cn("tabular-nums font-semibold", critical ? "text-status-risk" : analyte.flag === "HIGH" || analyte.flag === "LOW" ? "text-amber-900" : "text-text-primary")}>
          {analyte.value} <span className="font-medium text-text-secondary">{analyte.unit}</span>
        </p>
        <p className="tabular-nums text-xs text-text-secondary">{analyte.refRange}</p>
      </td>
      <td className="px-3 py-3">
        <Badge variant={critical ? "danger" : analyte.flag === "NORMAL" ? "default" : "warning"}>{FLAG_LABEL[analyte.flag]}</Badge>
        <div className="mt-1 flex flex-wrap gap-1">
          {analyte.instrumentFlags.map((flag) => (
            <span key={flag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-text-secondary">
              {flag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3 text-xs">
        {!analyte.deltaCheck.hasHistory ? (
          <span className="text-text-secondary">Nessun precedente</span>
        ) : isDeltaOpen(analyte.deltaCheck) ? (
          <div className="tabular-nums text-text-primary">
            <p>{analyte.deltaCheck.previousValue}</p>
            <p className="text-text-secondary">{analyte.deltaCheck.previousDate}</p>
            <p className={analyte.deltaCheck.deltaFlag ? "text-amber-900" : "text-text-secondary"}>
              {analyte.deltaCheck.deltaPercent > 0 ? "+" : ""}
              {analyte.deltaCheck.deltaPercent.toLocaleString("it-IT")}%
            </p>
          </div>
        ) : (
          <button type="button" disabled={locked} onClick={onOpenDelta} className="font-medium text-brand-secondary hover:underline disabled:opacity-50">
            Apri delta
          </button>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["VALIDATE", "Valida"],
              ["SUPPRESS", "Sopprimi"],
              ["HOLD", "Sospendi"],
            ] as const
          ).map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={locked || pending}
              onClick={() => onDisposition(action, action === "VALIDATE" ? undefined : disposition?.reasonCode)}
              className={cn(
                "rounded-lg border px-2 py-1 text-[11px] font-semibold",
                disposition?.action === action
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-border bg-white text-text-secondary hover:border-brand-secondary/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {needsReason ? (
          <label className="mt-2 block text-[11px] text-text-secondary">
            Codice motivo
            <select
              className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-text-primary"
              disabled={locked || pending}
              value={disposition?.reasonCode ?? ""}
              onChange={(event) => {
                if (!disposition) return;
                onDisposition(disposition.action, event.target.value || undefined);
              }}
            >
              <option value="">Seleziona</option>
              {REASONS.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </td>
    </tr>
  );
}

function InvestigationPanel({ blueprint, target }: { blueprint: ClientLabBlueprint; target: LabInvestigationTarget }) {
  return (
    <div className="mt-3 rounded-aequan border border-border-subtle bg-slate-50 p-3 text-sm">
      {target === "sampleInspection" ? <SampleBody gate={blueprint.investigations.sampleInspection} /> : null}
      {target === "hilIndices" ? (
        <HilBody gate={blueprint.investigations.hilIndices} analytes={blueprint.analytes} />
      ) : null}
      {target === "qcStatus" ? <QcBody gate={blueprint.investigations.qcStatus} /> : null}
      {target === "morphologyOrTrace" ? <MorphBody gate={blueprint.investigations.morphologyOrTrace} /> : null}
      {target === "deltaCheck" ? <DeltaBody blueprint={blueprint} /> : null}
    </div>
  );
}

function SampleBody({ gate }: { gate: ClientLabBlueprint["investigations"]["sampleInspection"] }) {
  if (!gate.unlocked) return <p className="text-text-secondary">Provetta non ancora aperta.</p>;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      <Fact label="Provetta" value={gate.tubeType} />
      <Fact label="Riempimento" value={fillLabel(gate.fillLevel)} />
      <Fact label="Coagulo" value={clotLabel(gate.clotCheck)} />
      <Fact label="Etichetta" value={labelIntegrity(gate.labelIntegrity)} />
      <Fact label="Prelievo → accettazione" value={`${gate.collectionToReceiptMin} min`} />
      <Fact label="Nota" value={gate.visualNote} />
    </dl>
  );
}

function HilBody({
  gate,
  analytes,
}: {
  gate: ClientLabBlueprint["investigations"]["hilIndices"];
  analytes: ClientLabAnalyte[];
}) {
  if (!gate.unlocked) return <p className="text-text-secondary">Indici HIL non ancora aperti.</p>;
  const names = gate.affectedAnalytes.map(
    (token) => analytes.find((analyte) => analyte.id === token)?.name ?? token,
  );
  return (
    <div className="space-y-2">
      <HilPhotometricBars
        hemolysis={gate.hemolysisIndex}
        icterus={gate.icterusIndex}
        lipemia={gate.lipemiaIndex}
      />
      <p className="text-text-secondary">{gate.wavelengthNote}</p>
      <p className="text-xs text-text-secondary">
        Analiti interessati: {names.length > 0 ? names.join(", ") : "nessuno"}
      </p>
    </div>
  );
}

function QcBody({ gate }: { gate: ClientLabBlueprint["investigations"]["qcStatus"] }) {
  if (!gate.unlocked) return <p className="text-text-secondary">CQI non ancora aperto.</p>;
  return (
    <div className="space-y-2">
      <p className="font-medium">{gate.analyzerLine}</p>
      <p className="text-text-secondary">{gate.status === "IN_CONTROL" ? "In controllo" : "Carta da interpretare"}</p>
      <p>{gate.summary}</p>
      {gate.leveyJennings ? <LeveyJenningsChart chart={gate.leveyJennings} /> : null}
    </div>
  );
}

function MorphBody({ gate }: { gate: ClientLabBlueprint["investigations"]["morphologyOrTrace"] }) {
  if (!gate.available) return <p className="text-text-secondary">Nessun tracciato su questo campione.</p>;
  if (!gate.unlocked) return <p className="text-text-secondary">Tracciato non ancora aperto.</p>;
  return (
    <div className="space-y-2">
      <p className="font-medium">{gate.title}</p>
      <p className="text-text-secondary">{kindLabel(gate.kind)}</p>
      {gate.visual ? <LabTraceVisualView visual={gate.visual} /> : null}
      <p className="leading-relaxed">{gate.findings}</p>
      {gate.keyMetrics ? (
        <ul className="mt-2 space-y-1">
          {Object.entries(gate.keyMetrics).map(([key, value]) => (
            <li key={key} className="tabular-nums text-xs text-text-secondary">
              {key}: {value}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeltaBody({ blueprint }: { blueprint: ClientLabBlueprint }) {
  if (!blueprint.investigations.deltaCheck.unlocked) {
    return <p className="text-text-secondary">Delta check non ancora aperto.</p>;
  }
  const rows = blueprint.analytes.filter((analyte) => isDeltaOpen(analyte.deltaCheck));
  if (rows.length === 0) return <p className="text-text-secondary">Nessun precedente associato a questi analiti.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((analyte) =>
        isDeltaOpen(analyte.deltaCheck) ? (
          <li key={analyte.id} className="tabular-nums">
            <span className="font-medium">{analyte.name}</span>
            <span className="text-text-secondary">
              {" "}
              · precedente {analyte.deltaCheck.previousValue} ({analyte.deltaCheck.previousDate}) ·{" "}
              {analyte.deltaCheck.deltaPercent > 0 ? "+" : ""}
              {analyte.deltaCheck.deltaPercent.toLocaleString("it-IT")}%
            </span>
          </li>
        ) : null,
      )}
    </ul>
  );
}

function BenchTab({
  blueprint,
  locked,
  pending,
  onOrder,
}: {
  blueprint: ClientLabBlueprint;
  locked: boolean;
  pending: string | null;
  onOrder: (id: string) => void;
}) {
  const checks: Array<[string, boolean]> = [
    ["Provetta", blueprint.investigations.sampleInspection.unlocked],
    ["Indici HIL", blueprint.investigations.hilIndices.unlocked],
    ["Delta check", blueprint.investigations.deltaCheck.unlocked],
    ["CQI linea", blueprint.investigations.qcStatus.unlocked],
  ];
  if (blueprint.investigations.morphologyOrTrace.available) {
    checks.push(["Morfologia / tracciati", blueprint.investigations.morphologyOrTrace.unlocked]);
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Indagini</h3>
        <ul className="mt-2 space-y-1">
          {checks.map(([label, done]) => (
            <li key={label} className="flex items-center justify-between text-sm">
              <span>{label}</span>
              <span className={done ? "text-brand-secondary" : "text-text-secondary"}>{done ? "Eseguita" : "Da eseguire"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Test reflex e conferma</h3>
        <ul className="mt-2 space-y-2">
          {blueprint.reflexCatalog.length === 0 ? <li className="text-sm text-text-secondary">Nessun reflex in catalogo.</li> : null}
          {blueprint.reflexCatalog.map((reflex) => (
            <li key={reflex.id} className="rounded-aequan border border-border px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{reflex.name}</p>
                  <p className="text-xs text-text-secondary">{reflex.category}</p>
                </div>
                <span className="tabular-nums text-xs font-semibold text-brand-primary">{money(reflex.costEuro)}</span>
              </div>
              {reflex.ordered ? (
                <div className="mt-2">
                  <Badge variant="info">Eseguito</Badge>
                  {reflex.resultSummary ? <p className="mt-2 text-sm leading-relaxed">{reflex.resultSummary}</p> : null}
                </div>
              ) : (
                <Button className="mt-2" size="sm" variant="secondary" disabled={locked || pending === `reflex:${reflex.id}`} onClick={() => onOrder(reflex.id)}>
                  {pending === `reflex:${reflex.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                  Ordina
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LineTab({
  target,
  thread,
  draft,
  pending,
  locked,
  readBackHint,
  chatRef,
  onTarget,
  onDraft,
  onSend,
  onOpenSign,
}: {
  target: LabInterlocutor;
  thread: LabWorkbenchState["interprofessionalLog"];
  draft: string;
  pending: boolean;
  locked: boolean;
  readBackHint: boolean;
  chatRef: RefObject<HTMLDivElement | null>;
  onTarget: (target: LabInterlocutor) => void;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
  onOpenSign: () => void;
}) {
  const chips = target === "tslb" ? TSLB_CHIPS : CLINICIAN_CHIPS;
  const counterpart = target === "tslb" ? "TSLB di banco" : "Medico reparto / PS";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-aequan bg-slate-100 p-1 text-xs font-semibold">
        {(
          [
            ["tslb", "TSLB di Banco"],
            ["clinician", "Medico Reparto / PS"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTarget(id)}
            className={cn("rounded-lg px-2 py-2", target === id ? "bg-white text-brand-primary shadow-clinical" : "text-text-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={chatRef} className="flex h-72 flex-col gap-2 overflow-y-auto rounded-aequan bg-ui-bg p-3">
        {thread.length === 0 ? (
          <p className="text-sm text-text-secondary">Nessun messaggio con {counterpart}. I due thread restano separati.</p>
        ) : null}
        {thread.map((row, index) => {
          const mine = row.role === "user";
          return (
            <div key={`${row.createdAtIso}-${index}`} className={cn("max-w-[90%] rounded-aequan px-3 py-2 text-sm leading-relaxed", mine ? "self-end bg-brand-primary text-white" : "self-start border border-border bg-white text-text-primary")}>
              {!mine ? <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{counterpart}</p> : null}
              {row.content}
            </div>
          );
        })}
        {pending ? <p className="text-xs text-text-secondary">{counterpart} sta scrivendo…</p> : null}
      </div>
      {readBackHint && target === "clinician" ? (
        <button type="button" onClick={onOpenSign} className="rounded-aequan border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs leading-relaxed text-amber-950">
          Read-back rilevato in chiamata: se ritieni il valore critico, formalizza la notifica nel tab Notifica & Firma.
        </button>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button key={chip} type="button" disabled={locked || pending} onClick={() => onSend(chip)} className="rounded-full border border-border bg-white px-2.5 py-1 text-left text-[11px] text-text-secondary hover:border-brand-secondary/40 hover:text-brand-primary disabled:opacity-50">
            {chip}
          </button>
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
        }}
      >
        <textarea
          value={draft}
          disabled={locked || pending}
          rows={2}
          maxLength={1000}
          placeholder={`Messaggio a ${counterpart}`}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend(draft);
            }
          }}
          className="min-h-16 flex-1 resize-none rounded-aequan border border-border px-3 py-2 text-sm outline-none focus:border-brand-secondary"
        />
        <Button type="submit" size="icon" disabled={locked || pending || draft.trim().length === 0} aria-label="Invia">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function SignTab({
  signRef,
  note,
  noteReady,
  missingCount,
  totalAnalytes,
  highlightGaps,
  notification,
  channel,
  recipient,
  readBackConfirmed,
  locked,
  pending,
  canSign,
  onNote,
  onChannel,
  onRecipient,
  onReadBack,
  onNotify,
  onSign,
}: {
  signRef: RefObject<HTMLDivElement | null>;
  note: string;
  noteReady: boolean;
  missingCount: number;
  totalAnalytes: number;
  highlightGaps: boolean;
  notification: LabWorkbenchState["criticalNotification"];
  channel: Exclude<LabNotifyChannel, "NONE">;
  recipient: string;
  readBackConfirmed: boolean;
  locked: boolean;
  pending: string | null;
  canSign: boolean;
  onNote: (value: string) => void;
  onChannel: (value: Exclude<LabNotifyChannel, "NONE">) => void;
  onRecipient: (value: string) => void;
  onReadBack: (value: boolean) => void;
  onNotify: () => void;
  onSign: () => void;
}) {
  const notified = Boolean(notification?.sent && notification.channel !== "NONE");
  return (
    <div className="space-y-4">
      <section className="rounded-aequan border border-border p-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-brand-secondary" />
          <h3 className="text-sm font-semibold">Notifica valore critico</h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Opzionale, a tua discrezione. Non è un suggerimento: registrala solo se decidi di comunicare un valore.
        </p>
        <label className="mt-3 block text-xs text-text-secondary">
          Canale
          <select className="mt-1 w-full rounded-lg border border-border bg-white px-2 py-2 text-sm text-text-primary" disabled={locked} value={channel} onChange={(event) => onChannel(event.target.value as Exclude<LabNotifyChannel, "NONE">)}>
            {CHANNELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-xs text-text-secondary">
          Destinatario
          <input className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm text-text-primary" disabled={locked} value={recipient} maxLength={120} placeholder="Medico di reparto o PS" onChange={(event) => onRecipient(event.target.value)} />
        </label>
        <label className="mt-2 flex items-center gap-2 text-xs text-text-primary">
          <input type="checkbox" disabled={locked} checked={readBackConfirmed} onChange={(event) => onReadBack(event.target.checked)} />
          Read-back confermato dal ricevente
        </label>
        <Button className="mt-3" size="sm" variant="secondary" disabled={locked || pending === "notify"} onClick={onNotify}>
          {pending === "notify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Registra notifica
        </Button>
        {notified && notification ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-2 py-2 text-xs leading-relaxed text-text-secondary">
            Ricevuta: {channelLabel(notification.channel)}
            {notification.recipientName ? ` · ${notification.recipientName}` : ""}
            {notification.notifiedAtIso ? ` · ${new Date(notification.notifiedAtIso).toLocaleString("it-IT")}` : ""}
            {typeof notification.elapsedMinutes === "number" ? ` · ${notification.elapsedMinutes} min dall'accettazione` : ""}
            {notification.readBackConfirmed ? " · read-back confermato" : ""}. Puoi aggiornarla prima della firma.
          </p>
        ) : null}
      </section>

      <section ref={signRef} id="lab-sign-panel" className="rounded-aequan border border-border p-3">
        <h3 className="text-sm font-semibold">Firma e nota interpretativa</h3>
        <label className="mt-2 block text-xs text-text-secondary">
          Commento di validazione al clinico
          <textarea
            value={note}
            disabled={locked}
            rows={5}
            maxLength={4000}
            onChange={(event) => onNote(event.target.value)}
            className={cn(
              "mt-1 w-full resize-y rounded-lg border px-2 py-2 text-sm text-text-primary outline-none",
              highlightGaps && !noteReady ? "border-rose-300 bg-rose-50" : "border-border",
            )}
          />
        </label>
        <p className={cn("mt-1 tabular-nums text-[11px]", noteReady ? "text-text-secondary" : "text-amber-900")}>
          {note.trim().length} / {LAB_VALIDATION_NOTE_MIN_CHARS} caratteri minimi
        </p>
        <ul className="mt-3 space-y-1 text-xs">
          <li className={cn("rounded-lg px-2 py-1", highlightGaps && missingCount > 0 ? "bg-rose-50 text-rose-800" : "text-text-secondary")}>
            Disposizioni: {totalAnalytes - missingCount}/{totalAnalytes}
          </li>
          <li className={cn("rounded-lg px-2 py-1", highlightGaps && !noteReady ? "bg-rose-50 text-rose-800" : "text-text-secondary")}>
            Nota interpretativa {noteReady ? "completa" : "ancora corta"}
          </li>
          <li className="rounded-lg px-2 py-1 text-text-secondary">
            Notifica critica: {notified ? "registrata" : "non registrata"} · non obbligatoria in questo pannello
          </li>
        </ul>
        <Button className="mt-3 w-full" disabled={locked || pending === "sign"} onClick={onSign}>
          {pending === "sign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
          {canSign ? "Firma e genera il referto" : "Controlla cosa manca"}
        </Button>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}

function fillLabel(value: string): string {
  if (value === "ADEQUATE") return "Adeguato";
  if (value === "UNDERFILLED") return "Sotto il segno";
  if (value === "OVERFILLED") return "Sopra il segno";
  if (value === "EMPTY") return "Vuota";
  return value;
}

function clotLabel(value: string): string {
  if (value === "ABSENT") return "Assente";
  if (value === "PRESENT") return "Presente";
  if (value === "NOT_ASSESSED") return "Non valutato";
  return value;
}

function labelIntegrity(value: string): string {
  if (value === "INTACT") return "Integra";
  if (value === "MISMATCH") return "Non corrispondente";
  if (value === "MISSING") return "Assente";
  return value;
}

function kindLabel(value: string): string {
  if (value === "SMEAR") return "Striscio";
  if (value === "ELECTROPHORESIS") return "Elettroforesi";
  if (value === "SCATTERGRAM") return "Scattergram";
  if (value === "MIXING") return "Mixing study";
  return value;
}

function channelLabel(value: string): string {
  return CHANNELS.find((channel) => channel[0] === value)?.[1] ?? value;
}
