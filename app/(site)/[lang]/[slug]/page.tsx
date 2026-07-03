import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Phone,
  ShieldCheck,
  Bus,
  Package,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import { contactInfo, destinations } from "@/lib/data";
import {
  CITY_URL_DIAMOND,
  cityPageSlug,
  cityPageUrl,
  countryLandingUrl,
} from "@/lib/utils";
import { CountryFlag, destinationSlugToCode } from "@/components/ui/CountryFlag";
import FAQ from "@/components/sections/FAQ";
import { Reveal } from "@/components/ui/Reveal";
import { getCountrySchedule } from "@/lib/countrySchedule";
import type { City, Destination } from "@/types";
import { isLocale, locales, localePath, type Locale } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";
import {
  localizeDestinationName,
  localizeCity,
} from "@/lib/i18n/dataI18n";
import { buildCountryFaq, buildCityFaq, buildCountryMeta, buildCityMeta } from "@/lib/i18n/destinationFaq";

export const revalidate = 3600;

export async function generateStaticParams() {
  const params: { lang: string; slug: string }[] = [];

  for (const lang of locales) {
    for (const d of destinations) {
      params.push({ lang, slug: d.seoSlug });
      for (const c of d.cities) {
        params.push({
          lang,
          slug: `autocar-chisinau-moldova-${CITY_URL_DIAMOND}-${cityPageSlug(c, d)}`,
        });
      }
    }
  }

  return params;
}

type CountryRoute = { kind: "country"; destination: Destination };
type CityRoute = { kind: "city"; destination: Destination; city: City };
type Route = CountryRoute | CityRoute | null;

