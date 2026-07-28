"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Loader2,
  Route,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { flattenCatalogExams } from "@/lib/exam-catalog-structure";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/ui/card";
import { Input } from "@/app/ui/input";
import { Textarea } from "@/app/ui/textarea";
import { Button } from "@/app/ui/button";
import { Badge } from "@/app/ui/badge";
import { cn } from "@/app/utils/cn";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";

const STEPS = [
  { id: 1, label: "Anagrafica", icon: UserRound },
  { id: 2, label: "Tempi esami", icon: FlaskConical },
  { id: 3, label: "Gold Standard", icon: Route },
  { id: 4, label: "Deterioramento", icon: Activity },
] as const;

const CATALOG_EXAMS = flattenCatalogExams().slice(0, 48);

const DIFFICULTY_OPTIONS = [
  { value: "EASY", label: "Facile" },
  { value: "MEDIUM", label: "Media" },
  { value: "HARD", label: "Difficile" },
] as const;

const SEX_OPTIONS = [
  { value: "", label: "—" },
  { value: "M", label: "Maschio" },
  { value: "F", label: "Femmina" },
] as const;

const PANEL_CARD =
  "rounded-xl border border-border bg-panel-bg shadow-aequan-panel hover:shadow-aequan-panel";
const FIELD_LABEL = "text-xs font-medium text-slate-700";
const FIELD_STACK = "space-y-1.5";

type WizardForm = {
  title: string;
  description: string;
  specialty: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  age: string;
  sex: "M" | "F" | "";
  context: string;
  pastMedicalHistory: string;
  correctSolution: string;
  vitals_fc: string;
  vitals_pa: string;
  vitals_spo2: string;
  vitals_temp: string;
  vitals_fr: string;
  examLatencies: Record<string, string>;
  goldSteps: string[];
  timeLimitMinutes: string;
  patientDeteriorationThreshold: string;
};

const INITIAL: WizardForm = {
  title: "",
  description: "",
  specialty: "",
  difficulty: "MEDIUM",
  age: "",
  sex: "",
  context: "",
  pastMedicalHistory: "",
  correctSolution: "",
  vitals_fc: "",
  vitals_pa: "",
  vitals_spo2: "",
  vitals_temp: "",
  vitals_fr: "",
  examLatencies: {},
  goldSteps: ["anamnesi_fumo", "obiettivo_torace"],
  timeLimitMinutes: "30",
  patientDeteriorationThreshold: "20",
};

type CaseCreatorWizardProps = {
  canPublishGlobal?: boolean;
};

function StepPanelHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Stethoscope;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="border-b border-border-subtle">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="font-display text-sm font-semibold text-brand-primary">
            {title}
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  );
}

