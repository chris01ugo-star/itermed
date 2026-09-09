import type { ReactNode } from "react";

type PrassiLayoutProps = {
  children: ReactNode;
};

/**
 * Passthrough: listing shell lives on the page so `/play/[id]` is not blocked
 * by Prisma case loading in the layout.
 */
export default function PrassiLayout({ children }: PrassiLayoutProps) {
  return children;
}
