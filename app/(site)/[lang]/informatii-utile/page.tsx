import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bus,
  HeartHandshake,
  Sparkles,
  Route,
  UserCheck,
  Luggage,
  Coffee,
  Utensils,
  Wifi,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";
import FAQ from "@/components/sections/FAQ";
import { Reveal } from "@/components/ui/Reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";

const sideIconsList: LucideIcon[] = [UserCheck, Luggage, Coffee, Utensils, Wifi, MonitorPlay];
const threeColIcons: LucideIcon[] = [Bus, Route, HeartHandshake];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dict(lang);
  return {
    title: t.usefulInfoPage.metaTitle,
    description: t.usefulInfoPage.metaDescription,
    alternates: {
      canonical: localePath(lang, "/informatii-utile"),
      languages: {
        ro: localePath("ro", "/informatii-utile"),
        ru: localePath("ru", "/informatii-utile"),
      },
    },
  };
}

export default async function InformatiiUtile({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dict(lang);
  const ti = t.usefulInfoPage;

  return (
    <>
      <section className="relative bg-hero-navy text-white">
        <div className="bg-noise absolute inset-0 opacity-30" />
        <div className="container-page relative py-20 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[1.1fr,1fr] items-center">
            <Reveal>
              <span className="eyebrow text-[color:var(--red-400)]">
                <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
                {ti.eyebrow}
              </span>
              <h1 className="display-hero display-xl text-white mt-5">
                {ti.titleA}
                <br />
                {ti.titleBLine1}{" "}
                <span className="text-[color:var(--red-400)]">{ti.titleBHighlight}</span>
              </h1>
              <p className="mt-6 text-lg text-white/70 max-w-xl leading-relaxed">
                {ti.description}
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ti.sideIcons.map((b, i) => {
                  const Icon = sideIconsList[i] ?? UserCheck;
                  return (
                    <div
                      key={b.label}
                      className="flex flex-col items-center text-center gap-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--red-500)] text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-xs font-semibold text-white text-center leading-tight">
                        {b.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-page">
          <Reveal>
            <div className="max-w-2xl">
              <span className="eyebrow">
                <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
                {ti.reasonsEyebrow}
              </span>
              <h2 className="display-hero display-lg text-[color:var(--navy-900)] mt-4">
                {ti.reasonsTitle}
              </h2>
              <p className="mt-4 text-[color:var(--ink-700)]">{ti.reasonsSubtitle}</p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {ti.reasons.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.05}>
                <div className="group h-full rounded-2xl border border-[color:var(--ink-200)] bg-white p-6 transition-all hover:-translate-y-1 hover:border-[color:var(--red-400)] hover:shadow-[0_16px_40px_-20px_rgba(11,38,83,0.35)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-900)] group-hover:bg-[color:var(--red-50)] group-hover:text-[color:var(--red-500)] transition-colors">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)] text-lg">
                    {r.title}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--ink-500)] leading-relaxed">{r.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#f59e0b] via-[#dc2626] to-[#4c1d95]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0b2653] to-transparent" />
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-gradient-to-r from-transparent via-[color:var(--red-400)] to-transparent opacity-40" />
        </div>

        <div className="container-page relative">
          <Reveal>
            <div className="max-w-3xl text-white">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
                {ti.bandEyebrow}
              </div>
              <h2 className="display-hero display-lg mt-3">{ti.bandTitle}</h2>
              <p className="mt-5 text-white/85 max-w-xl text-lg">{ti.bandText}</p>
              <div className="mt-8">
                <Link
                  href={localePath(lang, "/rezervare")}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-[color:var(--navy-900)] hover:bg-white/90 transition-colors"
                >
                  {ti.bandCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-20">
        <div className="container-page">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-[color:var(--navy-900)] p-8 md:p-12 text-white">
              <div className="bg-noise absolute inset-0 opacity-30" />
              <div className="relative grid gap-8 md:grid-cols-2 items-center">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-400)]">
                    {ti.newsletterEyebrow}
                  </div>
                  <h3 className="display-hero text-3xl md:text-4xl mt-3">{ti.newsletterTitle}</h3>
                  <p className="mt-3 text-white/65 max-w-md">{ti.newsletterText}</p>
                </div>
                <form className="flex gap-3">
                  <input
                    type="email"
                    placeholder={ti.newsletterPlaceholder}
                    className="flex-1 rounded-full bg-white/10 border border-white/15 px-5 py-3.5 text-sm text-white placeholder:text-white/50 outline-none focus:border-[color:var(--red-400)]"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full bg-[color:var(--red-500)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                  >
                    {ti.newsletterCta}
                  </button>
                </form>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="pb-20">
        <div className="container-page grid gap-8 md:grid-cols-3">
          {ti.threeCol.map((c, i) => {
            const Icon = threeColIcons[i] ?? Bus;
            return (
              <Reveal key={c.title} delay={i * 0.05}>
                <div className="h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--red-500)] text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--red-500)]">
                    {c.title}
                  </div>
                  <p className="mt-3 text-[color:var(--ink-700)] leading-relaxed">{c.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <FAQ />
    </>
  );
}
