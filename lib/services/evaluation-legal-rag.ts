/**
 * Pilastro 3 — Tutela Medico-Legale & Matrice RAG (Scudo Legale)
 * Motore totalmente agnostico: citazioni dinamiche dal corpus RAG della specialità.
 * Zero elenchi hardcoded di leggi/articoli — ogni rilievo cita il documento recuperato.
 */

import type {
  LegalConformityCriterion,
  RagLegalReference,
} from "@/lib/data/cases/types";
import { getCaseById } from "@/lib/data/cases/registry";
import type { GuidelineChunk } from "@/lib/services/rag-service";

export type LegalRagMotivation = {
  id: string;
  type: "positive" | "negative" | "neutral";
  text: string;
  sourceRef?: string;
  scoreImpact: number;
};

export type LegalRagFinding = {
  id: string;
  /** Titolo esatto del documento RAG di origine. */
  documentTitle: string;
  /** Es. "Articolo 5", estratto dal testo/RAG — mai da enum hardcoded. */
  article?: string;
  /** Es. "Sezione X". */
  section?: string;
  /** Es. "comma 2". */
  comma?: string;
  /** Fattispecie di rischio / obbligo (cluster key). */
  fattispecie: string;
  compliance: "rispettato" | "violato" | "parziale" | "non_applicabile";
  rationale: string;
  /** Citazione dinamica: `[Titolo] - Sezione X, Articolo Y`. */
  sourceRef: string;
};

