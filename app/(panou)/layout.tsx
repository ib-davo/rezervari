import type { Metadata, Viewport } from "next";

// Panoul e instalat pe telefoanele operatorilor ca aplicație („Adaugă pe ecranul
// principal"). Fără manifest, iconița era doar un shortcut de browser: după ce
// biletul deschidea davo.md, aplicația rămânea parcată pe site-ul public, fără
// drum înapoi spre panou. Manifestul îi dă identitate proprie și, mai important,
// `scope`/`start_url` pe /panou — orice link din afara panoului se deschide
// într-o fereastră separată de browser, iar iconița pornește mereu la /panou.
export const metadata: Metadata = {
  title: {
    default: "DAVO · Panou operatori",
    template: "%s · DAVO Operatori",
  },
  applicationName: "DAVO Operatori",
  manifest: "/panou.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DAVO Operatori",
    statusBarStyle: "default",
  },
  // Panou intern — nu are ce căuta în Google (ecranul de login e public).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b2653",
};

export default function PanouRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
