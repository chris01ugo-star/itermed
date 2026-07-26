import { z } from "zod";

/** Next.js loads `.env` in the app process; this covers scripts/edge cases when cwd differs. */
function bootstrapEnvFromDisk(): void {
  if (typeof window !== "undefined") return;

  try {
    // Dynamic require keeps `node:fs` out of any accidental client bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require("dotenv") as typeof import("dotenv");

    const candidateFiles = [
      path.resolve(process.cwd(), ".env.local"),
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "itermed", ".env.local"),
      path.resolve(process.cwd(), "itermed", ".env"),
    ];

    for (const file of candidateFiles) {
      if (!existsSync(file)) continue;
      dotenv.config({ path: file });
      if (process.env.DATABASE_URL && process.env.OPENAI_API_KEY) {
        return;
      }
    }
  } catch {
    // Non-fatal: Next.js may already have injected env vars.
  }
}

bootstrapEnvFromDisk();

const normalizedEnv = {
  ...process.env,
  // Prefer Neon pooled URLs (Vercel Neon / DATABASE_POOL_URL) for runtime Prisma.
  DATABASE_URL:
    process.env.DATABASE_POOL_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY,
};

/** Dev-only placeholder — rejected in production by Zod superRefine. */
const DEV_AUTH_SECRET_PLACEHOLDER = "itermed-dev-secret-set-NEXTAUTH_SECRET-for-production";
const DEV_APP_URL_FALLBACK = "http://localhost:3000";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    PINECONE_API_KEY: z.string().min(1).optional(),
    PINECONE_INDEX: z.string().min(1).optional(),
    NEXTAUTH_SECRET: z.string().min(1).optional(),
    AUTH_SECRET: z.string().min(1).optional(),
    NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),
    NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    /** Dev-only convenience: auto-authenticate every request as an admin mock user.
     *  Defaults to enabled in development; set to "false" to exercise the real
     *  login/logout flow locally (e.g. while testing auth changes). */
    DEV_AUTH_BYPASS: z
      .string()
      .optional()
      .transform((value) => value !== "false"),
    ITERMED_BOOTSTRAP_DEMO: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    STRIPE_PRICE_STUDENT: z.string().min(1).optional(),
    STRIPE_PRICE_PREMIUM: z.string().min(1).optional(),
    STRIPE_BUNDLE_PRICES: z
      .string()
      .optional()
      .transform((raw) => {
        if (!raw?.trim()) return {} as Record<string, string>;
        try {
          const parsed = JSON.parse(raw) as Record<string, string>;
          return parsed ?? {};
        } catch {
          return {} as Record<string, string>;
        }
      }),
  })
  .superRefine((data, ctx) => {
    const hasApiKey = Boolean(data.PINECONE_API_KEY);
    const hasIndex = Boolean(data.PINECONE_INDEX);

    if (hasApiKey !== hasIndex) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PINECONE_API_KEY and PINECONE_INDEX must both be set or both omitted",
        path: ["PINECONE_API_KEY"],
      });
    }

    // Production: zero soft-fallback on auth secrets and public URLs.
    if (data.NODE_ENV !== "production") return;

    const authSecret = data.NEXTAUTH_SECRET ?? data.AUTH_SECRET;
    if (!authSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "NEXTAUTH_SECRET (or AUTH_SECRET) is required in production — set it in Vercel env vars",
        path: ["NEXTAUTH_SECRET"],
      });
    } else if (authSecret === DEV_AUTH_SECRET_PLACEHOLDER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "NEXTAUTH_SECRET must not use the development placeholder in production",
        path: ["NEXTAUTH_SECRET"],
      });
    }

    if (!data.NEXT_PUBLIC_APP_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NEXT_PUBLIC_APP_URL is required in production (valid public app URL)",
        path: ["NEXT_PUBLIC_APP_URL"],
      });
    }

    if (!data.NEXTAUTH_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NEXTAUTH_URL is required in production (valid public app URL)",
        path: ["NEXTAUTH_URL"],
      });
    }
  });

