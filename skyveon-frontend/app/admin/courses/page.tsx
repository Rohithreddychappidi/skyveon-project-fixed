"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Course } from "@/lib/api-types";
import { Plus, X, BookOpen, Layers } from "lucide-react";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", department: "" });

  async function load() {
    setLoading(true);
    const body = await api.get("/api/courses");
    setCourses(body.courses);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/api/courses", form);
      setForm({ title: "", description: "", department: "" });
      setPanelOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create course — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle={loading ? "Loading…" : `${courses.length} course${courses.length === 1 ? "" : "s"}`}
        action={
          <Button onClick={() => setPanelOpen(true)}>
            <Plus size={16} /> New course
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`}>
            <Card className="p-5 h-full hover:border-indigo/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <span className="h-9 w-9 rounded-lg bg-orange/10 flex items-center justify-center">
                  <BookOpen size={18} className="text-orange" />
                </span>
                <Badge tone="cool">{course.department}</Badge>
              </div>
              <h3 className="font-display font-semibold text-ink mb-1">{course.title}</h3>
              <p className="text-sm text-slate line-clamp-2 mb-4">{course.description}</p>
              <span className="flex items-center gap-1 text-xs text-slate font-mono">
                <Layers size={12} />
                {course.lessons.length} lesson{course.lessons.length === 1 ? "" : "s"}
              </span>
            </Card>
          </Link>
        ))}
        {!loading && courses.length === 0 && (
          <p className="text-sm text-slate col-span-full py-8 text-center">
            No courses yet — create your first one.
          </p>
        )}
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-20 flex justify-end bg-ink/20">
          <div className="w-full max-w-md h-full bg-white border-l border-slate-200 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-lg text-ink">New course</h3>
              <button onClick={() => setPanelOpen(false)}>
                <X size={20} className="text-slate" />
              </button>
            </div>
            <form onSubmit={createCourse} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Responsible AI & ML Practices"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="What this course covers"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Department</span>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Cloud & DevOps"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                />
              </label>
              {error && <p className="text-xs text-crimson">{error}</p>}
              <Button type="submit" className="w-full mt-2" disabled={submitting}>
                {submitting ? "Creating…" : "Create course"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
