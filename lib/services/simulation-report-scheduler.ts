import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  processSimulationReportJob,
  type SimulationReportJobInput,
} from "@/lib/services/simulation-report-worker";

const schedulerLogger = createLogger("simulation-report-scheduler");

type JobQueuePayload = {
  evaluationChatHistory: SimulationReportJobInput["evaluationChatHistory"];
  exams: SimulationReportJobInput["exams"];
  normalizedReportText: string;
  caseContext?: string;
  finalDiagnosis?: string;
  liveSessionId?: string;
  requestedExamIds?: string[];
  executedActionIds?: string[];
  helpRequested?: boolean;
  helpRequestCount?: number;
};

const globalForScheduler = globalThis as unknown as {
  simulationReportJobs?: Map<string, Promise<void>>;
};

const activeJobs = globalForScheduler.simulationReportJobs ?? new Map<string, Promise<void>>();
globalForScheduler.simulationReportJobs = activeJobs;

export function buildJobQueueRawTrace(payload: JobQueuePayload) {
  return { jobQueue: payload };
}

export function scheduleSimulationReportJob(input: SimulationReportJobInput): void {
  if (activeJobs.has(input.reportId)) {
    schedulerLogger.info("Report job already running — skip duplicate schedule", {
      reportId: input.reportId,
      caseId: input.caseId,
    });
    return;
  }

  schedulerLogger.info("Scheduling simulation report job", {
    reportId: input.reportId,
    caseId: input.caseId,
    userId: input.userId,
  });

  const job = processSimulationReportJob(input)
    .catch((error) => {
      schedulerLogger.error("Unhandled simulation report job rejection", {
        reportId: input.reportId,
        error,
      });
    })
    .finally(() => {
      activeJobs.delete(input.reportId);
      schedulerLogger.info("Simulation report job slot released", {
        reportId: input.reportId,
      });
    });

  activeJobs.set(input.reportId, job);
}

/** Re-attach processing when background work was dropped (common in local Next.js dev). */
export async function ensureSimulationReportProcessing(
  reportId: string,
  userId: string,
): Promise<void> {
  if (activeJobs.has(reportId)) {
    return;
  }

  const report = await prisma.sessionReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      userId: true,
      caseId: true,
      status: true,
      rawTrace: true,
    },
  });

  if (!report || report.userId !== userId) {
    return;
  }

  if (report.status === "COMPLETED" || report.status === "FAILED") {
    return;
  }

  const queue = (report.rawTrace as { jobQueue?: JobQueuePayload } | null)?.jobQueue;
  if (!queue) {
    schedulerLogger.warn("Cannot kick report job — missing jobQueue payload", { reportId });
    return;
  }

  schedulerLogger.info("Kicking simulation report job from status poll", {
    reportId,
    status: report.status,
  });

  scheduleSimulationReportJob({
    reportId: report.id,
    userId: report.userId,
    caseId: report.caseId,
    liveSessionId: queue.liveSessionId,
    evaluationChatHistory: queue.evaluationChatHistory,
    exams: queue.exams,
    normalizedReportText: queue.normalizedReportText,
    caseContext: queue.caseContext,
    finalDiagnosis: queue.finalDiagnosis,
    requestedExamIds: queue.requestedExamIds,
    executedActionIds: queue.executedActionIds,
    helpRequested: queue.helpRequested,
    helpRequestCount: queue.helpRequestCount,
  });
}

export function isSimulationReportJobActive(reportId: string): boolean {
  return activeJobs.has(reportId);
}
