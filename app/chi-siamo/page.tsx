import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AequanLogo } from "@/components/AequanLogo";
import {
  AEQUAN_CONTACT_EMAIL,
  AEQUAN_CONTACT_MAILTO,
  AEQUAN_INSTAGRAM_URL,
  AEQUAN_LINKEDIN_URL,
} from "@/lib/brand/contact";

export const metadata = {
  title: "Chi siamo · Aequan",
  description:
    "Il team di Aequan: Christopher Uguzzoni (CEO) e Dario Barbagallo (CTO).",
};

const FOUNDERS = [
  {
    name: "Christopher Uguzzoni",
    role: "CEO",
    initials: "CU",
    photoSrc: "/team/christopher-uguzzoni.png",
    // Already shot in B&W — skip CSS grayscale.
    photoGrayscale: false,
    bio: "Fondatore di Aequan. Guida visione di prodotto e standard formativo, con focus su accuratezza clinica e tutela medico-legale.",
  },
  {
    name: "Dario Barbagallo",
    role: "CTO",
    initials: "DB",
    photoSrc: "/team/dario-barbagallo.png",
    photoGrayscale: true,
    bio: "CTO di Aequan. Responsabile di architettura, piattaforma e intelligenza artificiale: dal motore clinico al prodotto in produzione.",
  },
];

function TeamMember({
  name,
  role,
  initials,
  photoSrc,
  photoGrayscale = true,
  bio,
}: {
  name: string;
  role: string;
  initials: string;
  photoSrc?: string;
  photoGrayscale?: boolean;
  bio: string;
}) {
  return (
    <article className="min-w-0 w-full">
      <div className="relative aspect-square w-full max-w-[140px] overflow-hidden bg-neutral-200 sm:max-w-[160px]">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt={name}
            className={`absolute inset-0 h-full w-full object-cover object-center${
              photoGrayscale ? " grayscale" : ""
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-300">
            <span className="font-display text-2xl font-semibold tracking-tight text-neutral-600 sm:text-3xl">
              {initials}
            </span>
          </div>
        )}
      </div>
      <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-neutral-950 sm:mt-4 sm:text-lg">
        {name}
      </h3>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500 sm:text-[12px]">
        {role}
      </p>
      <p className="mt-2.5 max-w-xs text-[13px] leading-relaxed text-neutral-600 sm:mt-3 sm:text-[14px]">
        {bio}
      </p>
    </article>
  );
}

export default function ChiSiamoPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
          <Link href="/" aria-label="Aequan home" className="min-w-0 shrink">
            <span className="block sm:hidden">
              <AequanLogo height={28} className="max-w-[7rem]" />
            </span>
            <span className="hidden sm:block">
              <AequanLogo height={34} />
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 sm:px-3.5 sm:py-2 sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Home
            </Link>
            <Link
              href="/login"
              className="hidden px-2 py-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-950 sm:inline"
            >
              Accedi
            </Link>
            <Link
              href="/#lista-attesa"
              className="rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800 sm:px-4 sm:py-2 sm:text-sm"
            >
              Lista d&apos;attesa
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16 md:py-20">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-950 sm:mb-10"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Torna alla home
        </Link>

        {/* Intro */}
        <section className="max-w-xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl md:text-5xl">
            Il team
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-600 sm:mt-5 sm:text-base">
            Aequan nasce dall&apos;incontro tra visione formativa e tecnologia: accuratezza clinica
            e tutela medico-legale, costruite in Italia per chi si forma alla professione medica.
          </p>
        </section>

        {/* Founders — equal 2-col on all breakpoints */}
        <section className="mt-12 border-t border-neutral-200 pt-8 sm:mt-16 sm:pt-10 md:mt-20 md:pt-12">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-10 lg:grid-cols-[minmax(0,12rem)_1fr] lg:gap-16">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl md:text-2xl">
                Fondatori
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-10">
              {FOUNDERS.map((member) => (
                <TeamMember key={member.name} {...member} />
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-14 border-t border-neutral-200 pt-8 sm:mt-20 sm:pt-10 md:mt-24 md:pt-12">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-10 lg:grid-cols-[minmax(0,12rem)_1fr] lg:gap-16">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight text-neutral-950 sm:text-xl md:text-2xl">
                Contatti
              </h2>
            </div>
            <div className="max-w-md space-y-4 text-[15px] text-neutral-600">
              <p>
                Per partnership, università o accesso beta:{" "}
                <a
                  href={AEQUAN_CONTACT_MAILTO}
                  className="break-all font-medium text-neutral-950 underline-offset-4 hover:underline"
                >
                  {AEQUAN_CONTACT_EMAIL}
                </a>
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <a
                  href={AEQUAN_LINKEDIN_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-neutral-950 underline-offset-4 hover:underline"
                >
                  LinkedIn
                </a>
                <a
                  href={AEQUAN_INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-neutral-950 underline-offset-4 hover:underline"
                >
                  Instagram
                </a>
              </div>
              <Link
                href="/"
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                Torna alla home
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-[12px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Aequan · Accuratezza clinica e tutela medico-legale</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-neutral-950">
              Termini
            </Link>
            <Link href="/privacy" className="hover:text-neutral-950">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
