import { prisma } from "@/lib/prisma";
import { OVERVIEW_RADAR_METRICS } from "@/lib/overview-queries";
import { normalizeTrentesimiScore } from "@/lib/scoring/trentesimi";
import { completedPerformanceSessionWhere } from "@/lib/session-report-performance";

export type ScoreTrendPoint = {
  sessionId: string;
  label: string;
  averageScore: number;
  clinicalAccuracy: number;
  legalCompliance: number;
  prescribingAppropriateness: number;
  economicSustainability: number;
  empathy: number;
};

export type ClinicalCoachInsight = {
  priorityArea: string;
  score: number;
  recommendation: string;
  focusTags: string[];
};

export type StatisticsPageData = {
  completedCount: number;
  trend: ScoreTrendPoint[];
  coachInsights: ClinicalCoachInsight[];
  overallAverages: Record<(typeof OVERVIEW_RADAR_METRICS)[number]["key"], number>;
};

const COACH_PLAYBOOK: Record<
  (typeof OVERVIEW_RADAR_METRICS)[number]["key"],
  { area: string; recommendation: string; tags: string[] }
> = {
  clinicalAccuracy: {
    area: "Accuratezza Clinica",
    recommendation:
      "Rivedi la raccolta anamnestica e la formulazione della diagnosi differenziale prima di chiudere il caso. Usa checklist per sintomi red flag.",
    tags: ["Anamnesi", "Diagnosi differenziale", "Protocolli clinici"],
  },
  legalComplianceGelliBianco: {
    area: "Tutela Medico-Legale",
    recommendation:
      "Documenta consenso informato, indicazioni di dimissione e follow-up. Allinea le decisioni al percorso Gelli-Bianco e alla cartella clinica.",
    tags: ["Consenso", "Documentazione", "Gelli-Bianco"],
  },
  prescribingAppropriateness: {
    area: "Appropriatezza Prescrittiva",
    recommendation:
      "Limita esami e terapie non necessarie: chiediti se ogni prescrizione modifica la gestione. Consulta linee guida prima di richiedere imaging avanzato.",
    tags: ["Esami", "Terapie", "Linee guida"],
  },
  economicSustainability: {
    area: "Sostenibilità Economica",
    recommendation:
      "Prioritizza percorsi diagnostici a basso impatto quando il rischio clinico è basso. Evita duplicazioni di esami già disponibili in cartella.",
    tags: ["Costi", "Percorsi diagnostici", "Efficienza"],
  },
  empathy: {
    area: "Empatia e Comunicazione",
    recommendation:
      "Usa domande aperte, riassumi quanto riferito dal paziente e verifica comprensione prima di proporre il piano terapeutico.",
    tags: ["Comunicazione", "Ascolto attivo", "Relazione medico-paziente"],
  },
};

function formatTrendLabel(date: Date, includeTime: boolean): string {
  const day = date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  if (!includeTime) return day;
  const time = date.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} ${time}`;
}

function buildCoachInsights(
  averages: Record<(typeof OVERVIEW_RADAR_METRICS)[number]["key"], number>,
): ClinicalCoachInsight[] {
  const ranked = OVERVIEW_RADAR_METRICS.map(({ key }) => ({
    key,
    score: averages[key] ?? 0,
    playbook: COACH_PLAYBOOK[key],
  })).sort((a, b) => a.score - b.score);

  return ranked.slice(0, 3).map((item) => ({
    priorityArea: item.playbook.area,
    score: Math.round(item.score),
    recommendation: item.playbook.recommendation,
    focusTags: item.playbook.tags,
  }));
}

export async function fetchStatisticsPageData(userId: string): Promise<StatisticsPageData> {
  const performanceWhere = completedPerformanceSessionWhere({ userId });

  const sessions = await prisma.sessionReport.findMany({
    where: performanceWhere,
    orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      totalScore: true,
      clinicalAccuracy: true,
      legalComplianceGelliBianco: true,
      prescribingAppropriateness: true,
      economicSustainability: true,
      empathy: true,
      completedAt: true,
      createdAt: true,
    },
    take: 24,
  });

  const aggregates = await prisma.sessionReport.aggregate({
    where: performanceWhere,
    _avg: {
      clinicalAccuracy: true,
      legalComplianceGelliBianco: true,
      prescribingAppropriateness: true,
      economicSustainability: true,
      empathy: true,
    },
  });

  const overallAverages = {
    clinicalAccuracy: Math.round(aggregates._avg.clinicalAccuracy ?? 0),
    legalComplianceGelliBianco: Math.round(aggregates._avg.legalComplianceGelliBianco ?? 0),
    prescribingAppropriateness: Math.round(aggregates._avg.prescribingAppropriateness ?? 0),
    economicSustainability: Math.round(aggregates._avg.economicSustainability ?? 0),
    empathy: Math.round(aggregates._avg.empathy ?? 0),
  };

  const sessionDates = sessions.map((session) => session.completedAt ?? session.createdAt);
  const dayCounts = new Map<string, number>();
  for (const date of sessionDates) {
    const key = date.toDateString();
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const trend: ScoreTrendPoint[] = sessions.map((session, index) => {
    const date = sessionDates[index] ?? new Date();
    const sameDayCount = dayCounts.get(date.toDateString()) ?? 1;
    return {
      sessionId: session.id,
      label: formatTrendLabel(date, sameDayCount > 1 || sessions.length > 8),
      averageScore: Math.round(normalizeTrentesimiScore(session.totalScore) ?? 0),
      clinicalAccuracy: Math.round(session.clinicalAccuracy ?? 0),
      legalCompliance: Math.round(session.legalComplianceGelliBianco ?? 0),
      prescribingAppropriateness: Math.round(session.prescribingAppropriateness ?? 0),
      economicSustainability: Math.round(session.economicSustainability ?? 0),
      empathy: Math.round(session.empathy ?? 0),
    };
  });

  return {
    completedCount: sessions.length,
    trend,
    coachInsights: buildCoachInsights(overallAverages),
    overallAverages,
  };
}
