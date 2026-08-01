import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Termini di servizio · Aequan",
  description:
    "Termini di servizio di Aequan — Titolare Christopher Uguzzoni, Pavullo nel Frignano (MO).",
};

/**
 * Termini di servizio definitivi.
 * Titolare: Christopher Uguzzoni — CF GZZCRS01T12G393M — digitaleducation@aequan.it
 */
export default function TermsPage() {
  return (
    <LegalPageShell title="Termini di servizio" lastUpdated="1 agosto 2026">
      <LegalSection title="1. Oggetto del servizio e Titolare">
        <p>
          Aequan (di seguito &quot;la Piattaforma&quot;) è un ambiente digitale di{" "}
          <strong>formazione e simulazione clinica e medico-legale</strong> destinato a studenti di
          medicina e professionisti sanitari che abbiano compiuto 18 anni. L&apos;accesso e
          l&apos;uso della Piattaforma presuppongono l&apos;accettazione integrale dei presenti
          Termini.
        </p>
        <p>
          Il <strong>Titolare del Servizio</strong> — anche per fatturazione, adempimenti fiscali e
          richieste commerciali — è <strong>Christopher Uguzzoni</strong>, con residenza / sede
          legale in <strong>Pavullo nel Frignano (MO), Italia</strong>, Codice Fiscale{" "}
          <strong>GZZCRS01T12G393M</strong>. Email ufficiale:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          . Foro competente: <strong>Tribunale di Modena</strong>.
        </p>
        <p>
          Il Servizio è attualmente promosso e gestito in fase di{" "}
          <strong>validazione tecnica e commerciale</strong> da{" "}
          <strong>Christopher Uguzzoni</strong> (C.F. <strong>GZZCRS01T12G393M</strong>, email:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          ). A seguito del consolidamento operativo e del raggiungimento delle soglie di attività
          previste, la titolarità della piattaforma, della gestione contabile/fiscale e dei rapporti
          contrattuali <strong>potrà essere trasferita</strong> a una P.IVA o società di scopo,
          previa comunicazione agli utenti tramite aggiornamento dei presenti Termini.
        </p>
      </LegalSection>

      <LegalSection title="2. Disclaimer medico — uso esclusivamente educativo">
        <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-rose-950">
          <p className="font-semibold">Avvertenza importante</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Aequan è uno strumento <strong>puramente educativo e formativo</strong>. Non è un
              dispositivo medico (né MDR né FDA), non è software clinico certificato e non fornisce
              diagnosi, terapie o consulenza sanitaria.
            </li>
            <li>
              I contenuti, le simulazioni, i punteggi e i report generati (anche tramite
              intelligenza artificiale) <strong>non sostituiscono</strong> il giudizio clinico di un
              medico abilitato, le linee guida ufficiali né le procedure del proprio ente.
            </li>
            <li>
              È vietato utilizzare Aequan per prendere decisioni su pazienti reali, per attività
              assistenziali o per qualsiasi scopo diverso dalla formazione simulata.
            </li>
            <li>
              L&apos;utente è l&apos;unico responsabile dell&apos;uso dei contenuti al di fuori del
              contesto formativo simulato.
            </li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection title="3. Account e registrazione">
        <p>
          Per utilizzare alcune funzionalità è necessario creare un account fornendo dati veritieri
          e accettando i presenti Termini e la{" "}
          <Link
            href="/privacy"
            className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          . L&apos;utente è responsabile della riservatezza delle credenziali. La registrazione è
          consentita esclusivamente a soggetti che abbiano compiuto{" "}
          <strong>18 (diciotto) anni</strong>.
        </p>
      </LegalSection>

      <LegalSection title="4. Proprietà intellettuale">
        <p>
          L&apos;intera architettura software, il database dei casi clinici, gli algoritmi Aequan, i
          materiali del simulatore, i marchi, i loghi, i testi formativi e ogni altro contenuto
          predefinito della Piattaforma appartengono in via{" "}
          <strong>esclusiva a Christopher Uguzzoni</strong>.
        </p>
        <p>
          È vietato riprodurre, distribuire, modificare, estrarre, pubblicare o sfruttare
          commercialmente tali materiali senza previa autorizzazione scritta del Titolare.
          L&apos;utente conserva diritti solo sulle proprie{" "}
          <strong>metriche di performance personali</strong> (punteggi, report di sessione,
          progressi formativi). Gli output generati da modelli di intelligenza artificiale restano
          strumenti formativi interni e non attribuiscono all&apos;utente diritti di proprietà
          sull&apos;architettura, sugli algoritmi o sul corpus clinico di Aequan.
        </p>
      </LegalSection>

      <LegalSection title="5. Piani a Pagamento, Abbonamenti e Diritto di Recesso">
        <p>
          Alcune funzionalità di Aequan possono essere offerte mediante{" "}
          <strong>piani a pagamento o abbonamenti</strong> (SaaS). L&apos;accesso ai tier a
          pagamento è fatturato in modo <strong>automatico e ricorrente</strong> tramite{" "}
          <strong>Stripe</strong>, secondo la cadenza selezionata in checkout (
          <strong>mensile</strong> o <strong>annuale</strong>, ove disponibili). I prezzi sono
          indicati in <strong>Euro (€)</strong> e, salvo diversa indicazione esplicita in fase di
          checkout, si intendono comprensivi delle imposte applicabili.
        </p>
        <p>
          <strong>Diritto di recesso (14 giorni)</strong> — In conformità alla Direttiva UE
          2011/83/UE e al <strong>Codice del Consumo italiano (art. 59)</strong>, gli utenti
          consumatori hanno in linea di principio il diritto di recedere dal contratto di
          abbonamento entro <strong>14 (quattordici) giorni</strong> dalla conclusione
          dell&apos;acquisto, senza obbligo di giustificazione e con diritto al{" "}
          <strong>rimborso</strong> tramite Stripe, <strong>salvo</strong> quanto previsto dalle
          eccezioni di seguito per i contenuti / servizi digitali ad esecuzione immediata.
        </p>
        <p>
          <strong>Natura del servizio e esecuzione immediata</strong> — Aequan è un{" "}
          <strong>servizio digitale erogato tramite software SaaS</strong>. L&apos;
          <strong>attivazione dell&apos;abbonamento</strong> oppure l&apos;
          <strong>avvio della prima simulazione</strong> clinico-formativa costituiscono{" "}
          <strong>esecuzione immediata del contratto</strong> ai sensi della normativa
          consumeristica applicabile.
        </p>
        <p>
          <strong>
            Consenso preventivo espresso e perdita del diritto di recesso (art. 59 Codice del
            Consumo / Dir. 2011/83/UE)
          </strong>{" "}
          — In fase di <strong>checkout / acquisto</strong>, richiedendo l&apos;
          <strong>accesso immediato</strong> alle simulazioni e alle funzionalità digitali a
          pagamento, l&apos;utente fornisce il proprio{" "}
          <strong>consenso preventivo espresso</strong> all&apos;inizio dell&apos;esecuzione del
          servizio durante il periodo di recesso e{" "}
          <strong>
            riconosce espressamente di perdere il diritto di recesso di 14 giorni una volta che
            l&apos;esecuzione del servizio digitale è iniziata
          </strong>
          , nei limiti e alle condizioni previste dall&apos;art. 59 del Codice del Consumo e dalla
          Direttiva UE 2011/83/UE. In assenza di tale richiesta/consenso, restano ferme le tutele
          di legge applicabili al consumatore.
        </p>
        <p>
          <strong>Rinnovo automatico e disdetta</strong> — Gli abbonamenti si rinnovano
          automaticamente al termine di ciascun ciclo di fatturazione (mensile o annuale).
          L&apos;utente può <strong>disdire il rinnovo automatico in qualsiasi momento</strong> —
          prima della successiva data di addebito — dalle{" "}
          <strong>Impostazioni</strong> del proprio account e/o tramite il{" "}
          <strong>Stripe Customer Portal</strong>. La disdetta{" "}
          <strong>disattiva gli addebiti futuri</strong> e non comporta di per sé il rimborso del
          periodo già pagato e non ancora scaduto, salvo quanto dovuto in caso di legittimo
          esercizio del diritto di recesso ove ancora spettante.
        </p>
        <p>
          Per fatturazione, rimborsi e questioni fiscali relative ai piani a pagamento:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          . Titolare del Servizio: <strong>Christopher Uguzzoni</strong>, Pavullo nel Frignano
          (MO), Italia, CF <strong>GZZCRS01T12G393M</strong>. Foro competente:{" "}
          <strong>Modena</strong> (Tribunale di Modena).
        </p>
      </LegalSection>

      <LegalSection title="6. Limitazione di responsabilità">
        <p>
          Nei limiti consentiti dalla legge applicabile, Christopher Uguzzoni non risponde di danni
          derivanti dall&apos;uso improprio di Aequan, da interruzioni del servizio o da
          errori/omissioni nei contenuti formativi o nei report automatici.
        </p>
      </LegalSection>

      <LegalSection title="7. Legge applicabile e Foro competente">
        <p>
          I presenti Termini sono regolati dalla <strong>legge italiana</strong> e dalla normativa
          dell&apos;Unione Europea in materia di protezione dei dati personali (
          <strong>GDPR</strong> — Regolamento UE 2016/679) e di tutela del consumatore (ivi inclusa
          la Direttiva 2011/83/UE), ove applicabile.
        </p>
        <p>
          Per ogni controversia derivante da o connessa all&apos;uso della Piattaforma o ai presenti
          Termini è competente in via <strong>esclusiva</strong> il{" "}
          <strong>Tribunale di Modena</strong> (Foro di Modena), fatto salvo quanto
          obbligatoriamente previsto dalla legge a tutela del consumatore, ove applicabile.
        </p>
      </LegalSection>

      <LegalSection title="8. Contatti">
        <p>
          Per qualsiasi richiesta relativa ai presenti Termini, alla fatturazione o agli
          abbonamenti scrivere a:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Minori">
        <p>
          La Piattaforma è destinata esclusivamente a studenti di medicina e professionisti
          sanitari maggiorenni. L&apos;età minima richiesta è di <strong>18 anni</strong>. Non è
          consentita la registrazione o l&apos;uso da parte di minori.
        </p>
      </LegalSection>

      <LegalSection title="10. Conformità EU AI Act (Reg. UE 2024/1689) & Limiti del Modello">
        <p>
          In conformità agli obblighi di <strong>trasparenza</strong> (art. 50) e di promozione della{" "}
          <strong>AI literacy</strong> (art. 4) del Regolamento (UE) 2024/1689 (AI Act), Aequan
          informa gli utenti quanto segue.
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
            soggetti identificabili. La Piattaforma è destinata solo a scenari simulati.
          </li>
        </ul>
      </LegalSection>
    </LegalPageShell>
  );
}
