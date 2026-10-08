"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/app/ui/button";

export const COOKIE_CONSENT_STORAGE_KEY = "aequan_cookie_consent";

export type AequanCookieConsent = {
  analytics: boolean;
  /** ISO-8601. JSON non serializza un oggetto Date. */
  timestamp: string;
};

export function parseCookieConsent(raw: string | null): AequanCookieConsent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const record = value as { analytics?: unknown; timestamp?: unknown };
    if (typeof record.analytics !== "boolean") return null;
    if (typeof record.timestamp !== "string" || Number.isNaN(Date.parse(record.timestamp))) {
      return null;
    }
    return { analytics: record.analytics, timestamp: record.timestamp };
  } catch {
    return null;
  }
}

function readStoredConsent(): AequanCookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCookieConsent(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeConsent(analytics: boolean) {
  const record: AequanCookieConsent = {
    analytics,
    timestamp: new Date().toISOString(),
  };
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readStoredConsent() == null);
  }, []);

  function choose(analytics: boolean) {
    try {
      storeConsent(analytics);
    } catch {
      // Se lo storage è bloccato, chiudiamo comunque il banner in questa visita.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-8px_30px_rgba(30,50,78,0.08)] sm:px-6">
      <div
        role="region"
        aria-label="Consenso cookie"
        className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm leading-relaxed text-slate-800">
          Aequan utilizza cookie essenziali per il funzionamento della piattaforma e, previo tuo
          consenso, cookie analitici per migliorare l&apos;esperienza didattica. Consulta la{" "}
          <Link
            href="/cookies"
            className="font-medium text-[#1E324E] underline-offset-2 hover:underline"
          >
            Cookie Policy
          </Link>{" "}
          per i dettagli.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => choose(false)}>
            Solo necessari
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={() => choose(true)}>
            Accetta tutti
          </Button>
        </div>
      </div>
    </div>
  );
}
