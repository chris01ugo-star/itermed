import { getSessionUserId } from "@/lib/api-session";
import { toApiErrorResponse, ValidationError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { mapEconomicAuditToDTO } from "@/lib/mappers/economic-audit-mapper";
import { mapLegalAuditToDTO } from "@/lib/mappers/legal-audit-mapper";
import { prisma } from "@/lib/prisma";
import type { EconomicAuditResult } from "@/lib/services/economic-audit-service";
import type { LegalAuditResult } from "@/lib/services/legal-audit-service";
import { buildReportDataFromSession } from "@/lib/services/simulation-report-data";
import { ensureSimulationReportProcessing } from "@/lib/services/simulation-report-scheduler";

export const runtime = "nodejs";

function extractAuditFromRawTrace<T extends object>(
  rawTrace: unknown,
  key: "legalAudit" | "economicAudit",
): T | null {
  if (!rawTrace || typeof rawTrace !== "object") return null;
  const value = (rawTrace as Record<string, unknown>)[key];
  if (!value || typeof value !== "object") return null;
  return value as T;
}

export async function GET(request: Request) {
  const routeLogger = createLogger("simulation-report-status");

  try {
    const params = new URL(request.url).searchParams;
    const reportId = params.get("reportId") ?? params.get("sessionId");

    if (!reportId) {
      throw new ValidationError("reportId (or sessionId) query parameter is required.");
    }

    const userId = await getSessionUserId();
    if (!userId) {
      return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    await ensureSimulationReportProcessing(reportId, userId);

    const report = await prisma.sessionReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        userId: true,
        status: true,
        progress: true,
        progressMessage: true,
        notes: true,
        clinicalAccuracy: true,
        legalComplianceGelliBianco: true,
        prescribingAppropriateness: true,
        economicSustainability: true,
        empathy: true,
        totalScore: true,
        rawTrace: true,
      },
    });

    if (!report || report.userId !== userId) {
      routeLogger.info("Polling status — report not found or forbidden", { reportId, userId });
      return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    routeLogger.info("Polling status checked", {
      reportId,
      status: report.status,
      progress: report.progress,
      progressMessage: report.progressMessage,
    });

    const isCompleted = report.status === "COMPLETED";
    const legalReport = isCompleted
      ? mapLegalAuditToDTO(
          extractAuditFromRawTrace<LegalAuditResult>(report.rawTrace, "legalAudit"),
        )
      : null;
    const economicReport = isCompleted
      ? mapEconomicAuditToDTO(
          extractAuditFromRawTrace<EconomicAuditResult>(report.rawTrace, "economicAudit"),
        )
      : null;

    return Response.json({
      reportId: report.id,
      sessionId: report.id,
      status: report.status,
      progress: report.progress,
      progressMessage: report.progressMessage,
      ...(report.status === "FAILED" && typeof report.notes === "string" && report.notes
        ? { error: report.notes }
        : {}),
      reportData: isCompleted ? buildReportDataFromSession(report) : null,
      legalReport,
      economicReport,
    });
  } catch (error) {
    routeLogger.error("Report status lookup failed", { error });
    return toApiErrorResponse(error);
  }
}
