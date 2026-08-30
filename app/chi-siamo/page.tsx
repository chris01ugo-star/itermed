import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  Instagram,
  Linkedin,
  Mail,
  Scale,
  ClipboardCheck,
} from "lucide-react";
import { AequanLogo } from "@/components/AequanLogo";
import { BetaWaitlistForm } from "@/components/marketing/BetaWaitlistForm";
import {
  AEQUAN_CONTACT_EMAIL,
  AEQUAN_CONTACT_MAILTO,
  AEQUAN_INSTAGRAM_HANDLE,
  AEQUAN_INSTAGRAM_URL,
  AEQUAN_LINKEDIN_HANDLE,
  AEQUAN_LINKEDIN_URL,
} from "@/lib/brand/contact";

export const metadata = {
  title: "Chi siamo · Aequan",
  description:
    "Il team di Aequan: accuratezza clinica e tutela medico-legale per la formazione medica digitale.",
};

const TEAM = [
  {
    name: "Christopher Uguzzoni",
    role: "Fondatore",
    initials: "CU",
    tone: "from-[#1E324E] via-[#2A486D] to-[#345884]",
    bio: "Visione di prodotto e standard formativo. Guida la direzione clinica e medico-legale di Aequan.",
  },
  {
    name: "Dario Barbagallo",
    role: "CTO",
    initials: "DB",
    tone: "from-[#15263C] via-[#1E324E] to-[#2A486D]",
    bio: "Architettura, piattaforma e intelligenza artificiale. Traduce il metodo in prodotto affidabile e scalabile.",
  },
] as const;

function ChiSiamoHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-20 sm:gap-4 sm:px-6">
        <Link href="/" className="min-w-0 shrink" aria-label="Aequan home">
          <span className="block sm:hidden">
            <AequanLogo height={28} className="max-w-[7.5rem]" />
          </span>
          <span className="hidden sm:block">
            <AequanLogo height={40} />
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/#pilastri"
            className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Come funziona
          </Link>
          <Link
            href="/#lista-attesa"
            className="rounded-full px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            Lista beta
          </Link>
          <span className="rounded-full px-3.5 py-2 text-sm font-semibold text-[#1E324E]">
            Chi siamo
          </span>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/login"
            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:px-3.5 sm:py-2 sm:text-sm"
          >
            Accedi
          </Link>
          <Link
            href="/#lista-attesa"
            className="inline-flex items-center gap-1 rounded-xl bg-[#1E324E] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#2A486D] sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
          >
            Lista d&apos;attesa
          </Link>
        </div>
      </div>
    </header>
  );
}

