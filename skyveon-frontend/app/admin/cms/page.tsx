"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCms } from "@/components/cms/cms-context";
import { defaultHomeContent } from "@/lib/cms-data";
import type { HomeCmsContent, ImagePosition } from "@/lib/cms-types";
import { api, ApiError, resolveImageUrl } from "@/lib/api";
import type { Course } from "@/lib/api-types";
import {
  ExternalLink,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  Upload,
  X as XIcon,
  Shuffle,
  ImageIcon,
} from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15";
const labelClass = "text-sm font-medium text-ink mb-1.5 block";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="font-display font-semibold text-ink mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-slate mb-5">{description}</p>
      )}
      {!description && <div className="mb-5" />}
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

const IMAGE_POSITIONS: { value: ImagePosition; label: string; name: string }[] = [
  { value: "top-left", label: "↖", name: "Top Left" },
  { value: "top", label: "↑", name: "Top Center" },
  { value: "top-right", label: "↗", name: "Top Right" },
  { value: "left", label: "←", name: "Center Left" },
  { value: "center", label: "⊙", name: "Center" },
  { value: "right", label: "→", name: "Center Right" },
  { value: "bottom-left", label: "↙", name: "Bottom Left" },
  { value: "bottom", label: "↓", name: "Bottom Center" },
  { value: "bottom-right", label: "↘", name: "Bottom Right" },
];

/**
 * Visual crop & alignment editor with live real-time preview of the
 * exact aspect ratio used on the public site.
 */
