"use client";

import { useEffect } from "react";

const SITE = "Skyveon Learning Hub";

/** Sets the browser tab title for client-rendered pages ("Courses | Skyveon Learning Hub"). */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} | ${SITE}`;
  }, [title]);
}
