import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import PageHero from "@/components/sections/PageHero";
import CountryCityTabs from "@/components/sections/CountryCityTabs";
import { Reveal } from "@/components/ui/Reveal";
import { destinations } from "@/lib/data";
import { countryLandingUrl } from "@/lib/utils";
import { CountryFlag, destinationSlugToCode } from "@/components/ui/CountryFlag";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";
import {
  localizeDestinationName,
  localizeDestinationDescription,
} from "@/lib/i18n/dataI18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dict(lang);
  return {
    title: t.destinationsIndex.metaTitle,
    description: t.destinationsIndex.metaDescription,
    alternates: {
      canonical: localePath(lang, "/destinatii"),
      languages: {
        ro: localePath("ro", "/destinatii"),
        ru: localePath("ru", "/destinatii"),
      },
    },
  };
}

export default async function DestinatiiPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dict(lang);
  const td = t.destinationsIndex;

  return (
    <>
      <PageHero
        eyebrow={td.eyebrow}
        title={
          <>
            {td.titleA} <span className="text-[color:var(--red-500)]">{td.titleB}</span>
          </>
        }
        description={td.description}
      />

      <section className="py-10">
        <div className="container-page">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d, i) => {
              const code = destinationSlugToCode[d.slug];
              const name = localizeDestinationName(d.slug, lang, d.name);
              const desc = localizeDestinationDescription(d.slug, lang, d.description);
              return (
                <Reveal key={d.slug} delay={i * 0.05}>
                  <Link
                    href={localePath(lang, countryLandingUrl(d))}
                    className="group relative block overflow-hidden rounded-3xl border border-[color:var(--ink-200)] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[color:var(--red-400)] hover:shadow-[0_20px_40px_-20px_rgba(11,38,83,0.4)]"
                  >
                    {code && <CountryFlag code={code} className="h-14 w-20" />}
                    <div className="mt-5">
                      <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--ink-500)]">
                        {td.moldovaTo(name)}
                      </div>
                      <div className="mt-2 display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">
                        {name}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-[color:var(--ink-500)] line-clamp-2">{desc}</p>
                    <div className="mt-5 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-[color:var(--ink-500)] font-bold">
                          {t.common.from}
                        </div>
                        <div className="font-[family-name:var(--font-montserrat)] font-extrabold text-[color:var(--red-500)] text-xl">
                          {d.price || "—"} {d.currency}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[color:var(--ink-500)]">
                        <MapPin className="h-3.5 w-3.5" />
                        {td.citiesCount(d.cities.length)}
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[color:var(--navy-900)]">
                      {td.viewCities}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <CountryCityTabs />
    </>
  );
}
