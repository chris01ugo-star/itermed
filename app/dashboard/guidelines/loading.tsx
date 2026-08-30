export default function GuidelinesLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-6 md:p-8">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/80" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      <div className="h-12 animate-pulse rounded-2xl border border-slate-100 bg-white" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
