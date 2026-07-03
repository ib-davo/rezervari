"use client";

import { Calendar, MapPin, Phone, Snowflake, Clock } from "lucide-react";
import Link from "next/link";
import { collectionPoints, contactInfo, pickupSchedule } from "@/lib/data";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localizeDay } from "@/lib/i18n";
import { localizeCity } from "@/lib/i18n/dataI18n";

export default function CollectionSchedule({
  variant = "full",
  showHQ = true,
}: {
  variant?: "full" | "compact";
  showHQ?: boolean;
}) {
  const locale = useLocale();
  const t = dict(locale);

  return (
    <section className="relative py-16 lg:py-20 bg-white">
      <div className="container-page">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-[color:var(--navy-50)] px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-bold text-[color:var(--navy-800)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
            {t.collectionSchedule.badge}
          </span>
          <h2 className="mt-4 display-hero text-[color:var(--navy-900)] text-[clamp(1.5rem,3vw,2.25rem)]">
            {t.collectionSchedule.title}
          </h2>
          <p className="mt-4 text-[color:var(--ink-700)]">
            {t.collectionSchedule.subtitle1}{" "}
            <span className="font-semibold text-[color:var(--navy-900)]">{t.collectionSchedule.refTrailer}</span>{" "}
            {t.collectionSchedule.subtitle2}
          </p>
        </Reveal>

        {showHQ && (
          <Reveal delay={0.05}>
            <div className="mt-8 rounded-2xl border border-[color:var(--navy-200,rgba(20,58,122,0.18))] bg-[color:var(--navy-50)] p-5 md:p-6 grid gap-4 md:grid-cols-[1.1fr,1fr] items-start">
              <div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--red-50)] text-[color:var(--red-500)]">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)]">
                      {t.collectionSchedule.hqEyebrow}
                    </div>
                    <div className="font-[family-name:var(--font-montserrat)] text-lg font-extrabold text-[color:var(--navy-900)] mt-0.5">
                      {t.collectionSchedule.hqName}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <Link
                        href={contactInfo.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--navy-900)] underline decoration-[color:var(--red-500)] underline-offset-2 hover:text-[color:var(--red-500)]"
                      >
                        {t.collectionSchedule.openInMaps}
                      </Link>
                      <a
                        href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                        className="inline-flex items-center gap-1.5 font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)]"
                      >
                        <Phone className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                        {contactInfo.phone}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--ink-500)] flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {t.collectionSchedule.pickupScheduleLabel}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {pickupSchedule.map((s) => (
                    <li
                      key={s.day}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="font-semibold text-[color:var(--navy-900)]">
                        {localizeDay(s.day, locale)}
                      </span>
                      <span className="font-mono text-[13px] text-[color:var(--ink-700)]">
                        {s.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collectionPoints
            .filter((p) => (variant === "compact" ? p.city !== "Chișinău" : true))
            .map((p, i) => (
              <Reveal key={p.city} delay={i * 0.02}>
                <article className="h-full rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 hover:border-[color:var(--red-400)] hover:shadow-[0_18px_38px_-20px_rgba(11,38,83,0.25)] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-[color:var(--red-500)]">
                        {t.collectionSchedule.cityLabel}
                      </div>
                      <h3 className="font-[family-name:var(--font-montserrat)] text-xl font-extrabold text-[color:var(--navy-900)] mt-0.5">
                        {localizeCity(p.city, locale)}
                      </h3>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-800)]">
                      <Calendar className="h-4 w-4" />
                    </span>
                  </div>

                  <ul className="mt-4 space-y-1.5 border-t border-[color:var(--ink-100)] pt-3">
                    {p.schedule.map((s) => (
                      <li
                        key={s.day}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="font-semibold text-[color:var(--ink-700)]">
                          {localizeDay(s.day, locale)}
                        </span>
                        <span className="font-mono text-[13px] text-[color:var(--navy-900)]">
                          {s.hours}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.driver ? (
                    <div className="mt-4 flex items-center gap-2 text-xs text-[color:var(--ink-700)] border-t border-[color:var(--ink-100)] pt-3">
                      <Phone className="h-3.5 w-3.5 text-[color:var(--red-500)]" />
                      <span className="font-semibold">{p.driver.name}</span>
                      <span className="text-[color:var(--ink-500)]">·</span>
                      <a
                        href={`tel:${p.driver.phone.replace(/\s/g, "")}`}
                        className="font-mono text-[12px] hover:text-[color:var(--red-500)]"
                      >
                        {p.driver.phone}
                      </a>
                    </div>
                  ) : (
                    <div className="mt-4 text-[11px] text-[color:var(--ink-500)] border-t border-[color:var(--ink-100)] pt-3">
                      {t.collectionSchedule.driverConfirm(contactInfo.phone)}
                    </div>
                  )}

                  {p.notes && (
                    <div className="mt-2 text-[11px] italic text-[color:var(--ink-500)]">
                      {p.notes}
                    </div>
                  )}
                </article>
              </Reveal>
            ))}
        </div>

        <Reveal delay={0.1} className="mt-10 rounded-2xl bg-[color:var(--navy-900)] bg-hero-navy text-white p-6 md:p-8 grid gap-4 md:grid-cols-[auto,1fr,auto] items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[color:var(--red-400)]">
            <Snowflake className="h-6 w-6" />
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-[color:var(--red-400)]">
              {t.collectionSchedule.perishableEyebrow}
            </div>
            <p className="mt-1 text-sm md:text-base text-white/85 leading-relaxed">
              {t.collectionSchedule.perishableText}
            </p>
          </div>
          <a
            href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-sm font-semibold text-[color:var(--navy-900)] hover:bg-white transition-colors"
          >
            <Phone className="h-4 w-4 text-[color:var(--red-500)]" />
            {contactInfo.phone}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
