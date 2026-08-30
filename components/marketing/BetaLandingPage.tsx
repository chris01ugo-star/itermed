import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AequanLogo } from "@/components/AequanLogo";
import { BetaWaitlistForm } from "@/components/marketing/BetaWaitlistForm";
import {
  AEQUAN_CONTACT_EMAIL,
  AEQUAN_CONTACT_MAILTO,
  AEQUAN_INSTAGRAM_URL,
  AEQUAN_LINKEDIN_URL,
} from "@/lib/brand/contact";

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(30,50,78,0.45)]">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-full bg-white px-3 py-1 text-center text-[11px] text-slate-400 ring-1 ring-inset ring-slate-200">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function SimulatorMock() {
  return (
    <BrowserChrome url="aequan.it/dashboard/prassi/play">
      <div className="grid gap-3 p-4 sm:grid-cols-[1.2fr_0.8fr] sm:p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Dialogo clinico
              </p>
              <p className="text-sm font-semibold text-[#1E324E]">Anamnesi con il paziente</p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Sessione attiva
            </span>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#1E324E] px-3 py-2 text-[11px] leading-relaxed text-white">
              Mi racconti da quando sono iniziati i sintomi?
            </div>
            <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-slate-100 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-700">
              Stanotte, verso le 2. Un dolore al centro del petto, come una morsa…
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 flex-1 rounded-xl border border-slate-200 bg-white" />
            <div className="flex h-9 items-center rounded-xl bg-[#1E324E] px-3 text-[11px] font-semibold text-white">
              Invia
            </div>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vitali</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-rose-50 px-2 py-1.5 text-center">
                <p className="text-[9px] text-rose-400">PA</p>
                <p className="text-xs font-bold text-rose-700">150/92</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-center">
                <p className="text-[9px] text-amber-500">FC</p>
                <p className="text-xs font-bold text-amber-700">98</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-[#F7F9FC] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#345884]">
              Classifica
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-[#1E324E]">#12</p>
            <p className="text-[11px] text-slate-500">Top 18% · media 24.6/30</p>
          </div>
        </div>
      </div>
    </BrowserChrome>
  );
}

function ReportMock() {
  return (
    <BrowserChrome url="aequan.it/case/…/results">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Report simulazione
            </p>
            <p className="text-sm font-semibold text-[#1E324E]">Valutazione multi-pilastro</p>
          </div>
          <span className="rounded-md bg-[#EEF2F9] px-2 py-1 text-[11px] font-semibold text-[#345884]">
            26/30
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {["Clinica", "Legale", "Prescriv.", "Empatia", "Economia"].map((label, i) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2.5 text-center">
              <p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-[#1E324E]">
                {[5.2, 5.0, 4.8, 5.5, 5.1][i]}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3.5 py-3">
          <p className="text-[11px] font-semibold text-slate-700">Feedback clinico-legale</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Consenso acquisito prima della procedura. ECG tempestivo. Attenzione al budget SSN sugli
            esami di secondo livello.
          </p>
        </div>
      </div>
    </BrowserChrome>
  );
}

const PILLARS = [
  {
    icon: ClipboardCheck,
    title: "Accuratezza clinica",
    body: "Simuli casi reali e ricevi un punteggio su decisioni, timing e percorso diagnostico.",
  },
  {
    icon: Scale,
    title: "Tutela medico-legale",
    body: "Il motore valuta consenso, documentazione e aderenza alle linee guida (Gelli-Bianco).",
  },
  {
    icon: BookOpen,
    title: "Linee guida RAG",
    body: "Un corpus normativo e clinico indicizzato guida feedback affidabili, non generici.",
  },
  {
    icon: Trophy,
    title: "Classifica formativa",
    body: "Confrontati con altri medici in formazione e scala la classifica nazionale.",
  },
];

export function BetaLandingPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Aequan home">
            <AequanLogo height={34} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#prodotto" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#1E324E]">
              Prodotto
            </a>
            <a href="#simulazioni" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#1E324E]">
              Anteprima
            </a>
            <Link href="/chi-siamo" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-[#1E324E]">
              Chi siamo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:text-[#1E324E]"
            >
              Accedi
            </Link>
            <a
              href="#lista-attesa"
              className="inline-flex items-center gap-1 rounded-xl bg-[#1E324E] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#345884]"
            >
              Lista beta
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-white via-[#F7F9FC] to-[#F4F6F8]">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 20% 0%, rgba(52,88,132,0.14), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(30,50,78,0.08), transparent 45%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
            <div className="beta-hero-enter space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#345884]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#345884] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                Beta chiusa · Accesso su invito
              </span>
              <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-[#1E324E] sm:text-5xl">
                Aequan
              </h1>
              <p className="max-w-xl text-lg font-medium leading-snug text-slate-700 sm:text-xl">
                Il simulatore clinico e medico-legale che forma medici più sicuri, misurabili e
                consapevoli.
              </p>
              <p className="max-w-xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                Casi clinici immersivi, dialogo con il paziente virtuale, esame obiettivo, budget SSN
                e report AI su cinque pilastri scientifici — pensato per specializzandi, studenti e
                professionisti in formazione continua.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#lista-attesa"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1E324E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#345884]"
                >
                  Iscriviti alla lista d&apos;attesa
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </a>
                <Link
                  href="/chi-siamo"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#1E324E] transition hover:border-[#345884]/30 hover:bg-[#EEF2F9]"
                >
                  <Users className="h-4 w-4" strokeWidth={1.75} />
                  Chi siamo
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#345884]" /> Solo uso educativo
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-[#345884]" /> Trasparenza AI (EU AI Act)
                </span>
              </div>
            </div>

            <div className="beta-hero-enter-delay">
              <Suspense
                fallback={
                  <div className="h-[420px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
                }
              >
                <BetaWaitlistForm anchorId="lista-attesa" />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Product pillars */}
        <section id="prodotto" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
              Il progetto
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#1E324E]">
              Formazione clinica con standard professionali
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
              Aequan non è un quiz: è un ambiente di simulazione dove ogni decisione lascia traccia —
              clinica, legale, economica e relazionale — e diventa feedback azionabile.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-[#1E324E]">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-[13px]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Simulations / mockups */}
        <section id="simulazioni" className="border-y border-slate-200/80 bg-white">
          <div className="mx-auto max-w-6xl space-y-12 px-4 py-16 sm:px-6">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
                  Anteprima prodotto
                </p>
                <h2 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] sm:text-3xl">
                  Simula il caso come in un vero PS
                </h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  Dialogo con il paziente, esame obiettivo, esami e imaging, stress clinico e costo
                  SSN — tutto in un&apos;unica interfaccia pensata per l&apos;allenamento serio.
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#345884]" />
                    Casi Prassi per specialità (cardiologia e oltre)
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#345884]" />
                    Modulo consenso e documentazione medico-legale
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#345884]" />
                    Classifica nazionale per motivare il miglioramento continuo
                  </li>
                </ul>
              </div>
              <div className="beta-mock-enter">
                <SimulatorMock />
              </div>
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="beta-mock-enter order-2 lg:order-1">
                <ReportMock />
              </div>
              <div className="order-1 space-y-3 lg:order-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
                  Valutazione
                </p>
                <h2 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] sm:text-3xl">
                  Un report che parla il linguaggio del clinico
                </h2>
                <p className="text-sm leading-relaxed text-slate-500">
                  Dopo ogni simulazione ricevi un report strutturato: punteggi, trend, raccomandazioni
                  e riferimenti alle linee guida — per capire non solo il “cosa”, ma il “perché”.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-[#1E324E]/15 bg-[#1E324E] px-6 py-10 text-white sm:px-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Entra tra i primi a formare il futuro della simulazione medica
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
                  Stiamo selezionando un gruppo ristretto di beta tester. Se sei medico,
                  specializzando o docente, la tua esperienza aiuterà a calibrare Aequan prima del
                  lancio pubblico.
                </p>
                <Link
                  href="/chi-siamo"
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
                >
                  Scopri chi c&apos;è dietro Aequan
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/10" />}>
                <BetaWaitlistForm className="border-0 shadow-none" compact />
              </Suspense>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <AequanLogo height={28} />
            <p className="mt-2 text-[11px] text-slate-400">
              Simulazione formativa · non è un dispositivo medico
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-slate-500">
            <Link href="/chi-siamo" className="hover:text-[#345884]">
              Chi siamo
            </Link>
            <Link href="/terms" className="hover:text-[#345884]">
              Termini
            </Link>
            <Link href="/privacy" className="hover:text-[#345884]">
              Privacy
            </Link>
            <a href={AEQUAN_CONTACT_MAILTO} className="hover:text-[#345884]">
              {AEQUAN_CONTACT_EMAIL}
            </a>
            <a href={AEQUAN_LINKEDIN_URL} target="_blank" rel="noreferrer" className="hover:text-[#345884]">
              LinkedIn
            </a>
            <a href={AEQUAN_INSTAGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-[#345884]">
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
