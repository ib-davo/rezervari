"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { contactInfo } from "@/lib/data";

export type VideoCardData = {
  videoSrc: string;
  poster: string | null;
  title: string;
  tag: string;
  fallbackGradient: string;
};

export function VideoCard({ data }: { data: VideoCardData }) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setStarted(true);
    // play() returnează o promisiune; .catch evită UnhandledPromiseRejection
    // în cazul în care browser-ul refuză autoplay (rar, pentru că e gesture).
    videoRef.current?.play().catch(() => {});
  };

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black shadow-[0_20px_50px_-25px_rgba(11,38,83,0.5)]">
      <video
        ref={videoRef}
        src={data.videoSrc}
        poster={data.poster ?? undefined}
        controls={started}
        preload="metadata"
        playsInline
        className="absolute inset-0 h-full w-full bg-black object-cover"
      />

      {!started && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`Redă: ${data.title}`}
          className="group absolute inset-0 block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--red-500)]"
        >
          {!data.poster && (
            <div className={`absolute inset-0 bg-gradient-to-br ${data.fallbackGradient}`} />
          )}

          {/* Strat întunecat pentru lizibilitatea textului peste poster */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
            <span className="inline-flex items-center leading-none text-[10px] font-bold uppercase tracking-[0.2em] text-white/95 px-2.5 h-7 rounded-full bg-black/40 backdrop-blur-sm border border-white/20">
              {data.tag}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/20 text-white">
              <Play className="h-3.5 w-3.5 fill-white" />
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="font-[family-name:var(--font-montserrat)] font-extrabold uppercase text-lg leading-tight tracking-wider drop-shadow-lg">
              {data.title}
            </div>
            <div className="mt-1 text-xs text-white/85">
              DAVO Group · TikTok {contactInfo.social.handleTikTok}
            </div>
          </div>

          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--red-500)] text-white opacity-90 transition-all group-hover:scale-110 group-hover:opacity-100 shadow-[0_20px_40px_-10px_rgba(225,30,43,0.6)]">
            <Play className="h-6 w-6 fill-white" />
          </span>
        </button>
      )}
    </div>
  );
}
