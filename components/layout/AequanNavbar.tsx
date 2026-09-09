"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AequanLogo } from "@/components/AequanLogo";
import { cn } from "@/app/utils/cn";

type NavLink = { href: string; label: string };

const DEFAULT_NAV: NavLink[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/prassi", label: "Casi Clinici" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/demo", label: "Demo UI" },
];

type AequanNavbarProps = {
  className?: string;
  navLinks?: NavLink[];
  trailing?: ReactNode;
  sticky?: boolean;
};

/**
 * Sticky AEQUAN header — panel-bg, subtle border, brand-primary navigation.
 */
export function AequanNavbar({
  className,
  navLinks = DEFAULT_NAV,
  trailing,
  sticky = true,
}: AequanNavbarProps) {
  return (
    <header
      className={cn(
        "z-[100] flex min-h-24 items-center justify-between gap-6 border-b border-border bg-panel-bg px-4 py-3 md:px-6 shadow-clinical",
        sticky && "sticky top-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-8">
        <Link href="/dashboard" className="aequan-interactive hover:opacity-90 shrink-0">
          <AequanLogo height={65} />
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="aequan-interactive rounded-aequan px-3 py-1.5 text-sm font-medium text-text-primary hover:text-brand-primary hover:bg-ui-bg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {trailing ? <div className="flex items-center gap-2 shrink-0">{trailing}</div> : null}
    </header>
  );
}
