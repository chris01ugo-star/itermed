"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ban,
  CheckCircle,
  FileSignature,
  GitMerge,
  PhoneCall,
  TestTube,
} from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { cn } from "@/app/utils/cn";
import {
  classifyLabAction,
  isTerminalLabStep,
  labActionHint,
  labConsentRecorded,
  labRequestLooksExpensive,
  labSampleBadges,
  stepOptions,
  type LabActionTone,
  type LabFlowNode,
} from "@/lib/simulator/laboratory-lis";

type LaboratoryLisDashboardProps = {
  caseId: string;
  title: string;
  requestText: string;
  ward: string;
  labFlow: LabFlowNode[];
  disabled?: boolean;
  completing?: boolean;
  completeError?: string | null;
  onCompleteCase: () => void;
  onRecordOption?: (optionId: string) => void;
};

type TubeVisual = {
  label: string;
  liquidClass: string;
  clotted: boolean;
  warning: string | null;
};

const TUTORIAL_STEPS = [
  {
    title: "Pre-analitica",
    body: "Ispeziona sempre le provette nel rack. Cerca segni di emolisi, ittero o coaguli.",
  },
  {
    title: "Appropriatezza",
    body: "Controlla le tariffe e i consensi di legge sul terminale.",
  },
  {
    title: "Refertazione",
    body: "Usa il pannello azioni per validare, eseguire reflex test, o scartare il campione.",
  },
  {
    title: "Panic values",
    body: "In caso di valori critici, l'azione corretta è sempre allertare il reparto (pulsante telefono).",
  },
] as const;

function readTubeVisual(sourceText: string): TubeVisual {
  const source = sourceText.toLowerCase();
  const clotted = source.includes("coagul");
  if (source.includes("emolis") || source.includes("rosso")) {
    return {
      label: "Siero emolitico",
      liquidClass: "bg-red-700",
      clotted,
      warning: "EMOLISI",
    };
  }
  if (source.includes("itteric") || source.includes("giallo")) {
    return {
      label: "Siero itterico",
      liquidClass: "bg-amber-400",
      clotted,
      warning: "ITTERO",
    };
  }
  if (clotted) {
    return {
      label: "Campione coagulato",
      liquidClass: "bg-sky-700",
      clotted: true,
      warning: "COAGULO",
    };
  }
  return {
    label: "Campione idoneo",
    liquidClass: "bg-emerald-500",
    clotted: false,
    warning: null,
  };
}

function TubeGlyph({
  liquidClass,
  muted = false,
  warning,
}: {
  liquidClass: string;
  muted?: boolean;
  warning?: string | null;
}) {
  return (
    <div className={cn("flex w-16 flex-col items-center gap-1.5", muted && "opacity-40")}>
      {warning ? (
        <Badge className="border-transparent bg-red-600 px-1.5 py-0.5 text-[9px] text-white">
          {warning}
        </Badge>
      ) : (
        <span className="h-5" />
      )}
      <span className="relative flex h-14 w-10 items-end justify-center">
        <span className={cn("absolute bottom-1.5 h-8 w-4 rounded-b-full", liquidClass)} />
        <TestTube size={48} className="relative text-slate-100" strokeWidth={1.4} aria-hidden />
      </span>
    </div>
  );
}