function resolveRoute(rawSlug: string): Route {
  const slug = decodeURIComponent(rawSlug);

  const country = destinations.find((d) => d.seoSlug === slug);
  if (country) return { kind: "country", destination: country };

  const cityPrefix = `autocar-chisinau-moldova-${CITY_URL_DIAMOND}-`;
  if (!slug.startsWith(cityPrefix)) return null;

  const tail = slug.slice(cityPrefix.length);
  for (const d of destinations) {
    for (const c of d.cities) {
      if (cityPageSlug(c, d) === tail) {
        return { kind: "city", destination: d, city: c };
      }
    }
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const route = resolveRoute(slug);
  if (!route) return {};

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://davo.md").replace(/\/$/, "");
  const sched = getCountrySchedule(route.destination.slug);

  if (route.kind === "country") {
    const { destination } = route;
    const { title, description } = buildCountryMeta(destination, sched, lang);
    const canonicalPath = localePath(lang, countryLandingUrl(destination));
    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath,
        languages: {
          ro: localePath("ro", countryLandingUrl(destination)),
          ru: localePath("ru", countryLandingUrl(destination)),
        },
      },
      openGraph: {
        title,
        description,
        type: "website",
        url: `${baseUrl}${canonicalPath}`,
        locale: lang === "ru" ? "ru_RU" : "ro_MD",
      },
    };
  }

  const { city, destination } = route;
  const { title, description } = buildCityMeta(city, destination, sched, lang);
  const canonicalPath = localePath(lang, cityPageUrl(city, destination));
  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        ro: localePath("ro", cityPageUrl(city, destination)),
        ru: localePath("ru", cityPageUrl(city, destination)),
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${baseUrl}${canonicalPath}`,
      locale: lang === "ru" ? "ru_RU" : "ro_MD",
    },
  };
}

export default async function SeoSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const route = resolveRoute(slug);
  if (!route) notFound();

  return route.kind === "country" ? (
    <CountryLanding destination={route.destination} locale={lang} />
  ) : (
    <CityPage city={route.city} destination={route.destination} locale={lang} />
  );
}

// ============================================
// Country landing page
// ============================================

function CountryLanding({ destination, locale }: { destination: Destination; locale: Locale }) {
  const t = dict(locale);
  const td = t.destinationPage;
  const code = destinationSlugToCode[destination.slug];
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://davo.md").replace(/\/$/, "");
  const sched = getCountrySchedule(destination.slug);
  const countryUrl = `${baseUrl}${localePath(locale, countryLandingUrl(destination))}`;
  const country = localizeDestinationName(destination.slug, locale, destination.name);

  const travelAgencyLd = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": `${countryUrl}#travelagency`,
    name: `DAVO Group — Transport Moldova ${country}`,
    url: countryUrl,
    telephone: contactInfo.phone,
    email: contactInfo.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calea Ieșilor 11/3",
      addressLocality: "Chișinău",
      addressCountry: "MD",
    },
    description: `${destination.description}. Plecări regulate din Moldova către ${destination.cities.length} orașe din ${destination.name}.`,
    areaServed: destination.cities.map((c) => ({
      "@type": "City",
      name: c.name,
      addressCountry: destination.name,
    })),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: destination.currency === "£" ? "GBP" : "EUR",
      lowPrice: destination.price || "120",
      offerCount: destination.cities.length,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.common.home, item: `${baseUrl}${localePath(locale, "/")}` },
      { "@type": "ListItem", position: 2, name: t.nav.destinations, item: `${baseUrl}${localePath(locale, "/destinatii")}` },
      { "@type": "ListItem", position: 3, name: country, item: countryUrl },
    ],
  };

  const faqItems = buildCountryFaq(destination, sched, locale);
  const faqPageLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(travelAgencyLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }} />

      <section className="relative overflow-hidden bg-hero-navy text-white">
        <div className="bg-noise absolute inset-0 opacity-30" />
        <div className="container-page relative py-16 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[1.2fr,1fr] items-center">
            <Reveal>
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
                {td.transportMoldova(country)}
              </div>
              <h1 className="mt-4 display-hero display-xl text-white">
                {country.toUpperCase()}
              </h1>
              <p className="mt-5 text-lg text-white/70 max-w-xl leading-relaxed">
                {destination.description}. {td.countryHeroDesc(country, destination.cities.length)}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={localePath(locale, `/rezervare?to=${encodeURIComponent(destination.cities[0]?.name || "")}`)}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3.5 font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                >
                  {td.bookTicket} <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-6 py-3.5 font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {contactInfo.phone}
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex items-center justify-center lg:justify-end">
                <div className="relative">
                  {code && <CountryFlag code={code} className="h-36 w-52" />}
                  <div className="absolute -bottom-6 -right-6 rounded-full bg-[color:var(--red-500)] text-white shadow-lg px-5 py-3 text-sm font-bold flex flex-col items-center leading-tight">
                    <span className="text-[10px] uppercase tracking-widest opacity-80">
                      {td.fromPrice("", "").trim() || "de la"}
                    </span>
                    <span className="font-[family-name:var(--font-montserrat)] text-2xl">
                      {destination.price || "—"}
                      {destination.currency}
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[color:var(--ink-50)]">
        <div className="container-page">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display-hero display-md text-[color:var(--navy-900)]">
                {td.citiesAvailable}
              </h2>
              <div className="chip">
                <MapPin className="h-3.5 w-3.5" />
                {td.citiesCountChip(destination.cities.length)}
              </div>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {destination.cities.map((c, i) => (
              <Reveal key={c.id} delay={Math.min(i * 0.015, 0.3)}>
                <Link
                  href={localePath(locale, cityPageUrl(c, destination))}
                  className="group flex items-center justify-between rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-3 transition-all hover:border-[color:var(--red-400)] hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-[color:var(--red-500)] shrink-0" />
                    <span className="font-semibold text-[color:var(--navy-900)] text-sm truncate">
                      {localizeCity(c.name, locale)}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-[color:var(--ink-400)] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--red-500)]" />
                </Link>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <CustomCityCTA destinationName={country} locale={locale} />
          </Reveal>
        </div>
      </section>

      {sched && <ScheduleSection destination={destination} sched={sched} locale={locale} />}

      <section className="py-16">
        <div className="container-page grid gap-5 md:grid-cols-2">
          {[
            { icon: Calendar, k: td.regularTrips, v: sched ? td.weeklyOn(sched.outboundLabel) : td.weeklyOnly },
            { icon: ShieldCheck, k: td.safetyTitle, v: td.safetyDesc },
          ].map((b) => (
            <div key={b.k} className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-6 flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-900)] shrink-0">
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                  {b.k}
                </div>
                <div className="mt-1 text-sm text-[color:var(--ink-500)]">{b.v}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FAQ items={faqItems} title={t.faq.title} />
    </>
  );
}

