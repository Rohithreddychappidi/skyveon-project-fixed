"use client";

import { Building2 } from "lucide-react";
import type { HomeCmsContent } from "@/lib/cms-types";
import { resolveImageUrl } from "@/lib/api";

export function About({ about }: { about: HomeCmsContent["about"] }) {
  return (
    <section id="about" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
        {/* Left: photo, clay-framed */}
        <div className="clay relative overflow-hidden rounded-[32px] h-72 sm:h-96 order-1">
          {about.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImageUrl(about.imageUrl)}
              alt="Skyveon team"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <GeneratedPhoto />
          )}
        </div>

        {/* Right: paragraph, glass panel */}
        <div className="glass rounded-[32px] p-7 sm:p-10 order-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo/10 dark:bg-white/10 text-indigo dark:text-white px-3 py-1 text-xs font-medium font-mono tracking-tight">
            About
          </span>
          <h2 className="mt-4 font-display font-semibold text-2xl sm:text-3xl text-ink dark:text-white tracking-tight">
            {about.title}
          </h2>
          <p className="mt-4 text-slate dark:text-white/70 leading-relaxed">
            {about.body}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {about.highlights.map((h, i) => (
              <div
                key={i}
                className="clay-sm rounded-2xl px-4 py-3 min-w-[120px]"
              >
                <p className="font-display font-semibold text-lg text-indigo dark:text-white">
                  {h.value}
                </p>
                <p className="text-[11px] text-slate dark:text-white/60 mt-0.5">
                  {h.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Decorative clay + liquid-glass placeholder, used until an admin adds a
// real team/office photo via the CMS.
function GeneratedPhoto() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 90% at 20% 15%, rgba(75,78,158,0.35) 0%, transparent 60%)," +
            "radial-gradient(70% 90% at 85% 90%, rgba(230,57,70,0.3) 0%, transparent 60%)",
        }}
      />
      <div
        className="animate-blob-slow absolute -bottom-8 -left-8 h-44 w-44 rounded-full opacity-60 blur-2xl"
        style={{ background: "linear-gradient(135deg, #2E3192, #4B4E9E)" }}
      />
      <div
        className="animate-blob absolute -top-8 -right-8 h-40 w-40 rounded-full opacity-50 blur-2xl"
        style={{ background: "linear-gradient(135deg, #F5821F, #E63946)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="glass h-24 w-24 rounded-3xl flex items-center justify-center">
          <Building2 size={34} strokeWidth={1.5} className="text-white drop-shadow" />
        </div>
      </div>
    </div>
  );
}
