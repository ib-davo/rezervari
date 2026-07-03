import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Award, Bus, Globe2, Heart, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import PageHero from "@/components/sections/PageHero";
import DiscoverDavo from "@/components/sections/DiscoverDavo";
import { Reveal } from "@/components/ui/Reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";

const valueIcons: LucideIcon[] = [ShieldCheck, Users, Heart, Globe2];
const statIcons: LucideIcon[] = [Award, Globe2, Users, Bus];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dict(lang);
  return {
    title: t.aboutPage.metaTitle,
    description: t.aboutPage.metaDescription,
    alternates: {
      canonical: localePath(lang, "/despre-noi"),
      languages: {
        ro: localePath("ro", "/despre-noi"),
        ru: localePath("ru", "/despre-noi"),
      },
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dict(lang);
  const td = t.aboutPage;

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

      <section className="py-16">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[1fr,1fr] lg:gap-16 items-center">
            <Reveal>
              <h2 className="display-hero display-md text-[color:var(--navy-900)]">
                {td.storyTitle}
              </h2>
              <div className="mt-5 space-y-4 text-[color:var(--ink-700)] leading-relaxed">
                <p>{td.storyP1}</p>
                <p>{td.storyP2}</p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={localePath(lang, "/rezervare")}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-6 py-3.5 font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
                >
                  {td.bookTicket}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={localePath(lang, "/contact")}
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] bg-white px-6 py-3.5 font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--navy-700)] transition-colors"
                >
                  {td.contactUs}
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 gap-4">
                {td.stats.map((s, i) => {
                  const Icon = statIcons[i] ?? Award;
                  return (
                    <div
                      key={s.v}
                      className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-5 hover:border-[color:var(--red-400)] transition-colors"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-900)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 font-[family-name:var(--font-montserrat)] text-3xl font-extrabold text-[color:var(--navy-900)]">
                        {s.k}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--ink-500)]">{s.v}</div>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[color:var(--ink-50)]">
        <div className="container-page">
          <Reveal>
            <div className="max-w-2xl">
              <span className="eyebrow">
                <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
                {td.valuesEyebrow}
              </span>
              <h2 className="display-hero display-md text-[color:var(--navy-900)] mt-4">
                {td.valuesTitle}
              </h2>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {td.values.map((v, i) => {
              const Icon = valueIcons[i] ?? ShieldCheck;
              return (
                <Reveal key={v.title} delay={i * 0.05}>
                  <div className="h-full rounded-2xl bg-white border border-[color:var(--ink-200)] p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--red-500)] text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                      {v.title}
                    </h3>
                    <p className="mt-2 text-sm text-[color:var(--ink-500)]">{v.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <DiscoverDavo hideCta />
    </>
  );
}
