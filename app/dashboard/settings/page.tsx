import Link from "next/link";
import { Settings } from "lucide-react";
import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { AccountPrivacySettings } from "@/components/settings/AccountPrivacySettings";

export default async function DashboardSettingsPage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      leaderboardOptIn: true,
      leaderboardNameType: true,
      nickname: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true,
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-8">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 text-[#345884]">
          <Settings className="h-4 w-4" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">Account</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#1E324E] md:text-[28px]">
          Impostazioni
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-slate-500">
          Privacy, portabilità dei dati e cancellazione account (GDPR). Documentazione:{" "}
          <Link href="/privacy" className="font-medium text-[#345884] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </header>

      <AccountPrivacySettings
        initialLeaderboardOptIn={user?.leaderboardOptIn ?? false}
        initialLeaderboardNameType={user?.leaderboardNameType ?? "REAL_NAME"}
        initialNickname={user?.nickname ?? null}
        termsAcceptedAt={user?.termsAcceptedAt?.toISOString() ?? null}
        privacyAcceptedAt={user?.privacyAcceptedAt?.toISOString() ?? null}
      />
    </div>
  );
}