function SampleRack({ sourceText }: { sourceText: string }) {
  const badges = labSampleBadges(sourceText);
  const tube = readTubeVisual(sourceText);
  return (
    <Card className="rounded-md border-slate-700 bg-slate-950 text-slate-100 shadow-sm">
      <CardHeader className="border-b border-slate-800 px-3 py-2">
        <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Rack provette
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-end justify-between gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-3">
          <TubeGlyph
            liquidClass={tube.liquidClass}
            warning={tube.warning ?? (tube.clotted ? "COAGULO" : null)}
          />
          <TubeGlyph liquidClass="bg-sky-800" muted />
          <TubeGlyph liquidClass="bg-emerald-800" muted />
          {tube.clotted ? <AlertOctagon className="mb-6 h-5 w-5 shrink-0 text-orange-400" /> : null}
        </div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-slate-400">{tube.label}</p>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <Badge key={badge.label} className={cn(badge.className, "font-mono text-[10px]")}>
              {badge.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DataTerminal({
  caseId,
  ward,
  stepTitle,
  question,
  sourceText,
}: {
  caseId: string;
  ward: string;
  stepTitle: string;
  question: string;
  sourceText: string;
}) {
  const expensive = labRequestLooksExpensive(sourceText);
  const consent = labConsentRecorded(sourceText);
  const rows = [
    { key: "ID CAMPIONE", value: caseId },
    { key: "REPARTO MITTENTE", value: ward },
    { key: "STEP LIS", value: stepTitle },
  ];
  return (
    <Card className="flex h-full flex-col rounded-md border-slate-700 bg-slate-950 text-slate-100 shadow-sm">
      <CardHeader className="border-b border-slate-800 px-3 py-2">
        <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
          Terminale LIS
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 bg-slate-900 p-3 font-mono text-slate-100">
        <dl className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px]">
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">{row.key}</dt>
              <dd className="truncate text-slate-100">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex-1 rounded-md border border-slate-700 bg-slate-950 p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Quesito clinico</p>
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-slate-100">{question}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className={cn("rounded border px-2 py-1.5", expensive ? "border-amber-400 text-amber-200" : "border-slate-700 text-slate-300")}>
            <AlertTriangle className="mb-1 h-3.5 w-3.5" />
            {expensive ? "Tariffa fuori soglia" : "Tariffa in soglia"}
          </div>
          <div className={cn("rounded border px-2 py-1.5", consent ? "border-emerald-400 text-emerald-200" : "border-slate-700 text-slate-400 line-through")}>
            <FileSignature className="mb-1 h-3.5 w-3.5" />
            Consenso L.219/2017
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ACTION_ICON: Record<LabActionTone, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  critical: PhoneCall,
  reject: Ban,
  primary: CheckCircle,
  reflex: GitMerge,
  neutral: Activity,
};

export function LaboratoryLisDashboard({
  caseId,
  title,
  requestText,
  ward,
  labFlow,
  disabled = false,
  completing = false,
  completeError = null,
  onCompleteCase,
  onRecordOption,
}: LaboratoryLisDashboardProps) {
  const [showTutorial, setShowTutorial] = useState(true);
  const firstId = labFlow.find((node) => node.type === "decision")?.id ?? labFlow[0]?.id ?? "";
  const [nodeId, setNodeId] = useState(firstId);
  const [chosenIds, setChosenIds] = useState<string[]>([]);

  const node = useMemo(
    () => labFlow.find((item) => item.id === nodeId) ?? null,
    [labFlow, nodeId],
  );
  const options = stepOptions(node);
  const isResolved = isTerminalLabStep(node);

  function handleOptionSelect(optionId: string) {
    const current = labFlow.find((item) => item.id === nodeId);
    const choice = stepOptions(current).find((item) => item.id === optionId);
    if (!choice || disabled || completing) return;
    setChosenIds((prev) => [...prev, optionId]);
    setNodeId(choice.next);
    onRecordOption?.(optionId);
  }

  const sourceText = `${title}\n${requestText}\n${labFlow.map((item) => item.prompt).join("\n")}`;
  const sampleText = `${title}\n${requestText}`;

  return (
    <>
      <Dialog open={showTutorial}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Guida al Modulo di Patologia Clinica</DialogTitle>
            <DialogDescription>
              Quattro controlli prima di accettare il campione e chiudere il referto.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3">
            {TUTORIAL_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[#1E324E] font-mono text-[11px] font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1E324E]">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <DialogFooter>
            <Button type="button" onClick={() => setShowTutorial(false)}>
              Ho capito, inizia il turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <DataTerminal
          caseId={caseId}
          ward={ward}
          stepTitle={node?.title ?? title}
          question={node?.prompt?.trim() || requestText}
          sourceText={sourceText}
        />

        <div className="flex min-w-0 flex-col gap-3">
          <SampleRack sourceText={sampleText} />
          <Card className="flex flex-1 flex-col rounded-md border-slate-300 bg-slate-100 shadow-sm">
            <CardHeader className="border-b border-slate-300 px-3 py-2">
              <CardTitle className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                Pannello di refertazione e validazione
              </CardTitle>
              <p className="font-mono text-[10px] text-slate-500">
                {chosenIds.length > 0 ? `${chosenIds.length} comandi eseguiti` : "In attesa del primo comando"}
              </p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2 p-3">
              {isResolved ? (
                <Button
                  type="button"
                  disabled={disabled || completing}
                  onClick={onCompleteCase}
                  className="h-14 w-full text-sm font-semibold uppercase tracking-wide"
                >
                  {completing ? "Preparazione del report..." : "VAI AL REPORT DI VALUTAZIONE FINALE"}
                </Button>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {options.map((option) => {
                    const tone = classifyLabAction(option.label);
                    const Icon = ACTION_ICON[tone];
                    const critical = tone === "critical";
                    const affirmative = tone === "primary" || tone === "reflex";
                    return (
                      <Button
                        key={option.id}
                        type="button"
                        variant={critical || affirmative ? "primary" : "outline"}
                        disabled={disabled || completing}
                        onClick={() => handleOptionSelect(option.id)}
                        className={cn(
                          "h-auto items-center justify-start gap-2 whitespace-normal rounded-md px-2.5 py-2 text-left text-[12px]",
                          critical && "!border-orange-600 !bg-orange-600 !text-white hover:!bg-orange-500",
                          affirmative && "!border-[#1E324E] !bg-[#1E324E] !text-white hover:!bg-[#345884]",
                          tone === "reject" && "!border-red-600 !bg-white !text-red-700 hover:!bg-red-50",
                        )}
                      >
                        <Icon
                          className={cn("h-4 w-4 shrink-0", critical && "animate-pulse")}
                          strokeWidth={1.75}
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-[9px] font-semibold uppercase tracking-wide opacity-80">
                            {labActionHint(tone)}
                          </span>
                          <span className="block leading-snug">{option.label}</span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
              {completeError ? (
                <p className="text-xs text-red-700" role="alert">
                  {completeError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
