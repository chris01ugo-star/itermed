import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Scale,
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

const CORE_PILLARS = [
  {
    icon: ClipboardCheck,
    title: "Accuratezza clinica",
    body: "Ogni decisione viene misurata: timing diagnostico, percorso terapeutico, priorità e aderenza alle linee guida. Non un quiz: un giudizio clinico allenabile.",
  },
  {
    icon: Scale,
    title: "Tutela medico-legale",
    body: "Consenso, documentazione, responsabilità professionale e quadro Gelli-Bianco entrano nel feedback. Formi competenza clinica e consapevolezza del rischio.",
  },
];

const SUPPORT_PILLARS = [
  {
    icon: BookOpen,
    title: "Knowledge base RAG",
    body: "Linee guida cliniche e normative indicizzate per feedback citabili, non generici.",
  },
  {
    icon: Trophy,
    title: "Progressione misurabile",
    body: "Report, trend e classifica nazionale per migliorare sessione dopo sessione.",
  },
];

export function BetaLandingPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-800">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/92 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Aequan home">
            <AequanLogo height={34} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a
              href="#prodotto"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#1E324E]"
            >
              Prodotto
            </a>
            <a
              href="#simulazioni"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#1E324E]"
            >
              Anteprima
            </a>
            <Link
              href="/chi-siamo"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#1E324E]"
            >
              Chi siamo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:text-[#1E324E]"
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
        {/* Hero — blue full-bleed */}
        <section className="relative overflow-hidden bg-[#15263C] text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 12% -10%, rgba(74,120,180,0.45), transparent 55%), radial-gradient(ellipse 50% 45% at 92% 30%, rgba(52,88,132,0.35), transparent 50%), linear-gradient(180deg, transparent 60%, rgba(15,28,45,0.55))",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "linear-gradient(180deg, black, transparent 85%)",
            }}
          />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:py-20">
            <div className="beta-hero-enter space-y-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9BB4D4]">
                Beta chiusa · Accesso su invito
              </p>

              <div className="space-y-4">
                <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                  Aequan
                </h1>
                <p className="max-w-xl text-lg font-medium leading-snug text-white/90 sm:text-xl">
                  Simulazione professionale dove contano due cose:{" "}
                  <span className="text-white">accuratezza clinica</span> e{" "}
                  <span className="text-white">tutela medico-legale</span>.
                </p>
                <p className="max-w-xl text-sm leading-relaxed text-[#A8BDD4] sm:text-[15px]">
                  Non è solo un simulatore di casi. È uno standard formativo che allena il giudizio
                  clinico e la responsabilità professionale — con feedback misurabili su decisioni,
                  documentazione e quadro normativo italiano.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#lista-attesa"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#15263C] shadow-sm transition hover:bg-[#E8EEF6]"
                >
                  Iscriviti alla lista d&apos;attesa
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </a>
                <Link
                  href="/chi-siamo"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/10"
                >
                  <Users className="h-4 w-4" strokeWidth={1.75} />
                  Chi siamo
                </Link>
              </div>

              {/* Dual core — replaces weak chip row */}
              <div className="grid gap-3 sm:grid-cols-2">
                {CORE_PILLARS.map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#345884]/50 text-[#C5D6EB]">
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <h2 className="text-sm font-semibold text-white">{title}</h2>
                    </div>
                    <p className="mt-2.5 text-[12px] leading-relaxed text-[#A8BDD4]">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="beta-hero-enter-delay lg:pl-2">
              <Suspense
                fallback={
                  <div className="h-[420px] animate-pulse rounded-2xl border border-white/10 bg-white/10" />
                }
              >
                <BetaWaitlistForm
                  anchorId="lista-attesa"
                  className="border-white/10 shadow-[0_28px_64px_-24px_rgba(0,0,0,0.55)]"
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* Dual core + support */}
        <section id="prodotto" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
              Il punto centrale
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#1E324E]">
              Clinica e responsabilità, nello stesso allenamento
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-[15px]">
              Aequan nasce come piattaforma di simulazione — ma il prodotto non si ferma al caso
              clinico. Ogni sessione misura anche come gestisci consenso, tracciabilità e rischio
              professionale.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {CORE_PILLARS.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="relative overflow-hidden rounded-2xl border border-[#1E324E]/10 bg-white p-6 sm:p-7"
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full opacity-40"
                  style={{
                    background:
                      title.includes("clinica")
                        ? "radial-gradient(circle, rgba(52,88,132,0.18), transparent 70%)"
                        : "radial-gradient(circle, rgba(30,50,78,0.16), transparent 70%)",
                  }}
                />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="relative mt-4 font-display text-xl font-bold text-[#1E324E]">
                  {title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SUPPORT_PILLARS.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="flex gap-4 rounded-2xl border border-slate-200/90 bg-white/80 px-5 py-4"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#345884]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#1E324E]">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                    {body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Simulations / mockups — kept as preferred */}
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

        {/* Bottom CTA — full-bleed, no nested form card */}
        <section className="relative overflow-hidden bg-[#15263C] text-white">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 80% at 80% 20%, rgba(74,120,180,0.28), transparent 55%), radial-gradient(ellipse 50% 60% at 0% 100%, rgba(30,50,78,0.5), transparent 50%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div className="space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9BB4D4]">
                  Beta chiusa
                </p>
                <h2 className="max-w-xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Aiutaci a definire lo standard di accuratezza clinica e tutela medico-legale
                </h2>
                <p className="max-w-lg text-sm leading-relaxed text-[#A8BDD4] sm:text-[15px]">
                  Selezioniamo un gruppo ristretto di medici, specializzandi e docenti. Il tuo
                  feedback calibra i pilastri clinico e legale prima del lancio pubblico.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href="#lista-attesa"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#15263C] transition hover:bg-[#E8EEF6]"
                  >
                    Richiedi l&apos;accesso
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </a>
                  <Link
                    href="/chi-siamo"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/45 hover:bg-white/5"
                  >
                    Chi siamo
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                {CORE_PILLARS.map(({ icon: Icon, title }) => (
                  <div
                    key={title}
                    className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3.5"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[#C5D6EB]">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="text-[11px] text-[#8FA6C0]">
                        {title.includes("clinica")
                          ? "Decisioni, timing, percorso diagnostico"
                          : "Consenso, documentazione, Gelli-Bianco"}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="px-1 pt-1 text-[11px] leading-relaxed text-[#7E95B0]">
                  Uso esclusivamente educativo · Trasparenza AI (EU AI Act) · Non è un dispositivo
                  medico
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <AequanLogo height={28} />
            <p className="mt-2 text-[11px] text-slate-400">
              Accuratezza clinica · Tutela medico-legale
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
