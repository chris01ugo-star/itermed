"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ban,
  Barcode,
  CheckCircle,
  FileSignature,
  GitMerge,
  Info,
  PhoneCall,
  TestTube,
} from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { cn } from "@/app/utils/cn";
import {
  classifyLabAction,
  labActionHint,
  labConsentRecorded,
  labRequestLooksExpensive,
  labSampleBadges,
  type LabActionTone,
  type LabFlowNode,
} from "@/lib/simulator/laboratory-lis";

type LaboratoryLisDashboardProps = {
  caseId: string;
  title: string;
  requestText: string;
  labFlow: LabFlowNode[];
  disabled?: boolean;
};

type TubeVisual = {
  label: string;
  tubeClass: string;
  clotted: boolean;
};

function readTubeVisual(sourceText: string): TubeVisual {
  const source = sourceText.toLowerCase();
  if (source.includes("emolis") || source.includes("rosso")) {
    return { label: "Siero emolitico", tubeClass: "text-red-800", clotted: source.includes("coagul") };
  }
  if (source.includes("itteric") || source.includes("giallo")) {
    return { label: "Siero itterico", tubeClass: "text-amber-400", clotted: source.includes("coagul") };
  }
  if (source.includes("coagul")) {
    return { label: "Campione coagulato", tubeClass: "text-sky-300", clotted: true };
  }
  return { label: "Campione idoneo", tubeClass: "text-emerald-400", clotted: false };
}

