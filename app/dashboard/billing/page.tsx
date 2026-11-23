import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/require-user";
import { getBillingDashboard } from "@/lib/billing/user-dashboard";
import { config } from "@/lib/config";
import {
  BuyExtraButton,
  ManageSubscriptionButton,
  ReferralApplyField,
  SubscribeButton,
} from "@/components/billing/BillingActions";
import { ReferralInviteCard } from "@/components/billing/ReferralInviteCard";
import { SAAS_PLANS } from "@/lib/billing/plans";

function statusLabel(status: string | null, cancelAtPeriodEnd: boolean): string {
  if (!status) return "Nessun abbonamento";
  if (cancelAtPeriodEnd && status === "active") return "Attivo — si chiude a fine periodo";
  if (status === "active") return "Attivo";
  if (status === "trialing") return "In prova";
  if (status === "past_due") return "Pagamento non riuscito";
  if (status === "canceled") return "Cancellato";
  return status;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

type PageProps = {
  searchParams?: Promise<{ billing?: string; ref?: string }> | { billing?: string; ref?: string };
};

export default async function BillingPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const resolved =
    searchParams && "then" in searchParams ? await searchParams : searchParams;
  const data = await getBillingDashboard(user.id);
  const inviteUrl = `${config.APP_URL.replace(/\/$/, "")}/invite/${encodeURIComponent(data.referral.code)}`;
  const prefillRef = resolved?.ref?.trim();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-8">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 text-[#345884]">
          <CreditCard className="h-4 w-4" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Account</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] md:text-[28px]">
          Abbonamento e crediti
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          Un credito equivale a una sessione completa di simulazione clinica. I report e lo storico
          restano consultabili anche a crediti esauriti.
        </p>
      </header>

      {resolved?.billing === "success" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Pagamento ricevuto. Lo stato dell&apos;abbonamento si aggiorna appena Stripe conferma il
          webhook (di solito pochi secondi).
        </p>
      ) : null}
      {resolved?.billing === "canceled" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout annullato. Nessun addebito è stato effettuato.
        </p>
      ) : null}
      {resolved?.billing === "plan-updated" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Piano aggiornato. L&apos;eventuale conguaglio è gestito da Stripe.
        </p>
      ) : null}
      {!data.stripeConfigured ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          I pagamenti Stripe non sono ancora configurati in questo ambiente. I piani e i crediti
          sono pronti: servono le chiavi e i price ID elencati in{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs">docs/saas-billing.md</code>.
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Piano attuale
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[#1E324E]">
            {data.plan?.displayName ?? "Nessun piano a pagamento"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.plan ? data.plan.monthlyPriceLabel : "Scegli Start o Plus per sbloccare i crediti mensili."}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Stato</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {statusLabel(data.subscriptionStatus, data.cancelAtPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Prossimo rinnovo</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{formatDate(data.currentPeriodEnd)}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.subscribed ? <ManageSubscriptionButton /> : null}
            {data.subscribed && data.plan?.id === "START" ? (
              <SubscribeButton plan="PLUS" label="Passa a Plus — 16,90 €/mese" />
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Crediti disponibili
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-[#1E324E]">
            {data.credits.total}
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-sky-900">
              <span>Mensili piano</span>
              <span className="font-semibold tabular-nums">{data.credits.monthlyBalance}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
              <span>Extra acquistati</span>
              <span className="font-semibold tabular-nums">{data.credits.purchasedBalance}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
              <span>Bonus referral</span>
              <span className="font-semibold tabular-nums">{data.credits.referralBalance}</span>
            </div>
          </div>
          {data.plan ? (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                <span>Utilizzo del piano</span>
                <span>
                  {data.monthlyUsed}/{data.plan.monthlyCredits}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#345884]"
                  style={{ width: `${data.monthlyProgress}%` }}
                />
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            {data.completedCount} simulazioni completate · {data.uniqueCases} casi unici
          </p>
        </div>
      </section>

      {data.credits.total === 0 && data.subscribed ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Crediti esauriti. Puoi acquistare 5 simulazioni extra oppure passare a Plus. I report già
          completati restano disponibili.
        </div>
      ) : null}

      {!data.subscribed ? (
        <section className="grid gap-4 md:grid-cols-2">
          {(["START", "PLUS"] as const).map((id) => {
            const plan = SAAS_PLANS[id];
            return (
              <div
                key={id}
                className="flex flex-col rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel"
              >
                <h3 className="font-display text-lg font-semibold text-[#1E324E]">{plan.displayName}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.monthlyPriceLabel}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600">
                  <li>{plan.monthlyCredits} crediti al mese</li>
                  <li>Accumulo fino a {plan.monthlyCap} crediti mensili</li>
                  <li>Tutte le specialità, report AI e storico</li>
                </ul>
                <div className="mt-4">
                  <SubscribeButton
                    plan={id}
                    referralCode={prefillRef}
                    label={`Scegli ${plan.displayName}`}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {!data.firstPaidAt ? (
        <section className="rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel">
          <ReferralApplyField />
          {prefillRef ? (
            <p className="mt-2 text-xs text-slate-500">
              Codice precompilabile dal link: <span className="font-mono">{prefillRef}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel">
        <h2 className="font-display text-base font-semibold text-[#1E324E]">Simulazioni extra</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pacchetto da 5 crediti a {data.extraPack.priceLabel}. Non scadono a fine mese. Serve un
          abbonamento attivo per utilizzarli.
        </p>
        <div className="mt-4 max-w-md">
          <BuyExtraButton disabled={!data.subscribed} />
        </div>
      </section>

      <ReferralInviteCard
        code={data.referral.code}
        inviteUrl={inviteUrl}
        invitedTotal={data.referral.invitedTotal}
        confirmed={data.referral.confirmed}
        pending={data.referral.pending}
        bonusEarned={data.referral.bonusEarned}
        recent={data.referral.recent}
        suspended={data.referral.suspended}
      />

      <section className="rounded-xl border border-border bg-panel-bg p-5 shadow-aequan-panel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1E324E]">
              Cronologia crediti
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ogni movimento è persistente. La cronologia pagamenti completa è nel portale Stripe.
            </p>
          </div>
          {data.subscribed ? (
            <Link href="#pagamenti" className="text-xs font-medium text-[#345884] hover:underline">
              Cronologia pagamenti
            </Link>
          ) : null}
        </div>
        {data.creditHistory.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nessun movimento ancora.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {data.creditHistory.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-slate-800">{row.note || row.type}</p>
                  <p className="text-xs text-slate-400">
                    {row.bucket} ·{" "}
                    {row.createdAt.toLocaleString("it-IT", { timeZone: "Europe/Rome" })}
                  </p>
                </div>
                <span
                  className={
                    row.amount >= 0
                      ? "font-semibold tabular-nums text-emerald-700"
                      : "font-semibold tabular-nums text-slate-700"
                  }
                >
                  {row.amount > 0 ? `+${row.amount}` : row.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p id="pagamenti" className="mt-4 text-xs text-slate-500">
          Fatture e addebiti Stripe: usa &quot;Gestisci abbonamento&quot; per aprire il portale cliente.
          Pacchetti extra registrati: {data.extraPurchases}.
        </p>
      </section>
    </div>
  );
}
