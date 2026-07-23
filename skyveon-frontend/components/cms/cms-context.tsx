"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { HomeCmsContent } from "@/lib/cms-types";
import { defaultHomeContent } from "@/lib/cms-data";
import { apiFetch, ApiError } from "@/lib/api";

interface CmsContextValue {
  content: HomeCmsContent;
  hydrated: boolean;
  saving: boolean;
  saveError: string | null;
  updateContent: (patch: Partial<HomeCmsContent>) => void;
  setContent: (next: HomeCmsContent) => void;
  save: (next?: HomeCmsContent) => Promise<void>;
  resetToDefault: () => void;
}

const CmsContext = createContext<CmsContextValue | null>(null);

// Shallow-merges saved content over the defaults so new fields added to
// HomeCmsContent later don't break older data saved before the change.
function mergeWithDefaults(saved: Partial<HomeCmsContent>): HomeCmsContent {
  return {
    ...defaultHomeContent,
    ...saved,
    brand: { ...defaultHomeContent.brand, ...saved.brand },
    hero: { ...defaultHomeContent.hero, ...saved.hero },
    about: { ...defaultHomeContent.about, ...saved.about },
    coursesSection: { ...defaultHomeContent.coursesSection, ...saved.coursesSection },
    footer: { ...defaultHomeContent.footer, ...saved.footer },
  };
}

export function CmsProvider({ children }: { children: React.ReactNode }) {
  const [content, setContentState] = useState<HomeCmsContent>(defaultHomeContent);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Public endpoint — no auth required, so this loads for every visitor.
        const body = await apiFetch("/api/cms/home", { skipAuthRetry: true });
        if (body?.content) {
          setContentState(mergeWithDefaults(body.content));
        }
      } catch {
        // API unreachable or nothing saved yet — fall back to bundled defaults
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const setContent = useCallback((next: HomeCmsContent) => {
    setContentState(next);
  }, []);

  const updateContent = useCallback((patch: Partial<HomeCmsContent>) => {
    setContentState((prev) => mergeWithDefaults({ ...prev, ...patch }));
  }, []);

  const save = useCallback(
    async (next?: HomeCmsContent) => {
      const toSave = next ?? content;
      setContentState(toSave);
      setSaving(true);
      setSaveError(null);
      try {
        await apiFetch("/api/cms/home", { method: "PUT", body: JSON.stringify({ content: toSave }) });
      } catch (err) {
        setSaveError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [content]
  );

  const resetToDefault = useCallback(() => setContentState(defaultHomeContent), []);

  return (
    <CmsContext.Provider
      value={{ content, hydrated, saving, saveError, updateContent, setContent, save, resetToDefault }}
    >
      {children}
    </CmsContext.Provider>
  );
}

export function useCms() {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error("useCms must be used within a CmsProvider");
  return ctx;
}
