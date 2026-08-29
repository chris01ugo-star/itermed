import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ConditionalSiteFooter } from "@/components/legal/ConditionalSiteFooter";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AEQUAN · Medical-Legal Training Simulator",
  description:
    "AEQUAN è una piattaforma di simulazione clinica e medico-legale per studenti e specialisti, con valutazione Gelli-Bianco, appropriatezza prescrittiva, sostenibilità SSN ed empatia.",
  // Explicit icons so browsers that hard-request /favicon.ico (and cache it) pick Aequan, not a stale default.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="light" style={{ colorScheme: "light" }}>
      <body
        className={`${inter.variable} ${plusJakarta.variable} antialiased bg-[#F4F6F8] text-text-primary font-sans`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <ConditionalSiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