function SampleInspectionWidget({ sourceText }: { sourceText: string }) {
  const badges = labSampleBadges(sourceText);
  const tube = readTubeVisual(sourceText);
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#1E324E]">Ispezione campioni</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-slate-800/90 p-4 shadow-inner backdrop-blur-sm">
          <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.16em] text-slate-300">Rack provette</p>
          <div className="flex items-end justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              {tube.clotted ? (
                <AlertOctagon className="h-6 w-6 text-orange-400" aria-label="Campione coagulato" />
              ) : (
                <span className="h-6" />
              )}
              <TestTube size={48} className={tube.tubeClass} strokeWidth={1.5} aria-hidden />
              <p className="text-center text-[11px] font-medium text-slate-200">{tube.label}</p>
            </div>
            <TestTube size={48} className="text-sky-300/50" strokeWidth={1.5} aria-hidden />
            <TestTube size={48} className="text-emerald-400/40" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <Badge key={badge.label} className={badge.className}>
              {badge.label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceDashboard({ sourceText }: { sourceText: string }) {
  const expensive = labRequestLooksExpensive(sourceText);
  const consent = labConsentRecorded(sourceText);
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#1E324E]">Cruscotto economico e consensi</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-xl border px-3 py-3",
            expensive ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50",
          )}
        >
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <AlertTriangle className={cn("h-3.5 w-3.5", expensive ? "text-amber-700" : "text-slate-400")} />
            Tariffe
          </p>
          <p className={cn("mt-1 text-sm font-semibold", expensive ? "text-amber-900" : "text-slate-700")}>
            {expensive ? "Richiesta costosa in coda" : "Nessuna tariffa fuori soglia"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <FileSignature className={cn("h-3.5 w-3.5", consent ? "text-emerald-700" : "text-slate-400")} />
            Consenso L.219/2017
          </p>
          <p className={cn("mt-1 text-sm font-semibold", consent ? "text-emerald-800" : "text-slate-400 line-through")}>
            {consent ? "Consenso registrato" : "Consenso assente"}
          </p>
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
  labFlow,
  disabled = false,
}: LaboratoryLisDashboardProps) {
  const firstId = labFlow.find((node) => node.type === "decision")?.id ?? labFlow[0]?.id ?? "";
  const [nodeId, setNodeId] = useState(firstId);
  const [chosenIds, setChosenIds] = useState<string[]>([]);

  const node = useMemo(
    () => labFlow.find((item) => item.id === nodeId) ?? null,
    [labFlow, nodeId],
  );

  function handleOptionSelect(optionId: string) {
    const current = labFlow.find((item) => item.id === nodeId);
    const choice = current?.choices?.find((item) => item.id === optionId);
    if (!choice || disabled) return;
    setChosenIds((prev) => [...prev, optionId]);
    setNodeId(choice.next);
  }

  const terminalText = node?.prompt?.trim() || requestText;
  const sourceText = `${title}\n${requestText}\n${labFlow.map((item) => item.prompt).join("\n")}`;
  const sampleText = `${title}\n${requestText}`;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex gap-3 rounded-xl border border-blue-500 bg-blue-900/30 px-4 py-3 text-blue-50">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed">
          RUOLO: DIRETTORE DI LABORATORIO. 1. Leggi il quesito. 2. Ispeziona visivamente i campioni. 3.
          Valuta le tariffe. 4. Referta, rigetta la provetta o allerta il reparto in caso di emergenza
          (Panic Value).
        </p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
        <div className="flex h-full min-w-0 flex-col gap-6">
          <Card className="flex flex-1 flex-col rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#345884]/10 text-[#345884]">
                  <Barcode className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">
                    Tracciabilità campione
                  </p>
                  <CardTitle className="truncate text-base font-semibold text-[#1E324E]">{title}</CardTitle>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">{caseId}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
                Terminale LIS
              </p>
              <div className="min-h-[12rem] flex-1 rounded-md bg-slate-900 p-4 font-mono text-sm leading-relaxed text-green-400">
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-green-300/80">
                  RICHIESTA ELETTRONICA - QUESITO CLINICO
                </p>
                <p className="whitespace-pre-line">{terminalText}</p>
              </div>
            </CardContent>
          </Card>
          <ComplianceDashboard sourceText={sourceText} />
        </div>

        <div className="flex h-full min-w-0 flex-col gap-6">
          <SampleInspectionWidget sourceText={sampleText} />
          <Card className="flex flex-1 flex-col rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1E324E]">
                Banco da lavoro
              </CardTitle>
              {node ? (
                <p className="text-xs text-slate-500">
                  {node.title}
                  {chosenIds.length > 0 ? ` · ${chosenIds.length} scelte registrate` : ""}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Albero decisionale non disponibile per questo campione.</p>
              )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              {node?.type === "resolution" ? (
                <Badge variant={node.outcome === "positive" ? "success" : "danger"}>
                  {node.outcome === "positive" ? "Validazione conclusa" : "Percorso non conforme"}
                </Badge>
              ) : null}
              {node?.type === "decision"
                ? node.choices?.map((choice) => {
                    const tone = classifyLabAction(choice.label);
                    const Icon = ACTION_ICON[tone];
                    const hint = labActionHint(tone);
                    const critical = tone === "critical";
                    const affirmative = tone === "primary" || tone === "reflex";
                    return (
                      <Button
                        key={choice.id}
                        type="button"
                        variant={critical || affirmative ? "primary" : "outline"}
                        disabled={disabled}
                        onClick={() => handleOptionSelect(choice.id)}
                        className={cn(
                          "h-auto items-start justify-start whitespace-normal py-2.5 text-left",
                          critical && "!border-orange-600 !bg-orange-600 !text-white hover:!bg-orange-500",
                          affirmative && "!border-emerald-700 !bg-emerald-700 !text-white hover:!bg-emerald-600",
                          tone === "reject" && "!border-red-500 !text-red-700 hover:!bg-red-50",
                        )}
                      >
                        <Icon
                          className={cn("mt-0.5 h-4 w-4 shrink-0", critical && "animate-pulse")}
                          strokeWidth={1.75}
                        />
                        <span className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                            {hint}
                          </span>
                          <span className="block">{choice.label}</span>
                        </span>
                      </Button>
                    );
                  })
                : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