// ============================================
// City destination page
// ============================================

function CityPage({
  city,
  destination,
  locale,
}: {
  city: City;
  destination: Destination;
  locale: Locale;
}) {
  const t = dict(locale);
  const td = t.destinationPage;
  const code = destinationSlugToCode[destination.slug];
  const otherCities = destination.cities.filter((c) => c.id !== city.id);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://davo.md").replace(/\/$/, "");
  const sched = getCountrySchedule(destination.slug);
  const cityUrl = `${baseUrl}${localePath(locale, cityPageUrl(city, destination))}`;
  const countryUrl = `${baseUrl}${localePath(locale, countryLandingUrl(destination))}`;
  const cityName = localizeCity(city.name, locale);
  const country = localizeDestinationName(destination.slug, locale, destination.name);

  const busTripLd = {
    "@context": "https://schema.org",
    "@type": "BusTrip",
    name: `Autocar Chișinău - ${city.name}, ${destination.name}`,
    description: `Cursă săptămânală din Chișinău către ${city.name}${sched ? `. Plecare ${sched.outboundLabel}, retur ${sched.returnLabel}` : ""}. Autocare moderne cu Internet Starlink nelimitat, prânz gratuit, însoțitoare 24/24.`,
    departureBusStop: {
      "@type": "BusStation",
      name: "Chișinău (Calea Ieșilor 11/3)",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Calea Ieșilor 11/3",
        addressLocality: "Chișinău",
        addressCountry: "MD",
      },
    },
    arrivalBusStop: {
      "@type": "BusStation",
      name: city.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: city.name,
        addressCountry: destination.name,
      },
    },
    provider: {
      "@type": "Organization",
      "@id": `${baseUrl}/#organization`,
      name: "DAVO Group",
      telephone: contactInfo.phone,
      url: baseUrl,
    },
    offers: {
      "@type": "Offer",
      price: destination.price || "120",
      priceCurrency: destination.currency === "£" ? "GBP" : "EUR",
      availability: "https://schema.org/InStock",
      url: `${baseUrl}${localePath(locale, `/rezervare?to=${encodeURIComponent(city.name)}`)}`,
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.common.home, item: `${baseUrl}${localePath(locale, "/")}` },
      { "@type": "ListItem", position: 2, name: t.nav.destinations, item: `${baseUrl}${localePath(locale, "/destinatii")}` },
      { "@type": "ListItem", position: 3, name: country, item: countryUrl },
      { "@type": "ListItem", position: 4, name: cityName, item: cityUrl },
    ],
  };

  const faqItems = buildCityFaq(city, destination, sched, locale);
  const faqPageLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(busTripLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }} />

      <section className="relative overflow-hidden bg-hero-navy text-white">
        <div className="bg-noise absolute inset-0 opacity-30" />
        <div className="container-page relative py-16 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[1.25fr,1fr] items-center">
            <Reveal>
              <Link
                href={localePath(locale, countryLandingUrl(destination))}
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)] hover:text-white transition-colors"
              >
                <ArrowRight className="h-3 w-3 rotate-180" />
                {td.transportMoldova(country)}
              </Link>
              <h1 className="mt-4 display-hero display-xl text-white leading-[0.98]">
                {td.cityHeroTitle}
                <br />
                <span className="text-[color:var(--red-400)]">⇋</span> {cityName}, {country}
              </h1>
              <p className="mt-5 text-lg text-white/70 max-w-xl leading-relaxed">
                {td.cityHeroDescription(cityName)}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={localePath(locale, `/rezervare?to=${encodeURIComponent(city.name)}`)}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3.5 font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                >
                  {td.bookTicketTo(cityName)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={localePath(locale, `/rezervare?mode=colet&to=${encodeURIComponent(city.name)}`)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm px-6 py-3.5 font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <Package className="h-4 w-4" />
                  {td.sendParcel}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative w-full max-w-[440px] mx-auto lg:mr-0 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/15 p-6 md:p-7">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] font-bold text-white/60">
                  <span>{td.directRoute}</span>
                  <span className="inline-flex items-center gap-1.5 text-[color:var(--red-400)]">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inset-0 rounded-full bg-[color:var(--red-500)] animate-ping opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
                    </span>
                    {td.live}
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <CountryFlag code="md" className="h-9 w-14" />
                    <div className="mt-2 text-[10px] uppercase tracking-wider font-bold text-white/55">
                      {td.departure}
                    </div>
                    <div className="mt-0.5 font-[family-name:var(--font-montserrat)] font-extrabold text-white text-lg leading-tight">
                      {localizeCity("Chișinău", locale)}
                    </div>
                    <div className="text-[11px] text-white/55">{locale === "ru" ? "Молдова" : "Moldova"}</div>
                  </div>

                  <div className="shrink-0 flex flex-col items-center text-white/30">
                    <div className="h-px w-10 bg-white/20" />
                    <Bus className="my-1.5 h-4 w-4 text-[color:var(--red-400)]" />
                    <div className="h-px w-10 bg-white/20" />
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    {code && <CountryFlag code={code} className="h-9 w-14 ml-auto" />}
                    <div className="mt-2 text-[10px] uppercase tracking-wider font-bold text-white/55">
                      {td.destination}
                    </div>
                    <div className="mt-0.5 font-[family-name:var(--font-montserrat)] font-extrabold text-white text-lg leading-tight truncate">
                      {cityName}
                    </div>
                    <div className="text-[11px] text-white/55 truncate">{country}</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
                  <JourneyStat icon={Calendar} label={td.frequency} value={td.weekly2to3} />
                  <JourneyStat
                    icon={Bus}
                    label={t.common.from}
                    value={`${destination.price || "—"}${destination.currency}`}
                    accent
                  />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {sched && <ScheduleSection destination={destination} sched={sched} cityName={cityName} locale={locale} />}

      <section className="py-16">
        <div className="container-page grid gap-5 md:grid-cols-2">
          {[
            { icon: Calendar, k: td.regularTrips, v: sched ? td.weeklyOn(sched.outboundLabel) : td.multipleDeparturesPerWeek },
            { icon: ShieldCheck, k: td.doorToDoor, v: td.doorToDoorDesc },
          ].map((b) => (
            <div key={b.k} className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-6 flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-900)] shrink-0">
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                  {b.k}
                </div>
                <div className="mt-1 text-sm text-[color:var(--ink-500)]">{b.v}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {otherCities.length > 0 && (
        <section className="py-16 bg-[color:var(--ink-50)]">
          <div className="container-page">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="display-hero display-md text-[color:var(--navy-900)]">
                  {td.otherCitiesIn(country)}
                </h2>
                <Link
                  href={localePath(locale, countryLandingUrl(destination))}
                  className="text-sm font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)] transition-colors"
                >
                  {td.seeAll}
                </Link>
              </div>
            </Reveal>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {otherCities.map((c, i) => (
                <Reveal key={c.id} delay={Math.min(i * 0.015, 0.3)}>
                  <Link
                    href={localePath(locale, cityPageUrl(c, destination))}
                    className="group flex items-center justify-between rounded-xl border border-[color:var(--ink-200)] bg-white px-4 py-3 transition-all hover:border-[color:var(--red-400)] hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-[color:var(--red-500)] shrink-0" />
                      <span className="font-semibold text-[color:var(--navy-900)] text-sm truncate">
                        {localizeCity(c.name, locale)}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[color:var(--ink-400)] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--red-500)]" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <FAQ items={faqItems} title={t.faq.title} />
    </>
  );
}

function CustomCityCTA({ destinationName, locale }: { destinationName: string; locale: Locale }) {
  const t = dict(locale);
  const td = t.destinationPage;
  return (
    <div className="mt-8 rounded-2xl border border-[color:var(--navy-200,rgba(20,58,122,0.18))] bg-[color:var(--navy-50)] p-5 md:p-6 grid gap-4 md:grid-cols-[1fr,auto] items-center">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--red-500)]">
          {td.cityNotInListEyebrow}
        </div>
        <p className="mt-1.5 text-sm md:text-base text-[color:var(--ink-700)] leading-relaxed">
          {td.cityNotInListText(destinationName)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <a
          href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
        >
          <Phone className="h-4 w-4" />
          {contactInfo.phone}
        </a>
        <Link
          href={localePath(locale, "/contact")}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)] transition-colors"
        >
          {td.askOffer}
        </Link>
      </div>
    </div>
  );
}

function JourneyStat({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider font-bold text-white/55">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={
          "mt-1 font-[family-name:var(--font-montserrat)] font-extrabold text-[15px] leading-none " +
          (accent ? "text-[color:var(--red-400)]" : "text-white")
        }
      >
        {value}
      </div>
    </div>
  );
}

