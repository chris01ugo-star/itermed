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

export const batch2: Spec[] = [
  {
    n: 6,
    title: "Mild Cognitive Impairment, non Alzheimer",
    description:
      "Elena Costa, 74 anni, riferisce smemoratezza. Vive sola, guida, gestisce i conti, ADL e IADL conservate. L'MMSE è 27/30 e i test mostrano un disturbo isolato di memoria. La LG ISS, raccomandazione 84, è forte e negativa: non offrire inibitori dell'acetilcolinesterasi né memantina nel Mild Cognitive Impairment. La Nota 85 rimborsa quei farmaci solo nell'Alzheimer con piano del CDCD. Va monitorata, non trattata con Donepezil 5 mg o Memantina 10 mg.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "AMBULATORIO",
    condition: "MCI: niente donepezil e niente memantina, follow-up cognitivo",
    guidelineRef: "LG demenza ISS 2024 rec. 28-30 e 84; Nota AIFA 85",
    diagnosis:
      "Mild Cognitive Impairment senza perdita funzionale. Donepezil 5 mg e Memantina 10 mg non sono indicati. Non c'è delirium.",
    pastMedicalHistory:
      "Ipertensione controllata. Nessun ictus, nessuna depressione maggiore, udito corretto dagli occhiali acustici che usa. Nessun anticolinergico. Un conoscente le ha consigliato la pastiglia della memoria. Nessuna DAT.",
    presentation:
      "Collaborante, racconto coerente, conferma della figlia: dimentica i nomi ma non si perde e non trascura le medicine. Nessun segno focale, nessun fluctuare.",
    redHerrings: [
      "MMSE non perfetto viene letto come Alzheimer lieve da trattare subito.",
      "La figlia chiede la memantina perché ha sentito che protegge.",
      "Una TC normale viene usata per escludere ogni follow-up.",
    ],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Elena Costa, 74 anni. Sei precisa e un po' ansiosa. Dimentichi i nomi, non gli appuntamenti. Guidi e paghi le bollette. Se propongono Donepezil 5 mg o Memantina 10 mg, chiedi se servono davvero. Se ti dicono di tornare a controllo senza quelle pastiglie, accetti sollevata. Se propongono una benzodiazepina per l'ansia della memoria, esita. Non nominare linee guida.",
    correctSolution:
      "VMD e MMSE, conferma dell'autonomia, niente Donepezil 5 mg e niente Memantina 10 mg, follow-up, niente TC seriale se il primo imaging strutturale utile è già stato valutato nel percorso e il quadro è MCI clinico senza segno focale nuovo.",
    goldStandardPath: ["anamnesi-mci", "valutazione-geriatrica", "mmse", "azione-funzione", "azione-no-farmaco", "azione-follow-up", "azione-no-benzo"],
    goldPathNarrative:
      "L'autonomia è conservata. VMD e MMSE sostengono il MCI, non la demenza. La raccomandazione 84 vieta donepezil e memantina. Si programma un controllo. Non si aggiunge una benzodiazepina. Non si ripete la TC senza un quesito nuovo.",
    examLatencies: { "anamnesi-mci": 15, "valutazione-geriatrica": 45, mmse: 30, "azione-funzione": 10, "azione-no-farmaco": 10, "azione-follow-up": 10, "azione-no-benzo": 5 },
    anamnesisQuestions: [
      q("aq-funzione", "Ha perso autonomia in ADL o IADL, o solo prestazioni di memoria?", ["autonomia", "memoria"], "Senza impatto funzionale non è demenza e il MCI non si tratta con gli antidemenza."),
      q("aq-reversibili", "Ci sono depressione, delirium o farmaci anticolinergici?", ["depressione", "farmaci"], "La raccomandazione 5 chiede di escludere le cause reversibili prima di una etichetta."),
      q("aq-farmaco", "Qualcuno ha già proposto donepezil o memantina?", ["donepezil", "memantina"], "Quei farmaci sono fuori dalla raccomandazione 84."),
    ],
    physicalSummary: "Vigilanza normale, nessun deficit focale, umore reattivo, non inattenzione fluttuante.",
    citations: [
      { chunkId: "geria-006-84", source: "LG ISS demenza e MCI, gennaio 2024, raccomandazione 84", quote: "Non offrire inibitori delle acetilcolinesterasi (donepezil, galantamina e rivastigmina) e memantina per il trattamento del Mild Cognitive Impairment." },
      { chunkId: "geria-006-85", source: "Nota AIFA 85", quote: "La prescrizione a carico del SSN, su diagnosi e piano terapeutico dei CDCD, è limitata ai pazienti con malattia di Alzheimer di grado lieve, moderato o severo secondo l'MMSE." },
    ],
    indicators: ["Autonomia distinta dal sintomo di memoria.", "VMD e MMSE eseguiti.", "Nessun Donepezil 5 mg e nessuna Memantina 10 mg.", "Follow-up programmato, nessuna TC di ripetizione."],
    art5: "In cartella: MCI, autonomia conservata, raccomandazione 84, farmaci non prescritti, controllo fissato.",
    legalCriteria: ["Nessuna benzodiazepina per il disturbo di memoria.", "Consenso al follow-up, non una terapia imposta.", "La figlia non ottiene un farmaco fuori indicazione."],
    mandatoryExams: [
      vmd("ADL 6/6, IADL 8/8, MNA 26. Nessuna dipendenza. Costo 25 euro."),
      mmse("27/30, perso un punto al richiamo. Non è la fascia che da sola autorizza un antidemenza. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "Seconda TC Encefalo senza m.d.c.", "TC già eseguita nel percorso iniziale, senza lesioni trattabili. Una seconda costa 70 euro.", false, 70, "Il MCI si segue nel tempo. Una TC duplicata non autorizza il farmaco."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata da questo quesito cognitivo. Costo 35 euro.", false, 35, "La densitometria non diagnostica il MCI."),
    ],
    budget: 90,
    name: "Elena Costa",
    age: 74,
    sex: "F",
    context: "Ambulatorio per smemoratezza isolata.",
    vitals: { heartRate: 72, bloodPressure: "128/76", spo2: 98, temperature: 36.4, respiratoryRate: 14 },
    signs: [
      { signName: "Perdita delle ADL", result: "Autonoma in tutte le attività di base.", isPositive: false },
      { signName: "Delirium", result: "Nessuna fluttuazione e nessuna inattenzione marcata.", isPositive: false },
    ],
    literacy: "HIGH",
    emotion: "ANXIOUS",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Fa domande sul perché non le dai la pastiglia. Si rassicura se le spieghi il controllo nel tempo.",
    steps: [
      step("anamnesi", "Demenza o MCI", "Dimentica i nomi, vive sola, guida, IADL integre. Come lo chiami?", 0, 15, "Mild Cognitive Impairment: sintomi cognitivi senza perdita dell'autonomia", [{ label: "Diagnosi di Alzheimer lieve e ricetta immediata di Donepezil 5 mg", next: "res-farmaco" }]),
      step("diagnostica", "Scale", "Servono funzione e un test cognitivo, non un biomarcatore del MCI. La raccomandazione 29 non offre biomarcatori per il MCI.", 40, 15, "Valutazione multidimensionale e MMSE, poi follow-up", [{ label: "PET o puntura lombare per confermare il MCI", next: "res-tc" }]),
      step("screening", "Cause reversibili", "Prima di etichettare, la LG chiede di aver escluso delirium, depressione, deficit sensoriali e carico anticolinergico. Qui non ci sono. Cosa fai?", 0, 15, "Registrare l'assenza di cause reversibili e non iniziare un antidemenza", [{ label: "Iniziare comunque Memantina 10 mg in attesa del CDCD", next: "res-farmaco" }]),
      step("terapia", "Raccomandazione 84", "Il panel è forte e negativo sui due farmaci nel MCI. La Nota 85 non rimborsa fuori dall'Alzheimer.", 0, 15, "Non prescrivere Donepezil 5 mg né Memantina 10 mg", [{ label: "Donepezil 5 mg perché l'MMSE non è 30", next: "res-farmaco" }]),
      step("terapia", "Ansia della memoria", "Chiede qualcosa per dormire e non pensarci. Il diazepam, nei criteri di Beers, prolunga la sedazione e aumenta le cadute, e in un disturbo cognitivo peggiora i sintomi.", 0, 10, "Niente benzodiazepina a lunga emivita", [{ label: "Diazepam ogni sera fino al controllo", next: "res-benzo" }]),
      step("diagnostica", "Immagini", "Una TC strutturale utile a escludere cause secondarie può appartenere al primo inquadramento. Ripeterla oggi, senza segno focale, no.", 0, 10, "Non ripetere la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. oggi e un'altra tra un mese", next: "res-tc" }]),
      step("follow-up", "Cosa programmare", "La raccomandazione 30 offre una valutazione regolare per cogliere regressione, stabilità o progressione.", 0, 15, "Controllo cognitivo ed eventuale invio al CDCD se compare perdita funzionale", [{ label: "Nessun controllo: l'MMSE basta a chiudere il caso", next: "res-follow" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "MCI senza antidemenza", "Funzione e MMSE documentati, farmaci della Nota 85 non iniziati, controllo fissato, nessuna benzodiazepina.", 40, 100),
      done("res-farmaco", "negative", "Antidemenza nel MCI", "Donepezil 5 mg o Memantina 10 mg nel Mild Cognitive Impairment contraddicono la raccomandazione 84 e non rientrano nella Nota 85, che limita il SSN all'Alzheimer con piano del CDCD.", 15, 0, "economico"),
      done("res-tc", "negative", "Esami ripetuti o biomarcatori del MCI", "La raccomandazione 29 non offre biomarcatori per diagnosticare il MCI. Una seconda TC encefalo costa 70 euro e non trasforma il MCI in un'indicazione a farmaco.", 70, 0, "economico"),
      done("res-benzo", "negative", "Benzodiazepina per la memoria", "Il diazepam è una benzodiazepina a lunga emivita: nei criteri di Beers la sedazione può durare giorni e aumenta cadute e fratture. In un disturbo cognitivo le benzodiazepine peggiorano i sintomi.", 0, 0, "medico-legale"),
      done("res-follow", "negative", "Nessun monitoraggio", "La raccomandazione 30 chiede una valutazione nel tempo. Chiudere dopo un solo MMSE perde la progressione eventuale a demenza.", 0, 0, "medico-legale"),
    ],
  },
  {
    n: 7,
    title: "Depressione e carico anticolinergico",
    description:
      "Renato Fabbri, 81 anni, è rallentato, piange, ha smesso di uscire. L'MMSE fatto in questa fase è basso ma la figlia data l'inizio a sei settimane, dopo il lutto della sorella, e assume amitriptilina prescritta per il sonno. La LG chiede di escludere depressione e farmaci a carico anticolinergico prima di inviare al CDCD come demenza. I criteri di Beers sconsigliano l'amitriptilina come antidepressivo di prima scelta e l'uso prolungato di benzodiazepine nella depressione. Non si parte con Donepezil 5 mg.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "AMBULATORIO",
    condition: "Declino reversibile: depressione e amitriptilina prima di ogni antidemenza",
    guidelineRef: "LG demenza ISS 2024 rec. 5 e 31-32; criteri di Beers; Nota AIFA 85",
    diagnosis:
      "Sindrome depressiva e carico anticolinergico da amitriptilina, non Alzheimer da trattare con donepezil.",
    pastMedicalHistory:
      "Lutto sei settimane fa. Amitriptilina 25 mg alla sera da due mesi, più diazepam saltuario. Ipertensione in enalapril. Nessuna diagnosi di demenza. Autonomo fino a maggio.",
    presentation:
      "Ipoespressivo, latenza delle risposte, orientato se stimolato, non fluttuante nell'arco dei minuti. Riferisce insonnia e senso di colpa. Nessun deficit focale.",
    redHerrings: [
      "L'MMSE basso sembra Alzheimer.",
      "L'amitriptilina viene difesa come già un antidepressivo.",
      "Il rallentamento viene scambiato per delirium ipoattivo da sedare.",
    ],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Renato Fabbri, 81 anni. Parli piano, dici che non vale la pena e che tua sorella è morta. Se chiedono da quando: da sei settimane. Se chiedono le pastiglie della sera: una per il nervo e a volte quella per dormire. Se propongono Donepezil 5 mg, dici che non ti interessa la memoria, ti interessa non svegliarti. Se propongono di togliere l'amitriptilina e di curare il tono dell'umore, accetti con fatica. Non nominare scale.",
    correctSolution:
      "VMD e MMSE come descrizione, non come diagnosi di Alzheimer. Sospendere amitriptilina e diazepam. Curare la depressione senza un triciclico di prima scelta. Non inviare al CDCD finché la causa reversibile non è stata tolta. Niente Donepezil 5 mg. Niente Aloperidolo 2 mg/ml gocce.",
    goldStandardPath: ["anamnesi-umore", "valutazione-geriatrica", "mmse", "azione-anticolinergico", "azione-depressione", "azione-no-donepezil", "azione-follow-up"],
    goldPathNarrative:
      "Si data l'esordio e si trova l'amitriptilina. VMD e MMSE descrivono il momento, non autorizzano il donepezil. Si toglie il triciclico e la benzodiazepina. Si cura l'umore e si ricontrolla la cognizione. Nessuna TC encefalo senza segno focale.",
    examLatencies: { "anamnesi-umore": 15, "valutazione-geriatrica": 45, mmse: 30, "azione-anticolinergico": 10, "azione-depressione": 10, "azione-no-donepezil": 5, "azione-follow-up": 10 },
    anamnesisQuestions: [
      q("aq-tempo", "Il rallentamento è iniziato in settimane o è stabile da anni?", ["settimane", "lutto"], "L'esordio recente orienta a una causa reversibile."),
      q("aq-farmaci", "Assume amitriptilina o una benzodiazepina?", ["amitriptilina", "diazepam"], "Il triciclico aumenta il carico anticolinergico e non è la prima scelta."),
      q("aq-umore", "Ci sono tristezza, colpa, anedonia?", ["tristezza", "colpa"], "La depressione va esclusa prima del CDCD, raccomandazione 5."),
    ],
    physicalSummary: "Umore depresso, latenza, orientamento recuperabile, nessun deficit focale, non fluttuazione tipica del delirium.",
    citations: [
      { chunkId: "geria-007-lg", source: "LG ISS demenza e MCI, gennaio 2024, raccomandazioni 5 e 32", quote: "Riferire al CDCD quando siano state escluse cause reversibili, incluso il declino cognitivo causato da farmaci con aumentato carico anticolinergico. Minimizzare quei farmaci nella revisione della terapia." },
      { chunkId: "geria-007-beers", source: "Criteri di Beers, parte I e parte sulla depressione", quote: "L'amitriptilina, per i rilevanti effetti sedativi e anticolinergici, è inopportuna come antidepressivo di prima scelta. L'uso prolungato di benzodiazepine può generare o aggravare la depressione." },
    ],
    indicators: ["Esordio e farmaci anticolinergici raccolti prima del CDCD.", "VMD e MMSE eseguiti come descrizione.", "Amitriptilina sospesa. Nessun Donepezil 5 mg.", "Nessuna TC encefalo senza segno focale."],
    art5: "In cartella: depressione, amitriptilina, sospensione, divieto di donepezil prima della rivalutazione, nessun invio affrettato al CDCD.",
    legalCriteria: ["Nessun sedativo aggiuntivo per il rallentamento.", "Consenso alla sospensione spiegato.", "Non si etichetta demenza una depressione non trattata."],
    mandatoryExams: [
      vmd("ADL scese da 6/6 a 4/6 in sei settimane, IADL in calo, MNA 20, umore depresso. Costo 25 euro."),
      mmse("19/30 oggi, con lentezza. Non va letto come fascia della Nota 85 finché la causa reversibile è in corso. Costo 15 euro."),
      exam("tiroide", "TSH", "TSH nei limiti. Non spiega il quadro. Costo 22 euro.", false, 22),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Nessuna lesione acuta attesa e nessun segno focale. Costo 70 euro.", false, 70, "Prima si toglie l'anticolinergico. La TC non sostituisce la raccomandazione 5."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata. Costo 35 euro.", false, 35, "La densitometria non cura il tono dell'umore."),
    ],
    budget: 100,
    name: "Renato Fabbri",
    age: 81,
    sex: "M",
    context: "Ambulatorio, rallentamento dopo un lutto.",
    vitals: { heartRate: 70, bloodPressure: "134/78", spo2: 97, temperature: 36.5, respiratoryRate: 14 },
    signs: [
      { signName: "Umore depresso", result: "Colpa, anedonia, insonnia, esordio in sei settimane.", isPositive: true },
      { signName: "Segno focale", result: "Assente.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "PASSIVE",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Risponde dopo una pausa. La figlia riempie i silenzi e chiede la pastiglia della memoria. Lui segue se gli si parla del sonno e del lutto.",
    steps: [
      step("anamnesi", "Da quando e con quali farmaci", "Rallentato da sei settimane, amitriptilina alla sera. Prima di parlare di Alzheimer, cosa ricostruisci?", 0, 15, "Depressione recente più anticolinergico, non una demenza stabile", [{ label: "Alzheimer e Donepezil 5 mg in giornata", next: "res-nota85" }]),
      step("diagnostica", "VMD e MMSE", "Le scale descrivono funzione e cognizione di oggi. Non sono, da sole, il piano della Nota 85.", 40, 15, "Valutazione multidimensionale e MMSE, da ripetere dopo la sospensione", [{ label: "TC Encefalo senza m.d.c. come primo atto", next: "res-tc" }]),
      step("screening", "Invio al CDCD", "La raccomandazione 5 condiziona l'invio all'esclusione di depressione e carico anticolinergico. Quelle cause sono ancora attive.", 0, 15, "Non inviare come demenza finché non si sono tolte le cause reversibili", [{ label: "Invio urgente al CDCD per iniziare il donepezil", next: "res-nota85" }]),
      step("terapia", "Amitriptilina", "Beers: inopportuna come antidepressivo di prima scelta per sedazione e effetto anticolinergico. In un disturbo cognitivo i triciclici peggiorano il deficit.", 0, 15, "Sospendere l'amitriptilina e non sostituirla con un'altra molecola anticolinergica", [{ label: "Aumentare l'amitriptilina perché è già un antidepressivo", next: "res-beers" }]),
      step("terapia", "Benzodiazepina e neurolettico", "Il diazepam può aggravare la depressione. L'Aloperidolo 2 mg/ml gocce non cura il lutto e non è indicato in assenza di pericolo.", 0, 10, "Sospendere il diazepam. Niente Aloperidolo 2 mg/ml gocce", [{ label: "Aloperidolo 2 mg/ml gocce perché è rallentato e la figlia è stanca", next: "res-aloperidolo" }]),
      step("terapia", "Donepezil", "Senza diagnosi di Alzheimer e senza piano del CDCD il Donepezil 5 mg non è rimborsabile e qui la causa è un'altra.", 0, 10, "Non prescrivere Donepezil 5 mg", [{ label: "Donepezil 5 mg per l'MMSE di 19", next: "res-nota85" }]),
      step("follow-up", "Rivalutazione", "Dopo la sospensione e la cura dell'umore si rimisura la cognizione. Se resta un sospetto, allora il CDCD.", 0, 15, "Controllo di umore, farmaci e MMSE. CDCD solo se il sospetto sopravvive", [{ label: "Nessun controllo: la diagnosi di demenza è già chiusa", next: "res-beers" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Causa reversibile trattata", "Amitriptilina e diazepam sospesi, umore in cura, donepezil non iniziato, scale da ripetere.", 62, 100),
      done("res-nota85", "negative", "Donepezil senza Alzheimer", "Donepezil 5 mg senza diagnosi di Alzheimer e senza piano del CDCD è fuori Nota 85. La raccomandazione 5 vieta di saltare depressione e anticolinergici.", 15, 0, "economico"),
      done("res-tc", "negative", "TC encefalo al posto della revisione", "Non c'è segno focale né sospetto cerebrovascolare. La TC costa 70 euro e non sostituisce la sospensione dell'amitriptilina.", 70, 0, "economico"),
      done("res-beers", "negative", "Triciclico aumentato", "Aumentare l'amitriptilina, o chiudere il caso come demenza, lascia in corso un farmaco che Beers giudica inappropriato come prima scelta e che la LG invita a minimizzare.", 0, 0, "medico-legale"),
      done("res-aloperidolo", "negative", "Aloperidolo per il rallentamento", "Aloperidolo 2 mg/ml gocce non tratta la depressione. Non c'è pericolo per sé o per gli altri né un grave distress psicotico. È una sedazione di comodo.", 3, 0, "medico-legale"),
    ],
  },
  {
    n: 8,
    title: "Cadute ripetute e diazepam",
    description:
      "Anna Rizzi, 83 anni, tre cadute in due mesi, l'ultima con trauma cranico lieve. La TC dopo quella caduta è negativa, è lucida, non ha segni focali. Assume diazepam ogni sera da anni. Beers classifica le benzodiazepine a lunga emivita ad alto rischio di cadute e fratture. Il documento EBN mette i tranquillanti tra i fattori estrinseci e ricorda che la contenzione non previene le cadute. Il manuale di sicurezza lega un decesso alla mancata procedura di prevenzione. Una terza TC non è indicata.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "PRONTO_SOCCORSO",
    condition: "Cadute: sospendere il diazepam, piano multifattoriale, no TC seriale",
    guidelineRef: "Criteri di Beers; EBN contenzione; Bellelli SIMG 2020; manuale sicurezza",
    diagnosis:
      "Cadute in donna lucida, favorite dal diazepam. La TC dopo l'ultimo trauma è sufficiente. Non si contiene e non si aggiunge Aloperidolo 2 mg/ml gocce.",
    pastMedicalHistory:
      "Insonnia in diazepam 5 mg. Ipertensione. Osteoporosi nota, non in terapia remineralizzante e non allettata: vive sola e cammina. Nessuna demenza. Nessuna DAT.",
    presentation:
      "Lucida, escoriazione frontale, pressione stabile, nessun deficit. La figlia chiede una TC nuova e le sponde a casa.",
    redHerrings: ["Tre cadute sembrano tre TC obbligatorie.", "Il diazepam è l'unica cosa che la fa dormire.", "Le sponde vengono vendute come prevenzione."],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Anna Rizzi, 83 anni, lucida, dolorante alla fronte. Cadi spesso, prendi il diazepam ogni sera. Se ti chiedono di smetterlo hai paura di non dormire, ma ascolti se ti spiegano le cadute. Se propongono un'altra TAC o di legare il letto, dici che vuoi tornare a casa. Non nominare criteri.",
    correctSolution:
      "VMD, MMSE, sospensione del diazepam, piano cadute, niente seconda TC, niente contenzione, niente Aloperidolo 2 mg/ml gocce. La vitamina D non si aggiunge oggi senza criterio: cammina, vive a casa, e per una remineralizzazione serve prima il 25-OH.",
    goldStandardPath: ["anamnesi-cadute", "valutazione-geriatrica", "mmse", "azione-diazepam", "azione-piano", "azione-no-tc", "azione-sonno"],
    goldPathNarrative:
      "Si conta le cadute e si trova il diazepam. VMD e MMSE mostrano una donna lucida a rischio. Si sospende la benzodiazepina a lunga emivita e si scrive il piano. La TC non si ripete. Non si prescrive Colecalciferolo (Vitamina D) 25.000 UI senza 25-OH.",
    examLatencies: { "anamnesi-cadute": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-diazepam": 10, "azione-piano": 10, "azione-no-tc": 5, "azione-sonno": 10 },
    anamnesisQuestions: [
      q("aq-farmaco", "Quale ipnotico assume e da quanto?", ["diazepam", "sera"], "Il diazepam è il farmaco di Beers da togliere."),
      q("aq-tc", "La TC dopo l'ultima caduta è già stata fatta e com'era?", ["negativa", "fatta"], "Senza segno focale nuovo non si ripete."),
      q("aq-contenzione", "La figlia chiede le sponde come prevenzione?", ["sponde", "figlia"], "La contenzione abituale non è la prevenzione."),
    ],
    physicalSummary: "Lucida, escoriazione frontale, forza simmetrica, andatura cauta, pressione senza caduta marcata in piedi.",
    citations: [
      { chunkId: "geria-008-beers", source: "Criteri di Beers, benzodiazepine a lunga durata", quote: "Diazepam: data la lunga emivita, nei soggetti anziani l'effetto può durare anche più giorni. La forte sedazione può produrre il rischio di cadute." },
      { chunkId: "geria-008-ebn", source: "Cappuccio et al., Centro Studi EBN, 2008", quote: "La contenzione fisica non previene le cadute e può aumentarle attraverso debolezza e riduzione funzionale. I tranquillanti sono un fattore di rischio estrinseco." },
    ],
    indicators: ["Diazepam identificato come causa di cadute.", "VMD e MMSE eseguiti.", "Piano cadute scritto, contenzione rifiutata.", "TC non ripetuta. Vitamina D non prescritta fuori Nota 96."],
    art5: "In cartella: tre cadute, diazepam sospeso, TC recente negativa, niente sponde abituali, niente seconda TC.",
    legalCriteria: ["Procedura di prevenzione delle cadute applicata.", "Nessuna contenzione domiciliare di routine.", "Nessun nuovo sedativo in dimissione."],
    mandatoryExams: [
      vmd("ADL 5/6, IADL 4/8, MNA 22, tre cadute, diazepam in corso. Costo 25 euro."),
      mmse("26/30 da lucida. Non è un delirium. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c. ripetuta", "Terza TC negativa, come quella dopo l'ultimo trauma. Costo 70 euro.", false, 70, "Lucida e senza segno focale nuovo: la ripetizione non previene la prossima caduta."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC) in pronto soccorso", "Utile in seguito per l'osteoporosi, non decide la sospensione del diazepam stanotte. Costo 35 euro.", true, 35, "Farla al posto della sospensione del diazepam sposta il problema."),
    ],
    budget: 80,
    name: "Anna Rizzi",
    age: 83,
    sex: "F",
    context: "Pronto soccorso dopo l'ennesima caduta, TC già negativa.",
    vitals: { heartRate: 78, bloodPressure: "142/80", spo2: 97, temperature: 36.6, respiratoryRate: 16 },
    signs: [
      { signName: "Deficit focale", result: "Assente, paziente lucida.", isPositive: false },
      { signName: "Andatura instabile", result: "Passi corti, paura di cadere.", isPositive: true },
    ],
    literacy: "MEDIUM",
    emotion: "ANXIOUS",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Teme l'insonnia se le togli il diazepam. Accetta se le proponi un piano e non solo un divieto.",
    steps: [
      step("anamnesi", "Perché cade", "Tre cadute, diazepam ogni sera, lucida. Qual è il fattore che Beers mette in alto rischio?", 0, 15, "La benzodiazepina a lunga emivita, da sospendere", [{ label: "Chiedere subito un'altra TC Encefalo senza m.d.c.", next: "res-tc" }]),
      step("diagnostica", "Scale", "Funzione, nutrizione, cognizione. Non è un delirium.", 40, 15, "Valutazione multidimensionale e MMSE", [{ label: "Aloperidolo 2 mg/ml gocce e niente scale", next: "res-sedazione" }]),
      step("screening", "Prevenzione", "Il manuale di sicurezza mostra un decesso dopo caduta dal letto con procedura di prevenzione non applicata. Cosa scrivi?", 0, 15, "Piano multifattoriale: farmaco, ambiente, calzature, supervisione", [{ label: "Sponde bloccate a casa come unica misura", next: "res-contenzione" }]),
      step("terapia", "Diazepam", "Emivita lunga, sedazione che può durare giorni, cadute e fratture. Cosa fai della sera?", 0, 15, "Sospendere il diazepam e non sostituirlo con un'altra benzodiazepina a lunga emivita", [{ label: "Aumentare il diazepam così dorme e non si alza", next: "res-beers" }]),
      step("terapia", "Vitamina D non automatica", "Cammina e vive a casa. Non è istituzionalizzata né allettata. Per l'osteoporosi candidata a remineralizzazione la Nota 96 chiede prima il 25-OH. Oggi il gesto che previene la caduta è un altro.", 0, 10, "Non prescrivere Colecalciferolo (Vitamina D) 25.000 UI al posto della sospensione del diazepam", [{ label: "Colecalciferolo (Vitamina D) 25.000 UI subito, senza 25-OH", next: "res-nota96" }]),
      step("diagnostica", "TC già fatta", "Dopo l'ultima caduta la TC è negativa e non c'è un segno focale nuovo.", 0, 10, "Non ripetere la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. di controllo a 24 ore", next: "res-tc" }]),
      step("follow-up", "Dimissione", "Come chiudi la notte?", 0, 15, "Senza diazepam, con piano cadute, senza sponde abituali e senza neurolettico", [{ label: "Dimissione con Aloperidolo 2 mg/ml gocce se si alza", next: "res-sedazione" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Cadute affrontate sul farmaco", "Diazepam sospeso, piano scritto, TC non ripetuta, vitamina D non data fuori Nota 96.", 40, 100),
      done("res-beers", "negative", "Diazepam aumentato", "Aumentare il diazepam per non farla alzare rafforza un farmaco che Beers associa a sedazione prolungata, cadute e fratture.", 0, 0, "medico-legale"),
      done("res-contenzione", "negative", "Sponde come prevenzione", "La contenzione abituale non previene le cadute e può aumentarle. Non è un atto eccezionale e motivato.", 0, 0, "medico-legale"),
      done("res-sedazione", "negative", "Aloperidolo al posto del piano", "Aloperidolo 2 mg/ml gocce per non farla alzare è un tranquillante usato come prevenzione delle cadute, fattore di rischio nel documento EBN, senza i criteri di pericolo di Bellelli o della LG sui sintomi non cognitivi.", 3, 0, "medico-legale"),
      done("res-tc", "negative", "TC encefalo seriale", "La TC dopo la caduta c'è già. È lucida e senza segno focale. Ripeterla costa 70 euro.", 70, 0, "economico"),
      done("res-nota96", "negative", "Vitamina D fuori scenario", "Colecalciferolo (Vitamina D) 25.000 UI senza 25-OH, in una donna che cammina e vive a casa, non rientra nello scenario A. Se è candidata a remineralizzazione serve il dosaggio prima.", 6, 0, "economico"),
    ],
  },
  {
    n: 9,
    title: "Delirium da anticolinergico",
    description:
      "Pietro Amato, 80 anni, da tre giorni è confuso e secco in bocca. La figlia ha aggiunto un antistaminico per il prurito e continua l'ossibutinina. Non è caduto, non ha segni focali, non è febbrile. Bellelli: rivedere tutte le terapie; il neuroimaging non è indicato senza caduta recente, sospetto ictus o infezione del sistema nervoso, o coscienza ridotta con segni focali. Beers: in demenza e disturbi cognitivi gli antimuscarinici e gli antistaminici di prima generazione peggiorano confusione e agitazione. Non ci sono evidenze per gli inibitori dell'acetilcolinesterasi nel delirium.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "GUARDIA_MEDICA",
    condition: "Delirium anticolinergico: sospendere i farmaci, niente donepezil, niente TC",
    guidelineRef: "Bellelli SIMG 2020; criteri di Beers; LG demenza rec. 31-32",
    diagnosis:
      "Delirium precipitato da antistaminico e ossibutinina. Non è indicata la TC encefalo e non si inizia Donepezil 5 mg.",
    pastMedicalHistory:
      "Ipertrofia prostatica in ossibutinina. Prurito da tre giorni, antistaminico sedativo aggiunto. Ipertensione. Nessuna demenza nota. Nessuna caduta. Beve vino ai pasti, non è in astinenza.",
    presentation:
      "Inattento, fluttuante secondo la figlia, pupille non estreme, bocca secca, globo vescicale modesto. Nessun deficit di lato, temperatura normale.",
    redHerrings: ["La confusione sembra un ictus da mandare in TC di notte.", "Il prurito sembra un motivo per non toccare l'antistaminico.", "Qualcuno propone il donepezil come antidoto cognitivo."],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Pietro Amato, 80 anni, confuso a tratti. Dici che hai sete e che ti prude. Se chiedono le pastiglie nuove: una per il prurito, oltre a quella della vescica. Se propongono la TAC di notte ti spaventi. Se ti dicono di sospendere quelle due pastiglie, la figlia accetta. Non nominare anticolinergico.",
    correctSolution:
      "Riconoscere il delirium, VMD, MMSE dopo la risoluzione, sospendere antistaminico e ossibutinina, svuotare la vescica, niente TC, niente Donepezil 5 mg, niente benzodiazepina, Aloperidolo 2 mg/ml gocce solo se diventa un pericolo e comunque non come primo atto.",
    goldStandardPath: ["anamnesi-farmaci", "valutazione-geriatrica", "mmse", "azione-sospensione", "azione-vescica", "azione-no-tc", "azione-no-donepezil"],
    goldPathNarrative:
      "Si raccolgono i due anticolinergici. La VMD documenta il rischio. L'MMSE si rimanda a risoluzione. Si sospendono i farmaci e si svuota la vescica. Non si fa la TC. Non si inizia il donepezil.",
    examLatencies: { "anamnesi-farmaci": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-sospensione": 10, "azione-vescica": 10, "azione-no-tc": 5, "azione-no-donepezil": 5 },
    anamnesisQuestions: [
      q("aq-nuovi", "Quali farmaci sono stati aggiunti nei giorni scorsi?", ["antistaminico", "prurito"], "Bellelli chiede di rivedere le terapie in corso e quelle appena iniziate."),
      q("aq-focale", "C'è stata una caduta o un deficit di lato?", ["no", "deficit"], "Senza quei criteri la TC non è indicata."),
      q("aq-astinenza", "È in astinenza alcolica?", ["no", "vino"], "Le benzodiazepine nel delirium restano per l'astinenza, che qui non c'è."),
    ],
    physicalSummary: "Inattenzione, bocca secca, globo vescicale, nessun segno focale, non febbre.",
    citations: [
      { chunkId: "geria-009-bellelli", source: "Bellelli, Rivista SIMG 2020", quote: "È importante rivalutare tutte le terapie in corso o sospese di recente. Non vi sono evidenze di alcun tipo sull'uso degli inibitori dell'acetilcolinesterasi nel delirium. Le benzodiazepine sono da riservare all'astinenza alcolica." },
      { chunkId: "geria-009-beers", source: "Criteri di Beers, demenza e disturbi cognitivi", quote: "Gli antimuscarinici, per esempio nell'iperattività vescicale, comportano rischio di peggioramento del deficit cognitivo, della confusione e dell'agitazione. Gli antistaminici di prima generazione possono peggiorare i deficit cognitivi." },
    ],
    indicators: ["Farmaci precipitanti identificati.", "VMD fatta, MMSE non usato durante il delirium come diagnosi di demenza.", "Anticolinergici sospesi. Nessun Donepezil 5 mg.", "TC non richiesta."],
    art5: "In cartella: delirium, due anticolinergici sospesi, assenza di indicazione alla TC, donepezil non iniziato.",
    legalCriteria: ["Nessuna benzodiazepina in assenza di astinenza.", "Nessuna contenzione.", "Il neurolettico non è il primo atto."],
    mandatoryExams: [
      vmd("ADL in calo acuto, ritenzione, rischio cadute se viene sedato. Costo 25 euro."),
      mmse("Da eseguire a risoluzione. Oggi non è interpretabile come demenza. Costo 15 euro se lo si forza durante il delirium."),
      exam("elettroliti", "Elettroliti", "Sodio 138, potassio 4,1. Non sono il precipitante principale. Costo 6,50 euro.", false, 6.5),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Non indicata: niente caduta, niente sospetto ictus o infezione centrale, niente segno focale. Costo 70 euro.", false, 70, "La TC non sospende l'anticolinergico."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata in guardia. Costo 35 euro.", false, 35, "La densitometria non cura il delirium."),
    ],
    budget: 70,
    name: "Pietro Amato",
    age: 80,
    sex: "M",
    context: "Guardia medica notturna per confusione da tre giorni.",
    vitals: { heartRate: 96, bloodPressure: "150/84", spo2: 96, temperature: 36.7, respiratoryRate: 18 },
    signs: [
      { signName: "Inattenzione", result: "Non mantiene il filo, la figlia descrive fluttuazione.", isPositive: true },
      { signName: "Segno focale", result: "Assente.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "ANXIOUS",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "HIGH",
    support: "ADEQUATE",
    communicationStyle: "Risponde a singhiozzo. La figlia ha paura dell'ictus. Si calma se le nomini le pastiglie del prurito e della vescica.",
    steps: [
      step("anamnesi", "Precipitanti", "Confusione da tre giorni, antistaminico nuovo, ossibutinina, niente caduta e niente deficit. Come lo inquadri?", 0, 15, "Delirium da farmaci anticolinergici", [{ label: "Ictus fino a prova contraria e TC Encefalo senza m.d.c. subito", next: "res-tc" }]),
      step("diagnostica", "Scale e laboratorio mirato", "VMD ora. MMSE a risoluzione. Elettroliti per non perdere una causa metabolica, che qui non è la principale.", 40, 15, "Valutazione multidimensionale, elettroliti, MMSE solo dopo", [{ label: "Donepezil 5 mg subito per alzare l'acetilcolina", next: "res-donepezil" }]),
      step("terapia", "Quali farmaci togliere", "Antistaminico sedativo e ossibutinina sono i precipitanti di Beers e di Bellelli.", 0, 15, "Sospendere antistaminico e ossibutinina", [{ label: "Continuare entrambi e aggiungere un sedativo", next: "res-farmaci" }]),
      step("terapia", "Vescica", "C'è ritenzione. Gli anticolinergici peggiorano anche il flusso. Cosa fai?", 0, 15, "Svuotare la vescica e non reintrodurre l'ossibutinina stanotte", [{ label: "Aumentare l'ossibutinina per la vescica", next: "res-farmaci" }]),
      step("terapia", "Benzodiazepina e neurolettico", "Non è in astinenza. Non è un pericolo in questo momento: è confuso ma gestibile se si tolgono i farmaci. L'aloperidolo non è il primo atto.", 0, 10, "Niente benzodiazepina e niente Aloperidolo 2 mg/ml gocce come primo gesto", [{ label: "Aloperidolo 2 mg/ml gocce subito e diazepam per dormire", next: "res-sedazione" }]),
      step("terapia", "Donepezil", "Bellelli: nessuna evidenza degli inibitori nel delirium. Nota 85: non è una diagnosi di Alzheimer con piano.", 0, 10, "Non iniziare Donepezil 5 mg", [{ label: "Donepezil 5 mg per tre giorni e poi si vede", next: "res-donepezil" }]),
      step("follow-up", "Controllo", "A risoluzione si fa l'MMSE e si decide se il prurito e la vescica hanno alternative non anticolinergiche.", 0, 15, "MMSE di controllo e alternative ai due farmaci sospesi", [{ label: "TC Encefalo senza m.d.c. ambulatoriale comunque", next: "res-tc" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Anticolinergici sospesi", "Delirium riconosciuto, farmaci tolti, vescica svuotata, niente TC e niente donepezil.", 46.5, 100),
      done("res-farmaci", "negative", "Anticolinergici continuati", "Continuare o aumentare ossibutinina e antistaminico mantiene i precipitanti che Beers e Bellelli indicano di rivedere. La confusione e la ritenzione peggiorano.", 0, 0, "medico-legale"),
      done("res-sedazione", "negative", "Sedazione al posto della sospensione", "Aloperidolo 2 mg/ml gocce e diazepam, senza astinenza e senza pericolo, saltano la correzione della causa. Le benzodiazepine nel delirium di Bellelli sono solo per l'astinenza alcolica.", 3, 0, "medico-legale"),
      done("res-tc", "negative", "TC non indicata", "Bellelli riserva il neuroimaging a caduta recente, sospetto ictus o infezione centrale, o coscienza ridotta con segni focali. Qui non ricorre. Costa 70 euro.", 70, 0, "economico"),
      done("res-donepezil", "negative", "Donepezil nel delirium", "Non vi sono evidenze per gli inibitori dell'acetilcolinesterasi nel delirium. Donepezil 5 mg senza Alzheimer e senza piano del CDCD è anche fuori Nota 85.", 15, 0, "economico"),
    ],
  },
  {
    n: 10,
    title: "Delirium ipoattivo, non da sedare",
    description:
      "Carla Donati, 90 anni, in reparto è sonnolenta, inattenta, con fluttuazione riferita dal turno di notte. Non è aggressiva. Bellelli: la forma ipoattiva è la più frequente nell'anziano, ha prognosi peggiore e non richiede sedazione; gli antipsicotici rispondono poco. Vanno cercate le cause, qui una polmonite e un anticolinergico. Non ci sono segni focali né caduta: la TC non è indicata. Se il quadro diventasse terminale varrebbe l'art. 2 della Legge 219 sull'accanimento, ma oggi le cause sono trattabili.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "HIGH",
    setting: "REPARTO",
    condition: "Delirium ipoattivo trattabile: niente sedazione, cause mediche, no TC",
    guidelineRef: "Bellelli SIMG 2020; Legge 219/2017 art. 2; criteri di Beers",
    diagnosis:
      "Delirium ipoattivo da polmonite e anticolinergico, non terminalità. Non si seda e non si fa una TC encefalo.",
    pastMedicalHistory:
      "Scompenso lieve, demenza vascolare lieve nota da anni con sottotipo già chiaro. Ossibutinina. Nessuna DAT e nessuna pianificazione scritta di rinuncia alle cure delle infezioni. Vive in RSA.",
    presentation:
      "Apre gli occhi se chiamata, non mantiene l'attenzione, febbre 38, rantolo basale. Nessuna paresi nuova. Un collega propone Aloperidolo 2 mg/ml gocce perché disturba il sonno del compagno di stanza.",
    redHerrings: ["La sonnolenza sembra terminalità da non trattare.", "Sembra anche un motivo per sedarla.", "La demenza nota sembra un motivo per una TC di controllo."],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Carla Donati, 90 anni. Rispondi a monosillabi, ti riaddormenti, se ti chiamano dici «sono stanca». Non sei aggressiva. Tua nipote chiede se è la fine. Se il medico spiega febbre e pastiglia della vescica, la nipote accetta le cure. Se propongono gocce per farla stare zitta, la nipote si allarma. Non nominare delirium.",
    correctSolution:
      "4AT compatibile con delirium, VMD, MMSE non diagnostico oggi, RX e PCR, sospendere l'ossibutinina, antibiotico. Niente Aloperidolo 2 mg/ml gocce, niente Quetiapina 25 mg, niente TC. Non dichiararla terminale saltando la polmonite.",
    goldStandardPath: ["anamnesi-ipo", "valutazione-geriatrica", "mmse", "rx-torace", "pcr-pct", "azione-cause", "azione-no-sedazione"],
    goldPathNarrative:
      "Si riconosce il delirium ipoattivo. VMD e tentativo di MMSE documentano che oggi il test cognitivo non stadia la demenza. RX e PCR confermano la polmonite. Si toglie l'anticolinergico e si cura l'infezione. Non si seda e non si fa la TC.",
    examLatencies: { "anamnesi-ipo": 10, "valutazione-geriatrica": 45, mmse: 20, "rx-torace": 40, "pcr-pct": 60, "azione-cause": 10, "azione-no-sedazione": 5 },
    anamnesisQuestions: [
      q("aq-forma", "È sonnolenta e fluttuante o è un peggioramento stabile da mesi?", ["sonnolenta", "fluttua"], "La forma ipoattiva è delirium, non una indicazione a sedare."),
      q("aq-cause", "Febbre, farmaci anticolinergici, dolore?", ["febbre", "ossibutinina"], "Le cause trattabili vanno cercate prima di parlare di terminalità."),
      q("aq-focale", "C'è un segno focale o una caduta recente?", ["no", "focale"], "Senza quei criteri la TC non è indicata."),
    ],
    physicalSummary: "Ipoallerta, inattenzione, febbre, rantolo basale, nessun deficit focale nuovo.",
    citations: [
      { chunkId: "geria-010-ipo", source: "Bellelli, Rivista SIMG 2020", quote: "Il delirium ipocinetico non richiede una sedazione farmacologica. Gli studi hanno dimostrato scarsa responsività agli antipsicotici. L'uso di contenzioni fisiche è particolarmente pericoloso ed è da proscrivere." },
      { chunkId: "geria-010-219", source: "Legge 219/2017, art. 2", quote: "Il medico deve astenersi da ostinazione irragionevole e da trattamenti inutili o sproporzionati quando la prognosi è infausta a breve o la morte è imminente. Il dolore va sempre trattato." },
    ],
    indicators: ["Forma ipoattiva riconosciuta e non sedata.", "Cause cercate: polmonite e anticolinergico.", "VMD fatta. MMSE non usato come nuova stadiazione.", "TC non eseguita. Terminalità non dichiarata al posto della cura."],
    art5: "In cartella: delirium ipoattivo, polmonite curata, ossibutinina sospesa, sedazione non indicata, TC non indicata, art. 2 non applicabile perché la causa è reversibile.",
    legalCriteria: ["Nessuna sedazione del delirium ipoattivo.", "Nessuna contenzione.", "Nessun abbandono di una polmonite trattabile."],
    mandatoryExams: [
      vmd("ADL dipendenti nell'acuto, MNA 16, demenza vascolare lieve di base. Costo 25 euro."),
      mmse("Non completabile per ipoallerta. Non si usa questo numero per cambiare la terapia antidemenza. Costo 15 euro se forzato."),
      exam("rx-torace", "RX torace", "Addensamento basale. Costo 25 euro.", true, 25),
      exam("pcr-pct", "PCR", "PCR 12 mg/dL. Costo 28 euro.", true, 28),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Sottotipo vascolare già noto, nessun segno focale nuovo, nessuna caduta. Costo 70 euro.", false, 70, "La TC non sostituisce la cura della polmonite."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata in questo turno. Costo 35 euro.", false, 35, "La densitometria non spiega la sonnolenza."),
    ],
    budget: 120,
    name: "Carla Donati",
    age: 90,
    sex: "F",
    context: "Reparto medico, sonnolenza e febbre.",
    vitals: { heartRate: 102, bloodPressure: "108/64", spo2: 93, temperature: 38, respiratoryRate: 24 },
    signs: [
      { signName: "Ipoallerta fluttuante", result: "Si risveglia allo stimolo e si riaddormenta.", isPositive: true },
      { signName: "Segno focale nuovo", result: "Assente.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "PASSIVE",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "MEDIUM",
    support: "LIMITED",
    communicationStyle: "Poche parole. La nipote teme l'abbandono e anche l'accanimento. Si fida se distingui la polmonite curabile da una sedazione inutile.",
    steps: [
      step("anamnesi", "Ipoattivo non significa terminale", "Sonnolenta, febbre, anticolinergico, demenza già nota. Come lo leggi?", 0, 15, "Delirium ipoattivo con causa trattabile, non sedazione e non abbandono", [{ label: "Dichiararla terminale e sospendere ogni cura senza cercare la polmonite", next: "res-abbandono" }]),
      step("diagnostica", "Scale e torace", "VMD, MMSE non forzato come nuova diagnosi, RX e PCR.", 40, 15, "Valutazione multidimensionale, RX torace e PCR. MMSE a risoluzione", [{ label: "TC Encefalo senza m.d.c. prima di visitare il torace", next: "res-tc" }]),
      step("terapia", "Cause", "Polmonite e ossibutinina. Cosa fai?", 0, 15, "Antibiotico e sospensione dell'ossibutinina", [{ label: "Aumentare l'ossibutinina e non dare l'antibiotico", next: "res-abbandono" }]),
      step("terapia", "Niente sedazione", "Bellelli: il delirium ipoattivo non si seda. Gli antipsicotici rispondono poco. Non c'è pericolo.", 0, 15, "Niente Aloperidolo 2 mg/ml gocce e niente Quetiapina 25 mg", [{ label: "Quetiapina 25 mg perché non dorme il compagno di stanza", next: "res-sedazione" }]),
      step("screening", "Contenzione", "Propongono le sponde perché non si alzi nel sonno. Bellelli le proscrive.", 0, 10, "Niente contenzione fisica", [{ label: "Sponde e fasce per il turno di notte", next: "res-contenzione" }]),
      step("diagnostica", "TC encefalo", "Sottotipo già chiaro, nessun segno focale, nessuna caduta. Né Bellelli né la raccomandazione 12 indicano una TC nuova.", 0, 10, "Non eseguire la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. di controllo della demenza vascolare", next: "res-tc" }]),
      step("follow-up", "Dopo la risoluzione", "Se la sonnolenza cede con la cura, non era terminalità. Si rimisura allora la cognizione.", 0, 15, "MMSE a risoluzione e lettera alla RSA senza neurolettico", [{ label: "Dimissione con Aloperidolo 2 mg/ml gocce se è troppo quieta", next: "res-sedazione" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Ipoattivo curato, non sedato", "Polmonite trattata, anticolinergico sospeso, nessuna sedazione e nessuna TC.", 93, 100),
      done("res-abbandono", "negative", "Causa trattabile saltata", "Sospendere le cure, o non dare l'antibiotico, applica l'art. 2 della Legge 219 a un quadro che non è una morte imminente: la polmonite è trattabile. L'articolo vieta l'accanimento, non la cura proporzionata.", 0, 0, "medico-legale"),
      done("res-sedazione", "negative", "Sedazione dell'ipoattivo", "Aloperidolo 2 mg/ml gocce o Quetiapina 25 mg per una paziente ipoattiva contraddicono Bellelli. L'RCP non autorizza la quetiapina nelle psicosi da demenza. Non c'è un pericolo da trattare.", 5, 0, "medico-legale"),
      done("res-contenzione", "negative", "Contenzione notturna", "Le contenzioni fisiche, scrive Bellelli, sono particolarmente pericolose e da proscrivere. Non sono la cura del delirium ipoattivo.", 0, 0, "medico-legale"),
      done("res-tc", "negative", "TC di controllo", "Né il criterio di Bellelli né la raccomandazione 12, con sottotipo già chiaro e senza segno focale, indicano la TC. Costa 70 euro.", 70, 0, "economico"),
    ],
  },
];
