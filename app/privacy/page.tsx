import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Privacy Policy · Aequan",
  description:
    "Informativa privacy GDPR di Aequan — Titolare Christopher Uguzzoni, Pavullo nel Frignano (MO).",
};

/**
 * Privacy Policy definitiva (GDPR).
 * Titolare: Christopher Uguzzoni — CF GZZCRS01T12G393M — digitaleducation@aequan.it
 */
export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy (GDPR)" lastUpdated="1 agosto 2026">
      <LegalSection title="1. Titolare del trattamento">
        <p>
          Il <strong>Titolare del trattamento</strong> dei dati personali — anche per fatturazione,
          abbonamenti Stripe e richieste fiscali, fino a eventuale aggiornamento con diversa entità
          societaria — è <strong>Christopher Uguzzoni</strong>, con residenza / sede legale in{" "}
          <strong>Pavullo nel Frignano (MO), Italia</strong>, Codice Fiscale{" "}
          <strong>GZZCRS01T12G393M</strong>.
        </p>
        <p>
          Contatto ufficiale per privacy, billing e esercizio dei diritti:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          . Foro competente: <strong>Tribunale di Modena</strong>. Al momento non è stato nominato
          un Responsabile della protezione dei dati (DPO).
        </p>
      </LegalSection>

      <LegalSection title="2. Tipologie di dati trattati">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Dati di account: email, nome (opzionale), hash della password.</li>
          <li>
            Dati di accettazione legale: timestamp di accettazione dei Termini e della Privacy
            Policy.
          </li>
          <li>
            Dati di utilizzo: sessioni di simulazione, report formativi, preferenze (es.
            classifica).
          </li>
          <li>
            Dati di pagamento/abbonamento (se attivati): identificativi Stripe e stato
            sottoscrizione.
          </li>
          <li>
            Dati tecnici: log di sicurezza, indirizzo IP (ove necessario per rate-limiting e
            prevenzione abusi), cookie/sessioni di autenticazione.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalità e basi giuridiche (art. 6 GDPR)">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Esecuzione del contratto</strong> — creazione account, erogazione della
            simulazione formativa, gestione abbonamenti, assistenza.
          </li>
          <li>
            <strong>Obbligo legale</strong> — adempimenti fiscali/contabili ove applicabili.
          </li>
          <li>
            <strong>Legittimo interesse</strong> — sicurezza della piattaforma, prevenzione frodi,
            miglioramento del servizio (nel rispetto dei diritti dell&apos;interessato).
          </li>
          <li>
            <strong>Consenso</strong> — ove richiesto (es. cookie non necessari, analitici o di
            marketing). Il consenso può essere revocato in qualsiasi momento.
          </li>
          <li>
            <strong>Classifica / Leaderboard (consenso esplicito)</strong> — finalità: partecipazione
            e pubblicazione dei punteggi formativi nella classifica pubblica della Piattaforma. Base
            giuridica:{" "}
            <strong>consenso esplicito dell&apos;interessato (art. 6.1.a GDPR)</strong>, fornito
            tramite opzione (opt-in) nelle impostazioni del profilo e{" "}
            <strong>revocabile in qualsiasi momento</strong> senza pregiudicare la fruizione del
            servizio.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Destinatari, trasferimenti e proprietà intellettuale sui sistemi">
        <p>
          I dati possono essere trattati, per conto del Titolare e nei limiti delle finalità
          indicate, da fornitori tecnici indispensabili all&apos;erogazione della Piattaforma
          (hosting/cloud, database Neon, autenticazione, Stripe se attivata, OpenAI/Pinecone per
          funzionalità AI). Ove un trattamento comporti trasferimento fuori dallo SEE, si adottano
          garanzie adeguate ai sensi del GDPR (decisioni di adeguatezza, SCC o misure equivalenti).
        </p>
        <p>
          I dati e i prompt inviati tramite API ai fornitori terzi di modelli linguistici (es.{" "}
          <strong>OpenAI</strong>) sono elaborati esclusivamente per l&apos;erogazione della
          simulazione e la generazione dei report. Tali dati{" "}
          <strong>
            NON vengono utilizzati dai fornitori terzi per l&apos;addestramento o il miglioramento
            dei propri modelli di intelligenza artificiale
          </strong>
          .
        </p>
        <p>
          L&apos;architettura software, il database dei casi clinici, gli algoritmi Aequan e i
          materiali del simulatore appartengono in via{" "}
          <strong>esclusiva a Christopher Uguzzoni</strong>; il trattamento dei dati personali
          dell&apos;utente non trasferisce all&apos;utente alcun diritto di proprietà su tali
          asset.
        </p>
      </LegalSection>

      <LegalSection title="5. Periodo di conservazione">
        <p>
          I dati dell&apos;account sono conservati per la durata del rapporto e, dopo la
          cancellazione, per il tempo necessario ad obblighi di legge o difesa in giudizio. I
          timestamp di accettazione legale e i dati di fatturazione/abbonamento sono conservati per
          il tempo richiesto dalla normativa fiscale e civilistica applicabile.
        </p>
      </LegalSection>

      <LegalSection title="6. Diritti dell&apos;interessato e contatti">
        <p>
          L&apos;utente può esercitare accesso, rettifica, cancellazione, limitazione, portabilità,
          opposizione e revoca del consenso contattando il Titolare. Ha inoltre diritto di proporre
          reclamo all&apos;Autorità Garante per la protezione dei dati personali.
        </p>
        <p>
          Contatto privacy ufficiale:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          .
        </p>
        <p>
          I presenti trattamenti e i rapporti con gli utenti sono soggetti alla{" "}
          <strong>legge italiana</strong> e al <strong>GDPR</strong>. Per le controversie relative
          al trattamento dei dati o all&apos;uso della Piattaforma è competente in via esclusiva il{" "}
          <strong>Tribunale di Modena</strong> (Foro di Modena), fatto salvo quanto obbligatorio a
          tutela dell&apos;interessato / consumatore.
        </p>
      </LegalSection>

      <LegalSection title="7. Cookie e tecnologie di tracciamento (GDPR & ePrivacy)">
        <p>
          Attualmente Aequan utilizza <strong>unicamente cookie tecnici essenziali</strong>{" "}
          necessari all&apos;autenticazione di sessione e alla sicurezza dei pagamenti elaborati
          tramite Stripe. Tali cookie strettamente necessari non richiedono consenso preventivo ai
          sensi della normativa ePrivacy, in quanto indispensabili al servizio richiesto
          dall&apos;utente.
        </p>
        <p>
          Avviso esplicito: se in futuro saranno abilitati strumenti di analitica o pubblicità di
          terze parti (ad esempio <strong>Google Analytics</strong>, <strong>Meta Pixel</strong> o
          equivalenti), verrà fornito un <strong>banner interattivo GDPR</strong> di gestione dei
          cookie per raccogliere il <strong>consenso esplicito preventivo</strong> dell&apos;utente
          prima di qualsiasi inizializzazione di script di tracciamento non essenziale, in
          conformità al GDPR e alla Direttiva ePrivacy.
        </p>
      </LegalSection>

      <LegalSection title="8. Sicurezza">
        <p>
          Adottiamo misure tecniche e organizzative adeguate (hash delle password, controlli di
          accesso, rate limiting). Nessun sistema è immune al rischio: si invitano password robuste
          e uniche.
        </p>
      </LegalSection>

      <LegalSection title="9. Minori">
        <p>
          La Piattaforma è destinata esclusivamente a{" "}
          <strong>studenti di medicina e professionisti sanitari</strong> che abbiano compiuto{" "}
          <strong>18 anni</strong>. Non raccogliamo consapevolmente dati di minori di 18 anni. Se
          venisse a conoscenza di un account creato da un minore, il Titolare provvederà alla
          cancellazione senza indebito ritardo.
        </p>
      </LegalSection>

      <LegalSection title="10. Aggiornamenti">
        <p>
          Questa informativa può essere aggiornata. La data in cima alla pagina indica la versione
          corrente. Per i Termini di servizio vedi{" "}
          <Link
            href="/terms"
            className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            Termini di servizio
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="11. Conformità EU AI Act (Reg. UE 2024/1689) & Limiti del Modello">
        <p>
          In conformità agli obblighi di <strong>trasparenza</strong> (art. 50) e di promozione della{" "}
          <strong>AI literacy</strong> (art. 4) del Regolamento (UE) 2024/1689 (AI Act), il Titolare
          informa gli interessati quanto segue.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Aequan utilizza <strong>Large Language Models (LLM)</strong> esclusivamente per la
            simulazione medica didattica e per lo scoring / report formativo.
          </li>
          <li>
            Gli output dell&apos;IA sono <strong>non deterministici</strong> e possono presentare
            allucinazioni o inesattezze. L&apos;utente deve sempre confrontare i risultati con le
            linee guida cliniche ufficiali basate su Evidence-Based Medicine (EBM) e con il proprio
            giudizio professionale.
          </li>
          <li>
            È <strong>rigorosamente vietato</strong> inserire nelle interfacce di prompt AI dati di
            pazienti reali, Protected Health Information (PHI) o altri dati personali sanitari di
            soggetti identificabili. Eventuali contenuti di questo tipo inseriti dall&apos;utente
            costituiscono uso non autorizzato della Piattaforma.
          </li>
        </ul>
      </LegalSection>
    </LegalPageShell>
  );
}
