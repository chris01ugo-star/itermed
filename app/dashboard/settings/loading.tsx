export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-8">
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200/80" />
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200/80" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-2xl border border-slate-100 bg-white"
        />
      ))}
    </div>
  );
}
