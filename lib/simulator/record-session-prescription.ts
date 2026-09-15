import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getMedicationById } from "@/lib/medications/medication-repository";
import {
  inferCompletedGoldSteps,
  parseGoldStandardPath,
} from "@/lib/cases/simulation-time";
import { parseChatHistory } from "@/lib/simulator/persist-chat-turn";
import {
  type AdministrationRoute,
  type SessionPrescription,
  formatPrescriptionTrace,
  parseSessionPrescriptions,
} from "@/lib/simulator/prescription-trace";

export const PRESCRIPTION_MILESTONE_KEY = "prescrizione_farmacologica";

export async function recordSessionPrescription(params: {
  sessionId: string;
  medicationId: string;
  route: AdministrationRoute;
  posology: string;
}): Promise<{
  prescription: SessionPrescription;
  trace: string;
  prescribedMedications: SessionPrescription[];
  completedGoldSteps: string[];
}> {
  const medication = await getMedicationById(params.medicationId);
  if (!medication) {
    throw Object.assign(new Error("Farmaco non trovato nel prontuario."), { status: 404 });
  }

  const session = await prisma.caseSession.findUnique({
    where: { id: params.sessionId },
    select: {
      chatHistory: true,
      prescribedMedications: true,
      completedGoldSteps: true,
      requestedExamIds: true,
      case: { select: { goldStandardPath: true } },
    },
  });

  if (!session) {
    throw Object.assign(new Error("Sessione non trovata."), { status: 404 });
  }

  const posology = params.posology.trim();
  const trace = formatPrescriptionTrace({
    commercialName: medication.commercialName,
    activeIngredient: medication.activeIngredient,
    dosageForm: medication.dosageForm,
    price: medication.price,
    route: params.route,
    posology,
  });
  const prescription: SessionPrescription = {
    id: medication.id,
    commercialName: medication.commercialName,
    activeIngredient: medication.activeIngredient,
    dosageForm: medication.dosageForm,
    price: medication.price,
    category: medication.category,
    aifaBand: medication.aifaBand,
    route: params.route,
    posology,
    trace,
    prescribedAt: new Date().toISOString(),
  };

  const existingRx = parseSessionPrescriptions(session.prescribedMedications);
  const duplicate = existingRx.some(
    (row) =>
      row.id === prescription.id &&
      row.route === prescription.route &&
      row.posology === prescription.posology,
  );
  const nextRx = duplicate ? existingRx : [...existingRx, prescription];

  const goldPath = parseGoldStandardPath(session.case?.goldStandardPath);
  const requestedExamIds = Array.isArray(session.requestedExamIds) ? session.requestedExamIds : [];
  const inferredGold = inferCompletedGoldSteps({
    goldStandardPath: goldPath,
    requestedExamIds,
    clientCompletedSteps: session.completedGoldSteps,
    lastUserMessage: `${trace} ${params.route} ${posology} ${medication.commercialName} ${medication.activeIngredient}`,
  });

  const existingChat = parseChatHistory(session.chatHistory);
  const last = existingChat[existingChat.length - 1];
  const nextChat =
    last?.role === "user" && last.content === trace
      ? existingChat
      : [
          ...existingChat,
          { role: "user" as const, content: trace, createdAt: prescription.prescribedAt },
        ];

  await prisma.$transaction(async (tx) => {
    await tx.caseSession.update({
      where: { id: params.sessionId },
      data: {
        prescribedMedications: nextRx as Prisma.InputJsonValue,
        chatHistory: nextChat as Prisma.InputJsonValue,
        completedGoldSteps: inferredGold,
      },
    });

    await tx.simulationMilestone.upsert({
      where: {
        sessionId_milestoneKey: {
          sessionId: params.sessionId,
          milestoneKey: PRESCRIPTION_MILESTONE_KEY,
        },
      },
      create: {
        sessionId: params.sessionId,
        milestoneKey: PRESCRIPTION_MILESTONE_KEY,
        label: "Prescrizione farmacologica (Ricettario SSN)",
        category: "economic",
        source: "user_action",
        evidence: trace.slice(0, 500),
      },
      update: {
        evidence: trace.slice(0, 500),
        source: "user_action",
      },
    });

    const drugKey = `prescrizione_${medication.id.slice(0, 24)}`;
    await tx.simulationMilestone.upsert({
      where: {
        sessionId_milestoneKey: {
          sessionId: params.sessionId,
          milestoneKey: drugKey,
        },
      },
      create: {
        sessionId: params.sessionId,
        milestoneKey: drugKey,
        label: `Prescritto ${medication.commercialName} (${params.route})`,
        category: "clinical",
        source: "user_action",
        evidence: trace.slice(0, 500),
      },
      update: {
        evidence: trace.slice(0, 500),
      },
    });
  });

  return {
    prescription,
    trace,
    prescribedMedications: nextRx,
    completedGoldSteps: inferredGold,
  };
}
