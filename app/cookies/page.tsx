import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Cookie Policy · Aequan",
  description:
    "Cookie Policy di Aequan — cookie tecnici essenziali (NextAuth) e assenza di cookie di profilazione senza consenso.",
};

/**
 * Cookie Policy essenziale (ePrivacy / GDPR).
 */
export default function CookiesPage() {
  return (
    <LegalPageShell title="Cookie Policy" lastUpdated="30 luglio 2026">
      <LegalSection title="1. Cosa sono i cookie">
        <p>
          I cookie sono piccoli file di testo memorizzati sul dispositivo dell&apos;utente quando
          visita un sito web. Possono essere tecnici (necessari al funzionamento del servizio) o
          di profilazione/analitici (non essenziali e soggetti a consenso).
        </p>
      </LegalSection>

      <LegalSection title="2. Cookie utilizzati da Aequan">
        <p>
          Aequan utilizza <strong>esclusivamente cookie tecnici essenziali</strong> per garantire
          l&apos;autenticazione e la continuità della sessione utente (provider{" "}
          <strong>NextAuth</strong> / JWT session cookie). Questi cookie sono necessari per:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>mantenere l&apos;utente autenticato durante la navigazione;</li>
          <li>proteggere da abusi CSRF sulle azioni di autenticazione;</li>
          <li>ricordare lo stato di sessione strettamente legato al servizio richiesto.</li>
        </ul>
        <p>
          La base giuridica è l&apos;<strong>esecuzione del contratto</strong> e/o il{" "}
          <strong>legittimo interesse</strong> alla sicurezza della piattaforma (art. 6 GDPR),
          nonché l&apos;esenzione tipica per cookie strettamente necessari ai sensi della normativa
          ePrivacy.
        </p>
      </LegalSection>

      <LegalSection title="3. Cookie di profilazione e marketing">
        <p>
          <strong>Al momento Aequan non utilizza cookie di profilazione, pubblicitari o di
          tracking di terze parti</strong> (es. Google Analytics, Meta Pixel, cookie advertising)
          senza un previo consenso espresso dell&apos;utente.
        </p>
        <p>
          Qualora in futuro fossero introdotti cookie non essenziali, verrà implementato un banner
          di consenso conforme e la presente Cookie Policy sarà aggiornata prima dell&apos;attivazione.
        </p>
      </LegalSection>

      <LegalSection title="4. Gestione e cancellazione">
        <p>
          Puoi cancellare o bloccare i cookie tramite le impostazioni del browser. La disabilitazione
          dei cookie di sessione essenziali può impedire l&apos;accesso all&apos;area riservata e
          alle simulazioni.
        </p>
      </LegalSection>

      <LegalSection title="5. Contatti e documenti correlati">
        <p>
          Per richieste privacy:{" "}
          <a
            href="mailto:chris01.ugo@gmail.com"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            chris01.ugo@gmail.com
          </a>
          . Vedi anche la{" "}
          <Link href="/privacy" className="font-medium text-[#1E324E] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{" "}
          e l&apos;avviso di{" "}
          <Link
            href="/ai-transparency"
            className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            Trasparenza AI
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
