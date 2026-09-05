"use client";

import { useEffect, useState } from "react";
import { EliteResultsClient } from "./EliteResultsClient";
import { readOfflineReportCache } from "@/lib/reports/offline-report-cache";
import type { EliteReportData } from "@/lib/services/simulation-report-data";
import type {
  ClinicalDeltaRow,
  CoachingFeedback,
  EconomicAnalysis,
  LegalProtectionStatus,
} from "@/lib/services/evaluation-report-types";

type OfflineResultsGateProps = {
  caseId: string;
  sessionId: string;
  caseTitle?: string;
  correctSolution?: string;
  legalSources?: string[];
};

function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function eliteToClientProps(
  data: EliteReportData,
  extras: { caseTitle?: string; sessionId?: string; correctSolution?: string; legalSources?: string[] },
) {
  const radarData = [
    {
      metric: "Accuratezza clinica",
      key: "clinicalAccuracy",
      score: safeNum(data.scores.clinical),
    },
    {
      metric: "Tutela medico-legale",
      key: "legalComplianceGelliBianco",
      score: safeNum(data.scores.legal),
    },
    {
      metric: "Appropriatezza esami",
      key: "prescribingAppropriateness",
      score: safeNum(data.scores.exams),
    },
    {
      metric: "Sostenibilità economica",
      key: "economicSustainability",
      score: safeNum(data.scores.economy),
    },
    {
      metric: "Comunicazione",
      key: "empathy",
      score: safeNum(data.scores.empathy),
    },
  ];

  return {
    totalScore: safeNum(data.totalScore),
    radarData,
    caseTitle: extras.caseTitle,
    sessionId: extras.sessionId || data.sessionId,
    strengths: Array.isArray(data.feedback?.strengths) ? data.feedback.strengths : [],
    weaknesses: Array.isArray(data.feedback?.weaknesses) ? data.feedback.weaknesses : [],
    correctSolution: extras.correctSolution || data.feedback?.correctSolution,
    legalProtectionStatus: data.legalProtectionStatus as LegalProtectionStatus | undefined,
    clinicalDeltaTable: (Array.isArray(data.clinicalDeltaTable)
      ? data.clinicalDeltaTable
      : []) as ClinicalDeltaRow[],
    economicAnalysis: data.economicAnalysis as EconomicAnalysis | undefined,
    coachingFeedback: data.coachingFeedback as CoachingFeedback | undefined,
    legalSources:
      extras.legalSources && extras.legalSources.length > 0
        ? extras.legalSources
        : Array.isArray(data.evidence?.legalSources)
          ? data.evidence.legalSources
          : [],
    empathyBreakdown: data.empathyBreakdown ?? data.scoreBreakdown?.empathy ?? null,
    scoreBreakdown: data.scoreBreakdown ?? null,
  };
}

export function OfflineResultsGate({
  caseId,
  sessionId,
  caseTitle,
  correctSolution,
  legalSources,
}: OfflineResultsGateProps) {
  const [data, setData] = useState<EliteReportData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const cached = readOfflineReportCache(sessionId);
    if (cached) {
      setData(cached);
      return;
    }

    if (!sessionId || sessionId.startsWith("local-")) {
      setFailed(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `/api/simulation/report/status?reportId=${encodeURIComponent(sessionId)}`,
        );
        const payload = (await res.json().catch(() => null)) as {
          status?: string;
          reportData?: EliteReportData | null;
        } | null;
        if (cancelled) return;
        if (res.ok && payload?.status === "COMPLETED" && payload.reportData) {
          setData(payload.reportData);
          return;
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setFailed(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!data && !failed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-600 shadow-sm">
        Caricamento report di fine simulazione…
      </div>
    );
  }

  if (!data) {
    const fallback: EliteReportData = {
      sessionId: sessionId || `local-${caseId}`,
      scores: { clinical: 0, legal: 0, exams: 0, empathy: 0, economy: 0 },
      totalScore: 0,
      feedback: {
        strengths: [],
        weaknesses: [
          "Report non trovato sul database remoto. Mostrata la scheda locale del caso (registry).",
        ],
        clinicalNote: "Punteggi non disponibili: sessione non persistita su Prisma.",
        legalComplianceNote:
          "Scudo L. 24/2017 Art. 5: riferimento alle linee guida del caso in knowledge base.",
        prescribingNote: "Appropriatezza prescrittiva non calcolata in assenza di sessione remota.",
        empathyNote: "Audit D-RIME non disponibile offline senza snapshot locale.",
        economyNote: "Sostenibilità economica non calcolata in assenza di sessione remota.",
        correctSolution: correctSolution ?? "",
      },
      evidence: { legalSources: legalSources ?? [], protocolSources: [] },
    };
    const props = eliteToClientProps(fallback, {
      caseTitle: caseTitle || caseId,
      sessionId,
      correctSolution,
      legalSources,
    });
    return <EliteResultsClient {...props} />;
  }

  const props = eliteToClientProps(data, {
    caseTitle: caseTitle || caseId,
    sessionId,
    correctSolution,
    legalSources,
  });
  return <EliteResultsClient {...props} />;
}
