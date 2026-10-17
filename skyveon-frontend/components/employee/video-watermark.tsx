"use client";

import { useEffect, useState } from "react";

// Spots the label hops between, as % of the player — spread out so a crop
// of any one region still catches it at some point.
// Right-hand spots anchor from the right edge so a long name/email never
// runs off the player.
const POSITIONS: { top: number; left?: number; right?: number }[] = [
  { top: 8, left: 6 },
  { top: 14, right: 6 },
  { top: 44, left: 22 },
  { top: 70, left: 8 },
  { top: 76, right: 8 },
  { top: 32, right: 14 },
];
const HOP_MS = 7000;

/**
 * Viewer-identifying overlay drawn on top of the video player (and kept
 * inside the fullscreen wrapper). It replaces the old server-side ffmpeg
 * burn-in, which re-encoded every video once per viewer and couldn't cope
 * with multi-hour lectures. Like every other in-browser protection here
 * it's a deterrent: it shows up in screenshots and screen recordings, so
 * leaked footage is traceable to the account that watched it.
 */
export function VideoWatermark({ label }: { label: string }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * POSITIONS.length));

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1 + Math.floor(Math.random() * 3)) % POSITIONS.length), HOP_MS);
    return () => clearInterval(id);
  }, []);

  const pos = POSITIONS[index];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      <span
        className="absolute whitespace-nowrap rounded px-2 py-1 font-mono text-[11px] sm:text-xs text-white/40 transition-all duration-1000 ease-in-out"
        style={{
          top: `${pos.top}%`,
          left: pos.left !== undefined ? `${pos.left}%` : undefined,
          right: pos.right !== undefined ? `${pos.right}%` : undefined,
          textShadow: "0 0 2px rgba(0,0,0,0.6)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
