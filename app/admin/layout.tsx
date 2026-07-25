import type { ReactNode } from "react";
import Link from "next/link";
import { AequanLogo } from "../../components/AequanLogo";
import { DashboardSidebar } from "../../components/dashboard/DashboardSidebar";
import { TopBar } from "../../components/dashboard/TopBar";
import { fetchMedicalSpecialtyOptionsCached } from "../../lib/dashboard-queries";
import { buildSsmSpecialtyLinks } from "../../lib/ssm-specialties";
import { requireAdmin } from "../../lib/require-user";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const label = user.name || user.email || "Admin";

  let ssmSpecialties = buildSsmSpecialtyLinks([]);
  try {
    const dbSpecialties = await fetchMedicalSpecialtyOptionsCached();
    ssmSpecialties = buildSsmSpecialtyLinks(dbSpecialties);
  } catch {
    // Fallback to canonical SSM list without DB ids.
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#F4F6F8] text-text-primary">
      <DashboardSidebar userLabel={label} isAdmin ssmSpecialties={ssmSpecialties} />
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar userLabel={label} />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
          {children}
        </main>
      </div>

      {/* Logo centered relative to the full page width, independent of the sidebar.
          The admin topbar always shows its search bar, so nudge the logo a bit
          further right to keep clear of it. */}
      <Link
        href="/dashboard"
        aria-label="Vai alla dashboard"
        className="pointer-events-auto absolute left-1/2 top-0 z-20 flex h-16 items-center"
        style={{ transform: "translateX(calc(-50% + 28px))" }}
      >
        <AequanLogo height={28} />
      </Link>
    </div>
  );
}