function ImagePlacementEditor({
  title,
  subtitle,
  imageUrl,
  position,
  onChangePosition,
  aspectRatioClass = "aspect-[16/7]",
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  position?: ImagePosition;
  onChangePosition: (pos: ImagePosition) => void;
  aspectRatioClass?: string;
}) {
  const active = position ?? "center";
  const activeObj = IMAGE_POSITIONS.find((p) => p.value === active) ?? IMAGE_POSITIONS[4];

  if (!imageUrl) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            {title}
          </span>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-indigo shadow-xs">
          Alignment: {activeObj.name}
        </span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-center">
        {/* Live crop preview box */}
        <div className={`relative overflow-hidden rounded-lg border border-slate-300 bg-slate-200 ${aspectRatioClass} max-h-48 w-full shadow-inner`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveImageUrl(imageUrl)}
            alt="Position preview"
            className="w-full h-full object-cover transition-[object-position] duration-300"
            style={{ objectPosition: active.replace("-", " ") }}
          />
          {/* 3x3 overlay grid for spatial context */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-white/20">
            {IMAGE_POSITIONS.map(({ value: pos }) => (
              <div
                key={pos}
                className={`border border-white/10 transition-colors ${
                  active === pos ? "bg-indigo/25 ring-2 ring-indigo inset-0" : ""
                }`}
              />
            ))}
          </div>
          <div className="absolute bottom-2 left-2 pointer-events-none bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-mono">
            Live Crop Preview
          </div>
        </div>

        {/* 3x3 Clickable alignment buttons */}
        <div className="flex flex-col items-center gap-1.5 self-center">
          <span className="text-[11px] text-slate-500 font-medium">Click to reposition</span>
          <div className="grid grid-cols-3 gap-1 bg-white p-1.5 rounded-lg border border-slate-200 shadow-xs">
            {IMAGE_POSITIONS.map(({ value: pos, label, name }) => (
              <button
                key={pos}
                type="button"
                title={name}
                onClick={() => onChangePosition(pos)}
                className={`h-9 w-9 rounded flex items-center justify-center text-sm font-semibold transition-all ${
                  active === pos
                    ? "bg-indigo text-white shadow-xs scale-105"
                    : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multi-Image Rotation Gallery Manager.
 * Allows admins to manage a pool of images that rotate on page load/refresh,
 * select the primary image, upload multiple files at once, or add direct URLs.
 */
function MultiImageRotationManager({
  title,
  description,
  activeUrl,
  gallery,
  randomiseOnLoad,
  onToggleRandomise,
  onSelectActive,
  onRemoveFromGallery,
  onUploadImages,
  onAddUrl,
  uploading,
}: {
  title: string;
  description?: string;
  activeUrl: string;
  gallery: string[];
  randomiseOnLoad: boolean;
  onToggleRandomise: (checked: boolean) => void;
  onSelectActive: (url: string) => void;
  onRemoveFromGallery: (url: string) => void;
  onUploadImages: (files: FileList) => void;
  onAddUrl: (url: string) => void;
  uploading: boolean;
}) {
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine gallery and activeUrl so nothing is ever hidden or lost
  const fullGallery = Array.from(new Set([...gallery, ...(activeUrl ? [activeUrl] : [])]));

  function handleAddUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onAddUrl(trimmed);
    setUrlInput("");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-4 shadow-xs">
      {/* Header and Rotation Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-semibold text-sm text-ink">{title}</h3>
            {randomiseOnLoad && fullGallery.length > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium">
                <Shuffle size={11} /> Rotating on refresh ({fullGallery.length} images)
              </span>
            ) : randomiseOnLoad ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[11px] font-medium">
                Add 1 more image to rotate
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px]">
                Single image mode
              </span>
            )}
          </div>
          {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={randomiseOnLoad}
            onChange={(e) => onToggleRandomise(e.target.checked)}
            className="h-4 w-4 accent-indigo rounded cursor-pointer"
          />
          <span className="text-xs font-medium text-ink">Rotate images on load</span>
        </label>
      </div>

      {/* Gallery Cards */}
      {fullGallery.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-6 px-4 text-center">
          <ImageIcon size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-xs text-slate-600 font-medium">No images in this gallery yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Upload multiple images or add image URLs below to enable rotation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {fullGallery.map((url) => {
            const isActive = url === activeUrl;
            return (
              <div
                key={url}
                className={`group relative rounded-lg border overflow-hidden transition-all flex flex-col bg-white shadow-xs ${
                  isActive
                    ? "border-indigo ring-2 ring-indigo/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="relative h-24 w-full bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {isActive && (
                    <span className="absolute top-1.5 left-1.5 bg-indigo text-white text-[10px] font-medium px-1.5 py-0.5 rounded shadow">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveFromGallery(url)}
                    title="Remove from rotation"
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-white/90 hover:bg-crimson hover:text-white text-slate-600 flex items-center justify-center transition-colors shadow-sm"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="p-2 flex items-center justify-between text-[11px]">
                  {!isActive ? (
                    <button
                      type="button"
                      onClick={() => onSelectActive(url)}
                      className="text-indigo font-medium hover:underline text-[11px]"
                    >
                      Set as primary
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[10px]">Default</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Images Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
        <label className="cursor-pointer flex-none">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUploadImages(e.target.files);
              }
              e.target.value = "";
            }}
          />
          <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 bg-indigo/10 text-indigo hover:bg-indigo/15 transition-colors w-full sm:w-auto">
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload images (multi-select)"}
          </span>
        </label>

        <form onSubmit={handleAddUrlSubmit} className="flex-1 flex gap-1.5">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Or paste image URL to add to rotation…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-indigo"
          />
          <button
            type="submit"
            disabled={!urlInput.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-ink hover:bg-slate-200 disabled:opacity-50 transition-colors flex-none"
          >
            Add URL
          </button>
        </form>
      </div>
    </div>
  );
}

export default function HomeCmsPage() {
  const { content, hydrated, save, resetToDefault } = useCms();
  const [draft, setDraft] = useState<HomeCmsContent>(content);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [uploadingField, setUploadingField] = useState<"hero" | "heroMobile" | "about" | null>(null);

  // Sync the editable draft with persisted content once it has loaded from
  // the API, so the form doesn't briefly show defaults then jump.
  useEffect(() => {
    if (hydrated) setDraft(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    api
      .get("/api/courses")
      .then((body) => setAllCourses(body.courses))
      .catch(() => setAllCourses([]));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await save(draft);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!window.confirm("Reset the form to default content? Click Save afterward to publish it.")) return;
    resetToDefault();
    setDraft(defaultHomeContent);
  }

  async function uploadImage(field: "hero" | "heroMobile" | "about", file: File) {
    setUploadingField(field);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const body = await api.upload("/api/cms/upload-image", formData);
      if (field === "hero") {
        setDraft((d) => ({
          ...d,
          hero: {
            ...d.hero,
            imageUrl: body.url,
            imageGallery: Array.from(new Set([...(d.hero.imageGallery ?? []), body.url])),
          },
        }));
      } else if (field === "heroMobile") {
        setDraft((d) => ({
          ...d,
          hero: {
            ...d.hero,
            mobileImageUrl: body.url,
            mobileImageGallery: Array.from(new Set([...(d.hero.mobileImageGallery ?? []), body.url])),
          },
        }));
      } else {
        setDraft((d) => ({
          ...d,
          about: {
            ...d.about,
            imageUrl: body.url,
            imageGallery: Array.from(new Set([...(d.about.imageGallery ?? []), body.url])),
          },
        }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed — try again.");
    } finally {
      setUploadingField(null);
    }
  }

  async function uploadMultipleImages(field: "hero" | "heroMobile" | "about", files: FileList) {
    setUploadingField(field);
    setError(null);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const body = await api.upload("/api/cms/upload-image", formData);
        urls.push(body.url);
      }
      if (urls.length === 0) return;

      if (field === "hero") {
        setDraft((d) => {
          const current = d.hero.imageGallery ?? [];
          return {
            ...d,
            hero: {
              ...d.hero,
              imageUrl: d.hero.imageUrl || urls[0],
              imageGallery: Array.from(new Set([...current, ...urls])),
            },
          };
        });
      } else if (field === "heroMobile") {
        setDraft((d) => {
          const current = d.hero.mobileImageGallery ?? [];
          return {
            ...d,
            hero: {
              ...d.hero,
              mobileImageUrl: d.hero.mobileImageUrl || urls[0],
              mobileImageGallery: Array.from(new Set([...current, ...urls])),
            },
          };
        });
      } else {
        setDraft((d) => {
          const current = d.about.imageGallery ?? [];
          return {
            ...d,
            about: {
              ...d.about,
              imageUrl: d.about.imageUrl || urls[0],
              imageGallery: Array.from(new Set([...current, ...urls])),
            },
          };
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed — try again.");
    } finally {
      setUploadingField(null);
    }
  }

  function addUrlToGallery(field: "hero" | "heroMobile" | "about", url: string) {
    if (field === "hero") {
      setDraft((d) => ({
        ...d,
        hero: {
          ...d.hero,
          imageUrl: d.hero.imageUrl || url,
          imageGallery: Array.from(new Set([...(d.hero.imageGallery ?? []), url])),
        },
      }));
    } else if (field === "heroMobile") {
      setDraft((d) => ({
        ...d,
        hero: {
          ...d.hero,
          mobileImageUrl: d.hero.mobileImageUrl || url,
          mobileImageGallery: Array.from(new Set([...(d.hero.mobileImageGallery ?? []), url])),
        },
      }));
    } else {
      setDraft((d) => ({
        ...d,
        about: {
          ...d.about,
          imageUrl: d.about.imageUrl || url,
          imageGallery: Array.from(new Set([...(d.about.imageGallery ?? []), url])),
        },
      }));
    }
  }

  function selectFromGallery(field: "hero" | "heroMobile" | "about", url: string) {
    if (field === "hero") {
      setDraft((d) => ({ ...d, hero: { ...d.hero, imageUrl: url } }));
    } else if (field === "heroMobile") {
      setDraft((d) => ({ ...d, hero: { ...d.hero, mobileImageUrl: url } }));
    } else {
      setDraft((d) => ({ ...d, about: { ...d.about, imageUrl: url } }));
    }
  }

  function removeFromGallery(field: "hero" | "heroMobile" | "about", url: string) {
    if (field === "hero") {
      setDraft((d) => {
        const remaining = (d.hero.imageGallery ?? []).filter((u) => u !== url);
        const nextActive = d.hero.imageUrl === url ? (remaining[0] ?? "") : d.hero.imageUrl;
        return {
          ...d,
          hero: {
            ...d.hero,
            imageUrl: nextActive,
            imageGallery: remaining,
          },
        };
      });
    } else if (field === "heroMobile") {
      setDraft((d) => {
        const remaining = (d.hero.mobileImageGallery ?? []).filter((u) => u !== url);
        const nextActive = d.hero.mobileImageUrl === url ? (remaining[0] ?? "") : d.hero.mobileImageUrl;
        return {
          ...d,
          hero: {
            ...d.hero,
            mobileImageUrl: nextActive,
            mobileImageGallery: remaining,
          },
        };
      });
    } else {
      setDraft((d) => {
        const remaining = (d.about.imageGallery ?? []).filter((u) => u !== url);
        const nextActive = d.about.imageUrl === url ? (remaining[0] ?? "") : d.about.imageUrl;
        return {
          ...d,
          about: {
            ...d.about,
            imageUrl: nextActive,
            imageGallery: remaining,
          },
        };
      });
    }
  }

  // Featured courses ------------------------------------------------------
  const featured = draft.coursesSection.featuredCourseIds;
  function toggleCourse(id: string) {
    setDraft((d) => {
      const list = d.coursesSection.featuredCourseIds;
      const next = list.includes(id)
        ? list.filter((c) => c !== id)
        : [...list, id];
      return { ...d, coursesSection: { ...d.coursesSection, featuredCourseIds: next } };
    });
  }
  function moveCourse(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const list = [...d.coursesSection.featuredCourseIds];
      const i = list.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, coursesSection: { ...d.coursesSection, featuredCourseIds: list } };
    });
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Home page CMS"
        subtitle="Everything here controls the public home page — changes go live for visitors once saved."
        action={
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">
                <ExternalLink size={14} /> View home page
              </Button>
            </a>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {savedFlash ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : saving ? (
                "Saving…"
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        }
      />

      {error && (
        <p className="text-sm text-crimson bg-crimson/5 border border-crimson/20 rounded-lg px-4 py-2.5 mb-6">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {/* Brand & theme */}
        <SectionCard title="Brand & theme">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Site name">
              <input
                className={inputClass}
                value={draft.brand.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, brand: { ...d.brand, name: e.target.value } }))
                }
              />
            </Field>
            <Field label="Tagline">
              <input
                className={inputClass}
                value={draft.brand.tagline}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, brand: { ...d.brand, tagline: e.target.value } }))
                }
              />
            </Field>
          </div>
          <Field label="Default appearance for new visitors">
            <div className="flex gap-2 mt-1">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, defaultTheme: t }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    draft.defaultTheme === t
                      ? "border-indigo bg-indigo/10 text-indigo"
                      : "border-slate-200 text-slate hover:text-ink"
                  }`}
                >
                  {t === "light" ? "Light mode" : "Dark mode"}
                </button>
              ))}
            </div>
          </Field>
        </SectionCard>

        {/* Hero */}
        <SectionCard
          title="Hero banner"
          description="A pure visual banner at the top of the page. Upload multiple images to enable rotation on refresh, and position them with live crop preview."
        >
          {/* Multi-image rotation manager for desktop */}
          <MultiImageRotationManager
            title="Desktop Banner Images"
            description="Add one or more images. When rotation is enabled, visitors will see a different banner each time they visit or refresh the home page."
            activeUrl={draft.hero.imageUrl}
            gallery={draft.hero.imageGallery ?? []}
            randomiseOnLoad={draft.hero.randomiseOnLoad ?? false}
            onToggleRandomise={(checked) =>
              setDraft((d) => ({ ...d, hero: { ...d.hero, randomiseOnLoad: checked } }))
            }
            onSelectActive={(url) => selectFromGallery("hero", url)}
            onRemoveFromGallery={(url) => removeFromGallery("hero", url)}
            onUploadImages={(files) => uploadMultipleImages("hero", files)}
            onAddUrl={(url) => addUrlToGallery("hero", url)}
            uploading={uploadingField === "hero"}
          />

          {/* Live crop & position editor for desktop banner */}
          {draft.hero.imageUrl && (
            <ImagePlacementEditor
              title="Desktop Banner Crop & Alignment"
              subtitle="Interactive preview of how the banner is cropped on desktop. Click any position on the grid to change the focal point."
              imageUrl={draft.hero.imageUrl}
              position={draft.hero.imagePosition}
              onChangePosition={(pos) =>
                setDraft((d) => ({ ...d, hero: { ...d.hero, imagePosition: pos } }))
              }
              aspectRatioClass="aspect-[16/6]"
            />
          )}

          {/* Mobile banner section */}
          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col gap-4">
            <div>
              <h3 className="font-display font-semibold text-sm text-ink">Mobile Banner (Optional)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Wide desktop banners can crop heavily on phones. You can provide mobile-specific images here, or leave empty to use the desktop banner.
              </p>
            </div>

            <MultiImageRotationManager
              title="Mobile Banner Images"
              description="Separate images optimized for phone screen widths."
              activeUrl={draft.hero.mobileImageUrl ?? ""}
              gallery={draft.hero.mobileImageGallery ?? []}
              randomiseOnLoad={draft.hero.randomiseOnLoad ?? false}
              onToggleRandomise={(checked) =>
                setDraft((d) => ({ ...d, hero: { ...d.hero, randomiseOnLoad: checked } }))
              }
              onSelectActive={(url) => selectFromGallery("heroMobile", url)}
              onRemoveFromGallery={(url) => removeFromGallery("heroMobile", url)}
              onUploadImages={(files) => uploadMultipleImages("heroMobile", files)}
              onAddUrl={(url) => addUrlToGallery("heroMobile", url)}
              uploading={uploadingField === "heroMobile"}
            />

            {draft.hero.mobileImageUrl && (
              <ImagePlacementEditor
                title="Mobile Banner Crop & Alignment"
                subtitle="Preview of the crop on a mobile screen aspect ratio."
                imageUrl={draft.hero.mobileImageUrl}
                position={draft.hero.mobileImagePosition}
                onChangePosition={(pos) =>
                  setDraft((d) => ({ ...d, hero: { ...d.hero, mobileImagePosition: pos } }))
                }
                aspectRatioClass="aspect-[16/9]"
              />
            )}
          </div>

          <Field label="Banner alt text (accessibility)">
            <input
              className={inputClass}
              placeholder="Describe the banner for screen readers"
              value={draft.hero.altText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, hero: { ...d.hero, altText: e.target.value } }))
              }
            />
          </Field>
        </SectionCard>

        {/* About */}
        <SectionCard title="About section">
          {/* Multi-image rotation manager for about */}
          <MultiImageRotationManager
            title="About Section Photos"
            description="Add one or more photos. When rotation is enabled, visitors will see a different photo each time they open or refresh the page."
            activeUrl={draft.about.imageUrl}
            gallery={draft.about.imageGallery ?? []}
            randomiseOnLoad={draft.about.randomiseOnLoad ?? false}
            onToggleRandomise={(checked) =>
              setDraft((d) => ({ ...d, about: { ...d.about, randomiseOnLoad: checked } }))
            }
            onSelectActive={(url) => selectFromGallery("about", url)}
            onRemoveFromGallery={(url) => removeFromGallery("about", url)}
            onUploadImages={(files) => uploadMultipleImages("about", files)}
            onAddUrl={(url) => addUrlToGallery("about", url)}
            uploading={uploadingField === "about"}
          />

          {/* Live crop & position editor for about photo */}
          {draft.about.imageUrl && (
            <ImagePlacementEditor
              title="About Photo Alignment & Crop"
              subtitle="Interactive preview of how the team photo aligns in the card."
              imageUrl={draft.about.imageUrl}
              position={draft.about.imagePosition}
              onChangePosition={(pos) =>
                setDraft((d) => ({ ...d, about: { ...d.about, imagePosition: pos } }))
              }
              aspectRatioClass="aspect-[4/3]"
            />
          )}
          <Field label="Title">
            <input
              className={inputClass}
              value={draft.about.title}
              onChange={(e) =>
                setDraft((d) => ({ ...d, about: { ...d.about, title: e.target.value } }))
              }
            />
          </Field>
          <Field label="Body">
            <textarea
              className={inputClass}
              rows={4}
              value={draft.about.body}
              onChange={(e) =>
                setDraft((d) => ({ ...d, about: { ...d.about, body: e.target.value } }))
              }
            />
          </Field>
          <div>
            <span className={labelClass}>Highlight stats</span>
            <div className="flex flex-col gap-2">
              {draft.about.highlights.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Value, e.g. 5+"
                    value={h.value}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        about: {
                          ...d.about,
                          highlights: d.about.highlights.map((x, xi) =>
                            xi === i ? { ...x, value: e.target.value } : x
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Label, e.g. Departments covered"
                    value={h.label}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        about: {
                          ...d.about,
                          highlights: d.about.highlights.map((x, xi) =>
                            xi === i ? { ...x, label: e.target.value } : x
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        about: {
                          ...d.about,
                          highlights: d.about.highlights.filter((_, xi) => xi !== i),
                        },
                      }))
                    }
                    className="flex-none px-2 text-slate hover:text-crimson"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    about: {
                      ...d.about,
                      highlights: [...d.about.highlights, { label: "", value: "" }],
                    },
                  }))
                }
              >
                <Plus size={14} /> Add stat
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Courses section */}
        <SectionCard
          title="Courses section"
          description="Choose which courses appear on the home page, and in what order. Leave all unchecked to show every course."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Section title">
              <input
                className={inputClass}
                value={draft.coursesSection.title}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    coursesSection: { ...d.coursesSection, title: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Section subtitle">
              <input
                className={inputClass}
                value={draft.coursesSection.subtitle}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    coursesSection: { ...d.coursesSection, subtitle: e.target.value },
                  }))
                }
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            {allCourses.map((c) => {
              const isFeatured = featured.includes(c.id);
              const idx = featured.indexOf(c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={() => toggleCourse(c.id)}
                    className="h-4 w-4 accent-indigo"
                  />
                  <span className="flex-1 text-sm text-ink">{c.title}</span>
                  {isFeatured && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveCourse(c.id, -1)}
                        disabled={idx === 0}
                        className="text-slate hover:text-ink disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCourse(c.id, 1)}
                        disabled={idx === featured.length - 1}
                        className="text-slate hover:text-ink disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Footer */}
        <SectionCard title="Footer">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tagline">
              <input
                className={inputClass}
                value={draft.footer.tagline}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, footer: { ...d.footer, tagline: e.target.value } }))
                }
              />
            </Field>
            <Field label="Contact email">
              <input
                className={inputClass}
                value={draft.footer.email}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, footer: { ...d.footer, email: e.target.value } }))
                }
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={draft.footer.phone}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, footer: { ...d.footer, phone: e.target.value } }))
                }
              />
            </Field>
            <Field label="Address">
              <input
                className={inputClass}
                value={draft.footer.address}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, footer: { ...d.footer, address: e.target.value } }))
                }
              />
            </Field>
          </div>
        </SectionCard>

        <div className="flex items-center justify-between pb-10">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-sm text-slate hover:text-crimson"
          >
            <RotateCcw size={14} /> Reset to defaults
          </button>
          <Button onClick={handleSave} disabled={saving}>
            {savedFlash ? (
              <>
                <Check size={14} /> Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}