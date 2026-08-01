import Link from "next/link";
import { ContactEmail } from "@/components/legal/ContactEmail";

/** Global legal footer — contact, Terms, Privacy, Cookies, AI transparency. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer border-t border-slate-200/80 bg-white/90">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-6 sm:px-6">
        <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
          <p className="text-center text-[11px] text-slate-500 sm:text-left">
            © {year} Aequan · Simulatore formativo medico-legale (solo uso educativo)
          </p>
          <ContactEmail variant="stacked" className="sm:items-end sm:text-right" />
        </div>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px]"
          aria-label="Documenti legali"
        >
          <Link
            href="/terms"
            className="font-medium text-slate-600 underline-offset-2 hover:text-[#1E324E] hover:underline"
          >
            Termini di servizio
          </Link>
          <Link
            href="/privacy"
            className="font-medium text-slate-600 underline-offset-2 hover:text-[#1E324E] hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            href="/cookies"
            className="font-medium text-slate-600 underline-offset-2 hover:text-[#1E324E] hover:underline"
          >
            Cookie Policy
          </Link>
          <Link
            href="/ai-transparency"
            className="font-medium text-slate-600 underline-offset-2 hover:text-[#1E324E] hover:underline"
          >
            Trasparenza AI
          </Link>
        </nav>
      </div>
    </footer>
  );
}