export function CaseCreatorWizard({ canPublishGlobal = false }: CaseCreatorWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(INITIAL);
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGoldStep, setNewGoldStep] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const update = useCallback(<K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyGeneratedFields = useCallback(
    (fields: {
      title: string;
      description: string;
      specialty: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      age: string;
      sex: "M" | "F";
      context: string;
      pastMedicalHistory: string;
      correctSolution: string;
      vitals_fc: string;
      vitals_pa: string;
      vitals_spo2: string;
      vitals_temp: string;
      vitals_fr: string;
      abnormalExamsSummary?: string;
    }) => {
      const abnormal = fields.abnormalExamsSummary?.trim();
      const pastBase = fields.pastMedicalHistory?.trim() ?? "";
      const pastMedicalHistory =
        abnormal && !pastBase.includes(abnormal)
          ? [pastBase, `Alterazioni attese: ${abnormal}`].filter(Boolean).join("\n")
          : pastBase;

      setForm((prev) => ({
        ...prev,
        title: fields.title || prev.title,
        description: fields.description || prev.description,
        specialty: fields.specialty || prev.specialty,
        difficulty: fields.difficulty || prev.difficulty,
        age: fields.age || prev.age,
        sex: fields.sex || prev.sex,
        context: fields.context || prev.context,
        pastMedicalHistory: pastMedicalHistory || prev.pastMedicalHistory,
        correctSolution: fields.correctSolution || prev.correctSolution,
        vitals_fc: fields.vitals_fc || prev.vitals_fc,
        vitals_pa: fields.vitals_pa || prev.vitals_pa,
        vitals_spo2: fields.vitals_spo2 || prev.vitals_spo2,
        vitals_temp: fields.vitals_temp || prev.vitals_temp,
        vitals_fr: fields.vitals_fr || prev.vitals_fr,
      }));
      setStep(1);
    },
    [],
  );

  const handleGenerateCaseFields = async () => {
    setAiMessage(null);
    setError(null);
    const brief = aiBrief.trim();
    if (brief.length < 20) {
      setAiMessage("Inserisci un riassunto di almeno 20 caratteri.");
      return;
    }

    setAiGenerating(true);
    try {
      const res = await fetch("/api/generate-case-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        fields?: Parameters<typeof applyGeneratedFields>[0];
      } | null;

      if (!res.ok || !data?.fields) {
        setAiMessage(data?.error ?? "Generazione non riuscita.");
        return;
      }

      applyGeneratedFields(data.fields);
      setAiMessage(
        "Struttura caso generata. Rivedi i campi nello step Anagrafica e modifica liberamente prima del salvataggio.",
      );
    } catch {
      setAiMessage("Errore di rete durante la generazione. Riprova.");
    } finally {
      setAiGenerating(false);
    }
  };

  const configuredExams = useMemo(
    () => Object.entries(form.examLatencies).filter(([, v]) => v.trim() !== ""),
    [form.examLatencies],
  );

  const addGoldStep = () => {
    const v = newGoldStep.trim();
    if (!v) return;
    update("goldSteps", [...form.goldSteps, v]);
    setNewGoldStep("");
  };

  const removeGoldStep = (index: number) => {
    update(
      "goldSteps",
      form.goldSteps.filter((_, i) => i !== index),
    );
  };

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.title.trim()) return "Il titolo è obbligatorio.";
      if (form.description.trim().length < 10) return "La presentazione clinica deve essere più dettagliata.";
    }
    if (s === 3 && form.goldSteps.length === 0) return "Aggiungi almeno una tappa al Gold Standard.";
    if (s === 4) {
      const th = Number(form.patientDeteriorationThreshold);
      if (!Number.isFinite(th) || th < 1) return "Soglia di deterioramento non valida.";
    }
    return null;
  };

  const goToStep = (target: number) => {
    setError(null);
    setStep(Math.min(4, Math.max(1, target)));
  };

  const goNext = () => {
    // Tabs are freely navigable; field validation runs only on final submit.
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    for (let s = 1; s <= 4; s += 1) {
      const err = validateStep(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }

    setSaving(true);
    setError(null);

    const examLatencies: Record<string, number> = {};
    for (const [examId, raw] of Object.entries(form.examLatencies)) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) examLatencies[examId] = Math.round(n);
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      specialty: form.specialty.trim() || null,
      difficulty: form.difficulty,
      pastMedicalHistory: form.pastMedicalHistory.trim() || null,
      correctSolution: form.correctSolution.trim() || null,
      isGlobal: canPublishGlobal && isGlobal,
      demographics: {
        age: form.age.trim() ? form.age.trim() : null,
        sex: form.sex || null,
        context: form.context.trim() || null,
      },
      vitals: {
        heartRate: form.vitals_fc.trim() ? form.vitals_fc.trim() : null,
        bloodPressure: form.vitals_pa.trim() || null,
        spo2: form.vitals_spo2.trim() ? form.vitals_spo2.trim() : null,
        temperature: form.vitals_temp.trim() ? form.vitals_temp.trim() : null,
        respiratoryRate: form.vitals_fr.trim() ? form.vitals_fr.trim() : null,
      },
      timeLimitMinutes: form.timeLimitMinutes.trim() ? Number(form.timeLimitMinutes) : null,
      goldStandardPath: form.goldSteps,
      examLatencies,
      patientDeteriorationThreshold: Number(form.patientDeteriorationThreshold),
    };

    try {
      const res = await fetch("/api/cases/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Errore durante la creazione del caso.");
        return;
      }
      router.push("/dashboard/prassi");
      router.refresh();
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card
        className={cn(
          PANEL_CARD,
          "overflow-hidden border-brand-secondary/20 bg-gradient-to-br from-brand-secondary/[0.06] via-panel-bg to-ui-bg",
        )}
      >
        <CardHeader>
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="font-display text-sm font-semibold text-brand-primary">
                Compilazione rapida con IA
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Incolla un breve riassunto clinico: l&apos;IA compilerà titolo, presentazione,
                vitali, anamnesi e diagnosi attesa. Potrai rivedere ogni campo prima del
                salvataggio.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={aiBrief}
            onChange={(e) => setAiBrief(e.target.value)}
            rows={4}
            disabled={aiGenerating}
            placeholder='Es. "Uomo di 62 anni con dolore toracico irradiato al braccio sinistro, iperteso, fumatore. Sospetto infarto STEMI."'
            className="rounded-xl border-border bg-white text-sm"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Modello: gpt-4o-mini · disponibile per tutti gli utenti
            </p>
            <Button
              type="button"
              onClick={() => void handleGenerateCaseFields()}
              disabled={aiGenerating || aiBrief.trim().length < 20}
              className="inline-flex items-center gap-2"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generazione in corso…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Genera struttura caso
                </>
              )}
            </Button>
          </div>
          {aiGenerating ? (
            <div className="space-y-2 rounded-xl border border-border bg-ui-bg/80 p-3" role="status">
              <Skeleton className="h-3 w-40" />
              <SkeletonText lines={4} />
            </div>
          ) : null}
          {aiMessage ? (
            <p
              className={cn(
                "rounded-xl border px-3 py-2 text-xs",
                aiMessage.includes("Struttura caso generata")
                  ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
                  : "border-amber-200/80 bg-amber-50/80 text-amber-950",
              )}
              role="status"
            >
              {aiMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <nav
        className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
        aria-label="Sezioni wizard caso"
      >
        {STEPS.map(({ id, label, icon: Icon }) => {
          const active = step === id;
          const visited = step > id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => goToStep(id)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-[#1E324E] text-white shadow-sm"
                  : visited
                    ? "bg-transparent text-brand-secondary hover:text-[#1E324E]"
                    : "bg-transparent text-slate-500 hover:text-[#2F4156]",
              )}
            >
              {visited && !active ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span>
                {id}. {label}
              </span>
            </button>
          );
        })}
      </nav>

      {error ? (
        <div
          className="rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-xs text-rose-800"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <Card className={PANEL_CARD}>
          <StepPanelHeader
            icon={Stethoscope}
            title="Anagrafica e presentazione clinica"
            description="Definisci il profilo del paziente virtuale e i parametri vitali iniziali."
          />
          <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
            <label className={cn(FIELD_STACK, "md:col-span-2")}>
              <span className={FIELD_LABEL}>Titolo caso</span>
              <Input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Specialità</span>
              <Input
                value={form.specialty}
                onChange={(e) => update("specialty", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <div className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Difficoltà</span>
              <SegmentedControl
                aria-label="Difficoltà caso"
                options={[...DIFFICULTY_OPTIONS]}
                value={form.difficulty}
                onChange={(value) => update("difficulty", value)}
              />
            </div>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Età</span>
              <Input
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <div className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Sesso</span>
              <SegmentedControl
                aria-label="Sesso paziente"
                options={[...SEX_OPTIONS]}
                value={form.sex}
                onChange={(value) => update("sex", value)}
              />
            </div>
            <label className={cn(FIELD_STACK, "md:col-span-2")}>
              <span className={FIELD_LABEL}>Contesto / setting</span>
              <Input
                value={form.context}
                onChange={(e) => update("context", e.target.value)}
                className="h-9 text-sm"
                placeholder="es. PS notturno, dolore toracico da 2 ore"
              />
            </label>
            <label className={cn(FIELD_STACK, "md:col-span-2")}>
              <span className={FIELD_LABEL}>Presentazione clinica</span>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                rows={4}
                className="text-sm"
              />
            </label>
            <label className={cn(FIELD_STACK, "md:col-span-2")}>
              <span className={FIELD_LABEL}>Anamnesi / comorbidità</span>
              <Textarea
                value={form.pastMedicalHistory}
                onChange={(e) => update("pastMedicalHistory", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>FC (bpm)</span>
              <Input
                value={form.vitals_fc}
                onChange={(e) => update("vitals_fc", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>PA</span>
              <Input
                value={form.vitals_pa}
                onChange={(e) => update("vitals_pa", e.target.value)}
                className="h-9 text-sm"
                placeholder="120/80"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>SpO₂ (%)</span>
              <Input
                value={form.vitals_spo2}
                onChange={(e) => update("vitals_spo2", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Temperatura (°C)</span>
              <Input
                value={form.vitals_temp}
                onChange={(e) => update("vitals_temp", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>FR (atti/min)</span>
              <Input
                value={form.vitals_fr}
                onChange={(e) => update("vitals_fr", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className={cn(FIELD_STACK, "md:col-span-2")}>
              <span className={FIELD_LABEL}>Soluzione corretta (nascosta allo studente)</span>
              <Textarea
                value={form.correctSolution}
                onChange={(e) => update("correctSolution", e.target.value)}
                rows={2}
                className="text-sm"
              />
            </label>
            {canPublishGlobal ? (
              <label className="flex items-center gap-2.5 md:col-span-2">
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand-primary accent-[#1E324E]"
                />
                <span className="text-xs font-medium text-slate-700">
                  Pubblica come caso globale Aequan
                </span>
              </label>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className={PANEL_CARD}>
          <StepPanelHeader
            icon={Clock}
            title="Tempi di refertazione esami"
            description="Imposta i minuti di attesa per ogni esame. Il simulatore sommerà queste latenze al tempo trascorso."
          />
          <CardContent className="max-h-[520px] space-y-3 overflow-y-auto pt-4">
            {configuredExams.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {configuredExams.map(([id, mins]) => (
                  <Badge key={id} variant="info" className="text-[10px]">
                    {id}: {mins} min
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {CATALOG_EXAMS.map((exam) => (
                <label
                  key={exam.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-ui-bg/80 px-3 py-2"
                >
                  <span className="truncate text-[11px] text-slate-700" title={exam.name}>
                    {exam.name}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="min"
                    value={form.examLatencies[exam.id] ?? ""}
                    onChange={(e) =>
                      update("examLatencies", {
                        ...form.examLatencies,
                        [exam.id]: e.target.value,
                      })
                    }
                    className="h-7 w-16 text-right text-[11px]"
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className={PANEL_CARD}>
          <StepPanelHeader
            icon={Route}
            title="Percorso Gold Standard"
            description="Tappe cliniche obbligatorie per superare il caso (es. anamnesi, obiettivo, esami, terapie salvavita)."
          />
          <CardContent className="space-y-4 pt-4">
            <div className="flex gap-2">
              <Input
                value={newGoldStep}
                onChange={(e) => setNewGoldStep(e.target.value)}
                placeholder='es. "rx_torace", "somministrazione_ossigeno"'
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addGoldStep();
                  }
                }}
              />
              <Button type="button" onClick={addGoldStep} className="h-9 shrink-0">
                Aggiungi
              </Button>
            </div>
            <ol className="space-y-2">
              {form.goldSteps.map((stepId, index) => (
                <li
                  key={`${stepId}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ui-bg/80 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-text-primary">
                    <span className="mr-2 tabular-nums text-slate-400">{index + 1}.</span>
                    {stepId}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeGoldStep(index)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Rimuovi tappa ${stepId}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className={PANEL_CARD}>
          <StepPanelHeader
            icon={Activity}
            title="Soglie di deterioramento"
            description="Dopo quanti minuti simulati, senza azioni salvavita, il paziente inizia a peggiorare."
          />
          <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Tempo massimo simulazione (min)</span>
              <Input
                type="number"
                min={5}
                value={form.timeLimitMinutes}
                onChange={(e) => update("timeLimitMinutes", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <label className={FIELD_STACK}>
              <span className={FIELD_LABEL}>Soglia deterioramento (min)</span>
              <Input
                type="number"
                min={1}
                value={form.patientDeteriorationThreshold}
                onChange={(e) => update("patientDeteriorationThreshold", e.target.value)}
                className="h-9 text-sm"
              />
            </label>
            <div className="space-y-1 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs text-amber-900 md:col-span-2">
              <p>
                <strong>Riepilogo:</strong> {form.goldSteps.length} tappe Gold Standard,{" "}
                {configuredExams.length} esami con latenza configurata.
              </p>
              <p>
                Se il tempo simulato supera{" "}
                <strong>{form.patientDeteriorationThreshold || "—"} min</strong> senza
                completare il percorso, l&apos;AI farà deteriorare il paziente
                (desaturazione, ipotensione, distress).
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={step === 1 || saving}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Indietro
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={goNext} className="gap-1">
            Avanti
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="min-w-[140px] gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Crea caso
          </Button>
        )}
      </div>
    </div>
  );
}
