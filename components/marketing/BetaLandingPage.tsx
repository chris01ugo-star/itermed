import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  Euro,
  GraduationCap,
  HeartHandshake,
  Instagram,
  Linkedin,
  MessageCircle,
  Scale,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { AequanLogo } from "@/components/AequanLogo";
import { Badge } from "@/app/ui/badge";
import { ContactEmail } from "@/components/legal/ContactEmail";
import { LandingContactEmail } from "@/components/marketing/LandingContactEmail";
import { BetaWaitlistForm } from "@/components/marketing/BetaWaitlistForm";
import {
  AEQUAN_INSTAGRAM_HANDLE,
  AEQUAN_INSTAGRAM_URL,
  AEQUAN_LINKEDIN_HANDLE,
  AEQUAN_LINKEDIN_URL,
} from "@/lib/brand/contact";

/* ────────────────────────────────────────────────────────────────────────
   Navbar
   ──────────────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#pilastri", label: "Come funziona" },
  { href: "#lista-attesa", label: "Lista beta" },
  { href: "#contatti", label: "Contatti" },
];

function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-20 sm:gap-4 sm:px-6">
        <Link href="/" className="min-w-0 shrink">
          <span className="block sm:hidden">
            <AequanLogo height={28} className="max-w-[7.5rem]" />
          </span>
          <span className="hidden sm:block">
            <AequanLogo height={40} />
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/login"
            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:px-3.5 sm:py-2 sm:text-sm"
          >
            Accedi
          </Link>
          <Link
            href="/chi-siamo"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#1E324E]/20 bg-[#EEF2F9] px-3 py-1.5 text-xs font-semibold text-[#1E324E] transition hover:border-[#1E324E]/35 hover:bg-[#E2E9F3] sm:px-4 sm:py-2 sm:text-sm"
          >
            Chi siamo
          </Link>
          <a
            href="#lista-attesa"
            className="inline-flex items-center gap-1 rounded-xl bg-[#1E324E] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#2A486D] sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
          >
            Lista d&apos;attesa
          </a>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Hero + product preview mockup
   ──────────────────────────────────────────────────────────────────────── */

const RADAR_DIMENSIONS = [
  "Accuratezza Clinica",
  "Tutela Legale",
  "Sostenibilità",
  "Appropriatezza",
  "Empatia",
];

