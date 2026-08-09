"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCms } from "@/components/cms/cms-context";
import { defaultHomeContent } from "@/lib/cms-data";
import type { HomeCmsContent } from "@/lib/cms-types";
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

// Module-scope (not nested in HomeCmsPage) — see the note in
// app/admin/courses/[id]/page.tsx about why inline component definitions
// inside another component's render body are best avoided: they get a new
// identity on every render, which can cause unexpected remounts.
function ImageUploadField({
  label,
  hint,
  value,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  hint?: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {hint && <p className="text-xs text-slate mb-2 -mt-1">{hint}</p>}
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(value)}
            alt=""
            className="h-14 w-14 rounded-lg object-cover border border-slate-200 flex-none"
          />
        ) : (
          <div className="h-14 w-14 rounded-lg border border-dashed border-slate-200 flex-none" />
        )}
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-indigo hover:underline">
            <Upload size={14} /> {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </span>
        </label>
        {value && !uploading && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-slate hover:text-crimson"
          >
            <XIcon size={12} /> Remove
          </button>
        )}
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
        setDraft((d) => ({ ...d, hero: { ...d.hero, imageUrl: body.url } }));
      } else if (field === "heroMobile") {
        setDraft((d) => ({ ...d, hero: { ...d.hero, mobileImageUrl: body.url } }));
      } else {
        setDraft((d) => ({ ...d, about: { ...d.about, imageUrl: body.url } }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed — try again.");
    } finally {
      setUploadingField(null);
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
          description="A pure visual banner at the top of the page — no headline or body copy by design. Leave the image blank to use the generated clay/glass illustration."
        >
          <ImageUploadField
            label="Banner image"
            hint="Leave empty to use the generated clay/glass illustration instead."
            value={draft.hero.imageUrl}
            uploading={uploadingField === "hero"}
            onUpload={(file) => uploadImage("hero", file)}
            onClear={() => setDraft((d) => ({ ...d, hero: { ...d.hero, imageUrl: "" } }))}
          />
          <div className="mt-4">
            <ImageUploadField
              label="Mobile banner image (optional)"
              hint="A separate crop for small screens — a wide desktop banner often needs heavy cropping to fit a phone width, so this lets you pick something that looks right there instead. Falls back to the banner image above if left empty."
              value={draft.hero.mobileImageUrl ?? ""}
              uploading={uploadingField === "heroMobile"}
              onUpload={(file) => uploadImage("heroMobile", file)}
              onClear={() => setDraft((d) => ({ ...d, hero: { ...d.hero, mobileImageUrl: "" } }))}
            />
          </div>
          <Field label="Image alt text">
            <input
              className={inputClass}
              placeholder="Describe the image for screen readers"
              value={draft.hero.altText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, hero: { ...d.hero, altText: e.target.value } }))
              }
            />
          </Field>
        </SectionCard>

        {/* About */}
        <SectionCard title="About section">
          <ImageUploadField
            label="Photo"
            hint="Leave empty to use the generated clay/glass illustration instead."
            value={draft.about.imageUrl}
            uploading={uploadingField === "about"}
            onUpload={(file) => uploadImage("about", file)}
            onClear={() => setDraft((d) => ({ ...d, about: { ...d.about, imageUrl: "" } }))}
          />
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