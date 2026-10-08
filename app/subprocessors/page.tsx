import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Sub-responsabili del trattamento · Aequan",
  description:
    "Elenco dei sub-responsabili del trattamento (art. 28 GDPR) usati da Aequan: finalità, sede e garanzie di trasferimento.",
};

const SUBPROCESSORS = [
  {
    name: "Vercel Inc.",
    purpose: "Hosting e infrastruttura cloud dell'applicazione.",
    location: "Stati Uniti / Unione europea",
    safeguard: "Standard Contractual Clauses (SCC).",
  },
  {
    name: "Neon Inc.",
    purpose: "Database serverless PostgreSQL (dati di account, sessioni e report).",
    location: "Unione europea — Frankfurt",
    safeguard: "Trattamento dei dati nell'Unione europea.",
  },
  {
    name: "OpenAI",
    purpose:
      "Modelli di intelligenza artificiale per l'audit clinico-legale e il paziente simulato.",
    location: "Stati Uniti",
    safeguard: "SCC e Data Processing Addendum (API con Zero Data Retention).",
  },
  {
    name: "Stripe",
    purpose: "Elaborazione dei pagamenti e gestione degli abbonamenti.",
    location: "Stati Uniti / Unione europea",
    safeguard: "Standard Contractual Clauses (SCC).",
  },
  {
    name: "Pinecone Systems, Inc.",
    purpose: "Vector database per il recupero delle linee guida (RAG).",
    location: "Stati Uniti / Unione europea",
    safeguard: "Standard Contractual Clauses (SCC).",
  },
] as const;

export default function SubprocessorsPage() {
  return (
    <LegalPageShell title="Sub-responsabili del trattamento" lastUpdated="8 ottobre 2026">
      <LegalSection title="Art. 28 GDPR">
        <p>
          Aequan affida a fornitori terzi, in qualità di sub-responsabili del trattamento, le
          attività infrastrutturali necessarie a erogare la piattaforma di simulazione didattica.
          L&apos;elenco seguente indica, per ciascun fornitore, la finalità del trattamento, la sede
          e la garanzia adottata per il trasferimento dei dati.
        </p>
        <p>
          Aequan si impegna a notificare i clienti B2B prima di aggiungere un nuovo
          sub-responsabile. La comunicazione avviene con almeno <strong>30 giorni</strong> di
          preavviso, durante i quali il cliente può opporsi secondo la clausola standard del Data
          Processing Agreement. L&apos;opposizione va inviata a{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Elenco dei sub-responsabili">
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F4F6F8] text-[10px] font-bold uppercase tracking-[0.14em] text-[#1E324E]">
                <th className="px-3 py-2.5 font-bold">Fornitore</th>
                <th className="px-3 py-2.5 font-bold">Finalità</th>
                <th className="px-3 py-2.5 font-bold">Sede</th>
                <th className="px-3 py-2.5 font-bold">Garanzia</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((row) => (
                <tr key={row.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 align-top font-medium text-[#1E324E]">{row.name}</td>
                  <td className="px-3 py-3 align-top text-slate-600">{row.purpose}</td>
                  <td className="px-3 py-3 align-top text-slate-600">{row.location}</td>
                  <td className="px-3 py-3 align-top text-slate-600">{row.safeguard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>
    </LegalPageShell>
  );
}
