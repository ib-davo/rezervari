import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Hero from "@/components/sections/Hero";
import ColetBand from "@/components/sections/ColetBand";
import Benefits from "@/components/sections/Benefits";
import DestinationsPick from "@/components/sections/DestinationsPick";
import DiscoverDavo from "@/components/sections/DiscoverDavo";
import FAQ from "@/components/sections/FAQ";
import SocialDavo from "@/components/sections/SocialDavo";
import { isLocale, localePath } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return {
    alternates: {
      canonical: localePath(lang, "/"),
      languages: {
        ro: localePath("ro", "/"),
        ru: localePath("ru", "/"),
        "x-default": localePath("ro", "/"),
      },
    },
    openGraph: {
      locale: lang === "ru" ? "ru_RU" : "ro_MD",
    },
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <>
      <Hero />
      <ColetBand />
      <Benefits />
      <DestinationsPick />
      <DiscoverDavo />
      <FAQ />
      <SocialDavo />
    </>
  );
}
