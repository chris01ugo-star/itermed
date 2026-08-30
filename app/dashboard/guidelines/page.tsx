import { GuidelinesHub } from "@/components/guidelines/GuidelinesHub";
import { fetchGuidelineDocumentsWithExcerpt } from "@/lib/guidelines/queries";
import { createLogger } from "@/lib/logger";
import { requireUser } from "@/lib/require-user";

const log = createLogger("guidelines-page");

type PageProps = {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
};

export default async function DashboardGuidelinesPage(props: PageProps) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const searchParams =
    props.searchParams && "then" in props.searchParams
      ? await props.searchParams
      : props.searchParams;
  const initialTab = searchParams?.tab === "ingest" ? "ingest" : "browse";

  let docs: Awaited<ReturnType<typeof fetchGuidelineDocumentsWithExcerpt>> = [];
  let loadError: string | null = null;

  try {
    // Metadata + short excerpt only — never ship full PDF text to the client.
    docs = await fetchGuidelineDocumentsWithExcerpt();
  } catch (error) {
    log.error("Failed to load guideline documents", { error });
    loadError = "Impossibile caricare l'archivio linee guida al momento.";
  }

  const serializable = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    tags: doc.tags,
    sourceType: doc.sourceType,
    sourceName: doc.sourceName,
    chunkCount: doc.chunkCount,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
    excerpt: doc.excerpt,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
      <GuidelinesHub
        docs={serializable}
        isAdmin={isAdmin}
        loadError={loadError}
        initialTab={initialTab}
      />
    </div>
  );
}
