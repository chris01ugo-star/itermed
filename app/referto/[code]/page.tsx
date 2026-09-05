import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AequanLogo } from "@/components/AequanLogo";
import { EliteResultsClient } from "@/app/case/[id]/results/EliteResultsClient";
import { loadSharedSessionReport } from "@/lib/reports/load-shared-session-report";
import { reportAccessionCode, reportSharePath } from "@/lib/reports/share-link";
import { config } from "@/lib/config";
import { safeDisplayTrentesimi } from "@/lib/scoring/trentesimi";

type RefertoPageProps = {
  params: Promise<{ code: string }> | { code: string };
};

async function resolveCode(params: RefertoPageProps["params"]): Promise<string> {
  const resolved = "then" in params ? await params : params;
  return decodeURIComponent(resolved.code ?? "").trim();
}

export async function generateMetadata({ params }: RefertoPageProps): Promise<Metadata> {
  const code = await resolveCode(params);
  const report = await loadSharedSessionReport(code);
  const score = report ? safeDisplayTrentesimi(report.totalScore) : null;
  const title = report
    ? `Referto AEQUAN · ${score?.toFixed(1).replace(".", ",")}/30`
    : "Referto di valutazione · AEQUAN";
  const description = report?.caseTitle
    ? `Referto di valutazione — ${report.caseTitle}. Apri su AEQUAN.`
    : "Apri il Referto di valutazione di una simulazione clinica AEQUAN.";
  const url = `${config.APP_URL}${reportSharePath(code)}`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url,
      siteName: "AEQUAN",
      type: "article",
      locale: "it_IT",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

export default async function SharedRefertoPage({ params }: RefertoPageProps) {
  const code = await resolveCode(params);
  if (!code) return notFound();

  const report = await loadSharedSessionReport(code);
  if (!report) {
    return (
      <div className="min-h-screen bg-[var(--aequan-ui-bg)] text-[var(--aequan-text-primary)]">
        <div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
          <AequanLogo height={32} />
          <h1 className="mt-6 font-display text-2xl font-semibold text-[var(--aequan-brand-primary)]">
            Referto non disponibile
          </h1>
          <p className="mt-2 text-sm text-[var(--aequan-text-secondary)]">
            Questo link non corrisponde a una sessione pubblicata, oppure il referto è ancora in
            elaborazione.
          </p>
          <Link
            href="/#lista-attesa"
            className="mt-6 inline-flex rounded-full bg-[var(--aequan-brand-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Prova AEQUAN
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--aequan-ui-bg)] text-[var(--aequan-text-primary)]">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/" aria-label="AEQUAN">
            <AequanLogo height={28} />
          </Link>
          <Link
            href="/#lista-attesa"
            className="inline-flex items-center rounded-full bg-[var(--aequan-brand-primary)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Simula anche tu
          </Link>
        </div>
        <EliteResultsClient
          totalScore={report.totalScore}
          radarData={report.radarData}
          caseTitle={report.caseTitle}
          sessionId={report.sessionId}
          shareUrl={`${config.APP_URL}${reportSharePath(report.sessionId)}`}
          accessionCode={reportAccessionCode(report.sessionId)}
          dismissed={report.dismissed}
          strengths={report.strengths}
          weaknesses={report.weaknesses}
          correctSolution={report.correctSolution}
          legalProtectionStatus={report.legalProtectionStatus}
          clinicalDeltaTable={report.clinicalDeltaTable}
          economicAnalysis={report.economicAnalysis}
          coachingFeedback={report.coachingFeedback}
          legalSources={report.legalSources}
          killerSwitch={report.killerSwitch}
          fatalErrors={report.fatalErrors}
          empathyBreakdown={report.empathyBreakdown}
          scoreBreakdown={report.scoreBreakdown}
        />
      </div>
    </div>
  );
}
