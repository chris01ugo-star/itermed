import type { ReactNode } from "react";
import { DashboardChrome } from "../../components/dashboard/DashboardChrome";
import { fetchMedicalSpecialtyOptionsCached } from "../../lib/dashboard-queries";
import { buildSsmSpecialtyLinks } from "../../lib/ssm-specialties";
import { requireUser } from "../../lib/require-user";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await requireUser();
  const label = user.name || user.email || "Account";

  let ssmSpecialties = buildSsmSpecialtyLinks([]);
  try {
    const dbSpecialties = await Promise.race([
      fetchMedicalSpecialtyOptionsCached(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("specialty lookup timed out")), 800);
      }),
    ]);
    ssmSpecialties = buildSsmSpecialtyLinks(dbSpecialties);
  } catch {
    // Fallback to canonical SSM list without DB ids.
  }

  return (
    <DashboardChrome userLabel={label} isAdmin={user.role === "ADMIN"} ssmSpecialties={ssmSpecialties}>
      {children}
    </DashboardChrome>
  );
}
