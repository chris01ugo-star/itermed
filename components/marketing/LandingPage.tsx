import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  Euro,
  GraduationCap,
  HeartHandshake,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AequanLogo } from "@/components/AequanLogo";
import { Badge } from "@/app/ui/badge";
import { ContactEmail } from "@/components/legal/ContactEmail";

/* ────────────────────────────────────────────────────────────────────────
   Navbar
   ──────────────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: "#pilastri", label: "Come funziona" },
  { href: "#percorso", label: "Il percorso" },
  { href: "#prezzi", label: "Prezzi" },
];

function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-20 sm:gap-4 sm:px-6">
        <Link href="/" className="min-w-0 shrink">
          {/* Compact mark on narrow screens so Accedi + CTA stay on one row. */}
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
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:px-4 sm:py-2 sm:text-sm"
          >
            Accedi
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1 rounded-full bg-[#1E324E] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#2A486D] sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
          >
            Inizia gratis
          </Link>
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
      {/* Fake browser chrome */}
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

      {/* Fake dashboard content */}
      <div className="grid gap-4 p-5 sm:grid-cols-[1.1fr_0.9fr] sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bentornato</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">Il tuo profilo competenze</p>
          </div>

          {/* Simple static radar shape */}
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
          {/* Peek into the live simulator: color-coded vitals + patient dialogue, mirroring the real product */}
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
                <p className="text-[8px] font-semibold uppercase tracking-wide text-amber-600">Tachicardia</p>
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
            <p className="mt-1 text-2xl font-semibold tabular-nums">88<span className="text-sm font-medium text-white/60">/100</span></p>
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
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-[#1E324E] shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          In arrivo — accesso anticipato alla Beta
        </span>

        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Allena il{" "}
          <span className="text-[#345884]">giudizio clinico</span>
          <br className="hidden sm:block" /> prima del paziente reale.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Il simulatore clinico basato su IA che allena l&apos;equilibrio decisionale del medico —
          non solo la diagnosi giusta.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="danger">Empatia</Badge>
          <Badge variant="success">Sostenibilità delle risorse</Badge>
          <Badge variant="info">Tutela medico-legale</Badge>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#1E324E] px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#2A486D]"
          >
            Richiedi accesso alla Beta
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#pilastri"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Scopri come funziona
          </a>
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
   Decorative pulse (ECG) line — reinforces the "medical tool" identity
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
   Pillars — "I tre pilastri di AEQUAN"
   ──────────────────────────────────────────────────────────────────────── */

const PILLARS = [
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
      "Il tariffario del Servizio Sanitario Nazionale è integrato in ogni caso: impari a superare la medicina defensiva, bilanciando cura clinica e sostenibilità.",
  },
  {
    icon: ShieldCheck,
    dimension: "Tutela Legale",
    variant: "info" as const,
    title: "Sicurezza e Legge",
    description:
      "Un sistema RAG (Retrieval-Augmented Generation) fa da scudo formativo, garantendo che ogni valutazione rispetti linee guida e tutela medico-legale.",
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
          I tre pilastri di AEQUAN
        </h2>
        <PulseLine className="mx-auto mt-4 h-5 w-36 text-[#1E324E]/25" />
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Ispirato all&apos;<em>aequanimitas</em> di Sir William Osler: la capacità di restare
          lucidi e bilanciati di fronte all&apos;incertezza clinica. Ogni pilastro corrisponde a
          una dimensione realmente misurata nel tuo report di fine caso.
        </p>
      </div>

      {/* Clinical panel: mirrors the vitals/parameters card used inside the simulator */}
      <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title} className="p-7">
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
   How it works — "Il percorso"
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
      {/* Ambient glow accents, consistent with the final CTA treatment */}
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

        {/* Simulated app screen — a compact peek at the Guidelines hub */}
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

              {/* Fade + hint that many more documents power the RAG engine */}
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
   Pricing
   ──────────────────────────────────────────────────────────────────────── */

type PricingPlan = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
};

const PLANS: PricingPlan[] = [
  {
    name: "Free",
    price: "€0",
    description: "Per provare AEQUAN senza impegno.",
    features: [
      "2 simulazioni cliniche di prova",
      "5 messaggi per sessione di chat",
      "Accesso alle linee guida di base",
      "Report di valutazione su 5 dimensioni",
    ],
    cta: "Inizia gratis",
    href: "/signup",
  },
  {
    name: "Student",
    price: "€9",
    period: "/mese*",
    description: "Per chi si prepara a concorsi SSM e tirocini.",
    features: [
      "Simulazioni cliniche illimitate",
      "15 messaggi per sessione di chat",
      "Libreria completa dei casi per specialità",
      "Report AI dettagliato + cronologia progressi",
    ],
    cta: "Passa a Student",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "€19",
    period: "/mese*",
    description: "Per specializzandi e strutture formative.",
    features: [
      "Tutto ciò che è incluso in Student",
      "Generazione di casi clinici su misura",
      "Bundle tematici e casi atipici",
      "Supporto prioritario",
    ],
    cta: "Passa a Premium",
    href: "/signup",
  },
];

function LandingPricing() {
  return (
    <section id="prezzi" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Un piano per ogni fase del tuo percorso
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Inizia gratis, passa a un abbonamento quando vuoi allenarti senza limiti.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={
              plan.highlighted
                ? "relative flex flex-col rounded-2xl border-2 border-[#1E324E] bg-white p-6 shadow-lg"
                : "relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            }
          >
            {plan.highlighted ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#1E324E] px-3 py-1 text-[11px] font-semibold text-white">
                Più scelto
              </span>
            ) : null}

            <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>

            <p className="mt-5 flex items-baseline gap-1">
              <span className="font-display text-3xl font-semibold text-slate-900">{plan.price}</span>
              {plan.period ? <span className="text-sm text-slate-400">{plan.period}</span> : null}
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#345884]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href={plan.href}
              className={
                plan.highlighted
                  ? "mt-6 inline-flex items-center justify-center rounded-full bg-[#1E324E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2A486D]"
                  : "mt-6 inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              }
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        *Prezzi indicativi di lancio, IVA inclusa dove applicabile — soggetti a conferma finale.
      </p>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Final CTA
   ──────────────────────────────────────────────────────────────────────── */

function LandingFinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#0F1E30] px-8 py-16 text-center sm:px-16">
        {/* Ambient glow blobs */}
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#345884] opacity-30 blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-[#7BA0C7] opacity-20 blur-[90px]"
          aria-hidden
        />
        {/* Faint grid texture */}
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
            Pronto ad allenare il tuo giudizio clinico?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Unisciti agli specializzandi che si allenano con AEQUAN prima del lancio ufficiale.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1E324E] shadow-md transition-transform hover:scale-[1.02]"
            >
              Richiedi accesso alla Beta
              <ArrowRight className="h-4 w-4" />
            </Link>
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

/** Slim marketing strip above the global SiteFooter (logo, contact, compliance —
 *  Termini/Privacy/copyright already live in the app-wide SiteFooter). */
function LandingFooter() {
  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-8 sm:flex-row sm:items-start sm:px-6">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <AequanLogo height={20} />
          <ContactEmail variant="stacked" />
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

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LandingNavbar />
      <main>
        <LandingHero />
        <TrustStrip />
        <LandingPillars />
        <LandingHowItWorks />
        <LandingPricing />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
