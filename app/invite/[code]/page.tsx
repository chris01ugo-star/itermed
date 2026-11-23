import { redirect } from "next/navigation";
import { normalizeReferralCode } from "@/lib/billing/referral-code";

type InvitePageProps = {
  params: Promise<{ code: string }> | { code: string };
};

export default async function InvitePage({ params }: InvitePageProps) {
  const resolved = "then" in params ? await params : params;
  const code = normalizeReferralCode(decodeURIComponent(resolved.code ?? ""));
  if (!code) {
    redirect("/dashboard/billing");
  }
  redirect(`/dashboard/billing?ref=${encodeURIComponent(code)}`);
}
