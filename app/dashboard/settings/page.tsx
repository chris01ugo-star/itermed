import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { requireUser } from "../../../lib/require-user";
import { prisma } from "../../../lib/prisma";
import { AccountPrivacySettings } from "@/components/settings/AccountPrivacySettings";
import Link from "next/link";

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
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="text-sm text-zinc-400">
          Privacy, portabilità dei dati e cancellazione account (GDPR).
        </p>
      </header>

      <Card className="bg-white/80 border-zinc-200/80">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-950">
            Privacy & diritti dell&apos;interessato
          </CardTitle>
          <CardDescription>
            Controlli Art. 7 (consenso leaderboard), Art. 20 (portabilità) e Art. 17
            (oblio). Documentazione:{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountPrivacySettings
            initialLeaderboardOptIn={user?.leaderboardOptIn ?? false}
            initialLeaderboardNameType={user?.leaderboardNameType ?? "REAL_NAME"}
            initialNickname={user?.nickname ?? null}
          />
          <p className="mt-4 text-[11px] text-zinc-500">
            Termini accettati:{" "}
            {user?.termsAcceptedAt
              ? user.termsAcceptedAt.toLocaleString("it-IT")
              : "non registrato"}{" "}
            · Privacy accettata:{" "}
            {user?.privacyAcceptedAt
              ? user.privacyAcceptedAt.toLocaleString("it-IT")
              : "non registrato"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
