import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Boxes } from "lucide-react";
import PageHero from "@/components/sections/PageHero";
import CountryCityTabs from "@/components/sections/CountryCityTabs";
import SocialDavo from "@/components/sections/SocialDavo";
import { Reveal } from "@/components/ui/Reveal";
import { isLocale, localePath } from "@/lib/i18n/config";
import { dict } from "@/lib/i18n/dict";

const cardMeta = [
  { href: "/rezervare", tone: "navy" as const, image: "/images/bus-angle.png" },
  { href: "/rezervare?mode=colet", tone: "red" as const, image: "/images/parcel-boxes.png" },
  { href: "/rezervare?mode=colet", tone: "navy" as const, image: "/images/parcel-boxes.png" },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = dict(lang);
  return {
    title: t.servicesIndex.metaTitle,
    description: t.servicesIndex.metaDescription,
    alternates: {
      canonical: localePath(lang, "/serviciile-noastre"),
      languages: {
        ro: localePath("ro", "/serviciile-noastre"),
        ru: localePath("ru", "/serviciile-noastre"),
      },
    },
  };
}

export default async function ServiciiPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = dict(lang);
  const ts = t.servicesIndex;

  return (
    <>
      <PageHero
        eyebrow={ts.eyebrow}
        title={
          <>
            {ts.titleA} <span className="text-[color:var(--red-500)]">{ts.titleB}</span>
          </>
        }
        description={ts.description}
      />

      <CountryCityTabs />

      <section className="py-10 lg:py-16">
        <div className="container-page space-y-6 md:space-y-8">
          {ts.cards.map((c, i) => {
            const meta = cardMeta[i];
            return (
              <Reveal key={c.eyebrow} delay={i * 0.05}>
                <div
                  className={`group relative grid gap-8 md:grid-cols-[1.1fr,1.4fr] items-stretch rounded-3xl overflow-hidden border ${
                    meta.tone === "red"
                      ? "bg-[color:var(--red-500)] border-[color:var(--red-500)] text-white"
                      : "bg-[color:var(--navy-900)] border-[color:var(--navy-900)] text-white"
                  }`}
                >
                  <div className="bg-noise absolute inset-0 opacity-15" />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 hidden md:block h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_65%)] blur-3xl"
                  />
                  <div className="relative p-8 md:p-10 flex flex-col justify-center">
                    <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70 mb-3">
                      {ts.serviceLabel} {c.eyebrow}
                    </div>
                    <h2 className="display-hero text-3xl md:text-4xl lg:text-5xl text-white">{c.title}</h2>
                    <p className="mt-5 text-white/75 leading-relaxed max-w-md">{c.body}</p>
                    <div className="mt-7">
                      <Link
                        href={localePath(lang, meta.href)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-[color:var(--navy-900)] hover:bg-white/90 transition-colors"
                      >
                        {c.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="relative min-h-[240px] md:min-h-[300px] flex items-center justify-center px-6 pb-8 md:px-8 md:py-10">
                    <Image
                      src={meta.image}
                      alt={c.title}
                      width={520}
                      height={390}
                      unoptimized
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="relative h-auto w-full max-w-[460px] object-contain transition-transform duration-500 group-hover:scale-[1.04] drop-shadow-[0_28px_40px_rgba(0,0,0,0.35)]"
                    />
                    <div className="absolute bottom-4 right-4 md:bottom-5 md:right-5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/90 border border-white/20">
                      DAVO Group
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}

          {ts.moreServices.length > 0 && (
            <Reveal>
              <div className="grid md:grid-cols-2 gap-5 mt-4">
                {ts.moreServices.map((m) => (
                  <div
                    key={m.title}
                    className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-6 flex items-start gap-4 hover:border-[color:var(--red-400)] transition-colors"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--navy-50)] text-[color:var(--navy-900)] shrink-0">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-[family-name:var(--font-montserrat)] font-bold text-[color:var(--navy-900)]">
                        {m.title}
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--ink-500)]">{m.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <SocialDavo />
    </>
  );
}
