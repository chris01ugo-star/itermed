"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/legal/SiteFooter";

/** Hide the global legal footer on immersive simulator routes (links live in the sim bar). */
export function ConditionalSiteFooter() {
  const pathname = usePathname() ?? "";
  const hide =
    /\/dashboard\/prassi\/play\//.test(pathname) ||
    pathname.startsWith("/dashboard/simulator");

  if (hide) return null;
  return <SiteFooter />;
}
