import Link from "next/link";
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
    photoSrc: undefined as string | undefined,
  },
  {
    name: "Dario Barbagallo",
    role: "CTO",
    initials: "DB",
    photoSrc: "/team/dario-barbagallo.png",
  },
];

function TeamMember({
  name,
  role,
  initials,
  photoSrc,
}: {
  name: string;
  role: string;
  initials: string;
  photoSrc?: string;
}) {
  return (
    <article className="w-full max-w-[220px]">
      <div className="relative aspect-square overflow-hidden bg-neutral-200">
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover object-center grayscale"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-300">
            <span className="font-display text-4xl font-semibold tracking-tight text-neutral-600">
              {initials}
            </span>
          </div>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight text-neutral-950">
        {name}
      </h3>
      <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {role}
      </p>
    </article>
  );
}

export default function ChiSiamoPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
          <Link href="/" aria-label="Aequan home">
            <AequanLogo height={34} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="px-2 py-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-950"
            >
              Accedi
            </Link>
            <Link
              href="/#lista-attesa"
              className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Lista d&apos;attesa
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Intro */}
        <section className="max-w-xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
            Il team
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-neutral-600 sm:text-base">
            Aequan nasce dall&apos;incontro tra visione formativa e tecnologia: accuratezza clinica
            e tutela medico-legale, costruite in Italia per chi si forma alla professione medica.
          </p>
        </section>

        {/* Founders row — same size cards */}
        <section className="mt-16 border-t border-neutral-200 pt-10 sm:mt-20 sm:pt-12">
          <div className="grid gap-8 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-10 lg:gap-16">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                Fondatori
              </h2>
            </div>
            <div className="flex flex-wrap gap-8 sm:gap-10">
              {FOUNDERS.map((member) => (
                <TeamMember key={member.name} {...member} />
              ))}
            </div>
          </div>
        </section>

        {/* Quiet contact */}
        <section className="mt-20 border-t border-neutral-200 pt-10 sm:mt-24 sm:pt-12">
          <div className="grid gap-8 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-10 lg:gap-16">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                Contatti
              </h2>
            </div>
            <div className="max-w-md space-y-4 text-[15px] text-neutral-600">
              <p>
                Per partnership, università o accesso beta:{" "}
                <a
                  href={AEQUAN_CONTACT_MAILTO}
                  className="font-medium text-neutral-950 underline-offset-4 hover:underline"
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
                <Link
                  href="/"
                  className="font-medium text-neutral-950 underline-offset-4 hover:underline"
                >
                  Torna alla home
                </Link>
              </div>
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
