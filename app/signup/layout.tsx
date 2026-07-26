import type { ReactNode } from "react";

/** Full-bleed auth layout — marks the tree so the global site footer stays hidden. */
export default function SignupLayout({ children }: { children: ReactNode }) {
  return <div data-auth-fullscreen>{children}</div>;
}
