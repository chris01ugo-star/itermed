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

export const batch5: Spec[] = [
  {
    n: 21,
    title: "Demenza vascolare già chiara",
    description:
      "Silvana Conte, 82 anni, ha una demenza vascolare già diagnosticata con criteri clinici e una RM precedente. I figli chiedono una TC encefalo ogni anno e il Donepezil 5 mg. La raccomandazione 12 non ripete la neuroradiologia se diagnosi e sottotipo sono chiari. La 26 vieta di fondare la demenza vascolare solo sul carico lesionale, ma qui i criteri clinici ci sono già. La 97 considera inibitori o memantina solo se si sospetta anche Alzheimer, Parkinson o Lewy. La Nota 85 rimborsa solo l'Alzheimer. Non c'è agitazione che soddisfi la raccomandazione 144.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "MEDIUM",
    setting: "AMBULATORIO",
    condition: "Demenza vascolare nota: niente TC seriale e niente Nota 85",
    guidelineRef: "LG ISS rec. 12, 26 e 97; Nota AIFA 85",
    diagnosis:
      "Demenza vascolare di sottotipo già chiaro. Non si ripete la TC e non si prescrivono Donepezil 5 mg né Memantina 10 mg in Nota 85.",
    pastMedicalHistory:
      "Ictus due anni fa, diagnosi di demenza vascolare al CDCD con criteri clinici, non solo leucoaraiosi. Nessun sospetto di Alzheimer sovrapposto, nessun Parkinson. MMSE 18 stabile. Nessun delirio. I figli vogliono l'antidemenza dell'Alzheimer.",
    presentation:
      "Rallentata, cammina, nessun deficit nuovo rispetto alla visita di sei mesi fa. I figli portano il referto vecchio e chiedono di rifarlo.",
    redHerrings: ["Il vecchio ictus sembra un motivo per una TC oggi.", "L'MMSE 18 sembra la fascia della Nota 85.", "La lentezza sembra apatia da trattare con un antipsicotico."],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Silvana Conte, 82 anni. Parli poco, cammini, non hai un braccio nuovo che non si muove. I tuoi figli chiedono la TAC e la pastiglia dell'Alzheimer. Se il medico dice che la diagnosi c'è già e che quella pastiglia non è la tua, annuisci. Se propongono gocce perché sei lenta, scuoti la testa. Non nominare raccomandazioni.",
    correctSolution:
      "VMD e MMSE di follow-up. Nessuna TC nuova. Nessun Donepezil 5 mg e nessuna Memantina 10 mg. Nessun Aloperidolo 2 mg/ml gocce per l'apatia. Piano di funzione e carico assistenziale.",
    goldStandardPath: ["anamnesi-vad", "valutazione-geriatrica", "mmse", "azione-no-tc", "azione-no-farmaco", "azione-no-neurolettico", "azione-piano"],
    goldPathNarrative:
      "Sottotipo già chiaro. VMD e MMSE seguono la funzione, non riaprono l'imaging. Non si applica la Nota 85. Non si tratta l'apatia con un antipsicotico. Si scrive il piano assistenziale.",
    examLatencies: { "anamnesi-vad": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-no-tc": 5, "azione-no-farmaco": 5, "azione-no-neurolettico": 5, "azione-piano": 10 },
    anamnesisQuestions: [
      q("aq-sottotipo", "La diagnosi e il sottotipo sono già stati chiusi con criteri clinici?", ["sì", "vascolare"], "Se sono chiari la raccomandazione 12 non chiede una nuova TC."),
      q("aq-mista", "C'è un sospetto di Alzheimer, Parkinson o Lewy sovrapposti?", ["no", "no"], "Senza quel sospetto la raccomandazione 97 non offre gli antidemenza."),
      q("aq-agitazione", "C'è agitazione con grave distress?", ["no", "lenta"], "L'apatia non è la raccomandazione 144."),
    ],
    physicalSummary: "Esiti motori stabili, nessun deficit nuovo, nessun delirium, umore apatico senza deliri.",
    citations: [
      { chunkId: "geria-021-lg", source: "LG ISS demenza e MCI, gennaio 2024, raccomandazioni 12, 26 e 97", quote: "Offrire la neuroradiologia strutturale a meno che diagnosi e sottotipo siano già chiari. Non formulare una demenza vascolare solo sul carico lesionale. Considerare inibitori o memantina nella demenza vascolare solo se si sospetta comorbidità con Alzheimer, Parkinson o Lewy." },
      { chunkId: "geria-021-85", source: "Nota AIFA 85", quote: "La prescrizione a carico del SSN, su diagnosi e piano dei CDCD, è limitata ai pazienti con malattia di Alzheimer." },
    ],
    indicators: ["Sottotipo già chiaro non ri-scansionato.", "VMD e MMSE di follow-up.", "Niente donepezil e niente memantina.", "Niente antipsicotico per l'apatia."],
    art5: "In cartella: demenza vascolare già diagnosticata, farmaci della Nota 85 non indicati, TC non ripetuta, apatia non trattata con neurolettico.",
    legalCriteria: ["Nessun sedativo per la lentezza.", "I figli non ottengono un esame inutile al posto di un piano.", "Consenso alla visita, non una TC imposta."],
    mandatoryExams: [
      vmd("ADL 3/6, IADL 1/8, MNA 20, carico assistenziale alto. Costo 25 euro."),
      mmse("18/30, stabile. Non è un'indicazione di Nota 85. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c. annuale", "Esiti noti, nessun segno nuovo. Costo 70 euro.", false, 70, "Diagnosi e sottotipo sono già chiari."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata da questo quesito. Costo 35 euro.", false, 35, "La densitometria non cambia il sottotipo."),
    ],
    budget: 80,
    name: "Silvana Conte",
    age: 82,
    sex: "F",
    context: "Ambulatorio di follow-up di demenza vascolare.",
    vitals: { heartRate: 74, bloodPressure: "138/76", spo2: 97, temperature: 36.5, respiratoryRate: 16 },
    signs: [
      { signName: "Deficit nuovo", result: "Assente rispetto a sei mesi fa.", isPositive: false },
      { signName: "Deliri", result: "Assenti. Apatia.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "PASSIVE",
    adherence: "PARTIAL",
    sleep: "FAIR",
    stress: "LOW",
    support: "ADEQUATE",
    communicationStyle: "Poche parole. I figli riempiono la visita di richieste. Lei segue se le parli di come sta a casa, non della TAC.",
    steps: [
      step("anamnesi", "Sottotipo già chiuso", "Demenza vascolare con criteri clinici, nessun segno nuovo. I figli vogliono la TC. Cosa dice la raccomandazione 12?", 0, 15, "Non ripetere la neuroradiologia: diagnosi e sottotipo sono chiari", [{ label: "TC Encefalo senza m.d.c. ogni anno per regola", next: "res-tc" }]),
      step("diagnostica", "Cosa misurare", "Funzione e cognizione nel tempo, non un nuovo carico lesionale come unica diagnosi. La raccomandazione 26 vieta di fondare la vasculopatia solo sulle macchie, ma qui il lavoro clinico è già fatto.", 40, 15, "Valutazione multidimensionale e MMSE", [{ label: "Diagnosi nuova solo contando le lesioni di una TC fresca", next: "res-tc" }]),
      step("terapia", "Nota 85", "Non c'è Alzheimer. La raccomandazione 97 non offre donepezil o memantina senza quel sospetto o senza Parkinson o Lewy.", 0, 15, "Non prescrivere Donepezil 5 mg né Memantina 10 mg", [{ label: "Donepezil 5 mg perché l'MMSE è 18", next: "res-nota85" }]),
      step("terapia", "Memantina", "Stesso limite. La fascia numerica non basta senza la malattia della Nota 85.", 0, 10, "Non prescrivere Memantina 10 mg in Nota 85", [{ label: "Memantina 10 mg a carico del SSN lo stesso", next: "res-nota85" }]),
      step("terapia", "Apatia", "Non c'è grave distress né pericolo. L'antipsicotico non è il trattamento dell'apatia.", 0, 10, "Niente Aloperidolo 2 mg/ml gocce e niente Quetiapina 25 mg", [{ label: "Quetiapina 25 mg perché è lenta", next: "res-apatia" }]),
      step("screening", "Carico dei figli", "La VMD orienta gli aiuti. Non una RSA decisa dalla TC.", 0, 15, "Piano assistenziale su ADL e MNA", [{ label: "RSA immediata senza VMD", next: "res-apatia" }]),
      step("follow-up", "Prossimo controllo", "MMSE e funzione, imaging solo se compare un segno nuovo.", 0, 15, "Controllo clinico, TC solo davanti a un segno focale nuovo", [{ label: "TC Encefalo senza m.d.c. prenotata comunque", next: "res-tc" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Vascolare seguita senza esami di troppo", "Scale fatte, Nota 85 non applicata, TC non ripetuta, apatia non sedata.", 40, 100),
      done("res-tc", "negative", "TC seriale", "Con diagnosi e sottotipo chiari la raccomandazione 12 non chiede una nuova TC. Rifare la diagnosi solo sulle lesioni contraddice anche la 26. Ogni TC costa 70 euro.", 70, 0, "economico"),
      done("res-nota85", "negative", "Antidemenza fuori Alzheimer", "Donepezil 5 mg o Memantina 10 mg a carico del SSN richiedono l'Alzheimer. La raccomandazione 97 non li offre nella demenza vascolare senza comorbidità degenerativa sospetta.", 15, 0, "economico"),
      done("res-apatia", "negative", "Sedazione o istituzionalizzazione dell'apatia", "Quetiapina 25 mg o un ricovero in RSA senza VMD non curano l'apatia. L'RCP non autorizza la quetiapina in questo uso e la raccomandazione 144 non è soddisfatta. La VMD in reparto medico serve a ridurre, non a anticipare, l'istituzionalizzazione.", 5, 0, "medico-legale"),
    ],
  },
  {
    n: 22,
    title: "Allettamento e contenzione abituale",
    description:
      "Ettore Barbieri, 87 anni, è in reparto da cinque giorni per una infezione respiratoria in via di risoluzione. È stato tenuto a letto con le sponde anche di giorno, senza una prescrizione motivata. Bellelli dice di prevenire l'immobilizzazione e proscrive la contenzione. Il documento EBN la associa a piaghe, debolezza, più cadute e più neurolettici. La VMD in ortogeriatria e in area medica serve a limitare il danno funzionale e il delirium, non a ratificare il letto. Non c'è un pericolo che giustifichi Aloperidolo 2 mg/ml gocce.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "REPARTO",
    condition: "Immobilizzazione protratta: togliere la contenzione abituale e rimettere in piedi",
    guidelineRef: "Bellelli SIMG 2020; EBN 2008; LG VMD R5a.1 e R6a.1",
    diagnosis:
      "Decondizionamento da contenzione e allettamento non motivati. Non c'è indicazione all'aloperidolo né a una TC encefalo.",
    pastMedicalHistory:
      "Bronchite in risoluzione. Nessuna demenza. Nessuna caduta in reparto. Sponde messe la prima notte e mai rivalutate. Nessuna DAT.",
    presentation:
      "Lucido, debole, arrossamento sacrale, chiede di alzarsi. Il turno dice che le sponde sono la prassi e chiede le gocce se prova a scendere.",
    redHerrings: ["La prassi sembra una prescrizione.", "La debolezza sembra un motivo per non alzarlo.", "Una TC sembra necessaria prima di metterlo seduto."],
    timeLimitMinutes: 40,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Ettore Barbieri, 87 anni, lucido. Dici che sei a letto da giorni e ti fa male la schiena. Vuoi sederti. Se il medico toglie le sponde e ti fa alzare con aiuto, collabori. Se propone Aloperidolo 2 mg/ml gocce, rifiuti. Non nominare piaghe in linguaggio tecnico: di' che brucia dietro.",
    correctSolution:
      "Togliere la contenzione, VMD, MMSE, mobilizzazione, cura della cute, niente Aloperidolo 2 mg/ml gocce, niente TC.",
    goldStandardPath: ["anamnesi-letto", "valutazione-geriatrica", "mmse", "azione-sponde", "azione-mobilizzare", "azione-cute", "azione-no-farmaco"],
    goldPathNarrative:
      "Le sponde non hanno una motivazione eccezionale. VMD e MMSE mostrano un uomo lucido che si sta decondizionando. Si mobilizza e si cura la cute. Non si prescrive l'aloperidolo. Non si fa la TC.",
    examLatencies: { "anamnesi-letto": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-sponde": 5, "azione-mobilizzare": 15, "azione-cute": 10, "azione-no-farmaco": 5 },
    anamnesisQuestions: [
      q("aq-motivo", "Le sponde hanno una prescrizione motivata di oggi o sono la prassi?", ["prassi", "nessuna"], "Senza eccezionalità la contenzione non sta in piedi."),
      q("aq-pericolo", "È un pericolo per sé in questo momento?", ["no", "lucido"], "Non scatta il criterio del farmaco."),
      q("aq-cute", "C'è un arrossamento da pressione?", ["sacro", "brucia"], "È un danno atteso dell'immobilizzazione."),
    ],
    physicalSummary: "Lucido, ipostenico, eritema sacrale, nessun deficit focale, saturazione buona.",
    citations: [
      { chunkId: "geria-022-bellelli", source: "Bellelli, Rivista SIMG 2020", quote: "Nel delirium, e come prevenzione, vanno evitati immobilizzazione e contenzione. L'uso di contenzioni fisiche è particolarmente pericoloso ed è da proscrivere." },
      { chunkId: "geria-022-ebn", source: "Cappuccio et al., Centro Studi EBN, 2008", quote: "La contenzione fisica non previene le cadute e si associa a piaghe, lesioni, più dipendenza e più uso di benzodiazepine e neurolettici tipici. Deve essere un atto eccezionale, prescritto e giustificato." },
    ],
    indicators: ["Contenzione rivalutata e tolta.", "VMD e MMSE eseguiti.", "Mobilizzazione e cute.", "Niente aloperidolo e niente TC."],
    art5: "In cartella: sponde senza motivazione eccezionale, sospese, piano di mobilizzazione, cute descritta.",
    legalCriteria: ["Contenzione non lasciata come prassi.", "Nessun neurolettico per tenerlo a letto.", "Il danno da pressione è cercato, non ignorato."],
    mandatoryExams: [
      vmd("ADL scese a 2/6 per l'allettamento, MNA 19, rischio decondizionamento. Costo 25 euro."),
      mmse("26/30, lucido. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Nessun segno focale e nessuna caduta. Costo 70 euro.", false, 70, "La TC non rimette in piedi e non giustifica le sponde."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non è il gesto di oggi. Costo 35 euro.", false, 35, "La densitometria non cura l'eritema sacrale."),
    ],
    budget: 70,
    name: "Ettore Barbieri",
    age: 87,
    sex: "M",
    context: "Reparto medico, quinto giorno, sponde dalla prima notte.",
    vitals: { heartRate: 82, bloodPressure: "136/78", spo2: 95, temperature: 36.8, respiratoryRate: 18 },
    signs: [
      { signName: "Eritema sacrale", result: "Rossore da pressione, cute integra.", isPositive: true },
      { signName: "Delirium", result: "Assente. È lucido.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "DEFENSIVE",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "LIMITED",
    communicationStyle: "Chiede di alzarsi in modo concreto. Si chiude se gli proponi le gocce. Collabora se lo fai sedere.",
    steps: [
      step("anamnesi", "Perché è ancora contenuto", "Sponde da cinque giorni, lucido, infezione in risoluzione. C'è un atto eccezionale scritto?", 0, 15, "No: è una prassi e va sospesa", [{ label: "Confermare le sponde perché sono la prassi del reparto", next: "res-prassi" }]),
      step("diagnostica", "VMD", "La valutazione multidimensionale quantifica il danno funzionale dell'allettamento.", 40, 15, "Valutazione multidimensionale e MMSE", [{ label: "TC Encefalo senza m.d.c. prima di farlo sedere", next: "res-tc" }]),
      step("terapia", "Mobilizzare", "Bellelli invita a prevenire l'immobilizzazione. Lo si alza con aiuto.", 0, 15, "Seduto e poi in piedi con assistenza, sponde sospese", [{ label: "Riposo a letto altri cinque giorni", next: "res-prassi" }]),
      step("terapia", "Cute", "L'eritema è il danno previsto dal documento EBN. Va curato, non coperto dalle fasce.", 0, 10, "Curare la pressione e cambiare spesso posizione", [{ label: "Ignorare il sacro finché non si apre", next: "res-cute" }]),
      step("terapia", "Se prova a scendere", "Non è un pericolo. Vuole il bagno. Non è un criterio per l'aloperidolo.", 0, 15, "Accompagnarlo. Niente Aloperidolo 2 mg/ml gocce", [{ label: "Aloperidolo 2 mg/ml gocce a orario finché è in reparto", next: "res-aloperidolo" }]),
      step("diagnostica", "TC encefalo", "Nessuna indicazione di Bellelli.", 0, 10, "Non eseguire la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. perché è debole", next: "res-tc" }]),
      step("follow-up", "Dimissione", "Funzione recuperata almeno in parte, niente sponde scritte in lettera come consiglio domiciliare di routine.", 0, 15, "Lettera senza contenzione e senza neurolettico", [{ label: "Consigliare le sponde a casa per sempre", next: "res-prassi" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Rimesso in piedi", "Sponde sospese, VMD fatta, cute curata, nessun sedativo e nessuna TC.", 40, 100),
      done("res-prassi", "negative", "Contenzione di prassi", "Lasciare o consigliare le sponde come metodica abituale contraddice Bellelli e il documento EBN: serve un atto eccezionale, prescritto e giustificato. La prassi istituzionale è inaccettabile.", 0, 0, "medico-legale"),
      done("res-cute", "negative", "Piaga ignorata", "Il documento EBN lega la contenzione alle lesioni da pressione. Non guardare il sacro mentre lo si tiene fermo prosegue il danno.", 0, 0, "medico-legale"),
      done("res-aloperidolo", "negative", "Aloperidolo per tenerlo a letto", "Aloperidolo 2 mg/ml gocce a orario, senza pericolo, è la contenzione farmacologica che l'EBN trova associata alle fasce. Non è il criterio di Bellelli.", 3, 0, "medico-legale"),
      done("res-tc", "negative", "TC prima di sedersi", "Non c'è caduta, né sospetto ictus, né segno focale. La TC costa 70 euro e ritarda la mobilizzazione.", 70, 0, "economico"),
    ],
  },
  {
    n: 23,
    title: "Insonnia in guardia, senza un nuovo ipnotico",
    description:
      "Clara Fontana, 78 anni, chiama la guardia perché non dorme. Non ha delirium, non ha psicosi, non ha disturbo bipolare. Beers: la difenidramina non va usata come ipnotico; il diazepam e le altre benzodiazepine a lunga emivita aumentano le cadute. L'RCP della quetiapina ne limita le indicazioni a schizofrenia e disturbo bipolare e non la autorizza nelle psicosi da demenza. Se c'è una demenza, la raccomandazione 141 propone igiene del sonno, luce diurna, movimento e attività, non un ipnotico di routine. L'aloperidolo non è un sonnifero.",
    difficulty: "EASY",
    matrixDifficulty: "BASE",
    frequencyCategory: "HIGH",
    setting: "GUARDIA_MEDICA",
    condition: "Insonnia: niente diazepam, niente quetiapina, niente aloperidolo",
    guidelineRef: "Criteri di Beers; RCP quetiapina; LG ISS rec. 141",
    diagnosis:
      "Insonnia senza delirium e senza indicazione a Quetiapina 25 mg, Aloperidolo 2 mg/ml gocce o diazepam. Non serve la TC encefalo.",
    pastMedicalHistory:
      "Ipertensione. Lieve smemoratezza senza diagnosi di demenza e senza perdita delle ADL. Nessun bipolarismo, nessuna schizofrenia. Ha in casa un vecchio diazepam. Un vicino le ha parlato della quetiapina a basso dosaggio.",
    presentation:
      "Lucida, chiede una pastiglia per stanotte. Nessun dolore nuovo, nessuna dispnea, nessun deficit. È ansiosa per il sonno, non psicotica.",
    redHerrings: ["Il basso dosaggio della quetiapina sembra innocuo.", "Il diazepam in casa sembra la via più breve.", "La smemoratezza sembra un motivo per la TC notturna."],
    timeLimitMinutes: 35,
    patientDeteriorationThreshold: 25,
    patientPrompt:
      "ROLEPLAY. Sei Clara Fontana, 78 anni, lucida e infastidita. Non dormi da due notti. Non vedi cose strane, non hai il bipolarismo. Se ti offrono Quetiapina 25 mg, Aloperidolo 2 mg/ml gocce o il diazepam, chiedi se domani cadrai. Se ti spiegano orari, luce e niente pastiglia nuova, accetti a malincuore. Non nominare RCP.",
    correctSolution:
      "Escludere dolore, dispnea e delirium. VMD e MMSE non per prescrivere un ipnotico. Igiene del sonno. Niente diazepam, niente Quetiapina 25 mg, niente Aloperidolo 2 mg/ml gocce, niente TC.",
    goldStandardPath: ["anamnesi-sonno", "valutazione-geriatrica", "mmse", "azione-cause", "azione-igiene", "azione-no-farmaco", "azione-no-tc"],
    goldPathNarrative:
      "Non c'è un'urgenza medica nascosta. VMD e MMSE escludono un delirium. Si dà un piano di sonno. Non si prescrivono i tre farmaci del catalogo usati come ipnotici. Non si fa la TC.",
    examLatencies: { "anamnesi-sonno": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-cause": 10, "azione-igiene": 10, "azione-no-farmaco": 5, "azione-no-tc": 5 },
    anamnesisQuestions: [
      q("aq-cause", "C'è dolore, dispnea, ritenzione o un inizio acuto di confusione?", ["no", "solo sonno"], "Prima si escludono le cause, poi si parla di ipnotico."),
      q("aq-indicazione", "Ha schizofrenia o disturbo bipolare che indichino la quetiapina?", ["no", "no"], "Senza quelle indicazioni l'RCP non la sostiene."),
      q("aq-cadute", "È già caduta prendendo un sedativo?", ["paura", "diazepam"], "Il diazepam è legato alle cadute nei criteri di Beers."),
    ],
    physicalSummary: "Lucida, eutimica, nessun deficit, nessun segno di scompenso.",
    citations: [
      { chunkId: "geria-023-beers", source: "Criteri di Beers, ipnotici", quote: "La difenidramina può causare confusione o sedazione e non deve essere usata come ipnotico. Il diazepam, per la lunga emivita, può durare giorni e la sedazione produce rischio di cadute." },
      { chunkId: "geria-023-rcp", source: "RCP Quetiapina Sandoz e LG ISS raccomandazione 141", quote: "Le indicazioni della quetiapina sono schizofrenia e disturbo bipolare. Non è autorizzata nelle psicosi correlate alla demenza. Nelle persone con demenza e disturbi del sonno si considerano igiene del sonno, luce diurna, esercizio e attività personalizzate." },
    ],
    indicators: ["Cause organiche escluse.", "VMD e MMSE eseguiti.", "Nessun ipnotico di Beers e nessuna quetiapina.", "Nessuna TC."],
    art5: "In cartella: insonnia isolata, farmaci rifiutati con il motivo, piano non farmacologico.",
    legalCriteria: ["Nessuna benzodiazepina a lunga emivita aggiunta.", "Nessun neurolettico come sonnifero.", "La paziente è informata del rischio di caduta."],
    mandatoryExams: [
      vmd("ADL 6/6, IADL conservate, MNA 24, sonno scarso. Costo 25 euro."),
      mmse("28/30. Non è un delirium. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Non indicata di notte per l'insonnia. Costo 70 euro.", false, 70, "La TC non fa dormire."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata. Costo 35 euro.", false, 35, "La densitometria non è un ipnotico."),
    ],
    budget: 60,
    name: "Clara Fontana",
    age: 78,
    sex: "F",
    context: "Guardia medica per insonnia.",
    vitals: { heartRate: 78, bloodPressure: "136/80", spo2: 98, temperature: 36.4, respiratoryRate: 14 },
    signs: [
      { signName: "Delirium", result: "Assente.", isPositive: false },
      { signName: "Psicosi", result: "Assente.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "ANXIOUS",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "MEDIUM",
    support: "ADEQUATE",
    communicationStyle: "Vuole una ricetta subito. Accetta il no se le dici che la pastiglia di domani è una caduta, e se le lasci un piano concreto della sera.",
    steps: [
      step("anamnesi", "Solo sonno o altro", "Due notti in bianco, lucida, niente dolore e niente dispnea. Cosa escludi prima della ricetta?", 0, 15, "Un delirium o una causa acuta. Qui non ci sono", [{ label: "TC Encefalo senza m.d.c. perché non dorme", next: "res-tc" }]),
      step("diagnostica", "Scale", "VMD e MMSE per non scambiare l'insonnia per una demenza da trattare stanotte.", 40, 15, "Valutazione multidimensionale e MMSE", [{ label: "Saltare le scale e aprire il diazepam", next: "res-diazepam" }]),
      step("terapia", "Difenidramina e diazepam", "Beers vieta l'antistaminico come ipnotico e lega il diazepam alle cadute.", 0, 15, "Niente difenidramina e niente diazepam", [{ label: "Diazepam stanotte, come le altre volte", next: "res-diazepam" }]),
      step("terapia", "Quetiapina", "Non ha schizofrenia né bipolarità. L'RCP non la autorizza come sonnifero né nella psicosi da demenza.", 0, 15, "Non prescrivere Quetiapina 25 mg", [{ label: "Quetiapina 25 mg perché è un basso dosaggio", next: "res-quetiapina" }]),
      step("terapia", "Aloperidolo", "Non è un pericolo e non ha un delirium da astinenza.", 0, 10, "Non prescrivere Aloperidolo 2 mg/ml gocce", [{ label: "Aloperidolo 2 mg/ml gocce dieci gocce e a letto", next: "res-aloperidolo" }]),
      step("terapia", "Piano", "Orari, luce di giorno, niente caffè la sera, attività. È il contenuto della raccomandazione 141 se il quadro fosse una demenza, ed è comunque l'alternativa al farmaco di Beers.", 0, 10, "Igiene del sonno e controllo dal medico di famiglia", [{ label: "Niente consiglio: o la pastiglia o nulla", next: "res-diazepam" }]),
      step("follow-up", "Se non dorme ancora", "Rivalutare cause, non accumulare sedativi. TC solo se compare un segno focale, che ora non c'è.", 0, 10, "Controllo senza nuova molecola sedativa e senza TC", [{ label: "Quetiapina 25 mg per una settimana e TC di controllo", next: "res-quetiapina" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Insonnia senza nuovo ipnotico", "Cause escluse, scale fatte, nessun diazepam, nessuna quetiapina, nessun aloperidolo.", 40, 100),
      done("res-diazepam", "negative", "Benzodiazepina a lunga emivita", "Il diazepam, nei criteri di Beers, può sedare per giorni e aumenta cadute e fratture. Darlo in guardia per l'insonnia isolata è il farmaco inappropriato, non la cura.", 0, 0, "medico-legale"),
      done("res-aloperidolo", "negative", "Aloperidolo come sonnifero", "Aloperidolo 2 mg/ml gocce non è indicato nell'insonnia senza pericolo. È una sedazione. Bellelli riserva le benzodiazepine all'astinenza e l'aloperidolo a quadri in cui il paziente è un pericolo o i sintomi bloccano le cure.", 3, 0, "medico-legale"),
      done("res-quetiapina", "negative", "Quetiapina fuori indicazione", "Quetiapina 25 mg non ha l'insonnia tra le indicazioni dell'RCP. Non c'è schizofrenia né disturbo bipolare. Nelle psicosi da demenza non è autorizzata e l'RCP segnala più decessi negli anziani.", 5, 0, "economico"),
      done("res-tc", "negative", "TC per l'insonnia", "Non c'è indicazione di Bellelli. La TC encefalo costa 70 euro e non tratta il sonno.", 70, 0, "economico"),
    ],
  },
  {
    n: 24,
    title: "Pianificazione condivisa, senza DAT formali",
    description:
      "Vincenzo De Luca, 86 anni, ha una demenza avanzata e una pianificazione condivisa delle cure scritta sei mesi fa, quando era ancora in grado di decidere: niente rianimazione e niente PEG, sì all'antibiotico e alle cure del sintomo. Non ha depositato DAT al comune. Entra per una polmonite. L'art. 5 della Legge 219/2017 obbliga medico ed équipe a rispettare quella pianificazione quando il paziente non può più acconsentire. I figli, assenti allora, chiedono l'intubazione. La LG sulla demenza richiama proprio DAT e pianificazione condivisa. Non si ripete la TC per rimandare la lettura del foglio.",
    difficulty: "HARD",
    matrixDifficulty: "ADVANCED",
    frequencyCategory: "MEDIUM",
    setting: "REPARTO",
    condition: "Pianificazione condivisa vincolante: antibiotico sì, intubazione e PEG no",
    guidelineRef: "Legge 219/2017 art. 5; LG ISS su DAT e PCC",
    diagnosis:
      "Polmonite in demenza avanzata con pianificazione condivisa scritta. Si cura in modo proporzionato. Non si intuba e non si posiziona la PEG.",
    pastMedicalHistory:
      "Demenza avanzata, pianificazione firmata in cartella: no rianimazione, no PEG, sì antibiotico e conforto. Nessuna DAT comunale. Figli non presenti alla stesura. Memantina sospesa l'anno scorso per beneficio insufficiente.",
    presentation:
      "Febbre, saturazione 92%, sonnolento, non decide più. Il foglio è in cartella. Il figlio chiede la terapia intensiva.",
    redHerrings: ["L'assenza di DAT al comune sembra cancellare il foglio.", "I figli sembrano poter riscrivere il piano.", "Una TC sembra un modo per non leggere l'art. 5."],
    timeLimitMinutes: 50,
    patientDeteriorationThreshold: 35,
    patientPrompt:
      "ROLEPLAY. Sei Vincenzo De Luca, 86 anni. Non sostieni un colloquio. Tuo figlio parla e chiede la rianimazione. Se il medico legge il foglio firmato da te sei mesi fa, tuo figlio tace e poi chiede se l'antibiotico si può fare. Se gli si dice di sì, e di no al tubo, resta. Se propongono la PEG, alza la voce. Non citare l'articolo.",
    correctSolution:
      "Leggere la pianificazione. VMD. MMSE non decisionale oggi. RX e antibiotico. Niente intubazione, niente PEG, niente Memantina 10 mg senza piano, niente TC di controllo.",
    goldStandardPath: ["anamnesi-pcc", "valutazione-geriatrica", "mmse", "rx-torace", "azione-antibiotico", "azione-no-icu", "azione-figlio"],
    goldPathNarrative:
      "L'art. 5 rende vincolante il piano scritto. VMD e MMSE documentano la fase, non riaprono la memantina. Si cura la polmonite. Non si intuba e non si fa la PEG. Non si ripete la TC.",
    examLatencies: { "anamnesi-pcc": 15, "valutazione-geriatrica": 45, mmse: 20, "rx-torace": 40, "azione-antibiotico": 10, "azione-no-icu": 10, "azione-figlio": 10 },
    anamnesisQuestions: [
      q("aq-piano", "C'è una pianificazione condivisa scritta e cosa esclude?", ["pianificazione", "rianimazione"], "L'art. 5 obbliga l'équipe quando il paziente non può più acconsentire."),
      q("aq-dat", "L'assenza di DAT al comune cancella quel foglio?", ["no", "foglio"], "Sono istituti diversi. Il piano in cartella basta."),
      q("aq-figlio", "Il figlio era presente alla stesura?", ["no", "contesta"], "Il dissenso successivo non revoca il piano."),
    ],
    physicalSummary: "Sonnolenza, febbre, rantoli, saturazione 92%, nessun segno focale nuovo.",
    citations: [
      { chunkId: "geria-024-5", source: "Legge 219/2017, art. 5", quote: "Nella patologia cronica e invalidante o a evoluzione inarrestabile può realizzarsi una pianificazione delle cure condivisa, alla quale il medico e l'équipe sono tenuti ad attenersi qualora il paziente non possa più esprimere il consenso o sia incapace." },
      { chunkId: "geria-024-lg", source: "LG ISS demenza e MCI, gennaio 2024, capitolo etico", quote: "La Legge 219 del 2017 ha previsto le disposizioni anticipate di trattamento e la pianificazione condivisa delle cure per la persona con patologia cronica e invalidante, in un processo continuo di informazione e scelta." },
    ],
    indicators: ["Pianificazione letta prima della rianimazione.", "Antibiotico dato, PEG e intubazione no.", "VMD fatta. MMSE non usato per riaprire la memantina.", "Nessuna TC di controllo."],
    art5: "La pianificazione condivisa è citata in cartella insieme alla cura proporzionata della polmonite e al rifiuto di rianimazione e PEG.",
    legalCriteria: ["Intubazione non eseguita contro il piano.", "PEG non eseguita contro il piano.", "Il figlio è informato e non revoca il foglio."],
    mandatoryExams: [
      vmd("ADL 0/6, MNA 14, piano di cura già orientato. Costo 25 euro."),
      mmse("Non eseguibile. Non riapre Memantina 10 mg. Costo 15 euro se forzato."),
      exam("rx-torace", "RX torace", "Addensamento. Costo 25 euro.", true, 25),
      exam("pcr-pct", "PCR", "PCR 10 mg/dL. Costo 28 euro.", true, 28),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c.", "Sottotipo noto, nessun segno nuovo. Costo 70 euro.", false, 70, "La TC non riscrive la pianificazione."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata. Costo 35 euro.", false, 35, "La densitometria non decide l'intubazione."),
    ],
    budget: 120,
    name: "Vincenzo De Luca",
    age: 86,
    sex: "M",
    context: "Reparto, polmonite, pianificazione condivisa in cartella.",
    vitals: { heartRate: 110, bloodPressure: "100/60", spo2: 92, temperature: 38.3, respiratoryRate: 26 },
    signs: [
      { signName: "Incapacità attuale", result: "Non può acconsentire. Il piano scritto c'è.", isPositive: true },
      { signName: "Segno focale nuovo", result: "Assente.", isPositive: false },
    ],
    literacy: "LOW",
    emotion: "PASSIVE",
    adherence: "PARTIAL",
    sleep: "POOR",
    stress: "HIGH",
    support: "LIMITED",
    communicationStyle: "Non parla. Il figlio è combattivo finché non gli si legge il foglio e non gli si dice che l'antibiotico è dentro il piano.",
    steps: [
      step("anamnesi", "Quale foglio vale", "Niente DAT al comune, ma una pianificazione firmata in cartella. Il figlio chiede la rianimazione. Cosa applica l'art. 5?", 0, 15, "Il piano condiviso vincola l'équipe ora che lui non può acconsentire", [{ label: "Ignorarlo perché non è una DAT depositata al comune", next: "res-piano" }]),
      step("diagnostica", "Scale e torace", "VMD, RX, PCR. L'MMSE di oggi non riapre la memantina.", 40, 15, "Valutazione multidimensionale, RX e PCR. MMSE non decisionale", [{ label: "TC Encefalo senza m.d.c. prima di leggere il foglio", next: "res-tc" }]),
      step("terapia", "Cosa il piano accetta", "Antibiotico e conforto sì. Il rifiuto del tubo non è abbandono.", 0, 15, "Antibiotico proporzionato e cure del sintomo", [{ label: "Niente antibiotico: tanto ha rifiutato la rianimazione", next: "res-abbandono" }]),
      step("terapia", "Cosa il piano esclude", "Rianimazione e PEG sono scritte come no.", 0, 15, "Non intubare e non posizionare la PEG", [{ label: "Intubare perché il figlio, oggi, è contrario al foglio", next: "res-piano" }]),
      step("terapia", "Memantina", "Sospesa per beneficio insufficiente. Riprenderla senza piano non è la cura della polmonite.", 0, 10, "Non riprendere Memantina 10 mg", [{ label: "Memantina 10 mg in reparto senza piano del CDCD", next: "res-nota85" }]),
      step("diagnostica", "TC encefalo", "Nessun segno focale, sottotipo noto.", 0, 10, "Non eseguire la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. per decidere la rianimazione", next: "res-tc" }]),
      step("follow-up", "Con il figlio", "Gli si lascia il testo del piano e il fatto che l'antibiotico è stato dato.", 0, 15, "Lettera con art. 5, antibiotico, niente PEG", [{ label: "PEG differita di una settimana per accontentarlo", next: "res-piano" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Piano rispettato e polmonite curata", "Antibiotico sì, rianimazione e PEG no, memantina non riaperta, TC non fatta.", 93, 100),
      done("res-piano", "negative", "Pianificazione ignorata", "Intubare, fare la PEG o trattare il foglio come nullo perché manca la DAT comunale viola l'art. 5: medico ed équipe devono attenersi alla pianificazione quando il paziente non può più acconsentire. Il figlio non la revoca.", 0, 0, "medico-legale"),
      done("res-abbandono", "negative", "Antibiotico negato", "Il piano accetta l'antibiotico. Negarlo perché è stata rifiutata la rianimazione abbandona una cura proporzionata che lui aveva consentito.", 0, 0, "medico-legale"),
      done("res-nota85", "negative", "Memantina senza piano", "Memantina 10 mg senza piano del CDCD, dopo una sospensione per beneficio insufficiente, è fuori Nota 85.", 20, 0, "economico"),
      done("res-tc", "negative", "TC per non decidere", "La TC non riscrive l'art. 5 e non è indicata senza un segno focale nuovo. Costa 70 euro.", 70, 0, "economico"),
    ],
  },
  {
    n: 25,
    title: "Dimissione dopo delirium risolto",
    description:
      "Adele Santini, 83 anni, ha avuto un delirium da polmonite, ora risolto. È lucida da 48 ore. Bellelli non consente di chiamare demenza il punteggio preso durante l'agitazione. L'MMSE si fa adesso. La raccomandazione 5 invia al CDCD solo dopo che le cause reversibili sono state escluse: qui lo sono. Non si parte con Donepezil 5 mg senza diagnosi e piano. Non si manda a casa Aloperidolo 2 mg/ml gocce o Quetiapina 25 mg per la notte. Il manuale di sicurezza chiede la procedura di prevenzione delle cadute. La VMD in area medica è raccomandata anche per non trasformare il ricovero in un ingresso in RSA non discusso.",
    difficulty: "MEDIUM",
    matrixDifficulty: "INTERMEDIATE",
    frequencyCategory: "HIGH",
    setting: "REPARTO",
    condition: "Delirium risolto: MMSE adesso, niente neurolettico a casa, niente donepezil senza piano",
    guidelineRef: "Bellelli; LG ISS rec. 5; Nota 85; LG VMD R5a.1; manuale sicurezza",
    diagnosis:
      "Delirium risolto dopo polmonite. Cognizione da rivalutare da lucida. Nessuna indicazione a Donepezil 5 mg, Quetiapina 25 mg o Aloperidolo 2 mg/ml gocce alla dimissione.",
    pastMedicalHistory:
      "Polmonite curata, delirium durato due giorni, ora attenzioni stabile. Ipertensione. Vive con la figlia. Nessuna demenza precedente. Nessuna caduta in reparto. Le hanno proposto le gocce per la prima settimana a casa.",
    presentation:
      "Orientata, chiede quando torna a casa, cammina con supervisione. La figlia ha paura della prima notte.",
    redHerrings: ["L'MMSE basso di tre giorni fa, preso nel delirium, sembra una diagnosi.", "Le gocce sembrano una dimissione prudente.", "La RSA sembra obbligatoria senza VMD."],
    timeLimitMinutes: 45,
    patientDeteriorationThreshold: 30,
    patientPrompt:
      "ROLEPLAY. Sei Adele Santini, 83 anni, di nuovo lucida. Ricordi poco della febbre. Vuoi tornare da tua figlia. Se ti fanno domande di orientamento rispondi bene. Se propongono Aloperidolo 2 mg/ml gocce o Quetiapina 25 mg per la notte, dici che di giorno sei già lenta. Se ti spiegano un piano senza quelle gocce, accetti. Non nominare CDCD.",
    correctSolution:
      "VMD e MMSE da lucida. Se il sospetto cognitivo resta, invio al CDCD, non Donepezil 5 mg oggi. Niente neurolettico a casa. Piano cadute. Niente TC. Niente RSA automatica.",
    goldStandardPath: ["anamnesi-risolto", "valutazione-geriatrica", "mmse", "azione-non-demenza", "azione-no-farmaco", "azione-cadute", "azione-dimissione"],
    goldPathNarrative:
      "Il delirium è finito. VMD e MMSE si fanno adesso. Un punteggio precedente, preso nell'agitazione, non è Alzheimer e non autorizza il donepezil. Non si prescrivono aloperidolo e quetiapina. Si scrive il piano cadute e si dimette a casa se la VMD lo consente.",
    examLatencies: { "anamnesi-risolto": 10, "valutazione-geriatrica": 45, mmse: 30, "azione-non-demenza": 10, "azione-no-farmaco": 5, "azione-cadute": 10, "azione-dimissione": 15 },
    anamnesisQuestions: [
      q("aq-risolto", "L'attenzione è stabile da 48 ore?", ["stabile", "lucida"], "Solo adesso l'MMSE è interpretabile."),
      q("aq-vecchio", "Il punteggio preso durante il delirium va usato per il donepezil?", ["no", "delirium"], "Quel numero non è una diagnosi di Alzheimer."),
      q("aq-notte", "La figlia chiede un sedativo per la prima notte?", ["gocce", "paura"], "Non è un criterio per aloperidolo o quetiapina."),
    ],
    physicalSummary: "Lucida, febbre assente, deambulazione con supervisione, nessun deficit focale.",
    citations: [
      { chunkId: "geria-025-bellelli", source: "Bellelli, Rivista SIMG 2020, e LG ISS raccomandazione 5", quote: "La diagnosi di delirium è clinica e non va confusa con una demenza. Al CDCD si invia dopo aver escluso le cause reversibili, tra cui il delirium. Non vi sono evidenze per gli inibitori dell'acetilcolinesterasi nel delirium." },
      { chunkId: "geria-025-vmd", source: "LG VMD R5a.1 e manuale di sicurezza dei pazienti", quote: "Si raccomanda la valutazione multidimensionale per ridurre il ricovero in struttura nei reparti medici. La mancata applicazione delle procedure di prevenzione delle cadute negli anziani è un errore di sistema già ricostruito su un evento mortale." },
    ],
    indicators: ["MMSE eseguito a delirium risolto.", "VMD usata per la dimissione, non per una RSA automatica.", "Niente donepezil senza piano.", "Niente neurolettico a casa e piano cadute scritto."],
    art5: "In cartella: delirium risolto, MMSE attuale, farmaci non prescritti, piano cadute, sede di dimissione motivata con la VMD.",
    legalCriteria: ["Nessun sedativo di dimissione.", "Nessuna contenzione consigliata in lettera.", "Prevenzione delle cadute scritta."],
    mandatoryExams: [
      vmd("ADL 5/6, IADL con aiuto della figlia, MNA 22, dimissione a domicilio possibile. Costo 25 euro."),
      mmse("24/30 da lucida. Non è il numero preso durante il delirium e non autorizza il Donepezil 5 mg senza CDCD. Costo 15 euro."),
    ],
    inappropriateExams: [
      exam("tc-encefalo", "TC Encefalo senza m.d.c. di dimissione", "Nessun segno focale, delirium risolto. Costo 70 euro.", false, 70, "La TC non è il passaporto per la dimissione."),
      exam("densitometria-ossea", "Densitometria Ossea (MOC)", "Non indicata da questo ricovero. Costo 35 euro.", false, 35, "La densitometria non sostituisce il piano cadute."),
    ],
    budget: 70,
    name: "Adele Santini",
    age: 83,
    sex: "F",
    context: "Reparto, delirium risolto, giorno della dimissione.",
    vitals: { heartRate: 76, bloodPressure: "132/74", spo2: 97, temperature: 36.6, respiratoryRate: 16 },
    signs: [
      { signName: "Delirium attivo", result: "Assente da 48 ore.", isPositive: false },
      { signName: "Deficit focale", result: "Assente.", isPositive: false },
    ],
    literacy: "MEDIUM",
    emotion: "COLLABORATIVE",
    adherence: "FULL",
    sleep: "FAIR",
    stress: "MEDIUM",
    support: "STRONG",
    communicationStyle: "Vuole una data di uscita. La figlia ha paura della notte. Entrambe accettano un piano scritto senza gocce.",
    steps: [
      step("anamnesi", "Il delirium è finito", "Lucida da 48 ore. Il punteggio del giorno di febbre era basso. Quale numero usi?", 0, 15, "L'MMSE di oggi, non quello preso nel delirium", [{ label: "Diagnosi di Alzheimer sul punteggio del giorno di febbre e Donepezil 5 mg", next: "res-nota85" }]),
      step("diagnostica", "Scale di dimissione", "VMD per decidere la sede, MMSE da lucida.", 40, 15, "Valutazione multidimensionale e MMSE attuali", [{ label: "RSA senza VMD, per sicurezza", next: "res-rsa" }]),
      step("screening", "CDCD", "La raccomandazione 5 invia dopo le cause reversibili. La polmonite è guarita. L'invio, se il sospetto resta, non è una ricetta di donepezil.", 0, 15, "Eventuale invio al CDCD senza iniziare il farmaco", [{ label: "Donepezil 5 mg oggi e il centro più avanti", next: "res-nota85" }]),
      step("terapia", "Notte a casa", "Non c'è pericolo né psicosi. Quetiapina e aloperidolo non sono la profilassi della prima notte.", 0, 15, "Niente Quetiapina 25 mg e niente Aloperidolo 2 mg/ml gocce", [{ label: "Quetiapina 25 mg per sette sere", next: "res-notte" }]),
      step("screening", "Cadute", "Il manuale di sicurezza chiede la procedura, non un sedativo.", 0, 10, "Piano cadute: ambiente, niente sponde di routine, niente benzodiazepina", [{ label: "Diazepam e sponde consigliate in lettera", next: "res-cadute" }]),
      step("diagnostica", "TC di dimissione", "Nessun segno focale.", 0, 10, "Non eseguire la TC Encefalo senza m.d.c.", [{ label: "TC Encefalo senza m.d.c. come condizione della dimissione", next: "res-tc" }]),
      step("follow-up", "Dove torna", "La VMD consente il domicilio con la figlia. La RSA non è l'esito obbligato di un delirium risolto.", 0, 15, "Dimissione a casa con piano, senza neurolettico", [{ label: "Aloperidolo 2 mg/ml gocce al bisogno in lettera", next: "res-notte" }]),
    ],
    resolutions: [
      done("res-ok", "positive", "Dimessa lucida, senza sedativo", "MMSE attuale, VMD usata per il domicilio, nessun antidemenza e nessun neurolettico.", 40, 100),
      done("res-nota85", "negative", "Donepezil sul punteggio del delirium", "Quel MMSE non è valido e non c'è un piano del CDCD. Donepezil 5 mg è fuori Nota 85. Bellelli non trova evidenze per gli inibitori nel delirium, e qui il delirium è già risolto: il farmaco andrebbe comunque solo dopo una diagnosi di Alzheimer.", 15, 0, "economico"),
      done("res-notte", "negative", "Neurolettico a casa", "Quetiapina 25 mg non è un ipnotico autorizzato e non è indicata nelle psicosi da demenza. Aloperidolo 2 mg/ml gocce al bisogno, senza pericolo, è una sedazione di dimissione. Nessuno dei due previene la caduta.", 5, 0, "economico"),
      done("res-cadute", "negative", "Diazepam e sponde in lettera", "Il diazepam aumenta le cadute secondo Beers. Le sponde di routine non sono la prevenzione del manuale di sicurezza e non sono un atto eccezionale.", 0, 0, "medico-legale"),
      done("res-rsa", "negative", "RSA senza VMD", "La raccomandazione R5a.1 usa la valutazione multidimensionale per ridurre l'ingresso in struttura. Decidere la RSA senza farla, dopo un delirium risolto, è il contrario di quell'uso.", 0, 0, "medico-legale"),
      done("res-tc", "negative", "TC di dimissione", "Non c'è indicazione. Costa 70 euro e non è la condizione per tornare a casa.", 70, 0, "economico"),
    ],
  },
];
