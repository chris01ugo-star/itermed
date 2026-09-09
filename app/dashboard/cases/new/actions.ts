"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/require-user";
import { isTeacherRole } from "../../../../lib/cases/require-teacher-api";
import { EXAM_DEFAULT_VALUES, type ExamClinicalMeta } from "../../../../lib/exam-default-values";

function str(v: FormDataEntryValue | null): string | null {
  return v && typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: FormDataEntryValue | null): number | string | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const n = Number(v);
  return Number.isNaN(n) ? v.trim() : n;
}

function parseAdvancedExamValues(formData: FormData) {
  const entries = Array.from(formData.entries());
  const result: Record<
    string,
    { price: number | null; urgencyTiming: string | null; routineTiming: string | null; normalFinding: string | null }
  > = {};
  for (const [key, value] of entries) {
    if (!key.startsWith("examv_") || typeof value !== "string") continue;
    const [, examId, field] = key.split("__");
    if (!examId || !field) continue;
    if (!result[examId]) {
      result[examId] = { price: null, urgencyTiming: null, routineTiming: null, normalFinding: null };
    }
    if (field === "price") {
      const n = Number(value);
      result[examId].price = Number.isFinite(n) ? n : null;
    }
    if (field === "urgencyTiming") result[examId].urgencyTiming = value.trim() || null;
    if (field === "routineTiming") result[examId].routineTiming = value.trim() || null;
    if (field === "normalFinding") result[examId].normalFinding = value.trim() || null;
  }
  return result;
}

function randomBetween(min: number, max: number, decimals = 1): string {
  const factor = 10 ** decimals;
  const value = Math.round((min + Math.random() * (max - min)) * factor) / factor;
  return String(value);
}

function randomizeNormalFindingFromStandard(standard: string): string {
  const range = standard.match(/(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)/);
  if (range) {
    const min = Number(range[1].replace(",", "."));
    const max = Number(range[2].replace(",", "."));
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      const sampled = randomBetween(min, max, min % 1 !== 0 || max % 1 !== 0 ? 1 : 0);
      return standard.replace(range[0], sampled);
    }
  }
  const lt = standard.match(/<\s*(\d+(?:[.,]\d+)?)/);
  if (lt) {
    const max = Number(lt[1].replace(",", "."));
    if (Number.isFinite(max) && max > 0) {
      const sampled = randomBetween(Math.max(0, max * 0.35), max * 0.95, max % 1 !== 0 ? 1 : 0);
      return standard.replace(lt[0], sampled);
    }
  }
  const gt = standard.match(/>\s*(\d+(?:[.,]\d+)?)/);
  if (gt) {
    const min = Number(gt[1].replace(",", "."));
    if (Number.isFinite(min)) {
      const sampled = randomBetween(min * 1.02, min * 1.25, min % 1 !== 0 ? 1 : 0);
      return standard.replace(gt[0], sampled);
    }
  }
  if (/negativo|assente|non reattivo/i.test(standard)) {
    return standard;
  }
  return standard;
}

export async function createCase(formData: FormData) {
  const user = await requireUser();
  if (!isTeacherRole(user.role)) {
    throw new Error("Solo docenti e amministratori possono creare casi.");
  }
  const canPublishGlobal = user.role === "ADMIN";
  const title = formData.get("title");
  const description = formData.get("description");
  const specialty = formData.get("specialty");
  const difficulty = formData.get("difficulty");
  const pastHistory = formData.get("pastHistory");
  const correctSolution = formData.get("correctSolution");

  if (typeof title !== "string" || !title.trim()) {
    throw new Error("Il titolo del caso è obbligatorio.");
  }
  if (typeof description !== "string" || !description.trim()) {
    throw new Error("La descrizione del caso è obbligatoria.");
  }

  const mergedRaw = formData.get("mergedAdvancedExams");
  let advancedValuesFinal: Record<string, ExamClinicalMeta> | null = null;
  if (typeof mergedRaw === "string" && mergedRaw.trim()) {
    try {
      const parsed = JSON.parse(mergedRaw) as Record<string, ExamClinicalMeta>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        advancedValuesFinal = parsed;
      }
    } catch {
      advancedValuesFinal = null;
    }
  }

  const parsedAdvancedValues = parseAdvancedExamValues(formData);

  const advancedExamsValues =
    advancedValuesFinal ??
    Object.fromEntries(
      Object.entries(EXAM_DEFAULT_VALUES).map(([examId, defaults]) => {
        const raw = parsedAdvancedValues[examId] ?? {
          price: null,
          urgencyTiming: null,
          routineTiming: null,
          normalFinding: null,
        };
        return [
          examId,
          {
            price: raw.price ?? defaults.price,
            urgencyTiming: raw.urgencyTiming ?? defaults.urgencyTiming,
            routineTiming: raw.routineTiming ?? defaults.routineTiming,
            normalFinding:
              raw.normalFinding ?? randomizeNormalFindingFromStandard(defaults.normalFinding),
          },
        ];
      }),
    );

  const baselineExamFindings = {
    demographics: {
      age: num(formData.get("age")),
      sex: str(formData.get("sex")),
      context: str(formData.get("context")),
    },
    vitals: {
      heartRate: num(formData.get("vitals_fc")),
      bloodPressure: str(formData.get("vitals_pa")),
      spo2: num(formData.get("vitals_spo2")),
      temperature: num(formData.get("vitals_temp")),
      respiratoryRate: num(formData.get("vitals_fr")),
    },
    thorax: {
      cardiacAuscultation: str(formData.get("thorax_cardiac")),
      lungAuscultation: str(formData.get("thorax_lung")),
    },
    abdomen: {
      inspection: str(formData.get("abdomen_inspection")),
      palpation: str(formData.get("abdomen_palpation")),
      percussion: str(formData.get("abdomen_percussion")),
    },
    neuro: {
      pupils: str(formData.get("neuro_pupils")),
      gcs: str(formData.get("neuro_gcs")),
      deficits: str(formData.get("neuro_deficits")),
    },
    advancedExams: {
      notes: str(formData.get("advanced_exams_notes")),
      values: advancedExamsValues,
    },
  };

  const ageStr = baselineExamFindings.demographics.age != null ? String(baselineExamFindings.demographics.age) : "";
  const sexStr =
    baselineExamFindings.demographics.sex === "F"
      ? "Femmina"
      : baselineExamFindings.demographics.sex === "M"
        ? "Maschio"
        : "";
  const ctxStr = baselineExamFindings.demographics.context ?? "";
  const patientPrompt =
    [ageStr ? `${ageStr} anni` : "", sexStr, ctxStr, description.trim()].filter(Boolean).join(". ") ||
    "Paziente in simulazione. Rispondi come paziente, senza diagnosi.";

  await prisma.clinicalCase.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      specialty: typeof specialty === "string" && specialty.trim() ? specialty.trim() : null,
      difficulty:
        difficulty === "EASY" || difficulty === "HARD" || difficulty === "MEDIUM" ? difficulty : "MEDIUM",
      isActive: true,
      pastMedicalHistory:
        typeof pastHistory === "string" && pastHistory.trim() ? pastHistory.trim() : null,
      correctSolution:
        typeof correctSolution === "string" && correctSolution.trim() ? correctSolution.trim() : null,
      createdById: user.id,
      isGlobal: canPublishGlobal && formData.get("isGlobal") === "on",
      baselineExamFindings,
      nodes: {
        create: [
          {
            order: 1,
            type: "HISTORY",
            content: { casePrompt: patientPrompt },
          },
        ],
      },
    },
  });

  redirect("/dashboard/prassi");
}
