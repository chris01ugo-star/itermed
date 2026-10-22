"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Barcode,
  FileSignature,
  PhoneCall,
  TestTube2,
} from "lucide-react";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/ui/card";
import { cn } from "@/app/utils/cn";
import {
  classifyLabAction,
  labConsentRecorded,
  labRequestLooksExpensive,
  labSampleBadges,
  type LabFlowNode,
} from "@/lib/simulator/laboratory-lis";

type LaboratoryLisDashboardProps = {
  caseId: string;
  title: string;
  requestText: string;
  labFlow: LabFlowNode[];
  disabled?: boolean;
};

function SampleInspectionWidget({ sourceText }: { sourceText: string }) {
  const badges = labSampleBadges(sourceText);
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#1E324E]">
          <TestTube2 className="h-4 w-4 text-[#345884]" strokeWidth={1.75} />
          Accettazione provette
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3" aria-hidden>
          <TestTube2 className="h-8 w-8 text-red-500" strokeWidth={1.5} />
          <TestTube2 className="h-10 w-10 text-yellow-500" strokeWidth={1.5} />
          <TestTube2 className="h-8 w-8 text-emerald-600" strokeWidth={1.5} />
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge
        variant={expensive ? "warning" : "default"}
        className={cn(expensive && "border-amber-300 bg-amber-100 text-amber-900")}
      >
        <AlertTriangle className={cn("mr-1 h-3 w-3", expensive ? "text-amber-700" : "text-slate-400")} />
        {expensive ? "Richiesta costosa" : "Costo in soglia"}
      </Badge>
      <Badge variant={consent ? "success" : "default"} className={cn(!consent && "text-slate-400 line-through")}>
        <FileSignature className={cn("mr-1 h-3 w-3", consent ? "text-emerald-700" : "text-slate-400")} />
        Consenso L.219/2017
      </Badge>
    </div>
  );
}

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

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.7fr)]">
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm lg:col-start-1">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
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
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">
              Richiesta elettronica - quesito clinico
            </p>
            <ComplianceDashboard sourceText={sourceText} />
          </div>
          <div className="rounded-md bg-slate-900 p-4 font-mono text-sm leading-relaxed text-green-400">
            <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-green-300/80">
              RICHIESTA ELETTRONICA - QUESITO CLINICO
            </p>
            <p className="whitespace-pre-line">{terminalText}</p>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-start-2 lg:row-span-2">
        <SampleInspectionWidget sourceText={`${title}\n${requestText}`} />
      </div>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm lg:col-start-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1E324E]">
            Pannello di refertazione e validazione
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
        <CardContent className="flex flex-col gap-2">
          {node?.type === "resolution" ? (
            <Badge variant={node.outcome === "positive" ? "success" : "danger"}>
              {node.outcome === "positive" ? "Validazione conclusa" : "Percorso non conforme"}
            </Badge>
          ) : null}
          {node?.type === "decision"
            ? node.choices?.map((choice) => {
                const tone = classifyLabAction(choice.label);
                if (tone === "critical") {
                  return (
                    <Button
                      key={choice.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleOptionSelect(choice.id)}
                      className="h-auto justify-start whitespace-normal !border-orange-600 !bg-orange-600 py-2.5 text-left !text-white hover:!bg-orange-500"
                    >
                      <PhoneCall className="h-4 w-4 shrink-0 animate-pulse" />
                      {choice.label}
                    </Button>
                  );
                }
                if (tone === "reject") {
                  return (
                    <Button
                      key={choice.id}
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => handleOptionSelect(choice.id)}
                      className="h-auto justify-start whitespace-normal !border-red-500 py-2.5 text-left !text-red-700 hover:!bg-red-50"
                    >
                      {choice.label}
                    </Button>
                  );
                }
                if (tone === "primary") {
                  return (
                    <Button
                      key={choice.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleOptionSelect(choice.id)}
                      className="h-auto justify-start whitespace-normal !border-emerald-700 !bg-emerald-700 py-2.5 text-left !text-white hover:!bg-emerald-600"
                    >
                      {choice.label}
                    </Button>
                  );
                }
                return (
                  <Button
                    key={choice.id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    onClick={() => handleOptionSelect(choice.id)}
                    className="h-auto justify-start whitespace-normal py-2.5 text-left"
                  >
                    {choice.label}
                  </Button>
                );
              })
            : null}
        </CardContent>
      </Card>
    </div>
  );
}
