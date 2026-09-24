"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError, resolveImageUrl } from "@/lib/api";
import type { Course } from "@/lib/api-types";
import { Plus, X, BookOpen, Layers, Trash2, Pencil, Upload, ImageIcon } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", department: "", imageUrl: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const body = await api.get("/api/courses");
    setCourses(body.courses);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreatePanel() {
    setEditingCourse(null);
    setForm({ title: "", description: "", department: "", imageUrl: "" });
    setError(null);
    setPanelOpen(true);
  }

  function openEditPanel(e: React.MouseEvent, course: Course) {
    e.preventDefault();
    e.stopPropagation();
    setEditingCourse(course);
    setForm({
      title: course.title,
      description: course.description,
      department: course.department,
      imageUrl: course.imageUrl ?? "",
    });
    setError(null);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingCourse(null);
    setError(null);
  }

  async function uploadCoverImage(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      let body: { url: string };
      try {
        body = await api.upload("/api/courses/upload-cover-image", fd);
      } catch {
        body = await api.upload("/api/cms/upload-image", fd);
      }
      setForm((f) => ({ ...f, imageUrl: body.url }));
    } catch {
      setError("Image upload failed — try again.");
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingCourse) {
        await api.patch(`/api/courses/${editingCourse.id}`, {
          title: form.title,
          description: form.description,
          department: form.department,
          imageUrl: form.imageUrl || null,
        });
      } else {
        await api.post("/api/courses", {
          title: form.title,
          description: form.description,
          department: form.department,
          imageUrl: form.imageUrl || undefined,
        });
      }
      closePanel();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCourse(e: React.MouseEvent, course: Course) {
    e.preventDefault();
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete "${course.title}"? This hides it from every list — employees lose access, but existing progress/submission history is kept, not erased.`
      )
    )
      return;
    await api.delete(`/api/courses/${course.id}`);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle={loading ? "Loading…" : `${courses.length} course${courses.length === 1 ? "" : "s"}`}
        action={
          <Button onClick={openCreatePanel}>
            <Plus size={16} /> New course
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`}>
            <Card className="p-0 h-full hover:border-indigo/30 transition-colors overflow-hidden">
              {/* Cover image */}
              {course.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageUrl(course.imageUrl)}
                  alt={course.title}
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <ImageIcon size={28} className="text-slate-300" />
                </div>
              )}

              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="h-9 w-9 rounded-lg bg-orange/10 flex items-center justify-center">
                    <BookOpen size={18} className="text-orange" />
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge tone="cool">{course.department}</Badge>
                    <button
                      onClick={(e) => openEditPanel(e, course)}
                      title="Edit course"
                      className="p-1 text-slate-300 hover:text-indigo transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => deleteCourse(e, course)}
                      title="Delete course"
                      className="p-1 text-slate-300 hover:text-crimson transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="font-display font-semibold text-ink mb-1">{course.title}</h3>
                <p className="text-sm text-slate line-clamp-2 mb-4">{course.description}</p>
                <span className="flex items-center gap-1 text-xs text-slate font-mono">
                  <Layers size={12} />
                  {course.lessons.length} lesson{course.lessons.length === 1 ? "" : "s"}
                </span>
              </div>
            </Card>
          </Link>
        ))}
        {!loading && courses.length === 0 && (
          <p className="text-sm text-slate col-span-full py-8 text-center">
            No courses yet — create your first one.
          </p>
        )}
      </div>

      {/* Create / Edit slide-over panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-20 flex justify-end bg-ink/20" onClick={closePanel}>
          <div
            className="w-full max-w-md h-full bg-white border-l border-slate-200 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-lg text-ink">
                {editingCourse ? "Edit course" : "New course"}
              </h3>
              <button onClick={closePanel}>
                <X size={20} className="text-slate" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Responsible AI & ML Practices"
                  className={inputClass}
                  required
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What this course covers"
                  className={inputClass}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Department</span>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Cloud & DevOps"
                  className={inputClass}
                />
              </label>

              {/* Cover image */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Cover image</span>
                {form.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImageUrl(form.imageUrl)}
                    alt="Cover preview"
                    className="w-full h-36 object-cover rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="w-full h-36 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                    <ImageIcon size={28} className="text-slate-300" />
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <label className="cursor-pointer">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadCoverImage(file);
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 text-sm text-indigo hover:underline">
                      <Upload size={14} /> {uploadingImage ? "Uploading…" : form.imageUrl ? "Replace image" : "Upload image"}
                    </span>
                  </label>
                  {form.imageUrl && !uploadingImage && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="text-xs text-slate hover:text-crimson"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate">
                  Or paste a direct URL:
                </p>
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://…"
                  className={inputClass}
                />
              </div>

              {error && <p className="text-xs text-crimson">{error}</p>}

              <Button type="submit" className="w-full mt-2" disabled={submitting || uploadingImage}>
                {submitting ? (editingCourse ? "Saving…" : "Creating…") : (editingCourse ? "Save changes" : "Create course")}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}