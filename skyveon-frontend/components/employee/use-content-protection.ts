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
 * 2. Dev-tools-open: the classic outer/inner window-size-delta heuristic.
 *    It has real false positives (any docked devtools-like browser chrome,
 *    certain zoom levels, some OS window managers) and real false
 *    negatives (undocked devtools on a second monitor, most non-Chromium
 *    browsers). It's a nuisance-level speed bump, not a control.
 */
export function useContentProtection() {
  const [reason, setReason] = useState<ProtectionReason>(null);

  useEffect(() => {
    function handleVisibility() {
      setReason(document.hidden ? "tab-hidden" : null);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    let devtoolsPollId: ReturnType<typeof setInterval> | undefined;
    if (ENABLE_DEVTOOLS_DETECTION) {
      const THRESHOLD = 160;
      let wasOpen = false;
      devtoolsPollId = setInterval(() => {
        const widthDelta = window.outerWidth - window.innerWidth;
        const heightDelta = window.outerHeight - window.innerHeight;
        const isOpen = widthDelta > THRESHOLD || heightDelta > THRESHOLD;
        if (isOpen !== wasOpen) {
          wasOpen = isOpen;
          // Don't clobber a concurrent tab-hidden state, and don't clear a
          // devtools flag just because the tab regained visibility.
          setReason((prev) => {
            if (isOpen) return "devtools";
            return prev === "devtools" ? null : prev;
          });
        }
      }, 1000);
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (devtoolsPollId) clearInterval(devtoolsPollId);
    };
  }, []);

  return { blurred: reason !== null, reason };
}
