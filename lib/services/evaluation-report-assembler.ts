import type {
  ClinicalGapItem,
  FatalError,
  ForensicLegalAssessment,
  GoldStandardGuide,
} from "@/lib/services/evaluation-report-types";
import type { MacroAreaRationale } from "@/lib/services/evaluation-killer-switch";
import { escapeHtml } from "@/lib/utils/escape-html";

function riskBadgeClass(level: ClinicalGapItem["clinicalRiskLevel"]): string {
  switch (level) {
    case "CATASTROFICO":
      return "empatia-risk empatia-risk-catastrophic";
    case "ALTO":
      return "empatia-risk empatia-risk-high";
    case "MEDIO":
      return "empatia-risk empatia-risk-medium";
    default:
      return "empatia-risk empatia-risk-low";
  }
}

function riskLabel(level: ClinicalGapItem["clinicalRiskLevel"]): string {
  switch (level) {
    case "CATASTROFICO":
      return "Catastrofico";
    case "ALTO":
      return "Alto";
    case "MEDIO":
      return "Medio";
    default:
      return "Basso";
  }
}

export function assembleEliteReportHtml(params: {
  macroAreas: MacroAreaRationale[];
  finalScore: number;
  rawScore: number;
  killerSwitchApplied: boolean;
  fatalErrors: FatalError[];
  specializationDirectorCommentary: string;
  forensicLegal: ForensicLegalAssessment;
  clinicalGaps: ClinicalGapItem[];
  goldStandardGuide: GoldStandardGuide;
}): string {
  const {
    macroAreas,
    finalScore,
    rawScore,
    killerSwitchApplied,
    fatalErrors,
    specializationDirectorCommentary,
    forensicLegal,
    clinicalGaps,
    goldStandardGuide,
  } = params;

  const macroRows = macroAreas
    .map(
      (area) => `
    <tr>
      <td><strong>${escapeHtml(area.label)}</strong></td>
      <td class="empatia-num">${area.weightPercent}%</td>
      <td class="empatia-num">${area.scorePercent}/100</td>
      <td class="empatia-num">${area.contributionTrentesimi}/30</td>
      <td>${escapeHtml(area.rationale)}</td>
    </tr>`,
    )
    .join("");

  const killerBlock =
    killerSwitchApplied ?
      `<div class="empatia-alert empatia-alert-fatal">
        <strong>Killer Switch Clinico attivato.</strong>
        Errore fatale rilevato: il voto è stato abbattuto d'ufficio da ${rawScore}/30 a <strong>${finalScore}/30</strong> (&lt; 18/30).
        <ul>${fatalErrors.map((e) => `<li><strong>${escapeHtml(e.description)}</strong> — ${escapeHtml(e.rationale)}</li>`).join("")}</ul>
      </div>`
    : "";

  const gapBlocks =
    clinicalGaps.length > 0 ?
      clinicalGaps
        .map(
          (gap) => `
      <article class="empatia-gap-card">
        <h4 class="empatia-gap-title">${escapeHtml(gap.errorOrOmission)}</h4>
        <dl class="empatia-gap-dl">
          <dt>Il GAP Scientifico</dt>
          <dd>${escapeHtml(gap.scientificGap)}</dd>
          <dt>Esempio Vivido (Scenario Reale di Danno)</dt>
          <dd class="empatia-vivid">${escapeHtml(gap.vividDamageScenario)}</dd>
          <dt>Livello di Rischio Clinico</dt>
          <dd><span class="${riskBadgeClass(gap.clinicalRiskLevel)}">${riskLabel(gap.clinicalRiskLevel)}</span></dd>
        </dl>
      </article>`,
        )
        .join("")
    : `<p class="empatia-muted">Nessun gap clinico critico verificato rispetto al registro milestone deterministico.</p>`;

  const citations = goldStandardGuide.formalGuidelineCitations
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join("");

  return `<article class="empatia-elite-report">
  <section class="empatia-section" id="empatia-metrics">
    <h2 class="empatia-h2">📊 Riepilogo Statistico delle Prestazioni (Metrics &amp; OSCE Score)</h2>
    <table class="empatia-table">
      <thead>
        <tr>
          <th>Macro-area</th>
          <th>Peso</th>
          <th>Score</th>
          <th>Contributo /30</th>
          <th>Motivazione matematica</th>
        </tr>
      </thead>
      <tbody>
        ${macroRows}
        <tr class="empatia-total-row">
          <td colspan="3"><strong>Voto Finale Complessivo (trentesimi)</strong></td>
          <td class="empatia-num"><strong>${finalScore}/30</strong></td>
          <td>${killerSwitchApplied ? `Calcolo grezzo ${rawScore}/30 — Killer Switch applicato per errore fatale.` : `Somma ponderata delle cinque macro-aree (30% + 30% + 15% + 15% + 10%).`}</td>
        </tr>
      </tbody>
    </table>
    ${killerBlock}
  </section>

  <section class="empatia-section" id="empatia-director">
    <h2 class="empatia-h2">👨‍⚕️ Il Direttore della Scuola di Specializzazione (Commento del Primario)</h2>
    <div class="empatia-prose">${formatProse(specializationDirectorCommentary)}</div>
  </section>

  <section class="empatia-section" id="empatia-forensic">
    <h2 class="empatia-h2">🛡️ Scudo Medico-Legale &amp; Giurisprudenza (Valutazione Forense)</h2>
    <div class="empatia-forensic-grid">
      <div class="empatia-forensic-block">
        <h3>Inquadramento Giuridico dell'operato</h3>
        <p>${formatProse(forensicLegal.legalFramework)}</p>
      </div>
      <div class="empatia-forensic-block">
        <h3>Profili di Colpevolezza (Imperizia, Imprudenza, Negligenza)</h3>
        <p>${formatProse(forensicLegal.culpabilityProfile)}</p>
      </div>
      <div class="empatia-forensic-block empatia-forensic-wide">
        <h3>Nesso di Causalità Materiale</h3>
        <p>${formatProse(forensicLegal.materialCausality)}</p>
      </div>
    </div>
  </section>

  <section class="empatia-section" id="empatia-gaps">
    <h2 class="empatia-h2">❌ Comprensione Chirurgica dei GAP (Analisi dell'Errore e Rischio Clinico)</h2>
    ${gapBlocks}
  </section>

  <section class="empatia-section" id="empatia-gold">
    <h2 class="empatia-h2">📚 Gestione Esperta di Riferimento (Gold Standard Clinico)</h2>
    <div class="empatia-prose">
      <h3>Percorso clinico perfetto</h3>
      <p>${formatProse(goldStandardGuide.perfectClinicalPathway)}</p>
      <h3>Fisiopatologia e contesto teorico</h3>
      <p>${formatProse(goldStandardGuide.pathophysiologyContext)}</p>
      <h3>Fonti e linee guida internazionali</h3>
      <ul class="empatia-citations">${citations}</ul>
    </div>
  </section>
</article>`;
}

function formatProse(text: string): string {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
