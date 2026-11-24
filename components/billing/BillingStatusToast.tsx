"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

const COPY: Record<string, { title: string; body: string; tone: "green" | "amber" }> = {
  success: {
    title: "Pagamento ricevuto",
    body: "L’abbonamento si aggiorna in pochi secondi.",
    tone: "green",
  },
  "plan-updated": {
    title: "Piano aggiornato",
    body: "Il conguaglio è gestito da Stripe.",
    tone: "green",
  },
  canceled: {
    title: "Checkout annullato",
    body: "Nessun addebito è stato effettuato.",
    tone: "amber",
  },
};

export function BillingStatusToast({ kind }: { kind: string }) {
  const router = useRouter();
  const copy = COPY[kind];
  const [visible, setVisible] = useState(Boolean(copy));

  useEffect(() => {
    if (!copy) return;
    const hide = window.setTimeout(() => setVisible(false), 4200);
    const refresh = [1600, 3800, 7000].map((ms) =>
      window.setTimeout(() => router.refresh(), ms),
    );
    return () => {
      window.clearTimeout(hide);
      refresh.forEach((id) => window.clearTimeout(id));
    };
  }, [copy, router]);

  if (!copy || !visible) return null;

  const green = copy.tone === "green";

  return (
    <div
      role="status"
      className={
        green
          ? "fixed bottom-5 right-5 z-50 max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#C9DDD0] bg-[#E7F1EA] px-3.5 py-3 text-sm text-[#2F5A43] shadow-[0_8px_24px_rgba(30,50,78,0.12)]"
          : "fixed bottom-5 right-5 z-50 max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 shadow-[0_8px_24px_rgba(30,50,78,0.12)]"
      }
    >
      <p className="flex items-center gap-2 font-semibold">
        {green ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden /> : null}
        {copy.title}
      </p>
      <p className={green ? "mt-0.5 text-[13px] leading-snug text-[#3D6A52]" : "mt-0.5 text-[13px] leading-snug"}>
        {copy.body}
      </p>
    </div>
  );
}
