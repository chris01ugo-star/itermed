"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/ui/card";
import { Button } from "@/app/ui/button";
import { Input } from "@/app/ui/input";
import { Textarea } from "@/app/ui/textarea";

/** Admin RAG ingest controls embedded in Linee Guida hub. */
export function GuidelineIngestPanel() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [rawTextTitle, setRawTextTitle] = useState("");
  const [rawTextTags, setRawTextTags] = useState("");
  const [rawText, setRawText] = useState("");
  const [isSubmittingText, setIsSubmittingText] = useState(false);

  const handleSubmitPdf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!file) {
      setMessage({ type: "error", text: "Seleziona un file PDF da caricare." });
      return;
    }
    if (!title.trim()) {
      setMessage({ type: "error", text: "Inserisci un titolo per il documento." });
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("tags", tags);
      formData.append("file", file);

      const res = await fetch("/api/admin/ingest-pdf", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && (data.error as string | undefined)) || "Errore upload PDF.");
      }

      setMessage({
        type: "success",
        text: `Documento indicizzato con successo (${data?.chunks ?? "n"} chunk).`,
      });
      setTitle("");
      setTags("");
      setFile(null);
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Errore durante l'upload del PDF.";
      setMessage({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (!rawTextTitle.trim()) {
      setMessage({ type: "error", text: "Inserisci un titolo per il documento." });
      return;
    }
    if (!rawText.trim()) {
      setMessage({ type: "error", text: "Incolla il testo delle linee guida." });
      return;
    }

    try {
      setIsSubmittingText(true);
      const tagsArray = rawTextTags
        ? rawTextTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const res = await fetch("/api/admin/ingest-guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: rawTextTitle,
          text: rawText,
          tags: tagsArray,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && (data.error as string | undefined)) || "Errore durante l'indicizzazione.",
        );
      }

      setMessage({
        type: "success",
        text: `Testo indicizzato con successo (${data?.chunks ?? "n"} chunk).`,
      });
      setRawTextTitle("");
      setRawTextTags("");
      setRawText("");
      router.refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Errore durante l'indicizzazione.";
      setMessage({ type: "error", text: msg });
    } finally {
      setIsSubmittingText(false);
    }
  };

  return (
    <div className="space-y-4">
      {message ? (
        <div
          className={
            message.type === "success"
              ? "rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-2 text-xs text-emerald-800"
              : "rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-2 text-xs text-rose-800"
          }
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border-border bg-panel-bg shadow-aequan-panel">
          <CardHeader>
            <CardTitle className="font-display text-sm font-semibold text-brand-primary">
              Carica documento PDF
            </CardTitle>
            <CardDescription className="text-xs">
              Upload e indicizzazione automatica in chunk nel motore RAG.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPdf} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Titolo</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Tags</label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="es. empatia, EMPATHY, gelli-bianco"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">File PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1.5 file:text-xs file:font-medium"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Upload in corso…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Carica e indicizza PDF
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border bg-panel-bg shadow-aequan-panel">
          <CardHeader>
            <CardTitle className="font-display text-sm font-semibold text-brand-primary">
              Incolla testo
            </CardTitle>
            <CardDescription className="text-xs">
              Indicizza testo manuale (linee guida, protocolli, note operative).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitText} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Titolo</label>
                <Input
                  value={rawTextTitle}
                  onChange={(e) => setRawTextTitle(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Tags</label>
                <Input
                  value={rawTextTags}
                  onChange={(e) => setRawTextTags(e.target.value)}
                  placeholder="es. empatia, EMPATHY, gelli-bianco"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Testo</label>
                <Textarea
                  className="min-h-40 text-xs"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmittingText || !rawTextTitle.trim() || !rawText.trim()}
                className="rounded-xl"
              >
                {isSubmittingText ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Indicizzazione…
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Indicizza testo
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
