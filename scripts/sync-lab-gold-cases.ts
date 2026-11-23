/**
 * Upsert idempotente dei casi gold v2 e disattivazione dei LABO-001..026.
 * Non cancella righe, sessioni o referti.
 *
 *   npx tsx scripts/sync-lab-gold-cases.ts
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import {
  LAB_GOLD_CASES,
  LAB_GOLD_SPECIALTY_NAME,
  LAB_GOLD_SPECIALTY_SLUG,
  LEGACY_LAB_CASE_IDS,
  toLabKnowledgePayload,
} from "@/lib/simulator/data/laboratory-gold-cases";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const specialty = await prisma.medicalSpecialty.findFirst({
      where: { name: { equals: LAB_GOLD_SPECIALTY_NAME, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!specialty) {
      throw new Error(`Specialità "${LAB_GOLD_SPECIALTY_NAME}" assente. Nessuna riga è stata scritta.`);
    }

    const author = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    });
    if (!author) {
      throw new Error("Nessun utente ADMIN: impossibile creare i ClinicalCase nuovi.");
    }

    for (const entry of LAB_GOLD_CASES) {
      const payload = toLabKnowledgePayload(entry);
      const patientProfile = payload.patientProfile ?? {};
      const ragSources = payload.escCitations ?? [];
      await prisma.knowledgeBaseCase.upsert({
        where: { id: entry.id },
        create: {
          id: entry.id,
          specialty: LAB_GOLD_SPECIALTY_SLUG,
          version: 2,
          title: entry.title,
          patientProfile: patientProfile as object,
          caseData: payload as object,
          ragSources: ragSources as object,
        },
        update: {
          specialty: LAB_GOLD_SPECIALTY_SLUG,
          version: 2,
          title: entry.title,
          patientProfile: patientProfile as object,
          caseData: payload as object,
          ragSources: ragSources as object,
        },
      });

      const clinical = {
        title: entry.title,
        description: entry.blueprint.clinicalOrderSummary,
        specialty: LAB_GOLD_SPECIALTY_NAME,
        difficulty: entry.difficulty,
        isGlobal: true,
        isActive: true,
        estimatedDurationMinutes: 45,
        timeLimitMinutes: 45,
        patientDeteriorationThreshold: 30,
        pastMedicalHistory:
          "Il ticket non riporta l'anamnesi. Le notizie cliniche restano sul richiedente e vanno chieste in modo mirato.",
        correctSolution: entry.correctSolution,
        baselineExamFindings: {
          vitals: {
            heartRate: 78,
            bloodPressure: "122/74",
            spo2: 98,
            temperature: 36.5,
            respiratoryRate: 16,
          },
          examBudgetEuro: Math.max(1, entry.blueprint.budgetEuro),
          demographics: entry.blueprint.patientDemographics,
        },
        goldStandardPath: [
          "Ispezionare il campione e gli indici prima della firma.",
          "Disporre ogni analita e firmare la nota di validazione.",
        ],
        examLatencies: { "ispezione-campione": 1, "indici-hil": 1 },
        medicalSpecialtyId: specialty.id,
        secondarySpecialties: [],
      };

      await prisma.clinicalCase.upsert({
        where: { id: entry.id },
        create: { id: entry.id, ...clinical, createdById: author.id },
        update: clinical,
      });

      const nodeCount = await prisma.caseNode.count({ where: { caseId: entry.id } });
      if (nodeCount === 0) {
        await prisma.caseNode.create({
          data: {
            caseId: entry.id,
            order: 0,
            type: "HISTORY",
            content: { casePrompt: entry.blueprint.clinicalOrderSummary },
          },
        });
      }
    }

    const goldIds = LAB_GOLD_CASES.map((entry) => entry.id);
    const hidden = await prisma.clinicalCase.updateMany({
      where: {
        id: { notIn: goldIds },
        OR: [
          { medicalSpecialtyId: specialty.id },
          { specialty: { equals: LAB_GOLD_SPECIALTY_NAME, mode: "insensitive" } },
          { id: { in: [...LEGACY_LAB_CASE_IDS] } },
        ],
      },
      data: { isActive: false },
    });

    const active = await prisma.clinicalCase.findMany({
      where: {
        isActive: true,
        OR: [
          { medicalSpecialtyId: specialty.id },
          { specialty: { equals: LAB_GOLD_SPECIALTY_NAME, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const legacyLeft = await prisma.clinicalCase.findMany({
      where: { id: { in: [...LEGACY_LAB_CASE_IDS] } },
      select: { id: true, isActive: true },
      orderBy: { id: "asc" },
    });

    console.log(`[sync-lab] specialità ${specialty.name} (${specialty.id})`);
    console.log(`[sync-lab] autore ${author.email ?? author.id}`);
    console.log(`[sync-lab] upsert ${LAB_GOLD_CASES.length} casi v2`);
    console.log(`[sync-lab] legacy disattivati in questo giro: ${hidden.count}`);
    console.log(`[sync-lab] attivi di Medicina di Laboratorio: ${active.length}`);
    console.log(active.map((row) => row.id).join(", "));
    console.log(
      `[sync-lab] legacy ancora presenti: ${legacyLeft.length}; nascosti: ${legacyLeft.filter((row) => !row.isActive).length}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[sync-lab] FAIL", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
