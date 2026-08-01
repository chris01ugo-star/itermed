import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";

export const metadata = {
  title: "Trasparenza AI · Aequan",
  description:
    "Informativa di trasparenza AI (EU AI Act Art. 50) — modelli OpenAI, sanitizzazione prompt, scoring formativo.",
};

/**
 * EU AI Act Art. 50 — AI transparency notice (educational simulator).
 */
export default function AiTransparencyPage() {
  return (
    <LegalPageShell title="Trasparenza sull'Intelligenza Artificiale" lastUpdated="30 luglio 2026">
      <LegalSection title="1. Avviso di interazione (Art. 50 AI Act)">
        <p>
          Quando usi la chat di simulazione o generi un report valutativo,{" "}
          <strong>
            stai interagendo con un sistema di Intelligenza Artificiale basato su modelli
            generativi
          </strong>
          . I contenuti prodotti (dialogo paziente, esiti d&apos;esame narrativi, report e feedback)
          sono generati o co-generati da IA e non costituiscono parere medico o legale.
        </p>
        <p>
          Aequan è <strong>progettato in conformità con le linee guida di trasparenza e
          sicurezza del Regolamento UE sull&apos;Intelligenza Artificiale (EU AI Act)</strong>.
          Questa pagina non costituisce un&apos;autodichiarazione di &quot;conformità certificata&quot;
          né sostituisce eventuali valutazioni di conformità richieste per usi ad alto rischio.
        </p>
      </LegalSection>

      <LegalSection title="2. Modelli e fornitori utilizzati">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Chat paziente / esami / strumenti di sessione</strong>: OpenAI{" "}
            <span className="font-mono text-xs">gpt-4o-mini</span> (tramite Vercel AI SDK).
          </li>
          <li>
            <strong>Valutazione / report di simulazione</strong>: OpenAI{" "}
            <span className="font-mono text-xs">gpt-4o</span>.
          </li>
          <li>
            <strong>Embedding per RAG (linee guida)</strong>: OpenAI{" "}
            <span className="font-mono text-xs">text-embedding-3-small</span>, indice vettoriale
            Pinecone (ove configurato).
          </li>
        </ul>
        <p>
          I dati di prompt sono trasmessi a fornitori terzi (principalmente OpenAI) secondo le
          misure descritte nella{" "}
          <Link href="/privacy" className="font-medium text-[#1E324E] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          . Non inserire dati di pazienti reali o informazioni sanitarie identificative.
        </p>
      </LegalSection>

      <LegalSection title="3. Sanitizzazione dei prompt e mitigazioni">
        <p>
          Prima dell&apos;invio ai modelli esterni, i messaggi utente sono sottoposti a controlli di
          sicurezza (filtri anti-injection) e a una{" "}
          <strong>sanitizzazione/redazione di pattern PII comuni</strong> (es. email, telefoni,
          codici fiscali tipici). La redazione è di tipo best-effort e{" "}
          <strong>non garantisce</strong> l&apos;assenza totale di dati personali se l&apos;utente
          li inserisce in forma libera.
        </p>
        <p>
          Per il corpus legale/RAG, in assenza di fonti rilevanti il sistema applica un{" "}
          <strong>soft-fail</strong>: non inventa norme e non attribuisce punteggi legali
          &quot;perfetti&quot; di default.
        </p>
      </LegalSection>

      <LegalSection title="4. Natura dello scoring e limiti d'uso">
        <p>
          I punteggi multi-dimensione (clinico, medico-legale, esami, economia, empatia) e i
          report associati hanno <strong>esclusiva finalità didattica e formativa</strong>. Non
          sono certificazioni professionali, non sostituiscono la valutazione di un docente o di un
          ente accreditato e non devono essere usati come unico criterio per voti, assunzioni,
          abilitazioni o decisioni su pazienti reali.
        </p>
        <p>
          Eventuali classifiche (leaderboard) sono facoltative e soggette a opt-in esplicito
          dell&apos;utente.
        </p>
      </LegalSection>

      <LegalSection title="5. Supervisione umana e responsabilità">
        <p>
          L&apos;utente resta responsabile dell&apos;interpretazione dei contenuti generati. In
          contesti istituzionali si raccomanda sempre un{" "}
          <strong>human-in-the-loop</strong> (docente/tutor) prima di qualsiasi uso degli score al
          di fuori della pratica individuale.
        </p>
      </LegalSection>

      <LegalSection title="6. Contatti">
        <p>
          Domande su trasparenza AI e privacy:{" "}
          <a
            href="mailto:digitaleducation@aequan.it"
            className="font-mono text-xs font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            digitaleducation@aequan.it
          </a>
          . Documenti correlati:{" "}
          <Link href="/terms" className="font-medium text-[#1E324E] underline-offset-2 hover:underline">
            Termini
          </Link>
          ,{" "}
          <Link href="/privacy" className="font-medium text-[#1E324E] underline-offset-2 hover:underline">
            Privacy
          </Link>
          ,{" "}
          <Link href="/cookies" className="font-medium text-[#1E324E] underline-offset-2 hover:underline">
            Cookie
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
