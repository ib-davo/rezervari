import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/sections/PageHero";
import { Reveal } from "@/components/ui/Reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";

const lastUpdated = "2026-04-26";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dict(lang);
  return {
    title: t.tcPassengersPage.metaTitle,
    description: t.tcPassengersPage.metaDescription,
    alternates: {
      canonical: localePath(lang, "/termeni-pasageri"),
      languages: {
        ro: localePath("ro", "/termeni-pasageri"),
        ru: localePath("ru", "/termeni-pasageri"),
      },
    },
  };
}

export default async function TermeniPasageriPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dict(lang);
  const tc = t.tcPassengersPage;

  return (
    <>
      <PageHero
        eyebrow={tc.eyebrow}
        title={tc.title}
        description={tc.description}
        tone="dark"
      />

      <section className="py-12 lg:py-16">
        <div className="container-page max-w-4xl">
          <Reveal>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <strong className="font-semibold">{tc.note} </strong>
              {tc.noteText} <a href="mailto:info@davo.md" className="underline">info@davo.md</a>.
            </div>

            <p className="mt-6 text-sm text-[color:var(--ink-500)]">
              {tc.lastUpdated}{" "}
              <span className="font-semibold text-[color:var(--ink-700)]">{lastUpdated}</span>
            </p>
          </Reveal>

          <div className="mt-10 space-y-10">
            {tc.sections.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.03}>
                <article>
                  <h2 className="font-[family-name:var(--font-montserrat)] text-xl md:text-2xl font-extrabold text-[color:var(--navy-900)]">
                    {s.title}
                  </h2>
                  <div className="mt-4 space-y-3 text-[color:var(--ink-700)] leading-relaxed">
                    {s.body.map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
