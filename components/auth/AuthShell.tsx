import type { ReactNode } from "react";
import Link from "next/link";
import { AequanLogo } from "@/components/AequanLogo";

const DIMENSIONS = [
  "Accuratezza Clinica",
  "Tutela Legale",
  "Sostenibilità",
  "Appropriatezza",
  "Empatia",
];

type AuthShellProps = {
  children: ReactNode;
  /** Short line under the brand headline on the left panel. */
  brandLine?: string;
};

/**
 * Split auth layout: brand atmosphere on the left, form on the right.
 * Shared by login and signup so both feel like the medical product, not a generic form card.
 */
export function AuthShell({
  children,
  brandLine = "Simulatore clinico con valutazione AI su cinque dimensioni.",
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#F4F6F8]">
      {/* Ambient wash behind the form column */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(52,88,132,0.08),transparent_50%),radial-gradient(ellipse_at_20%_90%,rgba(30,50,78,0.05),transparent_45%)]"
        aria-hidden
      />

      {/* Brand panel */}
      <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-[#1E324E] px-10 py-10 text-white lg:flex xl:w-[48%] xl:px-14">
        {/* Soft light blobs + grid */}
        <div
          className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[#345884]/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[#152437]/80 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden
        />

        {/* Pulse line decoration */}
        <svg
          className="pointer-events-none absolute bottom-28 left-0 w-full opacity-20"
          viewBox="0 0 600 80"
          fill="none"
          aria-hidden
        >
          <path
            d="M0 40 H120 L140 20 L160 60 L190 10 L220 70 L250 40 H600"
            stroke="white"
            strokeWidth="1.5"
            className="auth-pulse-line"
          />
        </svg>

        <div className="relative z-10">
          <Link href="/" aria-label="Vai alla home" className="inline-flex">
            <span className="rounded-xl bg-white/95 px-3 py-2 shadow-sm">
              <AequanLogo height={36} />
            </span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="font-display text-[2.35rem] font-bold leading-[1.15] tracking-tight text-white xl:text-[2.6rem]">
            Allena il giudizio clinico prima del paziente reale.
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-white/70">{brandLine}</p>
          <ul className="flex flex-wrap gap-2 pt-1">
            {DIMENSIONS.map((dim) => (
              <li
                key={dim}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm"
              >
                {dim}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          Formazione medico-legale · solo uso educativo
        </p>
      </aside>

      {/* Form column */}
      <main className="relative z-10 flex min-h-screen flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        {/* Mobile brand mark (desktop has the left panel) */}
        <div className="mb-8 flex w-full max-w-[24rem] flex-col items-center gap-3 lg:hidden">
          <Link href="/" aria-label="Vai alla home">
            <AequanLogo height={38} />
          </Link>
        </div>
        <div className="w-full max-w-[24rem]">{children}</div>
      </main>
    </div>
  );
}
