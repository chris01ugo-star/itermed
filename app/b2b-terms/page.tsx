import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Condizioni B2B (MSA) · Aequan",
  description:
    "Condizioni generali di fornitura B2B di Aequan per studi pilota gratuiti: licenze per-seat, servizio as-is e responsabilità economica limitata a zero.",
};

export default function B2bTermsPage() {
  return (
    <LegalPageShell
      title="Condizioni Generali di Fornitura B2B / MSA"
      lastUpdated="8 ottobre 2026"
    >
      <LegalSection title="Premessa">
        <p>
          Queste condizioni regolano la fornitura della piattaforma Aequan agli{" "}
          <strong>Enti</strong> (Università e Ospedali) e sono distinte dai{" "}
          <Link
            href="/terms"
            className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            Termini di servizio
          </Link>{" "}
          rivolti al singolo utente. Diventano vincolanti con l&apos;accettazione del contratto o
          dell&apos;ordine B2B. Il trattamento dei dati personali è disciplinato dal{" "}
          <Link href="/dpa" className="font-medium text-[#1E324E] underline-offset-2 hover:underline">
            DPA
          </Link>
          .
        </p>
        <p>
          Il fornitore è <strong>Christopher Uguzzoni</strong>, Pavullo nel Frignano (MO), Italia,
          Codice Fiscale <strong>GZZCRS01T12G393M</strong>, contattabile a{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="1. Oggetto e licenze">
        <p>
          Aequan concede all&apos;Ente una licenza d&apos;uso non esclusiva, non trasferibile e
          limitata alla durata del contratto, per accedere alla piattaforma di simulazione didattica.
          Le licenze sono <strong>per-seat</strong>: un posto per ciascun studente o medico in
          formazione indicato dall&apos;Ente, nel numero aggregato previsto dall&apos;ordine.
        </p>
        <p>
          L&apos;Ente non può concedere <strong>sub-licenze a terzi</strong>, rivendere i posti o
          mettere la piattaforma a disposizione di soggetti diversi dagli utenti autorizzati. Le
          credenziali restano personali e non possono essere condivise.
        </p>
      </LegalSection>

      <LegalSection title="2. SLA (Service Level Agreement)">
        <p>
          Trattandosi di licenze concesse a titolo gratuito per studi pilota e Proof of Concept, il
          servizio è fornito <strong>&apos;as-is&apos;</strong> (nello stato di fatto e di diritto in
          cui si trova). Aequan garantisce il massimo sforzo (best effort) per mantenere la
          piattaforma disponibile, ma <strong>non si applicano SLA vincolanti</strong>.
        </p>
      </LegalSection>

      <LegalSection title="3. Supporto tecnico">
        <p>
          L&apos;assistenza è riservata ai <strong>referenti designati dall&apos;Ente</strong>, non
          al singolo studente. Le richieste si inviano via email a{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>{" "}
          o tramite il canale di ticket indicato nell&apos;ordine.
        </p>
        <p>
          Per i problemi <strong>critici</strong> (piattaforma inutilizzabile per l&apos;Ente o
          indisponibilità generale del servizio) Aequan garantisce una prima risposta entro{" "}
          <strong>24 ore lavorative</strong> dalla ricezione della segnalazione del referente.
        </p>
      </LegalSection>

      <LegalSection title="4. Limitazione di responsabilità">
        <p>
          Aequan è un software di simulazione didattica. <strong>Non è un dispositivo medico</strong>{" "}
          ai sensi del Regolamento (UE) 2017/745 (MDR) e non va usato per decisioni cliniche su
          pazienti reali. Aequan non assume alcuna responsabilità medica per l&apos;uso della
          piattaforma.
        </p>
        <p>
          Essendo la licenza concessa a titolo gratuito, la responsabilità economica massima di
          Aequan per qualsiasi danno è esplicitamente limitata a <strong>zero</strong> (fatti salvi i
          limiti inderogabili di legge per dolo o colpa grave). Aequan declina ogni responsabilità
          economica per interruzioni del servizio o eventuale perdita di log di sessione.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
