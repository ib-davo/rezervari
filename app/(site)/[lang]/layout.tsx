import { notFound } from "next/navigation";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WhatsAppFab from "@/components/layout/WhatsAppFab";
import { isLocale, locales } from "@/lib/i18n";
import { GeoProvider } from "@/components/geo/GeoProvider";
import { getGeoSafe } from "@/lib/geo";

// Orașele din picker-e vin din DB (davo.md/admin → Orașe); paginile statice se
// regenerează cel mult la un minut ca să prindă schimbările (= GEO_REVALIDATE_S
// din lib/geo.ts; Next cere aici un literal).
export const revalidate = 60;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const geo = await getGeoSafe();

  return (
    <GeoProvider geo={geo}>
      <Header />
      <main className="min-h-[60vh]" lang={lang}>{children}</main>
      <Footer />
      <WhatsAppFab />
    </GeoProvider>
  );
}