function ScheduleSection({
  destination,
  sched,
  cityName,
  locale,
}: {
  destination: Destination;
  sched: NonNullable<ReturnType<typeof getCountrySchedule>>;
  cityName?: string;
  locale: Locale;
}) {
  const t = dict(locale);
  const td = t.destinationPage;
  const country = localizeDestinationName(destination.slug, locale, destination.name);
  const kishinev = localizeCity("Chișinău", locale);
  const fromLabel = cityName ? `${kishinev} → ${cityName}` : `${locale === "ru" ? "Молдова" : "Moldova"} → ${country}`;
  const backLabel = cityName ? `${cityName} → ${kishinev}` : `${country} → ${locale === "ru" ? "Молдова" : "Moldova"}`;
  const flagCode = destinationSlugToCode[destination.slug];

  return (
    <section className="py-16 bg-white">
      <div className="container-page">
        <Reveal>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
            <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
            {td.weeklySchedule}
          </div>
          <h2 className="display-hero display-md text-[color:var(--navy-900)] mt-3">
            {td.weeklyTitle}
          </h2>
          <p className="mt-3 text-[color:var(--ink-700)] max-w-2xl">
            {td.weeklySubtitle(sched.fullSentence)}
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="rounded-2xl border-2 border-[color:var(--red-500)] bg-white p-6 shadow-[0_18px_40px_-22px_rgba(225,30,43,0.4)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--red-500)] text-white">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--red-500)]">
                    {td.outboundLabel}
                  </div>
                  <div className="text-sm text-[color:var(--ink-500)]">{fromLabel}</div>
                </div>
              </div>
              <div className="font-[family-name:var(--font-montserrat)] text-3xl md:text-4xl font-extrabold text-[color:var(--navy-900)] leading-tight">
                {sched.outboundLabel}
              </div>
              <Link
                href={localePath(locale, `/rezervare?to=${encodeURIComponent(cityName || destination.cities[0]?.name || "")}`)}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
              >
                {td.bookTrip} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="rounded-2xl border border-[color:var(--ink-200)] bg-[color:var(--ink-50)] p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--navy-900)] text-white">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--navy-700)]">
                    {td.returnLabel}
                  </div>
                  <div className="text-sm text-[color:var(--ink-500)]">{backLabel}</div>
                </div>
              </div>
              <div className="font-[family-name:var(--font-montserrat)] text-3xl md:text-4xl font-extrabold text-[color:var(--navy-900)] leading-tight">
                {sched.returnLabel}
              </div>
              {flagCode && (
                <div className="mt-5 flex items-center gap-2 text-xs text-[color:var(--ink-500)]">
                  {td.departureFromCountry(country)}{" "}
                  <CountryFlag code={flagCode} className="h-4 w-6 inline-block" />
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
