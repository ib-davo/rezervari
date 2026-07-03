"use client";

import Link from "next/link";
import { ArrowRight, Bus, Award, Globe2, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";
import { localePath } from "@/lib/i18n/config";

const cardIcons: LucideIcon[] = [Bus, Globe2, Award];

export default function DiscoverDavo({ hideCta = false }: { hideCta?: boolean } = {}) {
  const locale = useLocale();
  const t = dict(locale);

  return (
    <section className="relative py-20 lg:py-24 bg-[color:var(--ink-50)]">
      <div className="container-page">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-bold text-[color:var(--navy-800)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
            {t.discoverDavo.badge}
          </span>
          <h2 className="mt-4 display-hero text-[color:var(--navy-900)] text-[clamp(1.75rem,3.6vw,2.5rem)]">
            {t.discoverDavo.title}
          </h2>
          <p className="mt-4 text-[color:var(--ink-700)] max-w-xl mx-auto">
            {t.discoverDavo.description}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
          {t.discoverDavo.cards.map((c, i) => {
            const Icon = cardIcons[i] ?? Bus;
            return (
              <Reveal key={c.title} delay={i * 0.05}>
                <div className="h-full rounded-2xl bg-white border border-[color:var(--ink-200)] p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--red-400)] hover:shadow-[0_18px_38px_-20px_rgba(11,38,83,0.3)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--navy-900)] text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-4 font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                    {c.title}
                  </div>
                  <div className="mt-1 text-[13px] text-[color:var(--ink-500)]">{c.body}</div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {!hideCta && (
          <Reveal delay={0.2} className="mt-10 flex justify-center">
            <Link
              href={localePath(locale, "/despre-noi")}
              className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--navy-900)] px-7 py-3 text-white text-sm font-bold uppercase tracking-wider hover:bg-[color:var(--navy-800)] transition-colors"
            >
              {t.discoverDavo.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}
