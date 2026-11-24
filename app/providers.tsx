"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { PendingNavProvider } from "@/components/ui/PendingNav";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath="/api/auth">
      <PendingNavProvider>{children}</PendingNavProvider>
    </SessionProvider>
  );
}
