"use client";

import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { contactInfo } from "@/lib/data";
import { VideoCard, type VideoCardData } from "./VideoCard";
import { useLocale } from "@/lib/i18n/client";
import { dict } from "@/lib/i18n/dict";

const videoSources = [
  { videoSrc: "/videos/faq.mp4", poster: "/videos/faq.jpg", fallbackGradient: "from-[#0b2653] to-[#1d4ba0]" },
  { videoSrc: "/videos/colete.mp4", poster: "/videos/colete.jpg", fallbackGradient: "from-[#1d4ba0] to-[#143a7a]" },
  { videoSrc: "/videos/interior.mp4", poster: "/videos/interior.jpg", fallbackGradient: "from-[#0b2653] to-[#c41e2a]" },
];

export default function SocialDavo() {
  const locale = useLocale();
  const t = dict(locale);

  const cards: VideoCardData[] = videoSources.map((src, i) => ({
    ...src,
    title: t.socialDavo.cards[i].title,
    tag: t.socialDavo.cards[i].tag,
  }));

  return (
    <section className="relative py-20 lg:py-28">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="eyebrow">
                <span className="h-1.5 w-6 rounded-full bg-[color:var(--red-500)]" />
                {t.socialDavo.badge}
              </span>
              <h2 className="display-hero display-lg text-[color:var(--navy-900)] mt-4">
                {t.socialDavo.title}
              </h2>
            </div>
            <Link
              href={contactInfo.social.tiktok}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-[color:var(--navy-900)] hover:text-[color:var(--red-500)] transition-colors"
            >
              {t.socialDavo.seeAllOnTikTok}
            </Link>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <Reveal key={c.videoSrc} delay={i * 0.08}>
              <VideoCard data={c} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
