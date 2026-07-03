"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, MapPin } from "lucide-react";
import { destinations } from "@/lib/data";
import { cn, countryLandingUrl } from "@/lib/utils";
import { CountryFlag, destinationSlugToCode } from "@/components/ui/CountryFlag";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/config";
import {
  localizeDestinationName,
  localizeDestinationDescription,
  localizeCity,
} from "@/lib/i18n/dataI18n";

export default function DestinationsPick() {
  const locale = useLocale();
  const t = dict(locale);
  const [activeSlug, setActiveSlug] = useState(destinations[0].slug);
  const active = destinations.find((d) => d.slug === activeSlug) ?? destinations[0];
  const activeName = localizeDestinationName(active.slug, locale, active.name);

  return (
    <section className="relative py-20 lg:py-28">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <span className="eyebrow">
                <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
                {t.destinationsPick.badge}
              </span>
              <h2 className="display-hero display-lg text-[color:var(--navy-900)] mt-4">
                {t.destinationsPick.title}
              </h2>
              <p className="mt-4 text-[color:var(--ink-700)]">
                {t.destinationsPick.subtitle}
              </p>
            </div>
            <Link
              href={localePath(locale, "/destinatii")}
              className="group inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)] transition-colors"
            >
              {t.destinationsPick.viewAll}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[420px,1fr]">
          <Reveal>
            <div className="flex flex-col gap-2">
              {destinations.map((d) => {
                const isActive = d.slug === activeSlug;
                const flag = destinationSlugToCode[d.slug];
                const dName = localizeDestinationName(d.slug, locale, d.name);
                return (
                  <button
                    key={d.slug}
                    onClick={() => setActiveSlug(d.slug)}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all",
                      isActive
                        ? "border-[color:var(--red-500)] bg-[color:var(--red-500)] text-white shadow-[0_16px_40px_-20px_rgba(225,30,43,0.5)]"
                        : "border-[color:var(--ink-200)] bg-white text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)]"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {flag && <CountryFlag code={flag} className="h-10 w-14 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="font-[family-name:var(--font-montserrat)] font-extrabold uppercase text-sm tracking-wider">
                          {t.destinationsPick.transportMoldovaTo(dName)}
                        </div>
                        <div className={cn("text-xs mt-0.5", isActive ? "text-white/80" : "text-[color:var(--ink-500)]")}>
                          {t.destinationsPick.citiesCount(d.cities.length)} · {t.destinationsPick.fromPrice} {d.price || "—"}
                          {d.currency}
                        </div>
                      </div>
                      <ArrowRight
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isActive ? "text-white translate-x-1" : "text-[color:var(--ink-400)] group-hover:translate-x-1"
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative overflow-hidden rounded-3xl bg-hero-navy text-white p-6 md:p-10 min-h-[420px] flex flex-col">
              <div className="bg-noise absolute inset-0 opacity-40" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.slug}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.35 }}
                  className="relative z-10 flex-1 flex flex-col"
                >
                  <div className="flex items-center gap-4">
                    {destinationSlugToCode[active.slug] && (
                      <CountryFlag code={destinationSlugToCode[active.slug]} className="h-12 w-16" />
                    )}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-white/60">
                        {t.destinationsPick.moldovaTo(activeName)}
                      </div>
                      <div className="display-hero text-3xl md:text-4xl text-white mt-1">
                        {t.destinationsPick.fromPrice} {active.price || "—"}
                        {active.currency}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-white/70 max-w-lg">
                    {localizeDestinationDescription(active.slug, locale, active.description)}
                  </p>

                  <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {active.cities.slice(0, 15).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/85"
                      >
                        <MapPin className="h-3 w-3 text-[color:var(--red-400)]" />
                        <span className="truncate">{localizeCity(c.name, locale)}</span>
                      </div>
                    ))}
                  </div>

                  {active.cities.length > 15 && (
                    <div className="mt-2 text-xs text-white/50">
                      {t.destinationsPick.moreCities(active.cities.length - 15)}
                    </div>
                  )}

                  <div className="mt-auto pt-6 flex flex-wrap gap-3">
                    <Link
                      href={localePath(locale, countryLandingUrl(active))}
                      className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                    >
                      {t.destinationsPick.seeDetails}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={localePath(locale, `/rezervare?to=${active.name}`)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                    >
                      {t.destinationsPick.bookTicket}
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
