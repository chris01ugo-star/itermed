import type { AnalyticalEvaluation } from "@/lib/services/evaluation-service";
import type { ExamPayload } from "@/lib/services/evaluation-service";
import type { SessionMilestoneSnapshot } from "@/lib/simulator/milestone-tracker";
import {
  examMatchesCanonical,
  normalizeExamText,
  resolveCanonicalExam,
} from "@/lib/simulator/exam-canonical-registry";

function examIsPrescribed(
  examNameOrKey: string,
  prescribed: ExamPayload[],
  milestones: SessionMilestoneSnapshot[],
): boolean {
  const norm = normalizeExamText(examNameOrKey);

  for (const e of prescribed) {
    const canon = resolveCanonicalExam(e.id, e.name);
    if (canon && examMatchesCanonical(examNameOrKey, canon)) return true;
    const eName = normalizeExamText(e.name);
    const eId = normalizeExamText(e.id);
    if (eName.includes(norm) || norm.includes(eName)) return true;
    if (eId.includes(norm) || norm.includes(eId)) return true;
  }

  for (const m of milestones) {
    if (m.category !== "exam") continue;
    const evidence = normalizeExamText(m.evidence ?? m.label);
    if (norm.length >= 3 && (evidence.includes(norm) || norm.includes(evidence))) {
      return true;
    }
    const canon = resolveCanonicalExam(m.evidence ?? m.label, m.label);
    if (canon && examMatchesCanonical(examNameOrKey, canon)) return true;
  }

  return false;
}

/**
 * Removes false "missed exam" flags when prescribed exams or milestones prove they were ordered.
 */
export function guardEvaluationAgainstFalseOmissions(
  analytical: AnalyticalEvaluation,
  prescribed: ExamPayload[],
  milestones: SessionMilestoneSnapshot[],
): AnalyticalEvaluation {
  const filteredMissed = analytical.economicAnalysis.missedRequiredExams.filter(
    (item) => !examIsPrescribed(item.examName, prescribed, milestones),
  );

  const VERIFIED_USER_ACTION = "Azione/Esame verificato nella simulazione";
  const staleOmissionText = (text: string | undefined) =>
    /non evidenziato/i.test(text ?? "") || !(text ?? "").trim();

  const fixedDelta = analytical.clinicalDeltaTable.map((row) => {
    if (row.status !== "MISSED" && row.status !== "DELAYED") return row;
    const combined = `${row.protocolAction} ${row.userAction}`;
    if (examIsPrescribed(combined, prescribed, milestones)) {
      return {
        ...row,
        status: "MET" as const,
        userAction: staleOmissionText(row.userAction)
          ? VERIFIED_USER_ACTION
          : row.userAction,
        penaltyOrBonusReason: `${row.penaltyOrBonusReason} [Corretto: esame risulta prescritto.]`,
      };
    }
    return row;
  });

  return {
    ...analytical,
    economicAnalysis: {
      ...analytical.economicAnalysis,
      missedRequiredExams: filteredMissed,
    },
    clinicalDeltaTable: fixedDelta,
  };
}