function ProductPreviewCard() {
  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_60px_-25px_rgba(30,50,78,0.35)]">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className="flex-1 truncate rounded-full bg-white px-3 py-1 text-center text-[11px] text-slate-400 ring-1 ring-inset ring-slate-200">
          app.aequan.it/dashboard
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-[1.1fr_0.9fr] sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bentornato</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">Il tuo profilo competenze</p>
          </div>

          <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            <svg viewBox="0 0 200 200" className="h-full w-full">
              <polygon
                points="100,10 190,75 155,180 45,180 10,75"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <polygon
                points="100,55 145,90 125,150 75,150 55,90"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <polygon
                points="100,40 165,85 140,165 60,165 35,85"
                fill="color-mix(in srgb, #345884 18%, transparent)"
                stroke="#345884"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {RADAR_DIMENSIONS.map((dim) => (
              <span
                key={dim}
                className="rounded-full bg-[#1E324E]/8 px-2 py-1 text-[10px] font-semibold text-[#1E324E]"
              >
                {dim}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">Simulatore in corso</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                Paziente instabile
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">Uomo 33 anni, cefalea acuta</p>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-rose-50 py-1.5 text-center">
                <p className="text-[9px] font-medium text-rose-400">PA</p>
                <p className="text-xs font-bold text-rose-700">146/95</p>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-rose-500">Ipertesa</p>
              </div>
              <div className="rounded-lg bg-amber-50 py-1.5 text-center">
                <p className="text-[9px] font-medium text-amber-500">FC</p>
                <p className="text-xs font-bold text-amber-700">123</p>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-amber-600">
                  Tachicardia
                </p>
              </div>
              <div className="rounded-lg bg-rose-50 py-1.5 text-center">
                <p className="text-[9px] font-medium text-rose-400">SpO2</p>
                <p className="text-xs font-bold text-rose-700">85%</p>
                <p className="text-[8px] font-semibold uppercase tracking-wide text-rose-500">Ipossia</p>
              </div>
            </div>

            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg rounded-tl-sm bg-[#1E324E]/[0.06] px-2.5 py-2 text-[11px] leading-snug text-slate-600">
              <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-[#1E324E]/50" />
              &quot;Da quando ha iniziato il mal di testa?&quot;
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500">Report AI</p>
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div className="h-1.5 w-[82%] rounded-full bg-[#345884]" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div className="h-1.5 w-[64%] rounded-full bg-[#345884]" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div className="h-1.5 w-[90%] rounded-full bg-[#345884]" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-[#1E324E] p-3.5 text-white shadow-sm">
            <p className="text-xs font-medium text-white/70">Empatia percepita</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              88<span className="text-sm font-medium text-white/60">/100</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(52,88,132,0.12), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="text-[13px] font-medium tracking-wide text-slate-500">
          Fase beta · posti limitati
        </p>

        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Allena il{" "}
          <span className="text-[#345884]">giudizio clinico</span>
          <br className="hidden sm:block" /> prima del paziente reale.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Il simulatore clinico basato su IA che allena l&apos;equilibrio decisionale del medico —
          con focus su accuratezza clinica e tutela medico-legale.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="info">Accuratezza clinica</Badge>
          <Badge variant="info">Tutela medico-legale</Badge>
          <Badge variant="danger">Empatia</Badge>
          <Badge variant="success">Sostenibilità delle risorse</Badge>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#lista-attesa"
            className="inline-flex items-center gap-2 rounded-full bg-[#1E324E] px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#2A486D]"
          >
            Iscriviti alla lista d&apos;attesa
            <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            href="/chi-siamo"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Chi siamo
          </Link>
        </div>

        <div className="mt-16">
          <ProductPreviewCard />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Trust strip
   ──────────────────────────────────────────────────────────────────────── */

const TRUST_ITEMS = [
  { label: "Specialità SSM coperte", value: "19+" },
  { label: "Dimensioni di valutazione AI", value: "5" },
  { label: "Report basati su linee guida", value: "RAG" },
  { label: "Normativa IA europea", value: "EU AI Act" },
];

function TrustStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/70">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
        {TRUST_ITEMS.map((item) => (
          <div key={item.label} className="text-center">
            <p className="font-display text-2xl font-semibold text-[#1E324E]">{item.value}</p>
            <p className="mt-1 text-xs leading-snug text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Decorative pulse (ECG) line
   ──────────────────────────────────────────────────────────────────────── */

function PulseLine({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 32"
      className={className}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 16 H108 L118 16 L127 3 L138 29 L147 16 L156 16 L164 9 L171 23 L178 16 H300"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Pillars
   ──────────────────────────────────────────────────────────────────────── */

const PILLARS = [
  {
    icon: ClipboardCheck,
    dimension: "Accuratezza",
    variant: "info" as const,
    title: "Accuratezza clinica",
    description:
      "Timing diagnostico, percorso terapeutico e decisioni misurate sessione dopo sessione — non un quiz, un giudizio clinico allenabile.",
  },
  {
    icon: Scale,
    dimension: "Tutela Legale",
    variant: "info" as const,
    title: "Tutela medico-legale",
    description:
      "Consenso, documentazione e quadro Gelli-Bianco entrano nel feedback. Formi competenza clinica e consapevolezza del rischio professionale.",
  },
  {
    icon: HeartHandshake,
    dimension: "Empatia",
    variant: "danger" as const,
    title: "Clinica ed Empatia",
    description:
      "L'IA non valuta solo se la diagnosi è corretta, ma la delicatezza e l'efficacia della comunicazione medico-paziente durante l'intera visita virtuale.",
  },
  {
    icon: Euro,
    dimension: "Sostenibilità",
    variant: "success" as const,
    title: "Risorse e Cura",
    description:
      "Il tariffario del Servizio Sanitario Nazionale è integrato in ogni caso: impari a bilanciare cura clinica e sostenibilità delle risorse.",
  },
];

function LandingPillars() {
  return (
    <section id="pilastri" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E324E]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1E324E]">
          Il metodo
        </span>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Due pilastri centrali, un metodo completo
        </h2>
        <PulseLine className="mx-auto mt-4 h-5 w-36 text-[#1E324E]/25" />
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Aequan è più di un simulatore di casi: al centro ci sono{" "}
          <strong className="font-semibold text-slate-800">accuratezza clinica</strong> e{" "}
          <strong className="font-semibold text-slate-800">tutela medico-legale</strong>, insieme a
          empatia e sostenibilità delle risorse — come nel report di fine caso.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <Badge variant={pillar.variant}>{pillar.dimension}</Badge>
                  <Icon className="h-5 w-5 text-slate-300" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   How it works — linee guida RAG
   ──────────────────────────────────────────────────────────────────────── */

const PREVIEW_GUIDELINES = [
  {
    title: "Surviving Sepsis Campaign — Bundle iniziale",
    meta: "Sintesi formativa · Infettivologia",
    tags: ["sepsi", "emergenza"],
    excerpt: "Non ritardare la terapia antibiotica per attendere esami non essenziali.",
  },
  {
    title: "Linee Guida ESC 2023 — Sindromi Coronariche Acute",
    meta: "Sintesi operativa · Cardiologia",
    tags: ["sca", "stemi"],
    excerpt: "Valutazione iniziale e stratificazione del rischio ischemico.",
  },
  {
    title: "Stroke acuto — Percorso tempo-dipendente",
    meta: "Sintesi ESO/AAN · Neurologia",
    tags: ["ictus", "tempo-dipendente"],
    excerpt: "Deficit focale improvviso: riconoscimento rapido con FAST/BE-FAST.",
  },
];

function LandingHowItWorks() {
  return (
    <section id="percorso" className="relative overflow-hidden bg-[#0F1E30] py-24">
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[#345884] opacity-20 blur-[110px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Il motore RAG
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Le linee guida dietro ogni valutazione
          </h2>
          <PulseLine className="mx-auto mt-4 h-5 w-36 text-[#345884]/60" />
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Ogni feedback dell&apos;IA nasce da sintesi verificabili di società scientifiche,
            protocolli e normative — non da improvvisazione.
          </p>
        </div>

        <div className="relative mt-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </div>
            <div className="flex-1 truncate rounded-full bg-white px-3 py-1 text-center text-[11px] text-slate-400 ring-1 ring-inset ring-slate-200">
              app.aequan.it/linee-guida
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E324E]/8 text-[#1E324E]">
                  <BookOpen className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-slate-900">Linee Guida</p>
              </div>
              <span className="text-[11px] font-medium text-slate-400">50+ documenti attivi</span>
            </div>

            <div className="mt-3.5 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[12px] text-slate-400">Cerca per titolo, tag o contenuto…</span>
            </div>

            <div className="relative mt-4">
              <div className="space-y-2.5">
                {PREVIEW_GUIDELINES.map((doc) => (
                  <div key={doc.title} className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{doc.title}</p>
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        Attiva
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">{doc.meta}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#1E324E]/6 px-2 py-0.5 text-[10px] font-medium text-[#1E324E]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 truncate text-[12px] text-slate-500">{doc.excerpt}</p>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
            </div>

            <div className="mt-1 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                + oltre 45 altri documenti caricati nel motore RAG
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Waitlist (replaces pricing during closed beta)
   ──────────────────────────────────────────────────────────────────────── */

function LandingWaitlist() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E324E]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1E324E]">
            Accesso anticipato
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Entra nella lista d&apos;attesa della beta
          </h2>
          <PulseLine className="mt-4 h-5 w-36 text-[#1E324E]/25" />
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            La registrazione pubblica è chiusa. Selezioniamo un gruppo ristretto di medici,
            specializzandi e docenti per calibrare accuratezza clinica e tutela medico-legale prima
            del lancio.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {[
              "Simulazioni cliniche immersive con paziente virtuale",
              "Feedback su accuratezza clinica e tutela medico-legale",
              "Report AI multi-pilastro basati su linee guida RAG",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#345884]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-500">
            Vuoi saperne di più sul team?{" "}
            <Link href="/chi-siamo" className="font-semibold text-[#1E324E] underline-offset-2 hover:underline">
              Chi siamo
            </Link>
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-[380px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          }
        >
          <BetaWaitlistForm anchorId="lista-attesa" />
        </Suspense>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Contatti
   ──────────────────────────────────────────────────────────────────────── */

function ContactChannelLink({
  href,
  label,
  handle,
  icon: Icon,
}: {
  href: string;
  label: string;
  handle: string;
  icon: LucideIcon;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-5 transition hover:border-[#345884]/35"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[#345884]" strokeWidth={1.75} aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>
        </div>
        <p className="mt-2 truncate font-display text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          {handle}
        </p>
      </div>
      <p className="text-sm font-semibold text-[#345884] transition group-hover:text-[#1E324E]">
        Apri profilo
      </p>
    </a>
  );
}

function LandingContacts() {
  return (
    <section
      id="contatti"
      className="relative border-t border-slate-200/80 bg-[#F4F7FA] px-4 py-12 sm:px-6 sm:py-14"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(52,88,132,0.12),transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1E324E]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1E324E]">
            Contatti
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.15rem]">
            Come raggiungerci
          </h2>
          <PulseLine className="mt-3 h-5 w-28 text-[#1E324E]/25" />
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            Supporto, partnership o richiesta di accesso beta: scegli il canale e aprilo direttamente.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <LandingContactEmail />
          <ContactChannelLink
            href={AEQUAN_LINKEDIN_URL}
            label="LinkedIn"
            handle={AEQUAN_LINKEDIN_HANDLE}
            icon={Linkedin}
          />
          <ContactChannelLink
            href={AEQUAN_INSTAGRAM_URL}
            label="Instagram"
            handle={`@${AEQUAN_INSTAGRAM_HANDLE}`}
            icon={Instagram}
          />
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Final CTA
   ──────────────────────────────────────────────────────────────────────── */

function LandingFinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12 pb-24 sm:px-6 sm:py-14 sm:pb-24">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#0F1E30] px-8 py-16 text-center sm:px-16">
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#345884] opacity-30 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-[#7BA0C7] opacity-20 blur-[90px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
          aria-hidden
        />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80">
            <GraduationCap className="h-3.5 w-3.5" />
            Accesso anticipato alla Beta
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold text-white sm:text-3xl">
            Pronto ad allenare accuratezza clinica e tutela medico-legale?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Lascia la tua email: ti contatteremo quando apriremo un posto nella beta chiusa.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#lista-attesa"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1E324E] shadow-md transition-transform hover:scale-[1.02]"
            >
              Iscriviti alla lista d&apos;attesa
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Ho già un account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Footer
   ──────────────────────────────────────────────────────────────────────── */

function LandingFooter() {
  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-8 sm:flex-row sm:items-start sm:px-6">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <AequanLogo height={20} />
          <ContactEmail variant="stacked" />
          <Link
            href="/chi-siamo"
            className="text-sm font-semibold text-[#1E324E] underline-offset-2 hover:underline"
          >
            Chi siamo
          </Link>
        </div>
        <div className="flex max-w-xl items-start gap-2 text-left text-xs leading-snug text-slate-500">
          <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#345884]" />
          <span>
            Progettato in conformità con le linee guida di trasparenza e sicurezza del Regolamento
            UE sull&apos;Intelligenza Artificiale (EU AI Act)
          </span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────── */

export function BetaLandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingNavbar />
      <main>
        <LandingHero />
        <TrustStrip />
        <LandingPillars />
        <LandingHowItWorks />
        <LandingWaitlist />
        <LandingContacts />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
