type EnsureResult = {
  demoUserId: string;
  demoCaseIds: string[];
};

/**
 * Opzionale: crea solo l'utente demo se `ITERMED_BOOTSTRAP_DEMO=true`.
 * Non elimina dati esistenti. In produzione lasciare disattivato e usare registrazione utenti.
 */
export async function ensureBootstrapData(): Promise<EnsureResult> {
  const demoUserId = "demo-user";
  const demoCaseIds = ["demo", "cs_001", "cs_002", "cs_003"];

  const { config } = await import("./config");

  if (!config.DATABASE_URL || config.DATABASE_URL.includes("USER:PASSWORD")) {
    return { demoUserId, demoCaseIds };
  }

  if (!config.ITERMED_BOOTSTRAP_DEMO) {
    return { demoUserId, demoCaseIds };
  }

  const { prisma } = await import("./prisma");
  try {
    await prisma.user.upsert({
      where: { id: demoUserId },
      update: {},
      create: {
        id: demoUserId,
        email: "demo@itermed.local",
        name: "Dottore Demo",
        role: "STUDENT",
      },
    });
  } catch {
    return { demoUserId, demoCaseIds };
  }

  return { demoUserId, demoCaseIds };
}