/**
 * Fully validated, typed application configuration loaded from environment variables.
 * In development, invalid env never crashes the app — returns a soft fallback instead.
 * In production, missing auth secrets / public URLs fail fast (no hardcoded fallbacks).
 */
function buildConfigFromParsed(env: z.infer<typeof envSchema>) {
  const pineconeConfigured = Boolean(env.PINECONE_API_KEY && env.PINECONE_INDEX);
  const isProduction = env.NODE_ENV === "production";

  const authSecret = env.NEXTAUTH_SECRET ?? env.AUTH_SECRET;
  if (isProduction && !authSecret) {
    // Defensive: superRefine should already have rejected this.
    throw new Error("NEXTAUTH_SECRET (or AUTH_SECRET) is required in production");
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  if (isProduction && !appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }

  const nextAuthUrl = env.NEXTAUTH_URL;
  if (isProduction && !nextAuthUrl) {
    throw new Error("NEXTAUTH_URL is required in production");
  }

  return {
    NODE_ENV: env.NODE_ENV,
    DATABASE_URL: env.DATABASE_URL,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    PINECONE_API_KEY: env.PINECONE_API_KEY,
    PINECONE_INDEX: env.PINECONE_INDEX,
    AUTH_SECRET: authSecret ?? DEV_AUTH_SECRET_PLACEHOLDER,
    NEXTAUTH_URL: nextAuthUrl ?? appUrl ?? DEV_APP_URL_FALLBACK,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    isGoogleAuthConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    DEV_AUTH_BYPASS: env.DEV_AUTH_BYPASS,
    ITERMED_BOOTSTRAP_DEMO: env.ITERMED_BOOTSTRAP_DEMO,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_PRICE_STUDENT: env.STRIPE_PRICE_STUDENT,
    STRIPE_PRICE_PREMIUM: env.STRIPE_PRICE_PREMIUM,
    STRIPE_BUNDLE_PRICES: env.STRIPE_BUNDLE_PRICES,
    APP_URL: appUrl ?? DEV_APP_URL_FALLBACK,
    isDevelopment: env.NODE_ENV === "development",
    isProduction,
    isTest: env.NODE_ENV === "test",
    isPineconeConfigured: pineconeConfigured,
    isStripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
  } as const;
}

function loadDevFallbackConfig(
  envInput: Record<string, string | undefined>,
  details: Array<{ path: string; message: string; code: string }>,
) {
  console.warn(
    "⚠️ [itermed/config] Warning: alcune variabili d'ambiente non sono configurate correttamente.",
  );
  console.warn(
    "⚠️ Il blocco è disattivato in modalità Sviluppo — l'app continuerà con un fallback parziale.",
  );
  console.warn(JSON.stringify(details, null, 2));

  const dbUrl =
    (envInput.DATABASE_URL && envInput.DATABASE_URL.trim()) ||
    "postgresql://localhost:5432/itermed_dev";
  const openaiKey =
    (envInput.OPENAI_API_KEY && envInput.OPENAI_API_KEY.trim()) || "sk-dev-placeholder";

  let appUrl = DEV_APP_URL_FALLBACK;
  if (envInput.NEXT_PUBLIC_APP_URL?.trim()) {
    try {
      // eslint-disable-next-line no-new
      new URL(envInput.NEXT_PUBLIC_APP_URL.trim());
      appUrl = envInput.NEXT_PUBLIC_APP_URL.trim();
    } catch {
      // keep localhost default
    }
  }

  let nextAuthUrl = appUrl;
  if (envInput.NEXTAUTH_URL?.trim()) {
    try {
      // eslint-disable-next-line no-new
      new URL(envInput.NEXTAUTH_URL.trim());
      nextAuthUrl = envInput.NEXTAUTH_URL.trim();
    } catch {
      // keep appUrl default
    }
  }

  const pineconeKey = envInput.PINECONE_API_KEY?.trim() || undefined;
  const pineconeIndex = envInput.PINECONE_INDEX?.trim() || undefined;
  const pineconeOk = Boolean(pineconeKey && pineconeIndex);

  return {
    NODE_ENV: "development" as const,
    DATABASE_URL: dbUrl,
    OPENAI_API_KEY: openaiKey,
    PINECONE_API_KEY: pineconeOk ? pineconeKey : undefined,
    PINECONE_INDEX: pineconeOk ? pineconeIndex : undefined,
    AUTH_SECRET:
      envInput.NEXTAUTH_SECRET?.trim() ||
      envInput.AUTH_SECRET?.trim() ||
      DEV_AUTH_SECRET_PLACEHOLDER,
    NEXTAUTH_URL: nextAuthUrl,
    GOOGLE_CLIENT_ID: envInput.GOOGLE_CLIENT_ID?.trim() || undefined,
    GOOGLE_CLIENT_SECRET: envInput.GOOGLE_CLIENT_SECRET?.trim() || undefined,
    isGoogleAuthConfigured: Boolean(
      envInput.GOOGLE_CLIENT_ID?.trim() && envInput.GOOGLE_CLIENT_SECRET?.trim(),
    ),
    DEV_AUTH_BYPASS: envInput.DEV_AUTH_BYPASS !== "false",
    ITERMED_BOOTSTRAP_DEMO: envInput.ITERMED_BOOTSTRAP_DEMO === "true",
    STRIPE_SECRET_KEY: envInput.STRIPE_SECRET_KEY?.trim() || undefined,
    STRIPE_WEBHOOK_SECRET: envInput.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      envInput.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || undefined,
    STRIPE_PRICE_STUDENT: envInput.STRIPE_PRICE_STUDENT?.trim() || undefined,
    STRIPE_PRICE_PREMIUM: envInput.STRIPE_PRICE_PREMIUM?.trim() || undefined,
    STRIPE_BUNDLE_PRICES: {} as Record<string, string>,
    APP_URL: appUrl,
    isDevelopment: true,
    isProduction: false,
    isTest: false,
    isPineconeConfigured: pineconeOk,
    isStripeConfigured: Boolean(envInput.STRIPE_SECRET_KEY?.trim()),
  } as const;
}

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const envInput: Record<string, string | undefined> = {
    ...normalizedEnv,
    NODE_ENV: nodeEnv,
  };

  // Coerce empty optional strings → undefined (avoids Zod min(1) failures on "").
  for (const key of Object.keys(envInput)) {
    if (envInput[key] === "") {
      delete envInput[key];
    }
  }

  // Dev: ignore partial Pinecone config (RAG works without vector search).
  if (nodeEnv === "development") {
    const hasPineconeKey = Boolean(envInput.PINECONE_API_KEY);
    const hasPineconeIndex = Boolean(envInput.PINECONE_INDEX);
    if (hasPineconeKey !== hasPineconeIndex) {
      console.warn(
        "[itermed/config] DEV: Pinecone env incomplete — disabling vector RAG for this session.",
      );
      delete envInput.PINECONE_API_KEY;
      delete envInput.PINECONE_INDEX;
    }
  }

  const parsed = envSchema.safeParse(envInput);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "env",
      message: issue.message,
      code: issue.code,
    }));

    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║  ITERMED — Invalid environment configuration             ║");
    console.error("╚══════════════════════════════════════════════════════════╝");
    console.error(JSON.stringify(details, null, 2));

    // Development / local: never block the app — return soft fallback.
    if (nodeEnv === "development" || nodeEnv === "test") {
      return loadDevFallbackConfig(envInput, details);
    }

    console.error("\nFix: set these in Vercel Production env (or `.env.local` for local prod builds):");
    console.error("  DATABASE_URL=postgresql://...-pooler...");
    console.error("  OPENAI_API_KEY=sk-...");
    console.error("  NEXTAUTH_SECRET=<openssl rand -base64 32>");
    console.error("  NEXTAUTH_URL=https://your-app.vercel.app");
    console.error("  NEXT_PUBLIC_APP_URL=https://your-app.vercel.app\n");

    throw new Error(
      "Variabili .env mancanti: " + JSON.stringify(details, null, 2),
    );
  }

  return buildConfigFromParsed(parsed.data);
}

export type AppConfig = ReturnType<typeof loadConfig>;

/** Singleton configuration object — validated once at module load. */
export const config: AppConfig = loadConfig();
