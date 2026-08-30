"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  LayoutDashboard,
  Settings,
  Trophy,
  Users,
  TestTubeDiagonal,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { initialsFromLabel } from "@/lib/avatar-initials";
import type { SsmSpecialtyLink } from "@/lib/ssm-specialties";
import { cn } from "@/app/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefixes?: string[];
  /** Paths that must NOT activate this item (e.g. case creation under /cases). */
  excludePathPrefixes?: string[];
};

type DashboardSidebarProps = {
  userLabel: string;
  isAdmin: boolean;
  /** Dario / Chris only — platform ops nav. */
  isPlatformAdmin?: boolean;
  /** @deprecated Kept for call-site compatibility; Reparti SSM removed from UI. */
  ssmSpecialties?: SsmSpecialtyLink[];
};

const CREATE_CASE_HREF = "/dashboard/cases/create";

/** Case-creation routes — highlight Crea Caso, not Casi Clinici. */
function isCaseCreationPath(pathname: string): boolean {
  return (
    pathname === CREATE_CASE_HREF ||
    pathname.startsWith(`${CREATE_CASE_HREF}/`) ||
    pathname === "/dashboard/cases/new" ||
    pathname.startsWith("/dashboard/cases/new/") ||
    pathname === "/dashboard/prassi/create" ||
    pathname.startsWith("/dashboard/prassi/create/")
  );
}

const primaryNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  {
    href: "/dashboard/prassi",
    label: "Casi Clinici",
    icon: Activity,
    matchPrefixes: ["/dashboard/prassi", "/dashboard/cases", "/dashboard/simulator"],
    excludePathPrefixes: [
      "/dashboard/cases/create",
      "/dashboard/cases/new",
      "/dashboard/prassi/create",
    ],
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: Trophy,
    matchPrefixes: ["/dashboard/analytics", "/dashboard/classifiche", "/dashboard/statistics"],
  },
  {
    href: "/dashboard/guidelines",
    label: "Linee Guida",
    icon: BookOpen,
    matchPrefixes: ["/dashboard/guidelines", "/admin/knowledge"],
  },
];

const adminNavItems: NavItem[] = [
  { href: "/admin/users", label: "Utenti", icon: Users },
  { href: "/admin/exams", label: "Valori esami", icon: TestTubeDiagonal },
];

const platformAdminNavItems: NavItem[] = [
  { href: "/admin/platform", label: "Piattaforma", icon: BarChart3 },
];

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/dashboard") {
    return pathname === "/dashboard";
  }

  const excluded = item.excludePathPrefixes?.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (excluded || (item.href === "/dashboard/prassi" && isCaseCreationPath(pathname))) {
    return false;
  }

  const prefixes = item.matchPrefixes ?? [item.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = isNavItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-[13px] font-medium transition-colors",
        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
        isActive
          ? "bg-[#345884]/[0.1] text-[#1E324E]"
          : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-800",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && !collapsed ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#345884]"
          aria-hidden
        />
      ) : null}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive ? "text-[#345884]" : "text-slate-400 group-hover:text-slate-600",
        )}
        strokeWidth={1.75}
      />
      {collapsed ? null : <span className="min-w-0 truncate">{item.label}</span>}
    </Link>
  );
}

export function DashboardSidebar({
  userLabel,
  isAdmin,
  isPlatformAdmin = false,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const isCreateActive = isCaseCreationPath(pathname);
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200",
        collapsed ? "w-[4.75rem]" : "w-60",
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Espandi barra laterale" : "Comprimi barra laterale"}
        className="absolute -right-3.5 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#345884]/25 bg-white text-[#345884] shadow-[0_2px_10px_rgba(30,50,78,0.18)] transition hover:scale-105 hover:border-[#345884] hover:bg-[#EEF2F9] hover:shadow-[0_4px_14px_rgba(30,50,78,0.22)]"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
        ) : (
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
        )}
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-3">
          <Link
            href={CREATE_CASE_HREF}
            title={collapsed ? "Crea Caso" : undefined}
            aria-current={isCreateActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E324E] text-[13px] font-semibold text-white transition hover:bg-[#345884]",
              collapsed ? "h-10 w-10 px-0" : "h-10 w-full px-3",
              isCreateActive && "ring-2 ring-[#345884]/25 ring-offset-2 ring-offset-white",
            )}
          >
            <FilePlus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {collapsed ? null : <span>Crea Caso</span>}
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          {!collapsed ? (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Menu
            </p>
          ) : null}
          <nav className="space-y-1" aria-label="Navigazione principale">
            {primaryNavItems.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>

          {isAdmin ? (
            <>
              <div className={cn("mx-2 border-t border-slate-100", collapsed ? "my-3" : "my-4")} />
              {!collapsed ? (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Admin
                </p>
              ) : null}
              <nav className="space-y-1" aria-label="Navigazione amministratore">
                {(isPlatformAdmin ? platformAdminNavItems : [])
                  .concat(adminNavItems)
                  .map((item) => (
                    <NavLink key={item.href} item={item} collapsed={collapsed} />
                  ))}
              </nav>
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-100 p-2.5">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2F9] text-[12px] font-semibold text-[#345884]"
              title={userLabel}
            >
              {initialsFromLabel(userLabel)}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <Link
              href="/dashboard/settings"
              title="Impostazioni"
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-[#345884]"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <SignOutButton iconOnly />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50/80 px-2.5 py-2.5">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2F9] text-[12px] font-semibold text-[#345884]">
                {initialsFromLabel(userLabel)}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800" title={userLabel}>
                  {userLabel}
                </p>
                <Link
                  href="/dashboard/profile"
                  className="text-[11px] text-slate-400 transition hover:text-[#345884]"
                >
                  Profilo
                </Link>
              </div>
              <Link
                href="/dashboard/settings"
                className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-[#345884]"
                aria-label="Impostazioni"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </div>
            <div className="flex items-center justify-between px-1">
              <nav className="flex gap-x-3 text-[11px] text-slate-400" aria-label="Documenti legali">
                <Link href="/terms" className="transition hover:text-[#345884]">
                  Termini
                </Link>
                <Link href="/privacy" className="transition hover:text-[#345884]">
                  Privacy
                </Link>
              </nav>
              <SignOutButton />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
