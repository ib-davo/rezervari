import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, FileText, Package, Bus, Settings2 } from "lucide-react";
import PageHero from "@/components/sections/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { CountryFlag, destinationSlugToCode } from "@/components/ui/CountryFlag";
import { destinations, services } from "@/lib/data";
import { countryLandingUrl, cityPageUrl } from "@/lib/utils";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";
import {
  localizeDestinationName,
  localizeCity,
  localizeServiceTitle,
  localizeServiceDescription,
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
    title: t.sitemapPage.metaTitle,
    description: t.sitemapPage.metaDescription,
    alternates: {
      canonical: localePath(lang, "/harta-site"),
      languages: {
        ro: localePath("ro", "/harta-site"),
        ru: localePath("ru", "/harta-site"),
      },
    },
  };
}

export default async function HartaSitePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dict(lang);
  const sp = t.sitemapPage;
  const totalCities = destinations.reduce((acc, d) => acc + d.cities.length, 0);

  return (
    <>
      <PageHero
        eyebrow={sp.eyebrow}
        title={
          <>
            {sp.titleA} <span className="text-[color:var(--red-500)]">{sp.titleB}</span>
          </>
        }
        description={sp.description(destinations.length, totalCities, services.length, sp.mainPages.length + sp.legalPages.length)}
      />

      <section className="py-10">
        <div className="container-page">
          <SectionHeader icon={<FileText className="h-5 w-5" />} title={sp.sectionMain} />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sp.mainPages.map((p, i) => (
              <Reveal key={p.href} delay={i * 0.03}>
                <Link
                  href={localePath(lang, p.href)}
                  className="group flex h-full items-start justify-between gap-4 rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--red-400)] hover:shadow-[0_14px_30px_-18px_rgba(11,38,83,0.4)]"
                >
                  <div>
                    <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                      {p.label}
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--ink-500)] leading-snug">{p.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink-300,rgba(11,38,83,0.28))] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--red-500)]" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 bg-[color:var(--ink-50)]">
        <div className="container-page">
          <SectionHeader icon={<Settings2 className="h-5 w-5" />} title={sp.sectionServices} />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.03}>
                <Link
                  href={localePath(lang, `/serviciile-noastre/${s.slug}`)}
                  className="group flex h-full items-start justify-between gap-4 rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--red-400)] hover:shadow-[0_14px_30px_-18px_rgba(11,38,83,0.4)]"
                >
                  <div>
                    <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                      {localizeServiceTitle(s.slug, lang, s.title)}
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--ink-500)] leading-snug line-clamp-2">
                      {localizeServiceDescription(s.slug, lang, s.description)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--ink-300,rgba(11,38,83,0.28))] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--red-500)]" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="container-page">
          <SectionHeader icon={<Bus className="h-5 w-5" />} title={sp.sectionDestinations} />
          <p className="mt-2 text-sm text-[color:var(--ink-500)]">{sp.destinationsHint}</p>
          <div className="mt-6 space-y-6">
            {destinations.map((d, i) => {
              const code = destinationSlugToCode[d.slug];
              const dName = localizeDestinationName(d.slug, lang, d.name);
              return (
                <Reveal key={d.slug} delay={i * 0.05}>
                  <article className="rounded-3xl border border-[color:var(--ink-200)] bg-white overflow-hidden">
                    <Link
                      href={localePath(lang, countryLandingUrl(d))}
                      className="group flex items-center justify-between gap-4 p-5 md:p-6 border-b border-[color:var(--ink-100)] transition-colors hover:bg-[color:var(--ink-50)]"
                    >
                      <div className="flex items-center gap-4">
                        {code && <CountryFlag code={code} className="h-9 w-12 md:h-11 md:w-16" />}
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--ink-500)]">
                            {sp.moldovaTo(dName)}
                          </div>
                          <h3 className="display-hero text-xl md:text-2xl text-[color:var(--navy-900)] mt-1">
                            {dName}
                          </h3>
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-1.5 text-xs text-[color:var(--ink-500)]">
                        <MapPin className="h-3.5 w-3.5" />
                        {sp.citiesCount(d.cities.length)}
                      </div>
                    </Link>

                    <ul className="grid gap-x-4 gap-y-2 p-5 md:p-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {d.cities.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={localePath(lang, cityPageUrl(c, d))}
                            className="block py-1.5 text-sm text-[color:var(--ink-700)] transition-colors hover:text-[color:var(--red-500)]"
                          >
                            {localizeCity(c.name, lang)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-10 bg-[color:var(--ink-50)]">
        <div className="container-page">
          <SectionHeader icon={<Package className="h-5 w-5" />} title={sp.sectionLegal} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sp.legalPages.map((p, i) => (
              <Reveal key={p.href} delay={i * 0.03}>
                <Link
                  href={localePath(lang, p.href)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-3 transition-all hover:border-[color:var(--red-400)]"
                >
                  <span className="text-sm font-semibold text-[color:var(--navy-900)]">{p.label}</span>
                  <ChevronRight className="h-4 w-4 text-[color:var(--ink-300,rgba(11,38,83,0.28))] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--red-500)]" />
                </Link>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 text-xs text-[color:var(--ink-500)]">
            {sp.crawlerHint}{" "}
            <a href="/sitemap.xml" className="underline hover:text-[color:var(--red-500)]">sitemap.xml</a>
            {" · "}
            <a href="/robots.txt" className="underline hover:text-[color:var(--red-500)]">robots.txt</a>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--red-500)]/10 text-[color:var(--red-500)]">
        {icon}
      </span>
      <h2 className="display-hero text-2xl md:text-3xl text-[color:var(--navy-900)]">{title}</h2>
    </div>
  );
}
