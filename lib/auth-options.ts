import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: config.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const valid = await compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
    // Only registered when both env vars are configured — keeps credentials-only
    // deployments (and local dev without Google Cloud setup) working untouched.
    ...(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: config.GOOGLE_CLIENT_ID,
            clientSecret: config.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google users don't go through the credentials `authorize()` flow above,
      // so we upsert the local User row here (no passwordHash — OAuth-only account).
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;
        const acceptedAt = new Date();
        const existing = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            termsAcceptedAt: true,
            privacyAcceptedAt: true,
          },
        });

        if (existing) {
          await prisma.user.update({
            where: { email },
            data: {
              name: user.name ?? undefined,
              // Backfill legal acceptance once for legacy Google accounts.
              ...(!existing.termsAcceptedAt ? { termsAcceptedAt: acceptedAt } : {}),
              ...(!existing.privacyAcceptedAt ? { privacyAcceptedAt: acceptedAt } : {}),
            },
          });
        } else {
          await prisma.user.create({
            data: {
              email,
              name: user.name ?? undefined,
              leaderboardOptIn: false,
              termsAcceptedAt: acceptedAt,
              privacyAcceptedAt: acceptedAt,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }

      // For Google sign-ins, `user.id` is the provider's own id, not our DB id —
      // resolve it via email so the rest of the app (roles, ownership checks) is consistent.
      if (account?.provider === "google" && token.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: String(token.email).toLowerCase() },
            select: { id: true, role: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } catch {
          // Keep whatever we already have if the DB is temporarily unavailable.
        }
      }

      if (!token.id && token.sub) {
        token.id = token.sub;
      }

      // Re-read role from DB so promotions (e.g. STUDENT → ADMIN) apply without re-login.
      // If the user was erased (Art. 17), invalidate the JWT.
      const userId = typeof token.id === "string" ? token.id : null;
      if (userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          if (!dbUser) {
            return {};
          }
          if (dbUser.role) {
            token.role = dbUser.role;
          }
        } catch {
          // Keep token.role if DB is temporarily unavailable.
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
        session.user.role = (token.role as string) ?? "STUDENT";
      }
      return session;
    },
  },
};
