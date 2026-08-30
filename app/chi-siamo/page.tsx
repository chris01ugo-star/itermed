import Link from "next/link";
import { ArrowLeft, GraduationCap, HeartHandshake, Target } from "lucide-react";
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
    "La visione dietro Aequan: formazione clinica e medico-legale misurabile, progettata in Italia.",
};

export default function ChiSiamoPage() {
  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/">
            <AequanLogo height={32} />
          </Link>
          <Link
            href="/#lista-attesa"
            className="rounded-xl bg-[#1E324E] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#345884]"
          >
            Lista beta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#345884]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Torna alla home
        </Link>

        <header className="mt-6 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
            Chi siamo
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[#1E324E] sm:text-4xl">
            Costruiamo lo standard della formazione clinica digitale
          </h1>
          <p className="text-[15px] leading-relaxed text-slate-600">
            Aequan nasce dall&apos;idea che un medico in formazione meriti strumenti all&apos;altezza
            della responsabilità che dovrà assumere: non contenuti generici, ma simulazioni rigorose,
            feedback misurabili e rispetto del quadro medico-legale italiano.
          </p>
        </header>

        <section className="mt-10 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
          <div className="border-b border-slate-100 bg-[#F7F9FC] px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#345884]">
              Fondatore
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-[#1E324E]">
              Christopher Uguzzoni
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Titolare del progetto · Pavullo nel Frignano (MO)
            </p>
          </div>
          <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-slate-600">
            <p>
              Aequan è un progetto italiano di digital education medica. L&apos;obiettivo è unire
              simulazione clinica, tutela medico-legale e appropriatezza prescrittiva in un&apos;unica
              piattaforma formativa — pensata per chi studia, si specializza o aggiorna le proprie
              competenze.
            </p>
            <p>
              In questa fase di validazione tecnica e commerciale stiamo costruendo, insieme a un
              gruppo selezionato di beta tester, il prodotto che accompagnerà la prossima generazione
              di professionisti della salute.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Target,
              title: "Missione",
              body: "Rendere misurabile e ripetibile l’allenamento al giudizio clinico e alla responsabilità professionale.",
            },
            {
              icon: GraduationCap,
              title: "Metodo",
              body: "Casi immersivi, valutazione multi-pilastro e knowledge base di linee guida con retrieval affidabile.",
            },
            {
              icon: HeartHandshake,
              title: "Impegno",
              body: "Solo uso educativo. Trasparenza sull’IA. Rispetto di privacy e normative europee.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF2F9] text-[#345884]">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-[#1E324E]">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200/90 bg-white px-6 py-6">
          <h2 className="font-display text-lg font-bold text-[#1E324E]">Contatti</h2>
          <p className="mt-2 text-sm text-slate-600">
            Per partnership, università o richiesta di accesso beta:{" "}
            <a
              href={AEQUAN_CONTACT_MAILTO}
              className="font-medium text-[#345884] underline-offset-2 hover:underline"
            >
              {AEQUAN_CONTACT_EMAIL}
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <a
              href={AEQUAN_LINKEDIN_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-[#345884]/30 hover:text-[#345884]"
            >
              LinkedIn
            </a>
            <a
              href={AEQUAN_INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600 transition hover:border-[#345884]/30 hover:text-[#345884]"
            >
              Instagram
            </a>
            <Link
              href="/#lista-attesa"
              className="rounded-lg bg-[#1E324E] px-3 py-1.5 font-semibold text-white transition hover:bg-[#345884]"
            >
              Lista d&apos;attesa
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
