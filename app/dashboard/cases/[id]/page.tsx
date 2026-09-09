import { notFound, redirect } from "next/navigation";
import { Gauge, Stethoscope, Thermometer, Brain, FileText, FlaskConical } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { knowledgeBaseIdCandidates } from "@/lib/data/cases/registry-store";
import { userCanManageCase } from "../../../../lib/access";
import { requireUser } from "../../../../lib/require-user";
import { EXAM_DEFAULT_VALUES } from "../../../../lib/exam-default-values";
import { CaseFormTabs } from "../../../../components/cases/CaseFormTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../ui/card";
import { Input } from "../../../ui/input";
import { Textarea } from "../../../ui/textarea";
import { Button } from "../../../ui/button";

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
  const result: Record<string, { price: number | null; urgencyTiming: string | null; routineTiming: string | null; normalFinding: string | null }> = {};
  for (const [key, value] of entries) {
    if (!key.startsWith("examv_") || typeof value !== "string") continue;
    const [, examId, field] = key.split("__");
    if (!examId || !field) continue;
    if (!result[examId]) result[examId] = { price: null, urgencyTiming: null, routineTiming: null, normalFinding: null };
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

async function updateCase(formData: FormData) {
  "use server";

  const user = await requireUser();
  const canPublishGlobal = user.role === "ADMIN";
  const id = formData.get("id");
  const title = formData.get("title");
  const description = formData.get("description");
  const specialty = formData.get("specialty");
  const difficulty = formData.get("difficulty");
  const pastHistory = formData.get("pastHistory");
  const correctSolution = formData.get("correctSolution");

  if (typeof id !== "string" || !id.trim()) {
    throw new Error("ID caso mancante.");
  }
  if (typeof title !== "string" || !title.trim()) {
    throw new Error("Il titolo del caso è obbligatorio.");
  }
  if (typeof description !== "string" || !description.trim()) {
    throw new Error("La descrizione del caso è obbligatoria.");
  }

  const can = await userCanManageCase(user.id, id);
  if (!can) redirect("/dashboard/prassi");

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
      values: parseAdvancedExamValues(formData),
    },
  };

  await prisma.clinicalCase.update({
    where: { id },
    data: {
      title: title.trim(),
      description: description.trim(),
      specialty:
        typeof specialty === "string" && specialty.trim() ? specialty.trim() : null,
      difficulty:
        difficulty === "EASY" || difficulty === "HARD" || difficulty === "MEDIUM"
          ? difficulty
          : "MEDIUM",
      pastMedicalHistory:
        typeof pastHistory === "string" && pastHistory.trim() ? pastHistory.trim() : null,
      correctSolution:
        typeof correctSolution === "string" && correctSolution.trim()
          ? correctSolution.trim()
          : null,
      isGlobal: canPublishGlobal ? formData.get("isGlobal") === "on" : undefined,
      baselineExamFindings,
    },
  });

  redirect("/dashboard/prassi");
}

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseIdRaw } = await params;
  const caseId = caseIdRaw?.trim() ?? "";
  if (!caseId) return notFound();

  const user = await requireUser();

  const ids = knowledgeBaseIdCandidates(caseId);
  const clinicalCase = await prisma.clinicalCase.findFirst({
    where: { id: { in: ids.length ? ids : [caseId] } },
  });

  if (!clinicalCase) {
    return notFound();
  }

  const canEdit = await userCanManageCase(user.id, clinicalCase.id);
  if (!canEdit) {
    return notFound();
  }

  const baseline: any = clinicalCase.baselineExamFindings ?? {};
  const demographics = baseline.demographics ?? {};
  const vitals = baseline.vitals ?? {};
  const thorax = baseline.thorax ?? {};
  const abdomen = baseline.abdomen ?? {};
  const neuro = baseline.neuro ?? {};
  const advancedExams = baseline.advancedExams ?? {};

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Modifica caso clinico</h1>
        <p className="text-sm text-zinc-400">
          Aggiorna i dati del paziente, la descrizione del caso e i parametri vitali di base.
        </p>
      </header>

      <Card className="bg-white/80 border-zinc-200/80 max-w-3xl">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-950">
            {clinicalCase.title}
          </CardTitle>
          <CardDescription>
            Le modifiche saranno applicate alle prossime sessioni di simulazione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCase} className="space-y-4 text-xs">
            <input type="hidden" name="id" value={clinicalCase.id} />
            <CaseFormTabs
              general={
                <section className="space-y-4">
            {user.role === "ADMIN" ? (
              <div className="rounded-2xl border border-zinc-200/80 bg-white px-3 py-2.5">
                <label className="inline-flex items-center gap-2 text-[11px] font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    name="isGlobal"
                    defaultChecked={clinicalCase.isGlobal}
                    className="h-3.5 w-3.5"
                  />
                  <span>Caso globale (visibile a tutti gli utenti)</span>
                </label>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-700" htmlFor="title">
                  Titolo caso
                </label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={clinicalCase.title}
                  required
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-700" htmlFor="specialty">
                  Specialità
                </label>
                <Input
                  id="specialty"
                  name="specialty"
                  defaultValue={clinicalCase.specialty ?? ""}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-700" htmlFor="age">
                  Età
                </label>
                <Input
                  id="age"
                  name="age"
                  defaultValue={demographics.age ?? ""}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-700">Sesso</span>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="sex"
                      value="M"
                      defaultChecked={demographics.sex === "M"}
                      className="h-3 w-3"
                    />
                    <span>Maschio</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="sex"
                      value="F"
                      defaultChecked={demographics.sex === "F"}
                      className="h-3 w-3"
                    />
                    <span>Femmina</span>
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-700" htmlFor="context">
                  Contesto
                </label>
                <Input
                  id="context"
                  name="context"
                  defaultValue={demographics.context ?? ""}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-700" htmlFor="description">
                Descrizione del caso
              </label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={clinicalCase.description}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-700" htmlFor="pastHistory">
                  Patologie pregresse / comorbilità rilevanti
                </label>
                <Textarea
                  id="pastHistory"
                  name="pastHistory"
                  rows={3}
                  defaultValue={clinicalCase.pastMedicalHistory ?? ""}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-[11px] font-medium text-zinc-700"
                  htmlFor="correctSolution"
                >
                  Soluzione corretta del caso (diagnosi e gestione attesa)
                </label>
                <Textarea
                  id="correctSolution"
                  name="correctSolution"
                  rows={3}
                  defaultValue={clinicalCase.correctSolution ?? ""}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-700">Difficoltà</span>
              <div className="flex items-center gap-2">
                {["EASY", "MEDIUM", "HARD"].map((level) => (
                  <label key={level} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="difficulty"
                      value={level}
                      defaultChecked={clinicalCase.difficulty === level}
                      className="h-3 w-3"
                    />
                    <span>{level}</span>
                  </label>
                ))}
              </div>
            </div>
                </section>
              }
              objective={
                <section className="space-y-3 pt-2 border-t border-zinc-200/80">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                    <FileText className="h-3.5 w-3.5 text-zinc-600" />
                    Esame obiettivo (accordion)
                  </p>

                  <details open className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3 space-y-2">
                <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-700">Parametri vitali</summary>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                  <Gauge className="h-3.5 w-3.5 text-sky-600" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
                  <Input
                    name="vitals_fc"
                    placeholder="FC"
                    defaultValue={vitals.heartRate ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="vitals_pa"
                    placeholder="PA"
                    defaultValue={vitals.bloodPressure ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="vitals_spo2"
                    placeholder="SpO₂"
                    defaultValue={vitals.spo2 ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="vitals_temp"
                    placeholder="Temp °C"
                    defaultValue={vitals.temperature ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="vitals_fr"
                    placeholder="FR"
                    defaultValue={vitals.respiratoryRate ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                </div>
                  </details>

                  <details open className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3 space-y-2">
                <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-700">Torace</summary>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                  <Stethoscope className="h-3.5 w-3.5 text-sky-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <Input
                    name="thorax_cardiac"
                    placeholder="Auscultazione cuore"
                    defaultValue={thorax.cardiacAuscultation ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="thorax_lung"
                    placeholder="Auscultazione polmoni"
                    defaultValue={thorax.lungAuscultation ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                </div>
                  </details>

                  <details open className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3 space-y-2">
                <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-700">Addome</summary>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                  <Thermometer className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                  <Input
                    name="abdomen_inspection"
                    placeholder="Ispezione"
                    defaultValue={abdomen.inspection ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="abdomen_palpation"
                    placeholder="Palpazione"
                    defaultValue={abdomen.palpation ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="abdomen_percussion"
                    placeholder="Percussione"
                    defaultValue={abdomen.percussion ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                </div>
                  </details>

                  <details open className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3 space-y-2">
                <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-700">Neurologico</summary>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                  <Brain className="h-3.5 w-3.5 text-[#345884]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                  <Input
                    name="neuro_pupils"
                    placeholder="Pupille"
                    defaultValue={neuro.pupils ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="neuro_gcs"
                    placeholder="GCS"
                    defaultValue={neuro.gcs ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                  <Input
                    name="neuro_deficits"
                    placeholder="Deficit focali"
                    defaultValue={neuro.deficits ?? ""}
                    className="h-7 px-2 text-[11px]"
                  />
                </div>
                  </details>
                </section>
              }
              advanced={
                <section className="space-y-2 border-t border-zinc-200/80 pt-3">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-700">
                    <FlaskConical className="h-3.5 w-3.5 text-emerald-600" />
                    Esami diagnostici avanzati
                  </p>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-3 space-y-2 max-h-[520px] overflow-y-auto">
                    {Object.entries(EXAM_DEFAULT_VALUES).map(([examId, exam]) => {
                      const saved = (advancedExams.values && typeof advancedExams.values === "object"
                        ? (advancedExams.values as Record<string, { price?: number; urgencyTiming?: string; routineTiming?: string; normalFinding?: string }>)
                        : {})[examId];
                      return (
                        <details key={examId} className="rounded-xl border border-zinc-200/80 bg-white p-2">
                          <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-800">{examId}</summary>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input name={`examv__${examId}__price`} defaultValue={String(saved?.price ?? exam.price)} placeholder="Prezzo" className="h-8 text-[11px]" />
                            <Input name={`examv__${examId}__urgencyTiming`} defaultValue={saved?.urgencyTiming ?? exam.urgencyTiming} placeholder="Tempo urgenza" className="h-8 text-[11px]" />
                            <Input name={`examv__${examId}__routineTiming`} defaultValue={saved?.routineTiming ?? exam.routineTiming} placeholder="Tempo routine" className="h-8 text-[11px]" />
                            <Input name={`examv__${examId}__normalFinding`} defaultValue={saved?.normalFinding ?? exam.normalFinding} placeholder="Valore fisiologico/referto" className="h-8 text-[11px]" />
                          </div>
                        </details>
                      );
                    })}
                  </div>
                  <Textarea
                    name="advanced_exams_notes"
                    rows={7}
                    defaultValue={advancedExams.notes ?? ""}
                    className="text-xs"
                    placeholder="Definisci qui reperti/valori dei test diagnostici avanzati (lab, imaging, strumentali, endoscopia)."
                  />
                </section>
              }
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="submit"
                size="sm"
                className="text-xs px-4"
              >
                Salva modifiche
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

