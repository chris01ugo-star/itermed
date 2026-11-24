"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

type PendingNav = {
  pending: boolean;
  begin: () => void;
  end: () => void;
};

const PendingNavContext = createContext<PendingNav>({
  pending: false,
  begin: () => {},
  end: () => {},
});

export function usePendingNav(): PendingNav {
  return useContext(PendingNavContext);
}

function isInternalAppLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }
  try {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function PendingNavProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const safetyTimer = useRef<number | null>(null);

  const end = useCallback(() => {
    pendingRef.current = false;
    setPending(false);
    if (safetyTimer.current != null) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  const begin = useCallback(() => {
    pendingRef.current = true;
    setPending(true);
    if (safetyTimer.current != null) window.clearTimeout(safetyTimer.current);
    safetyTimer.current = window.setTimeout(() => {
      pendingRef.current = false;
      setPending(false);
    }, 12_000);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!isInternalAppLink(anchor)) return;
      begin();
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [begin]);

  return (
    <PendingNavContext.Provider value={{ pending, begin, end }}>
      {children}
      <Suspense fallback={null}>
        <NavigationRouteListener onRoute={end} />
      </Suspense>
      <NavigationProgress pending={pending} />
    </PendingNavContext.Provider>
  );
}

function NavigationRouteListener({ onRoute }: { onRoute: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onRoute();
  }, [pathname, searchParams, onRoute]);

  return null;
}

function NavigationProgress({ pending }: { pending: boolean }) {
  const [delayElapsed, setDelayElapsed] = useState(false);
  if (!pending && delayElapsed) {
    setDelayElapsed(false);
  }

  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setDelayElapsed(true), 180);
    return () => window.clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  const showOverlay = delayElapsed;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden"
        role="progressbar"
        aria-busy="true"
        aria-label="Caricamento"
      >
        <div className="aequan-nav-progress h-full w-1/3 origin-left bg-[#1E324E] shadow-[0_0_8px_rgba(30,50,78,0.45)]" />
      </div>
      {showOverlay ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-[#F4F6F8]/50 backdrop-blur-[1.5px]">
          <div className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white px-4 py-2.5 shadow-[0_8px_30px_rgba(30,50,78,0.12)]">
            <Spinner className="text-[#1E324E]" />
            <span className="text-sm font-medium text-[#1E324E]">Caricamento…</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
