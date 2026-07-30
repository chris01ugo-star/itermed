import type { ReactNode } from "react";
import Link from "next/link";
import { AequanLogo } from "@/components/AequanLogo";

/** Shared chrome for legal pages — no banners, no placeholder notices. */
export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className="inline-flex items-center hover:opacity-90">
            <AequanLogo height={36} />
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-3 text-xs font-medium text-slate-600 sm:gap-4">
            <Link href="/terms" className="underline-offset-2 hover:text-[#1E324E] hover:underline">
              Termini
            </Link>
            <Link href="/privacy" className="underline-offset-2 hover:text-[#1E324E] hover:underline">
              Privacy
            </Link>
            <Link href="/cookies" className="underline-offset-2 hover:text-[#1E324E] hover:underline">
              Cookie
            </Link>
            <Link
              href="/ai-transparency"
              className="underline-offset-2 hover:text-[#1E324E] hover:underline"
            >
              AI
            </Link>
            <Link href="/signup" className="underline-offset-2 hover:text-[#1E324E] hover:underline">
              Registrati
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Aequan · Documento legale
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#2F4156] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">Ultimo aggiornamento: {lastUpdated}</p>
        <article className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
          {children}
        </article>
        <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-500">
          <p>
            Titolare: Christopher Uguzzoni · Pavullo nel Frignano (MO), Italia · CF GZZCRS01T12G393M
          </p>
          <p className="mt-1">
            Contatti:{" "}
            <a
              href="mailto:chris01.ugo@gmail.com"
              className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
            >
              chris01.ugo@gmail.com
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-[#1E324E]">{title}</h2>
      <div className="space-y-2 text-slate-600">{children}</div>
    </section>
  );
}
