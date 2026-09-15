"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PenLine, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/ui/dialog";
import { cn } from "@/app/utils/cn";
import {
  AIFA_BAND_BADGE_CLASS,
  aifaBandLabel,
  resolveAifaBand,
  type AifaBand,
} from "@/lib/medications/aifa-band";
import {
  ADMINISTRATION_ROUTES,
  formatSsnPrice,
  type AdministrationRoute,
} from "@/lib/simulator/prescription-trace";

export type PrescriptionPadMedication = {
  id: string;
  commercialName: string;
  activeIngredient: string;
  dosageForm: string;
  price: number;
  category: string;
  aifaBand?: string;
};

export type ConfirmedPrescription = {
  medication: PrescriptionPadMedication;
  route: AdministrationRoute;
  posology: string;
};

type PrescriptionPadProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: ConfirmedPrescription) => void | Promise<void>;
  busy?: boolean;
  alreadyPrescribedIds?: string[];
};

const ROUTE_LABELS: Record<AdministrationRoute, string> = {
  orale: "Orale",
  endovenosa: "Endovenosa (EV)",
  intramuscolare: "Intramuscolare (IM)",
  sottocutanea: "Sottocutanea (SC)",
  inalatoria: "Inalatoria",
  sublinguale: "Sublinguale",
  transdermica: "Transdermica",
  rettale: "Rettale",
  topica: "Topica",
};

const POSOLOGY_PLACEHOLDERS: Record<AdministrationRoute, string> = {
  orale: "1 cp ogni 12 ore",
  endovenosa: "1 fiala in bolo lento",
  intramuscolare: "1 fiala IM",
  sottocutanea: "1 fiala SC",
  inalatoria: "2 puff × 3/die",
  sublinguale: "1 cp SL al bisogno",
  transdermica: "1 cerotto ogni 72 ore",
  rettale: "1 supp. al bisogno",
  topica: "applicazione locale 2/die",
};

function AifaBandBadge({ band }: { band: AifaBand }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.14em]",
        AIFA_BAND_BADGE_CLASS[band],
      )}
    >
      {aifaBandLabel(band)}
    </span>
  );
}