function TeamCard({
  name,
  role,
  initials,
  tone,
  bio,
  featured,
}: {
  name: string;
  role: string;
  initials: string;
  tone: string;
  bio: string;
  featured?: boolean;
}) {
  return (
    <article
      className={
        featured
          ? "group relative mx-auto w-full max-w-[280px] overflow-hidden rounded-[1.75rem] bg-white shadow-[0_28px_50px_-28px_rgba(30,50,78,0.45)] ring-1 ring-[#1E324E]/10 sm:max-w-none"
          : "group relative mx-auto w-full max-w-[260px] overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_40px_-28px_rgba(30,50,78,0.35)] ring-1 ring-slate-200/80 sm:max-w-none"
      }
    >
      <div className={`relative aspect-[3/4] bg-gradient-to-br ${tone}`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 80% 80%, rgba(0,0,0,0.25), transparent 50%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-5xl font-semibold tracking-tight text-white/90 sm:text-6xl">
            {initials}
          </span>
        </div>
        <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
          <p className="text-[15px] font-semibold tracking-tight text-slate-900">{name}</p>
          <p className="mt-0.5 text-sm text-slate-500">{role}</p>
        </div>
      </div>
      <p className="px-4 py-3.5 text-[13px] leading-relaxed text-slate-500">{bio}</p>
    </article>
  );
}

export default function ChiSiamoPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <ChiSiamoHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-10 pt-14 text-center sm:px-6 sm:pb-12 sm:pt-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(52,88,132,0.10), transparent 60%)",
            }}
          />
          <div className="relative mx-auto max-w-3xl">
            <p className="text-[13px] font-semibold text-[#345884]">Chi siamo</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              Il team dietro accuratezza clinica e tutela medico-legale
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Aequan è un progetto italiano di formazione medica digitale. Uniamo simulazione
              clinica, responsabilità professionale e tecnologie affidabili — per chi studia, si
              specializza o aggiorna le proprie competenze.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#contatti-team"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Contattaci
              </a>
              <Link
                href="/#lista-attesa"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E324E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2A486D]"
              >
                Lista d&apos;attesa beta
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="px-4 pb-6 sm:px-6">
          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2 sm:gap-8">
            {TEAM.map((member, i) => (
              <TeamCard key={member.name} {...member} featured={i === 0} />
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-xl text-center text-sm leading-relaxed text-slate-500">
            In fase di validazione tecnica e commerciale stiamo costruendo, insieme a un gruppo
            selezionato di beta tester, lo standard formativo della prossima generazione di
            professionisti della salute.
          </p>
        </section>

        {/* Values strip */}
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border border-slate-200 bg-[#F7F9FC] px-5 py-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#345884] ring-1 ring-slate-200/80">
                <ClipboardCheck className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1E324E]">Accuratezza clinica</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                  Decisioni, timing e percorso diagnostico misurati in ogni simulazione.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-slate-200 bg-[#F7F9FC] px-5 py-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#345884] ring-1 ring-slate-200/80">
                <Scale className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1E324E]">Tutela medico-legale</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-[13px]">
                  Consenso, documentazione e quadro normativo italiano nel feedback formativo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact + waitlist */}
        <section id="contatti-team" className="border-t border-slate-200 bg-[#F4F7FA] px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
            <Suspense
              fallback={
                <div className="h-[380px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
              }
            >
              <BetaWaitlistForm className="shadow-[0_20px_50px_-28px_rgba(30,50,78,0.35)]" />
            </Suspense>

            <div className="space-y-8 lg:pt-2">
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                  Parla con il team
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Partnership, università, supporto o richiesta di accesso beta: scegli il canale
                  più adatto.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#345884]" strokeWidth={1.75} />
                    <p className="text-sm font-semibold text-slate-900">Email</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Per partnership, supporto e richieste istituzionali.
                  </p>
                  <a
                    href={AEQUAN_CONTACT_MAILTO}
                    className="mt-1.5 inline-block text-sm font-semibold text-[#345884] underline-offset-2 hover:underline"
                  >
                    {AEQUAN_CONTACT_EMAIL}
                  </a>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-[#345884]" strokeWidth={1.75} />
                    <p className="text-sm font-semibold text-slate-900">LinkedIn</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Aggiornamenti sul prodotto e sulla formazione clinica digitale.
                  </p>
                  <a
                    href={AEQUAN_LINKEDIN_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-sm font-semibold text-[#345884] underline-offset-2 hover:underline"
                  >
                    {AEQUAN_LINKEDIN_HANDLE}
                  </a>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-[#345884]" strokeWidth={1.75} />
                    <p className="text-sm font-semibold text-slate-900">Instagram</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Dietro le quinte del progetto e della community in formazione.
                  </p>
                  <a
                    href={AEQUAN_INSTAGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-sm font-semibold text-[#345884] underline-offset-2 hover:underline"
                  >
                    @{AEQUAN_INSTAGRAM_HANDLE}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <AequanLogo height={22} />
            <p className="text-[11px] text-slate-400">
              Accuratezza clinica · Tutela medico-legale
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[12px] text-slate-500">
            <Link href="/" className="hover:text-[#345884]">
              Home
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
          </div>
        </div>
      </footer>
    </div>
  );
}
