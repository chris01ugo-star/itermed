"use client";

import { Check, Sparkles } from "lucide-react";
import {
  SAAS_PLAN_FEATURES,
  SAAS_PLANS,
  type SaasPlanId,
} from "@/lib/billing/plans";
import { ManageSubscriptionButton, SubscribeButton } from "@/components/billing/BillingActions";
import { cn } from "@/app/utils/cn";

export function BillingPlans({
  subscribed,
  currentPlanId,
  referralCode,
}: {
  subscribed: boolean;
  currentPlanId: SaasPlanId | null;
  referralCode?: string;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {(["START", "PLUS"] as const).map((id) => {
        const plan = SAAS_PLANS[id];
        const isCurrent = subscribed && currentPlanId === id;
        const isUpgrade = subscribed && currentPlanId === "START" && id === "PLUS";
        const isRecommended = id === "PLUS";
        const canSubscribe = !subscribed;
        const features = SAAS_PLAN_FEATURES[id];

        return (
          <article
            key={id}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-2xl border bg-panel-bg p-6 shadow-aequan-panel",
              isRecommended
                ? "border-[#1E324E] ring-1 ring-[#1E324E]/15"
                : "border-border",
              isCurrent ? "bg-white" : "",
            )}
          >
            {isRecommended ? (
              <p className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#1E324E] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                <Sparkles className="h-3 w-3" aria-hidden />
                Consigliato
              </p>
            ) : null}

            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {isCurrent ? "Il tuo piano" : id === "START" ? "Piano base" : "Piano intensivo"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#1E324E]">
              {plan.displayName}
            </h2>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold tabular-nums tracking-tight text-[#1E324E]">
                {id === "START" ? "9,90" : "16,90"}
              </span>
              <span className="text-sm font-medium text-slate-500">€ / mese</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {plan.monthlyCredits} crediti al mese · accumulo fino a {plan.monthlyCap}
            </p>

            <ul className="mt-5 flex-1 space-y-2.5">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm leading-snug text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#345884]" aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {isCurrent ? (
                <div className="space-y-2">
                  <p className="rounded-xl bg-[#E8EEF5] px-3 py-2 text-center text-sm font-semibold text-[#1E324E]">
                    Piano attivo
                  </p>
                  <ManageSubscriptionButton />
                </div>
              ) : canSubscribe ? (
                <SubscribeButton
                  plan={id}
                  referralCode={referralCode}
                  label={id === "PLUS" ? "Inizia con Plus" : "Scegli Start"}
                  className={
                    isRecommended
                      ? "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1E324E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:opacity-60"
                      : "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#1E324E]/20 bg-white px-4 py-3 text-sm font-semibold text-[#1E324E] transition hover:bg-[#F4F6F8] disabled:opacity-60"
                  }
                />
              ) : isUpgrade ? (
                <SubscribeButton
                  plan="PLUS"
                  label="Passa a Plus"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1E324E] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2A486D] disabled:opacity-60"
                />
              ) : (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-500">
                  Incluso nel tuo piano Plus
                </p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
