import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ColetLaCheieClient from "./ColetLaCheieClient";
import { COLET_LA_CHEIE_LAUNCHED } from "@/lib/coletProducts";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dict(lang);
  return {
    title: t.coletLaCheiePage.metaTitle,
    description: t.coletLaCheiePage.metaDescription,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
    alternates: {
      canonical: localePath(lang, "/colet-la-cheie"),
      languages: {
        ro: localePath("ro", "/colet-la-cheie"),
        ru: localePath("ru", "/colet-la-cheie"),
      },
    },
  };
}

export default async function ColetLaCheiePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  // Pagină ascunsă până la lansare.
  if (!COLET_LA_CHEIE_LAUNCHED) {
    // accesibil cu URL direct (noindex/nofollow).
  }
  void searchParams;
  return <ColetLaCheieClient />;
}
