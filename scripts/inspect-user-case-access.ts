/**
 * Read-only inspection of a learner's clinical-case access.
 *
 * There is no User↔ClinicalCase unlock join table. Entitlement is:
 *   - PILOT_ALLOWED_EMAILS → lifetime cap of 3 (university pilot)
 *   - SPONSORED_FREE_CASE emails → lifetime cap of 20
 *   - ADMIN / audit email → unlimited
 *   - CaseSession rows count as consumed simulations (they do not grant access)
 *
 * Usage:
 *   npx tsx scripts/inspect-user-case-access.ts --email=federico.frusone@gmail.com
 *
 * This script never writes to the database.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isPilotAllowedEmail, PILOT_SIMULATION_CAP } from "../lib/pilot-whitelist";
import {
  getSponsoredFreeCaseLimit,
  hasUnlimitedCaseAccess,
  SPONSORED_FREE_CASE_LIMIT,
} from "../lib/billing/unlimited-case-access";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const TARGET_EMAIL = "federico.frusone@gmail.com";
const GRANT_LIMIT = SPONSORED_FREE_CASE_LIMIT;

function flagValue(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is not set. Configure .env.local before running.");
  }

  const rawEmail = flagValue("email") || TARGET_EMAIL;
  const email = rawEmail.toLowerCase().trim();
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        planType: true,
        subscriptionStatus: true,
        freeTrialUsageCount: true,
        purchasedBundleIds: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            email,
            error: "USER_NOT_FOUND",
            message:
              "Nessun User con questa email. Lo sblocco 20 casi è un grant nel codice (email hardcoded), non una riga di join nel DB. Se l'utente non si è ancora registrato, la grant funzionerà al primo login dopo il deploy del codice.",
          },
          null,
          2,
        ),
      );
      return;
    }

    const [lifetimeSessions, activeGlobalCases] = await Promise.all([
      prisma.caseSession.count({ where: { userId: user.id } }),
      prisma.clinicalCase.count({ where: { isActive: true, isGlobal: true } }),
    ]);

    const unlimited = hasUnlimitedCaseAccess({ role: user.role, email: user.email });
    const onPilotList = isPilotAllowedEmail(user.email);
    const sponsoredLimit = getSponsoredFreeCaseLimit(user.email);
    const remainingSponsored =
      sponsoredLimit != null ? Math.max(0, sponsoredLimit - lifetimeSessions) : null;

    const grantWouldWorkInRuntime =
      sponsoredLimit === GRANT_LIMIT &&
      remainingSponsored != null &&
      remainingSponsored > 0 &&
      // Current production gates: whitelist + 3-cap still block sponsored emails.
      // After the proposed code patch, sponsored emails skip the 3-cap.
      true;

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          wroteToDatabase: false,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            planType: user.planType,
            subscriptionStatus: user.subscriptionStatus,
            freeTrialUsageCount: user.freeTrialUsageCount,
            purchasedBundleIds: user.purchasedBundleIds,
            createdAt: user.createdAt,
          },
          usage: {
            lifetimeCaseSessions: lifetimeSessions,
            activeGlobalClinicalCases: activeGlobalCases,
          },
          currentGates: {
            unlimited,
            onUniversityPilotWhitelist: onPilotList,
            universityPilotCap: onPilotList ? PILOT_SIMULATION_CAP : null,
            sponsoredLimit,
            remainingSponsoredGrant: remainingSponsored,
            note: onPilotList
              ? `In runtime attuale questo account è cappato a ${PILOT_SIMULATION_CAP} simulazioni (pilota), non a ${GRANT_LIMIT}.`
              : "In runtime attuale questo account non è in PILOT_ALLOWED_EMAILS: login/start possono essere bloccati anche senza grant sponsored.",
          },
          proposedGrant: {
            email,
            lifetimeSimulations: GRANT_LIMIT,
            alreadyConsumed: lifetimeSessions,
            remainingAfterGrant: Math.max(0, GRANT_LIMIT - lifetimeSessions),
            requiresCodeDeploy: true,
            dbMutationRequired: false,
            grantWouldWorkInRuntime,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
