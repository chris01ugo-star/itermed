import { requirePlatformAdmin } from "@/lib/require-user";
import {
  fetchPlatformMetrics,
  fetchWaitlistEntries,
} from "@/lib/admin/platform-metrics";

export const metadata = {
  title: "Piattaforma · Admin Aequan",
  description: "Waitlist beta e metriche operative.",
};

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#1E324E]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function AdminPlatformPage() {
  await requirePlatformAdmin();

  const [metrics, waitlist] = await Promise.all([
    fetchPlatformMetrics(),
    fetchWaitlistEntries(300),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#345884]">
          Solo operatori piattaforma
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1E324E]">
          Piattaforma
        </h1>
        <p className="text-sm text-slate-500">
          Lista d&apos;attesa beta e indicatori principali. Visibile solo a Dario e Christopher.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Panoramica</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Waitlist"
            value={metrics.waitlistAvailable ? metrics.waitlistTotal : "—"}
            hint={
              metrics.waitlistAvailable
                ? `+${metrics.waitlistLast7Days} negli ultimi 7 giorni`
                : "Tabella non disponibile (migration?)"
            }
          />
          <MetricCard
            label="Utenti registrati"
            value={metrics.usersTotal}
            hint={`+${metrics.usersLast7Days} · ${metrics.usersAdmins} admin`}
          />
          <MetricCard
            label="Simulazioni avviate"
            value={metrics.simulationsStarted}
            hint={`+${metrics.simulationsStartedLast7Days} negli ultimi 7 giorni`}
          />
          <MetricCard
            label="Simulazioni completate"
            value={metrics.simulationsCompleted}
            hint={`+${metrics.simulationsCompletedLast7Days} · ${metrics.reportsPending} in coda`}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Casi clinici attivi" value={metrics.activeCases} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Lista d&apos;attesa beta</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {metrics.waitlistAvailable
                ? `${waitlist.length} voci mostrate (max 300)`
                : "Impossibile leggere BetaWaitlistEntry"}
            </p>
          </div>
        </div>

        {!metrics.waitlistAvailable ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            Applica la migration{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              20260830120000_beta_waitlist
            </code>{" "}
            sul database di produzione.
          </p>
        ) : waitlist.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Nessuna email in lista ancora.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold sm:px-5">Email</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Nome</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Ruolo</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Fonte</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {waitlist.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="max-w-[220px] truncate px-4 py-3 font-medium text-slate-900 sm:px-5">
                      <a
                        href={`mailto:${row.email}`}
                        className="underline-offset-2 hover:text-[#345884] hover:underline"
                      >
                        {row.email}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600 sm:px-5">
                      {row.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 sm:px-5">
                      {row.roleHint || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 sm:px-5">{row.source}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 sm:px-5">
                      {row.createdAt.toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
