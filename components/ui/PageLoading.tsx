import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";

export function PageLoading({ label = "Caricamento…" }: { label?: string }) {
  return (
    <div
      className="mx-auto flex min-h-[50vh] w-full max-w-7xl flex-col gap-5 p-6 md:p-8"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5">
        <Spinner className="text-[#1E324E]" />
        <p className="text-sm font-medium text-[#1E324E]">{label}</p>
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    </div>
  );
}

export function PlayPageLoading() {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center gap-3 bg-[#F4F6F8]"
      role="status"
      aria-live="polite"
    >
      <Spinner size={28} className="text-[#1E324E]" />
      <p className="text-sm font-medium text-[#1E324E]">Apertura simulazione…</p>
    </div>
  );
}
