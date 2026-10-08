import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "DPA (B2B) · Aequan",
  description:
    "Accordo sul trattamento dei dati (art. 28 GDPR) per gli atenei: l'Ente è Titolare, Aequan è Responsabile. Nessun dato sanitario reale.",
};

export default function DpaPage() {
  return (
    <LegalPageShell title="Accordo sul trattamento dei dati (DPA)" lastUpdated="8 ottobre 2026">
      <LegalSection title="Premessa">
        <p>
          Il presente documento è il modello di Data Processing Agreement ai sensi dell&apos;
          <strong>art. 28 del Regolamento (UE) 2016/679</strong> offerto agli atenei e agli altri
          enti formativi che acquistano Aequan. Diventa vincolante con l&apos;accettazione del
          contratto B2B o di un ordine che vi rinvia.
        </p>
        <p>
          Il Responsabile è <strong>Christopher Uguzzoni</strong>, Pavullo nel Frignano (MO), Italia,
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

      <LegalSection title="1. Ruoli delle parti">
        <p>
          L&apos;<strong>Ente Cliente</strong> (l&apos;Università o l&apos;istituzione formativa) è
          il <strong>Titolare del trattamento</strong> (Data Controller). Determina finalità e mezzi
          del trattamento dei dati dei propri studenti e del proprio personale autorizzato a usare
          la piattaforma.
        </p>
        <p>
          <strong>Aequan</strong> è il <strong>Responsabile del trattamento</strong> (Data
          Processor). Tratta i dati personali soltanto su istruzione documentata del Titolare, per
          erogare il servizio di simulazione didattica, e non li usa per finalità proprie.
        </p>
      </LegalSection>

      <LegalSection title="2. Oggetto e natura del trattamento">
        <p>
          Oggetto del trattamento è l&apos;erogazione della simulazione clinica e medico-legale agli
          utenti indicati dal Titolare. Le categorie di dati sono identificativi e dati di utilizzo
          della piattaforma:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>nome e indirizzo email degli studenti e degli altri utenti autorizzati;</li>
          <li>metriche di performance formativa e report di simulazione;</li>
          <li>log di sessione necessari a erogare, proteggere e assistere il servizio.</li>
        </ul>
        <p>
          <strong>Non vengono trattati dati sanitari reali</strong> (PHR, cartelle cliniche o dati
          di pazienti identificabili). I casi clinici della piattaforma sono simulazioni di persone
          inesistenti. È vietato inserire nella piattaforma dati di pazienti reali.
        </p>
        <p>
          Gli interessati sono gli studenti e il personale dell&apos;Ente autorizzati all&apos;uso.
          La durata del trattamento coincide con il contratto e con il tempo necessario a restituire
          o cancellare i dati al termine, salvo obblighi di legge.
        </p>
      </LegalSection>

      <LegalSection title="3. Misure tecniche e organizzative">
        <p>
          Aequan adotta misure tecniche e organizzative adeguate al rischio, in particolare:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Cifratura in transito</strong> mediante TLS su tutti gli accessi alla
            piattaforma.
          </li>
          <li>
            <strong>Cifratura at rest</strong> dei dati conservati sull&apos;infrastruttura di
            database e di hosting.
          </li>
          <li>
            <strong>Isolamento logico dei tenant</strong>: i dati di ciascuna università restano
            separati da quelli degli altri enti clienti.
          </li>
          <li>
            <strong>Accesso limitato al database</strong>: solo personale autorizzato, per finalità
            di esercizio, sicurezza e assistenza, secondo il principio del minimo privilegio.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Violazione dei dati">
        <p>
          Se Aequan viene a conoscenza di una violazione di dati personali che riguarda il
          trattamento svolto per il Titolare, ne dà comunicazione al Titolare{" "}
          <strong>entro un massimo di 48 ore</strong> dalla scoperta. La comunicazione descrive, per
          quanto già noto, la natura della violazione, le categorie di dati e di interessati
          coinvolti, le conseguenze probabili e le misure adottate o proposte.
        </p>
        <p>
          La notifica all&apos;autorità di controllo e agli interessati resta in capo al Titolare.
          Aequan collabora alle informazioni ragionevolmente necessarie per quell&apos;adempimento.
        </p>
      </LegalSection>

      <LegalSection title="5. Sub-responsabili">
        <p>
          Aequan può avvalersi di sub-responsabili per l&apos;infrastruttura indispensabile al
          servizio. L&apos;elenco vigente, con finalità, sede e garanzie di trasferimento, è
          pubblicato nella pagina{" "}
          <Link
            href="/subprocessors"
            className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            Sub-responsabili del trattamento
          </Link>
          . L&apos;aggiunta di un nuovo sub-responsabile è comunicata ai clienti B2B con almeno 30
          giorni di preavviso, durante i quali il Titolare può opporsi.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