export type LegalRagResult = {
  score: 0 | 100;
  conformityStatus: "CONFORME" | "NON_CONFORME";
  formalLabel: string;
  primarySourceRef: string;
  expertAnalysis: string;
  framework: "legal-rag-ctu";
  /** Rilievi deduplicati (documento + fattispecie). */
  rilievi: LegalRagFinding[];
  criteriaResults: Array<{ id: string; description: string; met: boolean; sourceRef: string }>;
  motivations: LegalRagMotivation[];
  ragSourcesCount: number;
  hasLegalContext: boolean;
  usedCorpusFallback: boolean;
  unevaluable: boolean;
  applicableInstruments: number;
  violated: number;
  partial: number;
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function basenameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Estrae articolo / sezione / comma dal testo recuperato — pattern strutturali,
 * non nomi di leggi hardcoded.
 */
export function extractNormativeLocus(text: string): {
  article?: string;
  section?: string;
  comma?: string;
} {
  if (!text || typeof text !== "string") return {};
  const articleMatch = text.match(
    /\bArt(?:icolo)?\.?\s*(\d+(?:\s*(?:bis|ter|quater|quinquies))?)/i,
  );
  const sectionMatch = text.match(/\bSez(?:ione)?\.?\s*([A-Za-z0-9]+|\d+)/i);
  const commaMatch = text.match(/\b[Cc]omma\s+(\d+)/);

  return {
    ...(articleMatch?.[1]
      ? { article: `Articolo ${articleMatch[1].replace(/\s+/g, " ").trim()}` }
      : {}),
    ...(sectionMatch?.[1] ? { section: `Sezione ${sectionMatch[1]}` } : {}),
    ...(commaMatch?.[1] ? { comma: `comma ${commaMatch[1]}` } : {}),
  };
}

/**
 * Citazione dinamica obbligatoriamente ancorata al titolo documento RAG.
 * Formato: `[Titolo Documento RAG] - Sezione X, Articolo Y[, comma Z]`
 */
export function formatDynamicLegalCitation(params: {
  documentTitle: string;
  article?: string;
  section?: string;
  comma?: string;
  articlesHint?: string[];
}): string {
  const title = params.documentTitle.trim() || "Documento RAG";
  const parts: string[] = [];
  if (params.section) parts.push(params.section);
  if (params.article) parts.push(params.article);
  else if (params.articlesHint?.length) {
    parts.push(params.articlesHint[0]!.trim());
  }
  if (params.comma) parts.push(params.comma);
  return parts.length > 0 ? `[${title}] - ${parts.join(", ")}` : `[${title}]`;
}

const COMPLIANCE_RANK: Record<LegalRagFinding["compliance"], number> = {
  violato: 4,
  parziale: 3,
  rispettato: 2,
  non_applicabile: 1,
};

/** Deduplica per documento + fattispecie; mantiene il rilievo più grave. */
export function dedupeLegalFindings(findings: LegalRagFinding[]): LegalRagFinding[] {
  const map = new Map<string, LegalRagFinding>();
  for (const f of findings) {
    const key = `${normalizeKey(f.documentTitle)}|${normalizeKey(f.fattispecie)}`;
    const prev = map.get(key);
    if (!prev || COMPLIANCE_RANK[f.compliance] > COMPLIANCE_RANK[prev.compliance]) {
      map.set(key, f);
    }
  }
  return [...map.values()].sort((a, b) => {
    const rank = COMPLIANCE_RANK[b.compliance] - COMPLIANCE_RANK[a.compliance];
    if (rank !== 0) return rank;
    return a.fattispecie.localeCompare(b.fattispecie, "it");
  });
}

function milestoneUnlocked(
  requiredKeys: string[],
  milestoneKeys: ReadonlySet<string>,
): boolean {
  if (requiredKeys.length === 0) return false;
  for (const key of requiredKeys) {
    const k = key.trim();
    if (!k) continue;
    if (milestoneKeys.has(k)) return true;
    // Prefissi deterministici del tracker (non fuzzy substring).
    if (milestoneKeys.has(`gold_standard_${k}`)) return true;
    if (milestoneKeys.has(`richiesto_${k}`)) return true;
  }
  return false;
}

function pickDocumentForCriterion(
  criterion: LegalConformityCriterion,
  ragRefs: RagLegalReference[],
  ragChunks: GuidelineChunk[],
): { title: string; articles?: string[]; locusText: string } {
  const desc = criterion.description.toLowerCase();
  // Prefer case-authored ragReferences whose relevance/description aligns with criterion text.
  for (const ref of ragRefs) {
    const hay = `${ref.relevance} ${ref.sourceRef} ${(ref.articles ?? []).join(" ")}`.toLowerCase();
    const overlap =
      desc.split(/\s+/).filter((w) => w.length > 5 && hay.includes(w)).length >= 1 ||
      /consenso|gelli|deontolog|responsabilit|documentaz/i.test(hay);
    if (overlap || ragRefs.length === 1) {
      return {
        title: basenameFromPath(ref.documentPath) || ref.sourceRef.replace(/^Rif\.\s*/i, ""),
        articles: ref.articles,
        locusText: `${ref.sourceRef} ${ref.relevance} ${(ref.articles ?? []).join(" ")}`,
      };
    }
  }
  // Else first legal chunk, else first rag ref, else generic corpus label from chunks.
  if (ragChunks[0]) {
    return {
      title: ragChunks[0].title,
      locusText: ragChunks[0].content.slice(0, 400),
    };
  }
  if (ragRefs[0]) {
    return {
      title: basenameFromPath(ragRefs[0].documentPath) || ragRefs[0].sourceRef,
      articles: ragRefs[0].articles,
      locusText: ragRefs[0].sourceRef,
    };
  }
  return {
    title: "Corpus normativo della specialità (RAG)",
    locusText: criterion.description,
  };
}

function bindReviewToRagDocument(
  review: {
    instrument: string;
    documentTitle?: string;
    rationale: string;
  },
  ragTitles: string[],
  ragRefs: RagLegalReference[],
): { title: string; locusText: string; articles?: string[] } {
  const explicit = review.documentTitle?.trim();
  if (explicit) {
    return { title: explicit, locusText: `${explicit} ${review.rationale}` };
  }

  const needle = normalizeKey(`${review.instrument} ${review.rationale}`);
  for (const title of ragTitles) {
    if (needle.includes(normalizeKey(title)) || normalizeKey(title).includes(needle.slice(0, 24))) {
      return { title, locusText: `${title} ${review.rationale}` };
    }
  }
  for (const ref of ragRefs) {
    const base = basenameFromPath(ref.documentPath);
    const hay = normalizeKey(`${ref.sourceRef} ${base} ${(ref.articles ?? []).join(" ")}`);
    if (
      hay.includes(normalizeKey(review.instrument).slice(0, 16)) ||
      needle.includes(normalizeKey(base).slice(0, 16))
    ) {
      return {
        title: base || ref.sourceRef.replace(/^Rif\.\s*/i, ""),
        articles: ref.articles,
        locusText: `${ref.sourceRef} ${review.rationale}`,
      };
    }
  }

  // Ultimo resort: primo titolo RAG disponibile (ancora dinamico, non legge hardcoded).
  if (ragTitles[0]) {
    return { title: ragTitles[0], locusText: `${ragTitles[0]} ${review.rationale}` };
  }
  if (ragRefs[0]) {
    const base = basenameFromPath(ragRefs[0].documentPath);
    return {
      title: base || ragRefs[0].sourceRef,
      articles: ragRefs[0].articles,
      locusText: ragRefs[0].sourceRef,
    };
  }
  return {
    title: review.instrument || "Documento normativo RAG",
    locusText: review.rationale,
  };
}

function buildExpertAnalysis(params: {
  conformityStatus: "CONFORME" | "NON_CONFORME";
  caseTitle: string;
  rilievi: LegalRagFinding[];
  criteriaResults: LegalRagResult["criteriaResults"];
  ragSources: string[];
  usedCorpusFallback: boolean;
}): string {
  const parts: string[] = [];
  parts.push(
    `Perizia medico-legale (CTU) sul caso «${params.caseTitle}». ` +
      `Esito dello Scudo Legale: ${
        params.conformityStatus === "CONFORME"
          ? "CONFORME — Scudo Legale Attivo"
          : "NON CONFORME — Profilo di Rischio Contenzioso"
      }.`,
  );

  if (params.ragSources.length > 0) {
    parts.push(
      `Fonti normative dinamiche interrogate per la specialità: ${params.ragSources
        .slice(0, 6)
        .map((s) => `«${s}»`)
        .join(" · ")}.`,
    );
  } else if (params.usedCorpusFallback) {
    parts.push(
      "Corpus RAG specialty non disponibile al momento della valutazione: i rilievi si fondano sui riferimenti normativi ancorati al caso e sulla telemetria di sessione, senza inventare articoli non recuperati.",
    );
  }

  const met = params.criteriaResults.filter((c) => c.met).length;
  const tot = params.criteriaResults.length;
  if (tot > 0) {
    parts.push(
      `Criteri di conformità del caso: ${met}/${tot} soddisfatti rispetto alle evidenze deterministiche di sessione.`,
    );
  }

  const viol = params.rilievi.filter((r) => r.compliance === "violato" || r.compliance === "parziale");
  const ok = params.rilievi.filter((r) => r.compliance === "rispettato");

  if (ok.length > 0) {
    parts.push(
      `Adempimenti documentati: ${ok
        .slice(0, 4)
        .map((r) => `«${r.fattispecie}» (${r.sourceRef})`)
        .join(" · ")}.`,
    );
  }
  if (viol.length > 0) {
    parts.push(
      `Profilo di responsabilità: ${viol
        .slice(0, 5)
        .map((r) => `«${r.fattispecie}» — ${r.compliance} — ${r.sourceRef}`)
        .join("; ")}.`,
    );
  } else if (params.conformityStatus === "CONFORME") {
    parts.push(
      "Non emergono violazioni deduplicate rispetto al corpus normativo recuperato: condotta difendibile sotto il profilo della responsabilità professionale.",
    );
  }

  return parts.join(" ");
}

export function legalConformityFormalLabelFromStatus(
  status: "CONFORME" | "NON_CONFORME",
): string {
  return status === "CONFORME"
    ? "CONFORME (Scudo Legale Attivo)"
    : "NON CONFORME (Profilo di Rischio Contenzioso)";
}

export type LegalInstrumentReviewInput = {
  instrument: string;
  documentTitle?: string;
  compliance: "rispettato" | "violato" | "parziale" | "non_applicabile";
  rationale: string;
};

/**
 * Valutazione tutela medico-legale agnostica rispetto al corpus RAG caricato.
 */
export function computeLegalRagConformity(params: {
  caseId?: string | null;
  caseTitle?: string | null;
  chatHistory?: Array<{ role: string; content: string }> | null;
  sessionMilestones?: Array<{ milestoneKey: string }> | null;
  legalInstrumentReviews?: LegalInstrumentReviewInput[] | null;
  /** Chunk legali recuperati da getRelevantGuidelines (specialità attiva). */
  legalChunks?: GuidelineChunk[] | null;
  legalSources?: string[] | null;
  hasLegalContext?: boolean;
  ragSourcesCount?: number;
  criteria?: LegalConformityCriterion[] | null;
  ragReferences?: RagLegalReference[] | null;
}): LegalRagResult {
  const registered = params.caseId ? getCaseById(params.caseId) : undefined;
  const criteria =
    (Array.isArray(params.criteria) && params.criteria.length > 0
      ? params.criteria
      : registered?.legalConformity?.criteria) ?? [];
  const ragRefs =
    (Array.isArray(params.ragReferences) && params.ragReferences.length > 0
      ? params.ragReferences
      : registered?.legalConformity?.ragReferences) ?? [];

  const legalChunks = Array.isArray(params.legalChunks) ? params.legalChunks : [];
  const ragTitles = dedupeTitles([
    ...(Array.isArray(params.legalSources) ? params.legalSources : []),
    ...legalChunks.map((c) => c.title),
    ...ragRefs.map((r) => basenameFromPath(r.documentPath)),
  ]);

  const ragSourcesCount =
    typeof params.ragSourcesCount === "number"
      ? Math.max(0, params.ragSourcesCount)
      : ragTitles.length;
  const hasLegalContext =
    (params.hasLegalContext ?? false) && (legalChunks.length > 0 || ragSourcesCount > 0);
  const usedCorpusFallback = !hasLegalContext && ragRefs.length > 0;
  const unevaluable = !hasLegalContext && ragRefs.length === 0 && criteria.length === 0;

  const milestoneKeys = new Set(
    (params.sessionMilestones ?? []).map((m) => m.milestoneKey).filter(Boolean),
  );

  const rawFindings: LegalRagFinding[] = [];
  const criteriaResults: LegalRagResult["criteriaResults"] = [];

  // 1) Criteri del caso × milestone deterministici, citazione da RAG dinamico.
  for (const criterion of criteria) {
    const met = milestoneUnlocked(criterion.requiredMilestoneKeys, milestoneKeys);
    const doc = pickDocumentForCriterion(criterion, ragRefs, legalChunks);
    const locus = extractNormativeLocus(doc.locusText);
    const sourceRef = formatDynamicLegalCitation({
      documentTitle: doc.title,
      ...locus,
      articlesHint: doc.articles,
    });
    criteriaResults.push({
      id: criterion.id,
      description: criterion.description,
      met,
      sourceRef,
    });
    rawFindings.push({
      id: `crit_${criterion.id}`,
      documentTitle: doc.title,
      article: locus.article ?? doc.articles?.[0],
      section: locus.section,
      comma: locus.comma,
      fattispecie: criterion.description,
      compliance: met ? "rispettato" : "violato",
      rationale: met
        ? `Criterio soddisfatto (evidenza deterministica di sessione).`
        : `Criterio non soddisfatto: mancano evidenze per [${criterion.requiredMilestoneKeys.join(", ")}].`,
      sourceRef,
    });
  }

  // 2) Telemetria LLM — ancorata a titoli RAG dinamici (no legge hardcoded).
  const reviews = Array.isArray(params.legalInstrumentReviews)
    ? params.legalInstrumentReviews
    : [];
  for (const review of reviews) {
    if (review.compliance === "non_applicabile") continue;
    const bound = bindReviewToRagDocument(review, ragTitles, ragRefs);
    const locus = extractNormativeLocus(`${bound.locusText} ${bound.title}`);
    const sourceRef = formatDynamicLegalCitation({
      documentTitle: bound.title,
      ...locus,
      articlesHint: bound.articles,
    });
    rawFindings.push({
      id: `rev_${normalizeKey(review.instrument).slice(0, 40)}`,
      documentTitle: bound.title,
      ...locus,
      fattispecie: review.instrument,
      compliance: review.compliance,
      rationale: review.rationale.slice(0, 280),
      sourceRef,
    });
  }

  // 3) Obblighi emergenti dai chunk RAG: se il corpus cita obblighi tipici e la sessione
  //    non ha alcuna evidenza correlata, segnala gap — citazione sempre dal chunk stesso.
  if (legalChunks.length > 0 && milestoneKeys.size + doctorTurnCount(params.chatHistory) > 0) {
    for (const chunk of legalChunks.slice(0, 8)) {
      const obligation = inferObligationFattispecie(chunk);
      if (!obligation) continue;
      const evidenceOk = obligationEvidenceMet(obligation.kind, milestoneKeys, params.chatHistory);
      const locus = extractNormativeLocus(`${chunk.title}\n${chunk.content}`);
      const sourceRef = formatDynamicLegalCitation({
        documentTitle: chunk.title,
        ...locus,
      });
      rawFindings.push({
        id: `rag_obl_${normalizeKey(obligation.fattispecie).slice(0, 36)}`,
        documentTitle: chunk.title,
        ...locus,
        fattispecie: obligation.fattispecie,
        compliance: evidenceOk ? "rispettato" : "parziale",
        rationale: evidenceOk
          ? `Obbligo emergente dal corpus RAG rispettato in sessione.`
          : `Il documento RAG «${chunk.title}» impone attenzione a: ${obligation.fattispecie}. Evidenza di sessione incompleta.`,
        sourceRef,
      });
    }
  }

  const rilievi = dedupeLegalFindings(rawFindings);

  const hasViolation = rilievi.some(
    (r) => r.compliance === "violato" || r.compliance === "parziale",
  );
  const finalStatus: "CONFORME" | "NON_CONFORME" = hasViolation ? "NON_CONFORME" : "CONFORME";
  const score: 0 | 100 = finalStatus === "CONFORME" ? 100 : 0;
  const formalLabel = legalConformityFormalLabelFromStatus(finalStatus);

  const primarySourceRef =
    rilievi.find((r) => r.compliance === "violato" || r.compliance === "parziale")?.sourceRef ||
    rilievi.find((r) => r.compliance === "rispettato")?.sourceRef ||
    (ragTitles[0] ? formatDynamicLegalCitation({ documentTitle: ragTitles[0] }) : "") ||
    (ragRefs[0]
      ? formatDynamicLegalCitation({
          documentTitle: basenameFromPath(ragRefs[0].documentPath),
          articlesHint: ragRefs[0].articles,
        })
      : "[Corpus normativo RAG della specialità]");

  const motivations: LegalRagMotivation[] = [];
  if (hasLegalContext) {
    motivations.push({
      id: "legal_rag_active",
      type: "neutral",
      text: `Corpus RAG specialty attivo (${ragSourcesCount} fonti) — citazioni dinamiche dai documenti recuperati`,
      sourceRef: primarySourceRef,
      scoreImpact: 0,
    });
  } else if (usedCorpusFallback) {
    motivations.push({
      id: "legal_case_refs",
      type: "neutral",
      text: "Retrieval RAG soft-fail — applicazione riferimenti normativi ancorati al caso (zero allucinazione di articoli)",
      sourceRef: primarySourceRef,
      scoreImpact: 0,
    });
  } else if (unevaluable) {
    motivations.push({
      id: "legal_unevaluable",
      type: "neutral",
      text: "Nessun corpus normativo recuperato per la specialità — tutela non pienamente valutabile",
      sourceRef: primarySourceRef,
      scoreImpact: 0,
    });
  }

  for (const r of rilievi) {
    motivations.push({
      id: `legal_ril_${normalizeKey(r.id).slice(0, 28)}`,
      type:
        r.compliance === "rispettato"
          ? "positive"
          : r.compliance === "non_applicabile"
            ? "neutral"
            : "negative",
      text:
        r.compliance === "rispettato"
          ? `Adempimento — «${r.fattispecie}»: ${r.rationale.slice(0, 120)}`
          : `Rilievo — «${r.fattispecie}» (${r.compliance}): ${r.rationale.slice(0, 140)}`,
      sourceRef: r.sourceRef,
      scoreImpact: 0,
    });
  }

  motivations.push({
    id: "legal_verdict",
    type: finalStatus === "CONFORME" ? "positive" : "negative",
    text: formalLabel,
    sourceRef: primarySourceRef,
    scoreImpact: 0,
  });

  // Deduplicate motivations by text+sourceRef
  const uniqueMotivations = dedupeMotivations(motivations);

  const caseTitle =
    params.caseTitle || registered?.title || registered?.code || "Caso clinico";

  const expertAnalysis = buildExpertAnalysis({
    conformityStatus: finalStatus,
    caseTitle,
    rilievi,
    criteriaResults,
    ragSources: ragTitles,
    usedCorpusFallback: usedCorpusFallback || unevaluable,
  });

  return {
    score,
    conformityStatus: finalStatus,
    formalLabel,
    primarySourceRef,
    expertAnalysis,
    framework: "legal-rag-ctu",
    rilievi,
    criteriaResults,
    motivations: uniqueMotivations,
    ragSourcesCount,
    hasLegalContext,
    usedCorpusFallback,
    unevaluable,
    applicableInstruments: rilievi.filter((r) => r.compliance !== "non_applicabile").length,
    violated: rilievi.filter((r) => r.compliance === "violato").length,
    partial: rilievi.filter((r) => r.compliance === "parziale").length,
  };
}

function dedupeTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of titles) {
    const trimmed = t?.trim();
    if (!trimmed) continue;
    const key = normalizeKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function dedupeMotivations(items: LegalRagMotivation[]): LegalRagMotivation[] {
  const seen = new Set<string>();
  const out: LegalRagMotivation[] = [];
  for (const m of items) {
    const key = `${normalizeKey(m.text)}|${normalizeKey(m.sourceRef ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function doctorTurnCount(
  chatHistory?: Array<{ role: string; content: string }> | null,
): number {
  if (!Array.isArray(chatHistory)) return 0;
  return chatHistory.filter(
    (m) => m.role === "user" && typeof m.content === "string" && m.content.trim().length > 0,
  ).length;
}

/**
 * Inferisce una fattispecie di obbligo dal contenuto del chunk RAG
 * (pattern strutturali sul testo recuperato — non su elenchi di leggi).
 */
function inferObligationFattispecie(
  chunk: GuidelineChunk,
): { kind: "consenso" | "allergie" | "farmaci" | "documentazione"; fattispecie: string } | null {
  const text = `${chunk.title}\n${chunk.content}`.toLowerCase();
  if (/consenso informato|informazione al paziente|diritto di essere informato/.test(text)) {
    return {
      kind: "consenso",
      fattispecie: "Consenso informato / informazione al paziente",
    };
  }
  if (/allergi|anafilass|ipersensibilit/.test(text)) {
    return {
      kind: "allergie",
      fattispecie: "Rilevazione allergie / sicurezza prescrittiva",
    };
  }
  if (/anamnesi farmacolog|terapia in atto|interazioni farmacolog/.test(text)) {
    return {
      kind: "farmaci",
      fattispecie: "Anamnesi farmacologica / terapia in atto",
    };
  }
  if (/cartella clinica|documentazione sanitaria|tracciabilit/.test(text)) {
    return {
      kind: "documentazione",
      fattispecie: "Documentazione clinica / tracciabilità",
    };
  }
  return null;
}

function obligationEvidenceMet(
  kind: "consenso" | "allergie" | "farmaci" | "documentazione",
  milestoneKeys: ReadonlySet<string>,
  chatHistory?: Array<{ role: string; content: string }> | null,
): boolean {
  const chat = Array.isArray(chatHistory) ? chatHistory : [];
  const doctorText = chat
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content)
    .join("\n");

  const has = (...keys: string[]) => keys.some((k) => milestoneUnlocked([k], milestoneKeys));

  switch (kind) {
    case "consenso":
      return (
        has("consenso_informato", "consenso") ||
        /consenso informato|ha compreso i rischi|accetta (l['']esame|la procedura)/i.test(doctorText)
      );
    case "allergie":
      return has("indagate_allergie", "allergie") || /allergi/i.test(doctorText);
    case "farmaci":
      return (
        has("anamnesi_farmaci", "farmaci") ||
        /farmaci|terapia in atto|assume/i.test(doctorText)
      );
    case "documentazione":
      return (
        has("documentazione", "cartella_clinica") ||
        doctorText.trim().length > 40
      );
    default:
      return false;
  }
}
