import { CaseCreatorWizard } from "@/components/cases/CaseCreatorWizard";
import { requireUser } from "@/lib/require-user";

export default async function CreateCasePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 md:p-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-[28px] font-bold tracking-tight text-text-primary">
          Crea Caso
        </h1>
        <p className="text-sm leading-relaxed text-slate-500">
          Configura anagrafica, latenze degli esami, percorso Gold Standard e soglie di
          deterioramento. Usa la compilazione rapida con IA per generare una bozza da
          rivedere prima del salvataggio.
        </p>
      </header>
      <CaseCreatorWizard canPublishGlobal={user.role === "ADMIN"} />
    </div>
  );
}
