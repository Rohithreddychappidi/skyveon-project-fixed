"use client";

import { useEffect, useState } from "react";

// Toggle in one place if this proves too noisy in practice — the dev-tools
// heuristic in particular has real false positives (see below).
const ENABLE_DEVTOOLS_DETECTION = true;

export type ProtectionReason = "tab-hidden" | "devtools" | null;

/**
 * Two deterrent-level signals for protected content — neither is a real
 * security boundary, both are explicitly acknowledged as such:
 *
 * 1. Tab-hidden: uses the Page Visibility API (`document.hidden`), not raw
 *    window blur/focus — blur also fires when focus moves into our own
 *    same-page PDF <iframe>, which would falsely flag "away" on every
 *    click into the document viewer. visibilitychange only fires on an
 *    actual tab switch or minimize, so it doesn't have that problem, but
 *    it also can't detect e.g. a second monitor pointed at a phone camera.
 *
 * 2. Dev-tools-open: a window-size heuristic. Docked dev tools shrink the
 *    page (innerWidth/innerHeight) while the browser window itself
 *    (outerWidth/outerHeight) stays put. The naive "outer minus inner is
 *    big" check flagged anyone with a permanent sidebar, bookmarks bar,
 *    unusual zoom or a mobile browser's toolbars, so this version:
 *      - measures that gap at page load and only reacts to it GROWING by
 *        a large amount afterwards (whatever chrome was there from the
 *        start is ignored),
 *      - re-baselines on zoom changes and whole-window resizes,
 *      - needs the change to persist across two polls, and
 *      - is off on touch-only devices (no docked dev tools there).
 *    Still a deterrent, not a control: undocked dev tools aren't detected,
 *    and opening a browser side panel mid-lesson can still trigger it.
 */
export function useContentProtection() {
  const [reason, setReason] = useState<ProtectionReason>(null);

  useEffect(() => {
    function handleVisibility() {
      setReason(document.hidden ? "tab-hidden" : null);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    let devtoolsPollId: ReturnType<typeof setInterval> | undefined;
    const touchOnly = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
    if (ENABLE_DEVTOOLS_DETECTION && !touchOnly) {
      const detector = createDevtoolsDetector(measureWindow());
      devtoolsPollId = setInterval(() => {
        const change = detector(measureWindow());
        if (change === null) return;
        // Don't clobber a concurrent tab-hidden state, and don't clear a
        // devtools flag just because the tab regained visibility.
        setReason((prev) => (change === "opened" ? "devtools" : prev === "devtools" ? null : prev));
      }, 1000);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (devtoolsPollId) clearInterval(devtoolsPollId);
    };
  }, []);

  return { blurred: reason !== null, reason };
}

export interface WindowMetrics {
  dw: number; // outerWidth - innerWidth
  dh: number; // outerHeight - innerHeight
  ow: number; // outerWidth
  oh: number; // outerHeight
  dpr: number; // devicePixelRatio (changes with zoom)
}

function measureWindow(): WindowMetrics {
  return {
    dw: window.outerWidth - window.innerWidth,
    dh: window.outerHeight - window.innerHeight,
    ow: window.outerWidth,
    oh: window.outerHeight,
    dpr: window.devicePixelRatio,
  };
}

const GROWTH_THRESHOLD = 160;

/**
 * Pure decision logic for the dev-tools heuristic (see the hook's comment).
 * Feed it a measurement each poll; it returns "opened"/"closed" when the
 * state flips, null otherwise.
 */
export function createDevtoolsDetector(initial: WindowMetrics) {
  let baseline = initial;
  let suspectPolls = 0;
  let open = false;

  return (now: WindowMetrics): "opened" | "closed" | null => {
    // Zoom or a resize of the whole browser window: a new normal, not dev tools.
    if (now.dpr !== baseline.dpr || Math.abs(now.ow - baseline.ow) > 4 || Math.abs(now.oh - baseline.oh) > 4) {
      if (!open) {
        baseline = now;
        suspectPolls = 0;
      }
      return null;
    }
    const grew = now.dw - baseline.dw > GROWTH_THRESHOLD || now.dh - baseline.dh > GROWTH_THRESHOLD;
    suspectPolls = grew ? suspectPolls + 1 : 0;
    if (!open && suspectPolls >= 2) {
      open = true;
      return "opened";
    }
    if (open && !grew) {
      open = false;
      baseline = now;
      return "closed";
    }
    return null;
  };
}
