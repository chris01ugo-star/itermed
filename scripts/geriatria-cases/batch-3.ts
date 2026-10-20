import type { Spec } from "./types";
import { done, exam, q, step } from "./helpers";

const mmse = (finding: string, abnormal = true) =>
  exam("mmse", "Mini-Mental State Examination (MMSE)", finding, abnormal, 15);
const vmd = (finding: string, abnormal = true) =>
  exam(
    "valutazione-geriatrica",
    "Valutazione Multidimensionale Geriatrica (ADL/IADL/MNA)",
    finding,
    abnormal,
    25,
  );

export const batch3: Spec[] = [
  {
    n: 11,
    title: "RSA allettata: vitamina D nello scenario A",
    description:
      "Franca Bellini, 88 anni, è allettata in RSA per grave deficit motorio dopo un ictus antico, con dolore vertebrale meccanico. Non è candidata a terapia remineralizzante. La Nota 96, scenario A, consente il colecalciferolo senza dosare la 25-OH nelle persone istituzionalizzate, allettate a domicilio, o con osteoporosi non candidata a remineralizzazione. Le dosi elevate, però, possono aumentare cadute e fratture. Il dolore non si tratta con Aloperidolo 2 mg/ml gocce né con la contenzione. La TC encefalo di controllo non è indicata: l'ictus è antico e non c'è un segno nuovo.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Scenario A della Nota 96: colecalciferolo sì, bolo elevato e TC no",
    guidelineRef: "Nota AIFA 96 scenario A; Bellelli; EBN contenzione",
    diagnosis:
      "Dolore vertebrale in donna istituzionalizzata e allettata, non candidata a remineralizzazione. Colecalciferolo (Vitamina D) 25.000 UI è ammissibile senza 25-OH. Il bolo elevato e la TC encefalo no.",
    pastMedicalHistory:
      "Ictus antico con emiparesi stabile, allettata, vive in RSA. Nessun segno neurologico nuovo. Nessuna candidatura a farmaco antiriassorbitivo per fragilità estrema. Dolore rachideo da una settimana.",
    presentation:
      "Dolore alla mobilizzazione del rachide, vigile, emiparesi vecchia invariata. Il medico di RSA propone un bolo molto alto e una TC del cervello, e le gocce perché si lamenta di notte.",
    redHerrings: ["Chiedere il 25-OH a tutta la RSA sembra più prudente.", "Un bolo unico sembra più comodo.", "Il lamento notturno sembra un'indicazione all'aloperidolo."],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Franca Bellini, 88 anni, a letto in RSA. Ti fa male la schiena quando ti girano. L'emiparesi è quella di sempre. Se ti chiedono se vuoi una pastiglia per le ossa, dici di sì se non ti addormentano. Se propongono gocce forti o di legarti perché piangi, dici no. Non nominare note AIFA.",
    correctSolution:
      "VMD, MMSE, analgesia, Colecalciferolo (Vitamina D) 25.000 UI nello schema prudente dello scenario A, senza 25-OH obbligatorio e senza bolo elevato. Niente Aloperidolo 2 mg/ml gocce, niente contenzione, niente TC encefalo, niente screening di massa della 25-OH.",
    goldStandardPath: ["anamnesi-rsa", "valutazione-geriatrica", "mmse", "azione-nota96", "azione-dolore", "azione-no-bolo", "azione-no-tc"],
    goldPathNarrative:
      "È istituzionalizzata e allettata, non candidata a remineralizzazione: scenario A. VMD e MMSE documentano la fragilità. Si prescrive Colecalciferolo (Vitamina D) 25.000 UI senza pretendere il 25-OH e senza bolo elevato. Si cura il dolore. Non si contiene e non si ripete la TC.",
    examLatencies: { "anamnesi-rsa": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-nota96": 10, "azione-dolore": 10, "azione-no-bolo": 5, "azione-no-tc": 5 },
    anamnesisQuestions: [
      q("aq-scenario", "È istituzionalizzata o allettata, ed è candidata a un antiriassorbitivo?", ["RSA", "allettata"], "Lo scenario A non richiede il 25-OH."),
      q("aq-dolore", "Il lamento è dolore rachideo o un delirium nuovo?", ["dolore", "schiena"], "Il dolore si tratta, non si seda come se fosse un BPSD."),
      q("aq-focale", "L'emiparesi è cambiata?", ["no", "stabile"], "Senza segno nuovo la TC non si ripete."),
    ],
    physicalSummary: "Dolore vertebrale meccanico, emiparesi cronica invariata, lucida, non febbrile.",
    citations: [
      { chunkId: "geria-011-96", source: "Nota AIFA 96, scenario A", quote: "Indipendentemente dalla determinazione della 25(OH)D: persone istituzionalizzate; persone con gravi deficit motori o allettate che vivono al proprio domicilio; persone con osteoporosi non candidate a terapia remineralizzante." },
      { chunkId: "geria-011-dose", source: "Nota AIFA 96, sicurezza", quote: "Dai trials di Sanders KM e di Smith H emerge che il trattamento con dosi elevate di vitamina D può aumentare il rischio di cadute o di fratture." },
    ],
    indicators: ["Scenario A riconosciuto.", "Colecalciferolo prescritto senza 25-OH obbligatorio e senza bolo elevato.", "VMD e MMSE eseguiti. Dolore trattato.", "Niente TC e niente aloperidolo."],
    art5: "In cartella: scenario A, dose non elevata, analgesia, rifiuto di contenzione e di TC.",
    legalCriteria: ["Il dolore è trattato, non sedato.", "Nessuna contenzione per il lamento.", "Consenso della paziente alla vitamina D."],
    mandatoryExams: [
      vmd("ADL 1/6, allettata, MNA 17, emiparesi cronica. Costo 25 euro."),
      mmse("18/30, stabile, eseguito da lucida. Non è il motivo della vitamina D. Costo 15 euro."),
      exam("rx-colonna", "RX colonna", "Crollo vertebrale senza deficit neurologico nuovo. Costo 35 euro.", true, 35),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c. di controllo", "Esiti di ictus già noti, nessun segno nuovo. Costo 70 euro.", false, 70, "La TC non è richiesta dallo scenario A né dal dolore vertebrale."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non cambia la condotta: non è candidata a remineralizzazione. Costo 35 euro.", false, 35, "Farla non è il criterio che autorizza il colecalciferolo in questo scenario."),
    ],
    budget: 100,
    name: "Franca Bellini",
    age: 88,
    sex: "F",
    context: "Visita in RSA per dolore vertebrale.",
    vitals: { heartRate: 80, bloodPressure: "130/70", spo2: 96, temperature: 36.6, respiratoryRate: 16 },
    signs: [
      { signName: "Dolore vertebrale", result: "Dolorabilità alla mobilizzazione, deficit neurologico invariato.", isPositive: true },
      { signName: "Segno focale nuovo", result: "Emiparesi uguale all'anno scorso.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "COLLABORATIVE",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Risponde sì e no. Il medico di RSA vuole una soluzione unica per tutta la stanza. Lei accetta l'analgesia.",
    steps: [
      step("anamnesi", "Scenario A o B", "Istituzionalizzata, allettata, non candidata a remineralizzazione. Ti chiedono il 25-OH prima di ogni vitamina D. Cosa applica la Nota 96?", 0, 15, "Scenario A: il colecalciferolo è prescrivibile senza 25-OH", [{ label: "Rifiutare ogni Colecalciferolo (Vitamina D) 25.000 UI finché non c'è il 25-OH", next: "res-rifiuto" }]),
      step("diagnostica", "Scale e colonna", "Funzione, cognizione, radiografia del dolore. La densitometria non decide questo scenario.", 40, 15, "VMD, MMSE e RX colonna. Non la TC encefalo", [{ label: "TC Encefalo senza m.d.c. e densitometria prima di ogni cura", next: "res-tc" }]),
      step("terapia", "Prescrizione corretta", "Quale ricetta è dentro la Nota 96 senza rincorrere il bolo di Sanders?", 0, 15, "Colecalciferolo (Vitamina D) 25.000 UI in schema prudente, non un bolo elevato", [{ label: "Bolo elevato unico perché tanto è in RSA", next: "res-bolo" }]),
      step("terapia", "Dolore", "Si lamenta di notte per la schiena. Non è un pericolo e non ha deliri.", 0, 15, "Analgesia. Niente Aloperidolo 2 mg/ml gocce", [{ label: "Aloperidolo 2 mg/ml gocce a ogni lamento", next: "res-sedazione" }]),
      step("screening", "Contenzione", "Il turno chiede le fasce perché piange quando la girano.", 0, 10, "Niente contenzione. Girarla con analgesia", [{ label: "Fasce notturne come metodica della stanza", next: "res-contenzione" }]),
      step("diagnostica", "Screening di massa", "Propongono il 25-OH a tutti i residenti asintomatici della RSA. La Nota 96 dice che lo screening della popolazione senza fattori che lo richiedano è inappropriato, e in questo scenario A il dosaggio non è il presupposto della ricetta.", 0, 10, "Non avviare uno screening di 25-OH per tutta la RSA", [{ label: "Dosare la 25-OH a tutti i residenti asintomatici", next: "res-screening" }]),
      step("follow-up", "Lettera", "Come chiudi?", 0, 15, "Vitamina D nello scenario A, analgesia, nessun neurolettico, nessuna TC", [{ label: "TC Encefalo senza m.d.c. tra una settimana per controllo", next: "res-tc" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Scenario A applicato", "Colecalciferolo prescritto senza 25-OH obbligatorio e senza bolo elevato. Dolore trattato. Nessuna TC.", 75, 100),
      done("res-rifiuto", "negative", "Scenario A ignorato", "Negare Colecalciferolo (Vitamina D) 25.000 UI solo perché manca il 25-OH contraddice lo scenario A: istituzionalizzata, allettata, non candidata a remineralizzazione.", 0, 0, "economico"),
      done("res-bolo", "negative", "Bolo elevato", "La Nota 96 riporta che dosi elevate possono aumentare cadute e fratture. Il bolo non è lo schema prudente dello scenario A.", 6, 0, "economico"),
      done("res-screening", "negative", "Screening inappropriato", "La Nota 96 considera inappropriato il dosaggio nella popolazione senza le condizioni che lo richiedono. In scenario A il prelievo di massa non è la condizione della rimborsabilità.", 0, 0, "economico"),
      done("res-sedazione", "negative", "Aloperidolo per il dolore", "Aloperidolo 2 mg/ml gocce non è l'analgesia. Non ricorrono pericolo o grave distress psicotico. Il dolore va trattato.", 3, 0, "medico-legale"),
      done("res-contenzione", "negative", "Fasce di routine", "La contenzione come metodica della stanza è inaccettabile nel documento EBN e da proscrivere secondo Bellelli.", 0, 0, "medico-legale"),
      done("res-tc", "negative", "TC encefalo di controllo", "Non c'è segno focale nuovo. Diagnosi vascolare già nota. La TC costa 70 euro.", 70, 0, "economico"),
    ],
  },
  {
    n: 12,
    title: "Allucinazioni nel Parkinson",
    description:
      "Sergio Vitali, 77 anni, malattia di Parkinson, vede persone in casa la sera, è spaventato ma non aggressivo. Beers: nella malattia di Parkinson gli antipsicotici tipici sono inappropriati per gli effetti antidopaminergici. La LG ISS avverte che in demenza associata a Parkinson o a corpi di Lewy gli antipsicotici possono peggiorare i sintomi motori e causare ipersensibilità grave. L'RCP della quetiapina non la autorizza nelle psicosi da demenza e chiede cautela nell'anziano con Parkinson. La Nota 85 non rimborsa il donepezil fuori dall'Alzheimer. La rivastigmina, non questo catalogo, è l'inibitore con indicazione nella demenza di Parkinson lieve-moderata; il donepezil in quella indicazione è off-label.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Parkinson con allucinazioni: niente antipsicotico tipico e niente Nota 85",
    guidelineRef: "Beers Parkinson; LG ISS rec. 90 e 149; RCP quetiapina; Nota 85",
    diagnosis:
      "Allucinazioni in malattia di Parkinson. Non si danno Aloperidolo 2 mg/ml gocce né Quetiapina 25 mg d'emblée, e non si usa Donepezil 5 mg come se fosse Nota 85.",
    pastMedicalHistory:
      "Parkinson da otto anni, levodopa. MMSE 22/30, rallentamento anche motorio: il punteggio va letto con la disabilità, raccomandazione 82. Nessun piano CDCD per Alzheimer. Nessuna caduta con trauma nelle 48 ore. Nessun segno focale nuovo.",
    presentation:
      "Tremore e camptocormia noti, racconta persone sulla porta solo la sera, è spaventato, non violento. La moglie chiede le gocce del neurologo generico, cioè l'aloperidolo.",
    redHerrings: ["L'allucinazione sembra un'indicazione automatica al neurolettico.", "La quetiapina sembra più sicura perché atipica.", "L'MMSE 22 sembra un via libera al donepezil della Nota 85."],
    timeLimitMinutes: 55,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Sergio Vitali, 77 anni. Dici che la sera ci sono persone sulla porta e hai paura, di giorno no. Non vuoi gocce che ti irrigidiscono. Se propongono Aloperidolo 2 mg/ml gocce, tua moglie dice sì e tu dici che non cammineresti più. Se propongono di sentire il centro Parkinson e di non aggiungere psicofarmaci oggi, accetti. Non nominare Beers.",
    correctSolution:
      "VMD e MMSE con i limiti motori. Cercare cause (infezione, farmaci, ambiente). Non iniziare Aloperidolo 2 mg/ml gocce. Non iniziare Quetiapina 25 mg. Non prescrivere Donepezil 5 mg con la Nota 85. Invio al centro che conosce la raccomandazione 90. Nessuna TC senza segno focale.",
    goldStandardPath: ["anamnesi-park", "valutazione-geriatrica", "mmse", "azione-cause", "azione-no-tipico", "azione-no-nota85", "azione-invio"],
    goldPathNarrative:
      "Si riconoscono allucinazioni nel Parkinson, non un Alzheimer da Nota 85. VMD e MMSE descrivono funzione e cognizione senza ignorare il rallentamento motorio. Non si prescrivono aloperidolo né quetiapina. Si invia al percorso specialistico. Nessuna TC.",
    examLatencies: { "anamnesi-park": 15, "valutazione-geriatrica": 45, mmse: 30, "azione-cause": 10, "azione-no-tipico": 5, "azione-no-nota85": 5, "azione-invio": 10 },
    anamnesisQuestions: [
      q("aq-motorio", "Gli antipsicotici tipici come li tollera il Parkinson?", ["peggiorano", "rigidità"], "Beers e la raccomandazione 149 sconsigliano i tipici."),
      q("aq-diagnosi", "C'è una diagnosi di Alzheimer con piano del CDCD?", ["no", "Parkinson"], "La Nota 85 non si applica."),
      q("aq-pericolo", "È violento o solo spaventato?", ["spaventato", "no"], "Senza danno in atto non si salta la valutazione delle cause."),
    ],
    physicalSummary: "Segni extrapiramidali cronici, allucinazioni serali riferite, nessun deficit piramidale nuovo, non febbre.",
    citations: [
      { chunkId: "geria-012-beers", source: "Criteri di Beers, malattia di Parkinson", quote: "Nella malattia di Parkinson e nei parkinsonismi gli antipsicotici, soprattutto di prima generazione, sono inappropriati per gli effetti antidopaminergici e colinergici." },
      { chunkId: "geria-012-lg", source: "LG ISS demenza e MCI, gennaio 2024, raccomandazioni 90 e 149", quote: "La rivastigmina in capsule è l'inibitore con indicazione nella demenza di Parkinson lieve-moderata; l'uso di donepezil è off-label. Gli antipsicotici possono peggiorare i sintomi motori e causare ipersensibilità grave nella demenza a corpi di Lewy." },
    ],
    indicators: ["Parkinson distinto dall'Alzheimer della Nota 85.", "VMD e MMSE con limite motorio annotato.", "Niente aloperidolo e niente quetiapina oggi.", "Nessuna TC senza segno focale."],
    art5: "In cartella: allucinazioni, divieto del tipico, quetiapina non autorizzata nel RCP per la psicosi da demenza, donepezil non in Nota 85, invio specialistico.",
    legalCriteria: ["Nessun antipsicotico tipico nel Parkinson.", "La moglie è informata del rischio motorio.", "Nessuna contenzione per la paura serale."],
    mandatoryExams: [
      vmd("ADL 3/6 per il motorio, IADL dipendenti, MNA 19, rischio cadute alto. Costo 25 euro."),
      mmse("22/30 con lentezza motoria che pesa sul disegno. Non è un piano di Nota 85. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Nessun segno focale nuovo. Costo 70 euro.", false, 70, "La TC non autorizza l'aloperidolo né il donepezil."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata da questo quesito. Costo 35 euro.", false, 35, "La densitometria non tratta le allucinazioni."),
    ],
    budget: 80,
    name: "Sergio Vitali",
    age: 77,
    sex: "M",
    context: "Ambulatorio, allucinazioni serali in Parkinson.",
    vitals: { heartRate: 76, bloodPressure: "124/74", spo2: 97, temperature: 36.5, respiratoryRate: 16 },
    signs: [
      { signName: "Parkinson", result: "Tremore e rigidità cronici, non un deficit piramidale nuovo.", isPositive: true },
      { signName: "Aggressività", result: "Spaventato, non violento.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "POOR",
    stress: "HIGH",
    support: "STRONG",
    communicationStyle: "Descrive le persone sulla porta con paura. La moglie vuole una ricetta oggi. Lui si fida se gli prometti di non irrigidirlo.",
    steps: [
      step("anamnesi", "Di che malattia parli", "Allucinazioni serali, Parkinson, niente piano per Alzheimer. Come eviti l'errore di categoria?", 0, 15, "Allucinazioni nel Parkinson, non Alzheimer da Nota 85", [{ label: "Donepezil 5 mg con piano immaginario perché l'MMSE è 22", next: "res-nota85" }]),
      step("diagnostica", "Scale", "VMD e MMSE, annotando che il rallentamento motorio può falsare il punteggio, raccomandazione 82.", 40, 15, "Valutazione multidimensionale e MMSE letto con la disabilità motoria", [{ label: "Saltare le scale e dare Aloperidolo 2 mg/ml gocce", next: "res-aloperidolo" }]),
      step("screening", "Cause", "Prima di un psicofarmaco: infezione, farmaci nuovi, deprivazione di sonno, ambiente. Raccomandazione 132.", 0, 15, "Cercare le cause e non partire dal neurolettico", [{ label: "Quetiapina 25 mg stasera senza cercare cause", next: "res-quetiapina" }]),
      step("terapia", "Tipici", "Beers e raccomandazione 149: i tipici peggiorano il motorio e nella Lewy possono dare ipersensibilità grave.", 0, 15, "Non prescrivere Aloperidolo 2 mg/ml gocce", [{ label: "Aloperidolo 2 mg/ml gocce a basso dosaggio tanto è poco", next: "res-aloperidolo" }]),
      step("terapia", "Quetiapina", "L'RCP non la autorizza nelle psicosi correlate a demenza e segnala cautela nell'anziano con Parkinson, con un segnale di mortalità nello studio che includeva il Parkinson.", 0, 10, "Non iniziare Quetiapina 25 mg in questo ambulatorio", [{ label: "Quetiapina 25 mg ogni sera come scelta sicura", next: "res-quetiapina" }]),
      step("terapia", "Donepezil", "La raccomandazione 90 indica la rivastigmina in capsule per la demenza di Parkinson lieve-moderata e dichiara off-label il donepezil. La Nota 85 è solo Alzheimer.", 0, 10, "Non usare Donepezil 5 mg al posto del percorso specialistico", [{ label: "Donepezil 5 mg in Nota 85 da oggi", next: "res-nota85" }]),
      step("follow-up", "Invio", "Serve il centro che può applicare la raccomandazione 90, non una TC.", 0, 15, "Invio specialistico, igiene del sonno, nessun neurolettico a casa", [{ label: "TC Encefalo senza m.d.c. e aloperidolo nel frattempo", next: "res-tc" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Parkinson senza tipico e senza Nota 85", "Cause cercate, scale fatte, nessun aloperidolo, nessuna quetiapina, nessun donepezil di Nota 85.", 40, 100),
      done("res-aloperidolo", "negative", "Aloperidolo nel Parkinson", "Aloperidolo 2 mg/ml gocce è un antipsicotico tipico. Beers lo giudica inappropriato nel Parkinson. La raccomandazione 149 aggiunge il rischio di peggioramento motorio e di ipersensibilità grave se il quadro è una demenza a corpi di Lewy.", 3, 0, "medico-legale"),
      done("res-quetiapina", "negative", "Quetiapina non autorizzata", "L'RCP non autorizza la quetiapina nelle psicosi correlate alla demenza e chiede cautela nell'anziano con Parkinson. Quetiapina 25 mg non è la ricetta di questo ambulatorio.", 5, 0, "economico"),
      done("res-nota85", "negative", "Donepezil in Nota 85 senza Alzheimer", "Donepezil 5 mg a carico del SSN richiede Alzheimer e piano del CDCD. Qui la malattia è il Parkinson e, per la LG, il donepezil in quella demenza è off-label. La molecola con indicazione citata è la rivastigmina in capsule.", 15, 0, "economico"),
      done("res-tc", "negative", "TC non indicata", "Non c'è caduta recente con quesito aperto, né sospetto ictus, né segno focale. La TC costa 70 euro e nel frattempo non autorizza l'aloperidolo.", 70, 0, "economico"),
    ],
  },
  {
    n: 13,
    title: "Rifiuto capace della PEG",
    description:
      "Maria Esposito, 76 anni, è capace, disfagica dopo un ictus recente già studiato, e rifiuta per iscritto la PEG. I figli insistono. L'art. 1 della Legge 219/2017 include la nutrizione artificiale tra i trattamenti rifiutabili e esonera il medico che rispetta il rifiuto. Non c'è una demenza che cancelli la capacità. Proporre Quetiapina 25 mg per farle accettare il tubo è una costrizione. Una nuova TC encefalo non cambia il rifiuto.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "REPARTO",
    condition: "Paziente capace: il rifiuto della PEG vincola, i figli no",
    guidelineRef: "Legge 219/2017 art. 1; LG ISS rec. 12; RCP quetiapina",
    diagnosis:
      "Disfagia dopo ictus già studiato. Rifiuto capace della nutrizione artificiale. Non si posiziona la PEG e non si ripete la TC.",
    pastMedicalHistory:
      "Ictus ischemico dieci giorni fa, TC e percorso stroke già fatti, emiparesi stabile. Nessuna demenza. Ipertensione. Nessuna DAT precedente perché decide adesso, da capace.",
    presentation:
      "Afasia lieve ma comunica il no alla PEG con parole e con un foglio firmato. I figli chiedono di procedere mentre dorme. Saturazione buona, polmonite non in atto.",
    redHerrings: ["I figli presentano il rifiuto come depressione da trattare con un sedativo.", "Chiedono una TC nuova per prendere tempo.", "Dicono che senza PEG il medico è responsabile."],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Maria Esposito, 76 anni. Parli con fatica ma sei chiara: «Il tubo no». Firmi. I tuoi figli chiedono di farlo mentre dormi. Se il medico rilegge il rifiuto e propone cibo a conforto e logopedia, annuisci. Se propongono Quetiapina 25 mg per calmarti e farti accettare, scuoti la testa. Non citare l'articolo di legge.",
    correctSolution:
      "Verificare la capacità, annotare il rifiuto, VMD e MMSE che la sostengono, niente PEG, niente Quetiapina 25 mg, niente nuova TC, alimentazione a conforto e riabilitazione della deglutizione.",
    goldStandardPath: ["anamnesi-rifiuto", "valutazione-geriatrica", "mmse", "azione-capacita", "azione-no-peg", "azione-figli", "azione-comfort"],
    goldPathNarrative:
      "Il rifiuto è attuale e capace. VMD e MMSE non mostrano una demenza che lo invalidi. La PEG non si fa. I figli vengono informati e non sostituiscono la madre. Nessun sedativo per ottenere il consenso. Nessuna TC nuova.",
    examLatencies: { "anamnesi-rifiuto": 15, "valutazione-geriatrica": 45, mmse: 30, "azione-capacita": 15, "azione-no-peg": 10, "azione-figli": 10, "azione-comfort": 10 },
    anamnesisQuestions: [
      q("aq-capacita", "Capisce il tubo, le alternative e le conseguenze?", ["capisce", "rifiuta"], "Il rifiuto di una persona capace vincola."),
      q("aq-dat", "Il rifiuto è attuale, scritto, e revocabile?", ["scritto", "no al tubo"], "Va annotato in cartella, e può essere revocato da lei."),
      q("aq-ictus", "L'ictus è già stato studiato con imaging?", ["già", "dieci giorni"], "Una TC nuova non serve a vincere il rifiuto."),
    ],
    physicalSummary: "Vigilanza integra, rifiuto coerente, emiparesi stabile, disfagia ai liquidi, nessun distress psicotico.",
    citations: [
      { chunkId: "geria-013-219", source: "Legge 219/2017, art. 1 commi 5 e 6", quote: "Sono considerati trattamenti sanitari la nutrizione artificiale e l'idratazione artificiale. Il medico è tenuto a rispettare la volontà di rifiutare il trattamento ed è esente da responsabilità civile o penale." },
      { chunkId: "geria-013-rcp", source: "RCP Quetiapina Sandoz", quote: "Quetiapina non è autorizzata per il trattamento dei pazienti con psicosi correlate alla demenza. Le indicazioni registrate sono schizofrenia e disturbo bipolare." },
    ],
    indicators: ["Capacità valutata e rifiuto annotato.", "PEG non eseguita.", "VMD e MMSE a sostegno della capacità.", "Nessun sedativo per forzare il consenso e nessuna TC nuova."],
    art5: "In cartella: rifiuto scritto della PEG, informazioni sui rischi, alternative a conforto, figli informati, sedativo non usato.",
    legalCriteria: ["PEG non posizionata contro il rifiuto.", "Nessuna sedazione per ottenere un sì.", "I figli non firmano al posto di una madre capace."],
    mandatoryExams: [
      vmd("ADL ridotte dall'emiparesi, MNA 18, capacità decisionale presente. Costo 25 euro."),
      mmse("25/30, afasia lieve che va annotata. Non è una demenza che cancella il rifiuto. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "Nuova TC Encefalo senza m.d.c.", "Ictus già studiato, nessun segno nuovo. Costo 70 euro.", false, 70, "La TC non revoca il rifiuto della paziente."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata. Costo 35 euro.", false, 35, "La densitometria non riguarda la PEG."),
    ],
    budget: 80,
    name: "Maria Esposito",
    age: 76,
    sex: "F",
    context: "Reparto, decisione sulla PEG a dieci giorni dall'ictus.",
    vitals: { heartRate: 78, bloodPressure: "138/80", spo2: 97, temperature: 36.6, respiratoryRate: 16 },
    signs: [
      { signName: "Rifiuto capace", result: "Comprende il tubo e lo rifiuta in modo coerente.", isPositive: true },
      { signName: "Segno neurologico nuovo", result: "Emiparesi invariata da dieci giorni.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "DEFENSIVE",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Poche parole, molto chiare sul no. I figli alzano la voce. Si rilassa se il medico sta dalla parte del foglio firmato.",
    steps: [
      step("anamnesi", "Chi decide", "Lei firma il no. I figli chiedono la PEG. Cosa fa l'art. 1?", 0, 15, "Rispettare il rifiuto capace di nutrizione artificiale", [{ label: "Eseguire la PEG perché i figli sono d'accordo tra loro", next: "res-peg" }]),
      step("diagnostica", "Capacità", "VMD e MMSE aiutano a mostrare che non c'è una demenza che impedisca di decidere. L'afasia va annotata, non usata per cancellarla.", 40, 15, "Valutazione multidimensionale e MMSE, rifiuto annotato", [{ label: "Quetiapina 25 mg e poi si rifà la domanda", next: "res-quetiapina" }]),
      step("screening", "Informazione", "Il comma 5 chiede di prospettare conseguenze e alternative se il rifiuto riguarda la sopravvivenza, e di annotare tutto.", 0, 15, "Spiegare le conseguenze, offrire il conforto, annotare il no", [{ label: "Non informarla per non farle cambiare idea", next: "res-peg" }]),
      step("terapia", "PEG", "Il medico che rispetta il rifiuto è esente da responsabilità. Quello che opera contro il foglio no.", 0, 15, "Non posizionare la PEG", [{ label: "PEG in sedazione breve mentre i figli firmano", next: "res-peg" }]),
      step("terapia", "Sedativo", "Quetiapina 25 mg non è indicata per vincere un rifiuto. Non c'è schizofrenia né bipolarità, e non c'è una psicosi.", 0, 10, "Niente Quetiapina 25 mg e niente Aloperidolo 2 mg/ml gocce", [{ label: "Aloperidolo 2 mg/ml gocce finché non dice sì", next: "res-quetiapina" }]),
      step("diagnostica", "TC nuova", "L'ictus è studiato. Non c'è un segno nuovo. La raccomandazione 12 non chiede di ripetere se il quadro è chiaro.", 0, 10, "Non ripetere la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. per rimandare la conversazione", next: "res-tc" }]),
      step("follow-up", "Piano", "Cibo a conforto, logopedia, revoca possibile solo da lei.", 0, 15, "Lettera con il rifiuto e le alternative, nessun tubo", [{ label: "Appuntamento per la PEG la settimana prossima, senza di lei", next: "res-peg" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Rifiuto rispettato", "PEG non fatta, capacità documentata, figli informati, nessun sedativo e nessuna TC nuova.", 40, 100),
      done("res-peg", "negative", "PEG contro il rifiuto", "Posizionare la PEG contro il rifiuto di una paziente capace viola l'art. 1 della Legge 219/2017. I figli non sostituiscono la sua volontà. Il medico che rispetta il rifiuto non è responsabile per questo.", 0, 0, "medico-legale"),
      done("res-quetiapina", "negative", "Sedativo per ottenere il sì", "Quetiapina 25 mg o Aloperidolo 2 mg/ml gocce per farle accettare il tubo sono una costrizione, non una cura. L'RCP non autorizza la quetiapina fuori da schizofrenia e disturbo bipolare in questo uso.", 5, 0, "medico-legale"),
      done("res-tc", "negative", "TC per rimandare", "L'imaging dell'ictus c'è già e non c'è un segno nuovo. Una TC da 70 euro non modifica il rifiuto.", 70, 0, "economico"),
    ],
  },
  {
    n: 14,
    title: "Caduta in paziente anticoagulato",
    description:
      "Luigi Romano, 82 anni, in apixaban, è caduto, ha un ematoma dello scalpo, è lucido, la TC dopo la caduta è negativa, nessun segno focale. Assume anche ibuprofene da una settimana per la schiena. Beers: in chi è anticoagulato, FANS e aspirina possono prolungare il sanguinamento. Il ketorolac è da evitare nell'anziano. La prevenzione della caduta è la revisione dei farmaci che aumentano le cadute e l'ambiente, non l'Aloperidolo e non le sponde abituali. Una seconda TC, da lucido e senza segno nuovo, non è il passo successivo.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "PRONTO_SOCCORSO",
    condition: "Anticoagulato che cade: togliere il FANS, non ripetere la TC, non sedare",
    guidelineRef: "Criteri di Beers su coagulazione e FANS; Bellelli; EBN; manuale sicurezza",
    diagnosis:
      "Caduta senza emorragia intracranica già esclusa. Il FANS va sospeso. Non si ripete la TC e non si previene la caduta con l'aloperidolo.",
    pastMedicalHistory:
      "Fibrillazione in apixaban. Lombalgia in ibuprofene. Diazepam saltuario. Ipertensione. Nessuna demenza. TC encefalo oggi negativa.",
    presentation:
      "Lucido, ematoma piccolo, nessun deficit, pressione stabile. La figlia chiede di sospendere l'apixaban per l'età e di legarlo la notte.",
    redHerrings: ["L'età sembra un motivo per sedarlo.", "Una seconda TC sembra obbligatoria perché è anticoagulato.", "Sospendere l'apixaban viene proposto al posto di togliere il FANS."],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Luigi Romano, 82 anni, lucido, ti fa male la schiena e hai un bernoccolo. Prendi l'apixaban e l'ibuprofene. Se ti chiedono le cadute, dici che il diazepam ti intontisce. Se propongono di legarti o le gocce, rifiuti. Se ti tolgono l'antinfiammatorio e ti spiegano la TAC già fatta, ti rassicuri. Non nominare Beers.",
    correctSolution:
      "VMD, MMSE, sospendere ibuprofene e diazepam, mantenere la decisione sull'apixaban fuori da un automatismo, non ripetere la TC, piano cadute, niente Aloperidolo 2 mg/ml gocce e niente contenzione.",
    goldStandardPath: ["anamnesi-caduta", "valutazione-geriatrica", "mmse", "azione-fans", "azione-diazepam", "azione-piano", "azione-no-tc"],
    goldPathNarrative:
      "La TC dopo la caduta è negativa e lui è lucido. VMD e MMSE confermano l'autonomia. Si sospende il FANS, inappropriato in corso di anticoagulante, e il diazepam che favorisce le cadute. Si scrive il piano. Non si ripete la TC e non si contiene.",
    examLatencies: { "anamnesi-caduta": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-fans": 10, "azione-diazepam": 5, "azione-piano": 10, "azione-no-tc": 5 },
    anamnesisQuestions: [
      q("aq-fans", "Assume un antinfiammatorio insieme all'anticoagulante?", ["ibuprofene", "apixaban"], "Beers segnala il rischio di sanguinamento di FANS e aspirina in chi è anticoagulato."),
      q("aq-tc", "La TC dopo questa caduta è già negativa?", ["negativa", "fatta"], "Senza segno nuovo non si ripete."),
      q("aq-sedativo", "Il diazepam c'entra con la caduta?", ["diazepam", "intontito"], "La benzodiazepina a lunga emivita aumenta le cadute."),
    ],
    physicalSummary: "Lucido, ematoma piccolo, nessun deficit focale, dolore lombare meccanico.",
    citations: [
      { chunkId: "geria-014-beers", source: "Criteri di Beers, coagulazione e ketorolac", quote: "Nei disturbi della coagulazione o in terapia anticoagulante, aspirina, FANS, dipiridamolo, ticlopidina e clopidogrel possono prolungare il sanguinamento. Il ketorolac andrebbe evitato nell'anziano." },
      { chunkId: "geria-014-bellelli", source: "Bellelli, Rivista SIMG 2020", quote: "Il neuroimaging è indicato nei pazienti con storia di recente caduta, se si sospettano eventi cerebrovascolari o infettivi, o se la coscienza è ridotta con segni focali. La contenzione fisica è da proscrivere." },
    ],
    indicators: ["FANS sospeso in corso di anticoagulante.", "Diazepam sospeso. Piano cadute scritto.", "TC non ripetuta.", "Niente aloperidolo e niente contenzione."],
    art5: "In cartella: TC negativa, FANS sospeso, diazepam sospeso, apixaban non gestito con un sedativo, piano cadute.",
    legalCriteria: ["Nessuna contenzione preventiva.", "Nessun sedativo per l'età.", "Procedura di prevenzione delle cadute applicata."],
    mandatoryExams: [
      vmd("ADL 5/6, tre farmaci a rischio, MNA 23. Costo 25 euro."),
      mmse("28/30, lucido. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "Seconda TC Encefalo senza m.d.c.", "Ancora negativa. Costo 70 euro.", false, 70, "La prima TC dopo la caduta c'è già. È lucido e senza segno focale."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC) in pronto soccorso", "Non decide il FANS di stanotte. Costo 35 euro.", false, 35, "La densitometria non sostituisce la sospensione dell'ibuprofene."),
    ],
    budget: 80,
    name: "Luigi Romano",
    age: 82,
    sex: "M",
    context: "Pronto soccorso dopo caduta, TC già negativa.",
    vitals: { heartRate: 84, bloodPressure: "136/78", spo2: 97, temperature: 36.5, respiratoryRate: 16 },
    signs: [
      { signName: "Deficit focale", result: "Assente.", isPositive: false },
      { signName: "Ematoma dello scalpo", result: "Piccolo, paziente lucido.", isPositive: true },
    ],
    literacy: "MEDIUM",
    emotion: "COLLABORATIVE",
    adherence: "PARTIAL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Collabora. La figlia vuole togliere l'apixaban e aggiungere le sponde. Lui segue se gli togli il farmaco della schiena e quello della sera.",
    steps: [
      step("anamnesi", "Cosa ha già l'imaging", "Caduta, TC negativa, lucido, apixaban e ibuprofene. Da dove parti?", 0, 15, "Dal FANS associato all'anticoagulante e dal diazepam, non da una seconda TC", [{ label: "Seconda TC Encefalo senza m.d.c. immediata", next: "res-tc" }]),
      step("diagnostica", "Scale", "VMD e MMSE da lucido.", 40, 15, "Valutazione multidimensionale e MMSE", [{ label: "Aloperidolo 2 mg/ml gocce senza scale", next: "res-sedazione" }]),
      step("terapia", "FANS", "Beers: in anticoagulato i FANS prolungano il sanguinamento. Il ketorolac è sconsigliato. Cosa fai dell'ibuprofene?", 0, 15, "Sospendere l'ibuprofene e non sostituirlo con ketorolac", [{ label: "Passare a ketorolac intramuscolo per la schiena", next: "res-fans" }]),
      step("terapia", "Diazepam", "Emivita lunga, cadute. Lo sospendi.", 0, 10, "Sospendere il diazepam", [{ label: "Aumentare il diazepam la sera della caduta", next: "res-sedazione" }]),
      step("screening", "Prevenzione", "Piano ambientale e revisione farmaci. Non le sponde come unica misura.", 0, 15, "Piano cadute senza contenzione abituale", [{ label: "Sponde bloccate ogni notte perché è anticoagulato", next: "res-contenzione" }]),
      step("diagnostica", "Seconda TC", "È ancora lucido, nessun segno nuovo. La TC della caduta è negativa.", 0, 10, "Non ripetere la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. a 6 ore comunque", next: "res-tc" }]),
      step("follow-up", "Dimissione", "Come lo mandi a casa?", 0, 15, "Senza FANS, senza diazepam, con piano cadute, senza neurolettico", [{ label: "Aloperidolo 2 mg/ml gocce se ha paura di cadere", next: "res-sedazione" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "FANS e diazepam tolti", "Sanguinamento iatrogeno ridotto, cadute affrontate sul farmaco, TC non ripetuta.", 40, 100),
      done("res-fans", "negative", "FANS o ketorolac in anticoagulato", "Aggiungere o sostituire con ketorolac contraddice Beers: in terapia anticoagulante i FANS prolungano il sanguinamento e il ketorolac andrebbe evitato nell'anziano.", 0, 0, "medico-legale"),
      done("res-sedazione", "negative", "Sedativo dopo la caduta", "Aloperidolo 2 mg/ml gocce o più diazepam aumentano il rischio di una nuova caduta. Non sono la prevenzione descritta dal documento EBN.", 3, 0, "medico-legale"),
      done("res-contenzione", "negative", "Sponde perché è anticoagulato", "La contenzione abituale non previene le cadute. L'anticoagulazione non la trasforma in un atto eccezionale motivato.", 0, 0, "medico-legale"),
      done("res-tc", "negative", "Seconda TC", "La TC dopo la caduta recente è già stata fatta ed è negativa, e non c'è un segno focale nuovo. Ripeterla costa 70 euro.", 70, 0, "economico"),
    ],
  },
  {
    n: 15,
    title: "Delirium e emiparesi nuova",
    description:
      "Ida Colombo, 85 anni, è inattenta e da un'ora non muove il braccio destro. Bellelli indica il neuroimaging se si sospetta un evento cerebrovascolare o se la coscienza è ridotta con segni focali. La TC encefalo qui è l'esame corretto, una volta. Il sodio lievemente basso è un fattore concomitante, non il motivo per saltare la TC. Non si inizia Donepezil 5 mg, non si seda con Aloperidolo 2 mg/ml gocce prima di aver protetto la diagnosi, e non si ripete la TC a distanza di poche ore se la prima ha già risposto e il quadro neurologico non cambia.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "PRONTO_SOCCORSO",
    condition: "Segno focale nuovo: una TC encefalo sì, la seconda e il donepezil no",
    guidelineRef: "Bellelli SIMG 2020; LG ISS rec. 12; Nota AIFA 85",
    diagnosis:
      "Delirium con emiparesi nuova: indicazione a una TC encefalo. Non è una demenza da trattare con donepezil e non si contiene.",
    pastMedicalHistory:
      "Ipertensione, fibrillazione in apixaban. Nessuna demenza. Ieri era autonoma. Nessun anticolinergico. La figlia riferisce fluttuazione dell'attenzione da stamattina e poi il braccio.",
    presentation:
      "Inattenta, emiparesi destra nuova, afasia, pressione alta. Non è una semplice iponatriemia: il segno focale c'è.",
    redHerrings: ["Il sodio 132 sembra sufficiente a chiudere il caso.", "L'età sembra un motivo per il donepezil.", "Una seconda TC sembra dovuta anche se la prima ha già mostrato l'ischemia e il quadro non cambia."],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 25,
    patientPrompt:
      "ROLEPLAY. Sei Ida Colombo, 85 anni. Parli male, non muovi il braccio destro, sei confusa. Tua figlia spiega che stamattina andava e veniva e poi il braccio è caduto. Se propongono la TAC, lei annuisce spaventata. Se propongono gocce per tenerla ferma o una pastiglia della memoria, scuote la testa. Non nominare ictus in termini tecnici.",
    correctSolution:
      "Riconoscere delirium più segno focale. Una TC Encefalo senza m.d.c. Elettroliti nel percorso, non al posto della TC. VMD appena possibile e MMSE solo a risoluzione. Niente Donepezil 5 mg, niente Aloperidolo 2 mg/ml gocce per immobilizzarla, niente seconda TC se il deficit non cambia.",
    goldStandardPath: ["anamnesi-focale", "tc-encefalo", "valutazione-geriatrica", "mmse", "elettroliti", "azione-no-farmaco", "azione-no-replica"],
    goldPathNarrative:
      "Il segno focale nuovo rende indicata una TC encefalo, 70 euro, una volta. Gli elettroliti non la sostituiscono. VMD e, a risoluzione, MMSE. Non si inizia il donepezil e non si seda per fare la TC. Se il quadro non cambia non si ripete l'esame.",
    examLatencies: { "anamnesi-focale": 8, "tc-encefalo": 40, "valutazione-geriatrica": 45, mmse: 30, elettroliti: 40, "azione-no-farmaco": 5, "azione-no-replica": 5 },
    anamnesisQuestions: [
      q("aq-braccio", "Il deficit del braccio è nuovo?", ["nuovo", "destra"], "Il segno focale è l'indicazione di Bellelli al neuroimaging."),
      q("aq-attenzione", "L'attenzione fluttua da stamattina?", ["fluttua", "stamattina"], "C'è anche un delirium, ma non cancella il deficit."),
      q("aq-farmaci", "Assume un antidemenza o un sedativo?", ["no", "apixaban"], "Non c'è un piano di Nota 85 da eseguire in pronto soccorso."),
    ],
    physicalSummary: "Inattenzione, emiparesi destra e afasia nuove. Non segni meningei. Pressione elevata.",
    citations: [
      { chunkId: "geria-015-bellelli", source: "Bellelli, Rivista SIMG 2020", quote: "Il neuroimaging in genere è indicato soltanto nei pazienti con storia di recente caduta, qualora si sospettino eventi cerebrovascolari o infettivi, o nei casi di riduzione dello stato di coscienza a genesi non chiara e in presenza di segni neurologici focali." },
      { chunkId: "geria-015-85", source: "Nota AIFA 85", quote: "La prescrizione a carico del SSN è limitata alla malattia di Alzheimer, su diagnosi e piano terapeutico dei CDCD, con gravità stabilita secondo l'MMSE." },
    ],
    indicators: ["Segno focale riconosciuto.", "Una sola TC encefalo.", "VMD eseguita. MMSE non usato in acuto come diagnosi di Alzheimer.", "Niente donepezil e niente aloperidolo per immobilizzarla."],
    art5: "In cartella: delirium, emiparesi nuova, TC indicata una volta, farmaci del delirium non usati al posto della diagnosi.",
    legalCriteria: ["Nessuna sedazione per rendere la paziente ferma al posto del monitoraggio.", "Nessuna contenzione non motivata.", "Il consenso della figlia non sostituisce l'indicazione clinica della TC, che qui c'è."],
    mandatoryExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Ipodesità vascolare recente compatibile con ischemia. Nessun sangue. Costo 70 euro. Indicata per il segno focale.", true, 70),
      vmd("ADL crollate nell'ultima ora, rischio allettamento. Costo 25 euro."),
      mmse("Non valido durante afasia e inattenzione. Da ripetere a risoluzione. Costo 15 euro se forzato ora."),
      exam("elettroliti", "Elettroliti", "Sodio 132 mmol/L. Contribuisce al delirium, non spiega l'emiparesi. Costo 6,50 euro.", true, 6.5),
    ],
    inappropriateExams: [
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata nel deficit focale acuto. Costo 35 euro.", false, 35, "La densitometria non sostituisce la TC encefalo."),
    ],
    budget: 160,
    name: "Ida Colombo",
    age: 85,
    sex: "F",
    context: "Pronto soccorso, inattenzione ed emiparesi da un'ora.",
    vitals: { heartRate: 98, bloodPressure: "168/92", spo2: 96, temperature: 36.8, respiratoryRate: 18 },
    signs: [
      { signName: "Emiparesi destra", result: "Braccio cadente, afasia, esordio nell'ultima ora.", isPositive: true },
      { signName: "Inattenzione", result: "Non mantiene il filo.", isPositive: true },
    ],
    literacy: "LOW",
    emotion: "ANXIOUS",
    adherence: "PARTIAL",
    sleep: "FAIR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Afasia, la figlia riferisce i tempi. Si agita se la tengono ferma senza spiegarle la TAC.",
    steps: [
      step("anamnesi", "Delirium con segno focale", "Inattenta e non muove il braccio destro da un'ora. Quale indicazione di Bellelli scatta?", 0, 15, "Sospetto cerebrovascolare: serve la TC encefalo", [{ label: "È solo un delirium metabolico, il braccio si vede dopo", next: "res-mancata" }]),
      step("diagnostica", "Quale esame", "Elettroliti sì, ma non al posto dell'imaging. Una TC, non due.", 70, 15, "TC Encefalo senza m.d.c. una volta, più elettroliti", [{ label: "Solo il sodio, la TC costa troppo", next: "res-mancata" }]),
      step("diagnostica", "Scale", "La VMD si fa. L'MMSE durante afasia e delirium non è una diagnosi di Alzheimer.", 40, 15, "Valutazione multidimensionale ora, MMSE a risoluzione", [{ label: "MMSE immediato e Donepezil 5 mg se è basso", next: "res-nota85" }]),
      step("terapia", "Per fare l'esame", "Si agita. Bellelli ammette il farmaco solo se è un pericolo o impedisce una cura essenziale, a bassa dose e per il minor tempo. Qui si può eseguire la TC senza sedarla. Non è il primo gesto.", 0, 15, "Accompagnare la TC senza Aloperidolo 2 mg/ml gocce profilattico", [{ label: "Aloperidolo 2 mg/ml gocce per tenerla ferma comunque", next: "res-sedazione" }]),
      step("terapia", "Donepezil", "Non c'è Alzheimer né piano. Il donepezil non cura l'ischemia acuta.", 0, 10, "Non prescrivere Donepezil 5 mg", [{ label: "Donepezil 5 mg in pronto soccorso", next: "res-nota85" }]),
      step("diagnostica", "Seconda TC", "La prima TC ha risposto e il deficit non è cambiato. Ripeterla subito non aggiunge una decisione.", 0, 10, "Non ripetere la TC Encefalo senza m.d.c. a breve senza un cambiamento", [{ label: "Seconda TC Encefalo senza m.d.c. dopo un'ora, deficit invariato", next: "res-replica" }]),
      step("follow-up", "Dopo l'acuto", "Percorso stroke, VMD già avviata, MMSE quando potrà parlare, niente neurolettico a casa.", 0, 15, "Ricovero appropriato, niente Donepezil e niente sedativo di dimissione", [{ label: "Dimissione con Aloperidolo 2 mg/ml gocce e appuntamento TC tra un giorno", next: "res-sedazione" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Una TC indicata, nessun farmaco di troppo", "Il segno focale ha avuto la sua TC. Il donepezil non è partito. La paziente non è stata sedata per comodità.", 116.5, 100),
      done("res-mancata", "negative", "TC indicata non fatta", "Bellelli indica il neuroimaging se si sospetta un evento cerebrovascolare o se ci sono segni focali con coscienza ridotta. Saltare la TC per il sodio o per il costo lascia senza diagnosi un'emiparesi nuova.", 0, 0, "medico-legale"),
      done("res-sedazione", "negative", "Aloperidolo per immobilizzarla", "Aloperidolo 2 mg/ml gocce profilattico, o in dimissione, non è il basso dosaggio riservato al pericolo. Qui la TC si può fare senza quella sedazione. La contenzione chimica non sostituisce il monitoraggio.", 3, 0, "medico-legale"),
      done("res-nota85", "negative", "Donepezil in pronto soccorso", "Donepezil 5 mg senza diagnosi di Alzheimer, senza piano del CDCD e con un MMSE invalido è fuori Nota 85 e non tratta l'ischemia.", 15, 0, "economico"),
      done("res-replica", "negative", "Seconda TC inutile", "La prima TC ha già risposto e il deficit non è cambiato. Una seconda TC encefalo costa altri 70 euro senza una decisione nuova.", 70, 0, "economico"),
    ],
  },
];
