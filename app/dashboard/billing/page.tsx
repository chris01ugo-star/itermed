import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/require-user";
import { getBillingDashboard } from "@/lib/billing/user-dashboard";
import { config } from "@/lib/config";
import { BuyExtraButton } from "@/components/billing/BillingActions";
import { BillingPlans } from "@/components/billing/BillingPlans";
import { ReferralInviteCard } from "@/components/billing/ReferralInviteCard";
import { BillingStatusToast } from "@/components/billing/BillingStatusToast";
import { toSaasPlanId } from "@/lib/billing/plans";
import { reconcilePaidCheckoutSession } from "@/lib/billing/reconcile-checkout";

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
  searchParams?:
    | Promise<{ billing?: string; ref?: string; session_id?: string }>
    | { billing?: string; ref?: string; session_id?: string };
};

export default async function BillingPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const resolved =
    searchParams && "then" in searchParams ? await searchParams : searchParams;
  if (resolved?.billing === "success") {
    await reconcilePaidCheckoutSession(user.id, resolved.session_id);
  }
  const data = await getBillingDashboard(user.id);
  const inviteUrl = `${config.APP_URL.replace(/\/$/, "")}/invite/${encodeURIComponent(data.referral.code)}`;
  const prefillRef = resolved?.ref?.trim();
  const currentPlanId = toSaasPlanId(data.plan?.id ?? data.planType);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 md:p-8">
      <header className="space-y-1.5">
        <div className="inline-flex items-center gap-2 text-[#345884]">
          <CreditCard className="h-4 w-4" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Account</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] md:text-[28px]">
          {data.subscribed ? "Il tuo abbonamento" : "Scegli il piano e inizia a esercitarti"}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          {data.subscribed
            ? "Un credito equivale a una sessione completa. Puoi fare upgrade, comprare extra o invitare un collega."
            : "Senza abbonamento i casi della Prassi restano bloccati. I report già fatti restano consultabili."}
        </p>
      </header>

      {resolved?.billing ? <BillingStatusToast kind={resolved.billing} /> : null}
      {!data.stripeConfigured ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          I pagamenti Stripe non sono ancora configurati in questo ambiente.
        </p>
      ) : null}
      {data.isAdmin && !data.subscribed ? (
        <p className="rounded-xl border border-[#1E324E]/15 bg-[#F4F6F8] px-4 py-3 text-sm text-[#1E324E]">
          I casi risultano bloccati per chi non è abbonato. Come admin puoi comunque avviarli da
          Inizia.
        </p>
      ) : null}

      {data.subscribed ? (
        <section className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-aequan-panel sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Piano attuale
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-[#1E324E]">
              {data.plan?.displayName}
            </p>
            <p className="text-sm text-slate-500">
              {statusLabel(data.subscriptionStatus, data.cancelAtPeriodEnd)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Crediti disponibili
            </p>
            <p className="mt-1 font-display text-lg font-semibold tabular-nums text-[#1E324E]">
              {data.credits.total}
            </p>
            <p className="text-sm text-slate-500">
              Piano {data.credits.monthlyBalance} · Extra {data.credits.purchasedBalance} · Referral{" "}
              {data.credits.referralBalance}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Prossimo rinnovo
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-[#1E324E]">
              {formatDate(data.currentPeriodEnd)}
            </p>
            <p className="text-sm text-slate-500">
              {data.completedCount} simulazioni · {data.uniqueCases} casi unici
            </p>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#1E324E]">
            {data.subscribed ? "Il tuo piano e l’upgrade" : "Due piani, due ritmi di studio"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {data.subscribed
              ? currentPlanId === "PLUS"
                ? "Sei su Plus. Puoi gestire rinnovo e fatture dal portale."
                : "Sei su Start. Passa a Plus quando ti serve più volume."
              : "Start per un ritmo costante. Plus se vuoi allenarti di più ogni mese."}
          </p>
        </div>
        <BillingPlans
          subscribed={data.subscribed}
          currentPlanId={currentPlanId}
          referralCode={prefillRef}
        />
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
        showApply={!data.firstPaidAt}
        prefillCode={prefillRef}
      />

      {data.credits.total === 0 && data.subscribed ? (
        <div className="rounded-xl border border-[#1E324E]/12 bg-[#F4F6F8] px-4 py-3 text-sm leading-relaxed text-[#1E324E]">
          Crediti esauriti? Non preoccuparti: i report che hai già fatto restano sempre
          consultabili. Quando vuoi, compra 5 simulazioni extra oppure passa a Plus.
        </div>
      ) : null}

      {data.subscribed ? (
        <section className="rounded-2xl border border-border bg-panel-bg p-6 shadow-aequan-panel">
          <h2 className="font-display text-lg font-semibold text-[#1E324E]">Simulazioni extra</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Pacchetto da 5 crediti a {data.extraPack.priceLabel}. Non scadono a fine mese.
          </p>
          <div className="mt-4 max-w-md">
            <BuyExtraButton />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-panel-bg p-6 shadow-aequan-panel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-[#1E324E]">
              Cronologia crediti
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ogni movimento è persistente. Fatture e addebiti sono nel portale Stripe.
            </p>
          </div>
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
        <p className="mt-4 text-xs text-slate-500">
          Pacchetti extra registrati: {data.extraPurchases}.{" "}
          {data.subscribed ? (
            <Link href="#pagamenti" className="font-medium text-[#345884] hover:underline">
              Gestisci fatture dal pulsante del tuo piano.
            </Link>
          ) : null}
        </p>
      </section>
    </div>
  );
}
