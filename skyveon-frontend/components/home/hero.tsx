"use client";

import { GraduationCap, BookOpen, PlayCircle, Users } from "lucide-react";
import type { HomeCmsContent } from "@/lib/cms-types";
import { resolveImageUrl } from "@/lib/api";

export function Hero({ hero }: { hero: HomeCmsContent["hero"] }) {
  return (
    <section className="w-full px-3 sm:px-4 lg:px-6 pt-4">
      <div className="clay relative overflow-hidden rounded-[28px] sm:rounded-[36px] h-[240px] sm:h-[480px] lg:h-[560px]">
        {hero.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(hero.imageUrl)}
            alt={hero.altText || "Skyveon Learning Hub"}
            className="absolute inset-0 h-full w-full object-contain sm:object-cover"
          />
        ) : (
          <GeneratedBanner />
        )}
      </div>
    </section>
  );
}

// Decorative, text-free clay + liquid-glass illustration used until an
// admin uploads a real banner image via the CMS.
function GeneratedBanner() {
  const chips = [
    { Icon: GraduationCap, className: "top-[14%] left-[10%]", size: 26, delay: "" },
    { Icon: BookOpen, className: "top-[62%] left-[18%]", size: 22, delay: "animate-blob-slow" },
    { Icon: PlayCircle, className: "top-[22%] right-[14%]", size: 24, delay: "animate-blob-slow" },
    { Icon: Users, className: "top-[66%] right-[10%]", size: 22, delay: "" },
  ];

  return (
    <div className="absolute inset-0">
      {/* mesh gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 80% at 15% 20%, rgba(230,57,70,0.35) 0%, transparent 60%)," +
            "radial-gradient(55% 75% at 85% 25%, rgba(245,130,31,0.3) 0%, transparent 60%)," +
            "radial-gradient(65% 85% at 25% 90%, rgba(75,78,158,0.35) 0%, transparent 60%)," +
            "radial-gradient(60% 80% at 90% 85%, rgba(46,49,146,0.35) 0%, transparent 60%)",
        }}
      />

      {/* soft floating clay blobs */}
      <div
        className="animate-blob absolute -top-10 -left-10 h-56 w-56 rounded-full opacity-70 blur-2xl"
        style={{ background: "linear-gradient(135deg, #E63946, #F5821F)" }}
      />
      <div
        className="animate-blob-slow absolute bottom-[-3rem] right-[-2rem] h-64 w-64 rounded-full opacity-60 blur-2xl"
        style={{ background: "linear-gradient(135deg, #4B4E9E, #2E3192)" }}
      />
      <div
        className="animate-blob absolute top-1/3 right-1/3 h-32 w-32 rounded-full opacity-40 blur-xl"
        style={{ background: "linear-gradient(135deg, #F5821F, #E63946)" }}
      />

      {/* liquid glass sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-white/10 dark:from-white/5 dark:to-transparent" />

      {/* floating glass icon chips */}
      {chips.map(({ Icon, className, size, delay }, i) => (
        <div
          key={i}
          className={`glass absolute ${className} ${delay} h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center`}
        >
          <Icon size={size} strokeWidth={1.6} className="text-white drop-shadow" />
        </div>
      ))}
    </div>
  );
}