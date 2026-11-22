import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  processSimulationReportJob,
  shouldResumeReportJob,
  type SimulationReportJobInput,
} from "@/lib/services/simulation-report-worker";

export { shouldResumeReportJob };

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
  physicalExams?: SimulationReportJobInput["physicalExams"];
  helpRequested?: boolean;
  helpRequestCount?: number;
  selectedOptions?: SimulationReportJobInput["selectedOptions"];
  caseData?: SimulationReportJobInput["caseData"];
};

const globalForScheduler = globalThis as unknown as {
  simulationReportJobs?: Map<string, Promise<void>>;
};

const activeJobs = globalForScheduler.simulationReportJobs ?? new Map<string, Promise<void>>();
globalForScheduler.simulationReportJobs = activeJobs;

export function buildJobQueueRawTrace(payload: JobQueuePayload) {
  return { jobQueue: payload };
}

export function scheduleSimulationReportJob(
  input: SimulationReportJobInput,
  options?: { reclaim?: boolean },
): Promise<void> {
  const existing = activeJobs.get(input.reportId);
  if (existing && !options?.reclaim) {
    schedulerLogger.info("Report job already running — skip duplicate schedule", {
      reportId: input.reportId,
      caseId: input.caseId,
    });
    return existing;
  }

  schedulerLogger.info("Scheduling simulation report job", {
    reportId: input.reportId,
    caseId: input.caseId,
    userId: input.userId,
  });

  let job!: Promise<void>;
  job = processSimulationReportJob(input)
    .catch((error) => {
      schedulerLogger.error("Unhandled simulation report job rejection", {
        reportId: input.reportId,
        error,
      });
    })
    .finally(() => {
      if (activeJobs.get(input.reportId) === job) {
        activeJobs.delete(input.reportId);
      }
      schedulerLogger.info("Simulation report job slot released", {
        reportId: input.reportId,
      });
    });

  activeJobs.set(input.reportId, job);
  return job;
}

/** Re-attach processing when background work was dropped (common in local Next.js dev). */
export async function ensureSimulationReportProcessing(
  reportId: string,
  userId: string,
): Promise<void> {
  const report = await prisma.sessionReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      userId: true,
      caseId: true,
      status: true,
      updatedAt: true,
      rawTrace: true,
    },
  });

  if (!report || report.userId !== userId) {
    return;
  }

  if (!shouldResumeReportJob(report.status, report.updatedAt)) {
    return;
  }

  // Same-isolate dedup only while the row is still PENDING. A stale PROCESSING
  // row must be reclaimable even if this process still holds a hung promise.
  if (report.status === "PENDING" && activeJobs.has(reportId)) {
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

  void scheduleSimulationReportJob(
    {
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
      physicalExams: queue.physicalExams,
      helpRequested: queue.helpRequested,
      helpRequestCount: queue.helpRequestCount,
      selectedOptions: queue.selectedOptions,
      caseData: queue.caseData,
    },
    { reclaim: report.status === "PROCESSING" },
  );
}

export function isSimulationReportJobActive(reportId: string): boolean {
  return activeJobs.has(reportId);
}