export function PrescriptionPad({
  open,
  onClose,
  onConfirm,
  busy = false,
  alreadyPrescribedIds = [],
}: PrescriptionPadProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PrescriptionPadMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PrescriptionPadMedication | null>(null);
  const [route, setRoute] = useState<AdministrationRoute>("orale");
  const [posology, setPosology] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const prescribed = useMemo(() => new Set(alreadyPrescribedIds), [alreadyPrescribedIds]);
  const canConfirm = Boolean(selected && posology.trim() && !busy);
  const selectedBand = selected ? resolveAifaBand(selected) : null;

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("take", "40");
      const res = await fetch(`/api/medications?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Impossibile caricare il prontuario.",
        );
      }
      const rows = Array.isArray(data?.medications) ? data.medications : [];
      setResults(
        rows.filter(
          (row: PrescriptionPadMedication) =>
            row && typeof row.id === "string" && typeof row.commercialName === "string",
        ),
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      setLoadError(err instanceof Error ? err.message : "Errore di ricerca.");
      setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) setListOpen(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void search(query);
    }, query.trim() ? 220 : 0);
    return () => window.clearTimeout(handle);
  }, [open, query, search]);

  useEffect(() => {
    if (open) return;
    setQuery("");
    setSelected(null);
    setRoute("orale");
    setPosology("");
    setListOpen(false);
    setLoadError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open={open}>
      <DialogContent className="relative flex max-h-[min(92dvh,760px)] max-w-[42rem] flex-col overflow-hidden p-0 shadow-2xl">
        <div
          role="note"
          className="shrink-0 border-b-2 border-amber-600 bg-amber-300 px-3 py-2 text-center"
        >
          <p className="text-[10px] font-extrabold uppercase leading-snug tracking-[0.08em] text-red-800 sm:text-[11px]">
            FAC-SIMILE - USO ESCLUSIVAMENTE DIDATTICO - NON VALIDO PER LA DISPENSAZIONE
          </p>
        </div>
        <div className="relative overflow-hidden border-b-[6px] border-[#8B1E2D] bg-[#1E324E] px-5 pb-4 pt-4 text-white">
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full border-[10px] border-white/10" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                Servizio Sanitario Nazionale
              </p>
              <DialogHeader className="mb-0 mt-1 space-y-0.5 text-left">
                <DialogTitle className="font-serif text-[1.35rem] font-semibold tracking-tight text-white">
                  Foglio Unico di Terapia
                </DialogTitle>
                <DialogDescription className="text-[11px] text-white/75">
                  Prescrizione interna · prontuario AIFA · ricetta SSN di reparto
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex items-start gap-2">
              <div className="hidden rounded-sm border border-dashed border-white/35 px-2.5 py-1.5 text-right sm:block">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  Mod. FUT
                </p>
                <p className="font-mono text-[10px] text-white/80">SSN-RX</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/20 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                aria-label="Chiudi ricettario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#F4EFE4] px-5 py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden"
          >
            <p className="rotate-[-28deg] select-none text-center text-[1.35rem] font-black uppercase leading-tight tracking-[0.18em] text-red-700/15 sm:text-2xl">
              FAC-SIMILE
              <br />
              USO DIDATTICO
            </p>
          </div>
          <div className="relative z-[1] mb-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.12em] text-slate-500">
            <div className="rounded-sm border border-dashed border-slate-300/80 bg-white/50 px-2.5 py-1.5">
              Reparto <span className="ml-1 font-semibold text-slate-700">Simulazione clinica</span>
            </div>
            <div className="rounded-sm border border-dashed border-slate-300/80 bg-white/50 px-2.5 py-1.5 text-right">
              Data <span className="ml-1 font-mono text-slate-700">{new Date().toLocaleDateString("it-IT")}</span>
            </div>
          </div>

          <div ref={searchWrapRef} className="relative z-[1]">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
              Farmaco (nome commerciale / principio attivo)
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(null);
                  setListOpen(true);
                }}
                onFocus={() => setListOpen(true)}
                placeholder="Cerca nel prontuario ospedaliero…"
                autoFocus
                autoComplete="off"
                role="combobox"
                aria-expanded={listOpen}
                aria-controls="prescription-pad-results"
                className="h-11 w-full rounded-sm border border-slate-300 bg-white pl-10 pr-3 font-serif text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-[#8B1E2D]/50 focus:ring-2 focus:ring-[#8B1E2D]/15"
              />
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              {loading ? "Interrogazione prontuario…" : `${results.length} confezion${results.length === 1 ? "e" : "i"} in elenco`}
            </p>

            {listOpen && !selected ? (
              <div
                id="prescription-pad-results"
                role="listbox"
                className="mt-1 max-h-64 overflow-y-auto rounded-sm border border-slate-300 bg-white shadow-sm"
              >
                {loadError ? (
                  <p className="px-3 py-4 text-sm text-rose-700">{loadError}</p>
                ) : results.length === 0 && !loading ? (
                  <p className="px-3 py-4 text-sm text-slate-500">Nessun farmaco trovato.</p>
                ) : (
                  results.map((med) => {
                    const band = resolveAifaBand(med);
                    const already = prescribed.has(med.id);
                    return (
                      <button
                        key={med.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          setSelected(med);
                          setQuery(med.commercialName);
                          setListOpen(false);
                        }}
                        className="flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-[#F4EFE4]/80"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-serif text-sm font-bold text-slate-900">
                              {med.commercialName}
                            </span>
                            <AifaBandBadge band={band} />
                            {already ? (
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                                già in cartella
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                            {med.activeIngredient}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-slate-600">{med.dosageForm}</p>
                          <p className="font-mono text-[11px] tabular-nums text-slate-800">
                            €{formatSsnPrice(med.price)}{" "}
                            <span className="text-[9px] font-sans uppercase tracking-wide text-slate-400">
                              SSN
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          {selected && selectedBand ? (
            <div className="relative z-[1] mt-3 overflow-hidden rounded-sm border border-slate-300 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Riga di terapia
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setListOpen(true);
                  }}
                  className="text-[10px] font-semibold uppercase tracking-wide text-[#8B1E2D] hover:underline"
                >
                  Cambia farmaco
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-serif text-base font-bold text-slate-900">
                      {selected.commercialName}
                    </p>
                    <AifaBandBadge band={selectedBand} />
                  </div>
                  <p className="text-xs text-slate-500">{selected.activeIngredient}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{selected.dosageForm}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Prezzo SSN
                  </p>
                  <p className="font-mono text-lg tabular-nums text-slate-900">
                    €{formatSsnPrice(selected.price)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="relative z-[1] mt-3 border border-dashed border-slate-300 bg-white/40 px-3 py-2 text-[11px] text-slate-500">
              Selezionare un farmaco dal menu a tendina per compilare la riga di terapia.
            </p>
          )}

          <div className="relative z-[1] mt-4 space-y-3 rounded-sm border border-slate-300 bg-white p-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Via di somministrazione
              </span>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value as AdministrationRoute)}
                className="h-11 w-full rounded-sm border border-slate-300 bg-[#FBF9F4] px-3 text-sm text-slate-800 outline-none focus:border-[#8B1E2D]/45 focus:ring-2 focus:ring-[#8B1E2D]/10"
              >
                {ADMINISTRATION_ROUTES.map((value) => (
                  <option key={value} value={value}>
                    {ROUTE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                Posologia
              </span>
              <input
                value={posology}
                onChange={(e) => setPosology(e.target.value)}
                placeholder={POSOLOGY_PLACEHOLDERS[route]}
                maxLength={200}
                className="h-11 w-full rounded-sm border border-slate-300 bg-[#FBF9F4] px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#8B1E2D]/45 focus:ring-2 focus:ring-[#8B1E2D]/10"
              />
              <span className="block text-[10px] text-slate-400">
                Es. «1 cp ogni 12 ore», «1 fiala in bolo lento»
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-[#FBF9F4] px-5 py-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="text-[10px] text-slate-500">
              <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Medico prescrittore</p>
              <p className="mt-1 border-b border-slate-400/70 pb-0.5 font-serif italic text-slate-600">
                Firma e timbro di reparto
              </p>
            </div>
            <div className="rounded-full border border-dashed border-[#8B1E2D]/40 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8B1E2D]/80">
              FAC-SIMILE
            </div>
          </div>
          <DialogFooter className="mt-0">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-sm border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (!selected || !posology.trim()) return;
                void onConfirm({
                  medication: selected,
                  route,
                  posology: posology.trim(),
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[#8B1E2D] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#6F1724] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <PenLine className="h-3.5 w-3.5" />
              {busy ? "Registrazione…" : "Firma e valida prescrizione"}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
