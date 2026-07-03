"use client";

import Image from "next/image";
import {
  UserCheck,
  Luggage,
  Coffee,
  Utensils,
  Wifi,
  MonitorPlay,
  Usb,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";

const benefitIcons: LucideIcon[] = [
  UserCheck,
  Utensils,
  Coffee,
  Wifi,
  Luggage,
  Usb,
  MonitorPlay,
  ShieldCheck,
];

export default function Benefits() {
  const locale = useLocale();
  const t = dict(locale);

  return (
    <section className="relative py-20 lg:py-24 bg-white">
      <div className="container-page">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-[color:var(--navy-50)] px-4 py-1.5 text-[11px] uppercase tracking-[0.22em] font-bold text-[color:var(--navy-800)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--red-500)]" />
            {t.benefits.badge}
          </span>
          <h2 className="mt-4 display-hero text-[color:var(--navy-900)] text-[clamp(1.75rem,3.6vw,2.5rem)]">
            {t.benefits.title}
          </h2>
          <p className="mt-4 text-[color:var(--ink-700)] max-w-xl mx-auto">
            {t.benefits.subtitle}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr,1.1fr] lg:gap-14 items-center">
          <Reveal className="relative">
            <div className="relative rounded-[32px] bg-[linear-gradient(160deg,#f4f7fc_0%,#e7eef9_100%)] p-6 md:p-8 ring-1 ring-[color:var(--ink-200)] overflow-hidden">
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_30%,rgba(225,30,43,0.08),transparent_60%)]" />
              <div className="relative mx-auto aspect-[3/4] w-full max-w-[320px]">
                <Image
                  src="/images/bus-front.png"
                  alt="DAVO Group"
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 320px, 60vw"
                  className="object-contain drop-shadow-[0_30px_35px_rgba(11,38,83,0.18)]"
                />
              </div>

              <div className="absolute left-4 bottom-4 md:left-6 md:bottom-6 rounded-2xl bg-white/95 backdrop-blur-sm ring-1 ring-[color:var(--ink-100)] shadow-[0_18px_40px_-18px_rgba(11,38,83,0.35)] px-4 py-3">
                <div className="font-[family-name:var(--font-montserrat)] text-2xl font-extrabold text-[color:var(--navy-900)] leading-none">
                  4,8<span className="text-[color:var(--red-500)]">★</span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-[color:var(--ink-500)]">
                  {t.benefits.rating}
                </div>
              </div>

              <div className="absolute right-4 top-4 md:right-6 md:top-6 rounded-full bg-[color:var(--navy-900)] px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-white">
                {t.benefits.busClass}
              </div>
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {t.benefits.items.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.04}>
                <BenefitCard icon={benefitIcons[i] ?? ShieldCheck} title={b.title} body={b.body} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="group relative h-full rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[color:var(--red-400)] hover:shadow-[0_20px_40px_-20px_rgba(11,38,83,0.25)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-800)] transition-colors group-hover:bg-[color:var(--red-50)] group-hover:text-[color:var(--red-500)]">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)] text-[0.95rem] leading-tight">
            {title}
          </div>
          <div className="mt-1 text-[12px] text-[color:var(--ink-500)] leading-relaxed">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}
