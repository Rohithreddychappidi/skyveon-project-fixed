"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonTypeIcon, lessonTypeLabel } from "@/components/ui/lesson-icon";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Course, Lesson, LessonType, LessonSubmission } from "@/lib/api-types";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  RefreshCw,
  ExternalLink,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Check,
  X as XIcon,
  Download,
} from "lucide-react";

const LESSON_TYPES: LessonType[] = ["VIDEO", "PDF", "PPT", "DOC", "IMAGE", "LINK", "ASSIGNMENT"];

interface NewLessonState {
  title: string;
  type: LessonType;
  linkUrl: string;
  assignmentPrompt: string;
}

const EMPTY_NEW_LESSON: NewLessonState = { title: "", type: "VIDEO", linkUrl: "", assignmentPrompt: "" };

// Module-scope, not defined inside CourseDetailPage: these must keep a
// stable identity across renders. Defining a component inside another
// component's body creates a brand-new function (and therefore a brand-new
// component type) on every render, which makes React unmount + remount it
// whenever the parent re-renders — e.g. on every keystroke, since typing
// updates state. That remount was why the assignment-prompt textarea kept
// losing focus back to the title field (which has autoFocus) after each// character typed.
function InsertDivider({ position, insertAt, onOpen }: { position: number; insertAt: number | null; onOpen: (p: number) => void }) {
  if (insertAt === position) return null; // form is already open right here
  return (
    <button
      onClick={() => onOpen(position)}
      className="group w-full flex items-center gap-2 py-1 text-slate-300 hover:text-indigo transition-colors"
    >
      <span className="flex-1 border-t border-dashed border-slate-200 group-hover:border-indigo/40 transition-colors" />
      <span className="text-[11px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus size={12} /> Insert lesson here
      </span>
      <span className="flex-1 border-t border-dashed border-slate-200 group-hover:border-indigo/40 transition-colors" />
    </button>
  );
}

function AddLessonForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  error,
}: {
  value: NewLessonState;
  onChange: (next: NewLessonState) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-indigo/30 bg-indigo/[0.02] p-4 my-2 flex flex-col gap-3">
      <input
        autoFocus
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
        placeholder="Lesson title"
        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
      />
      <select
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value as LessonType })}
        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
      >
        {LESSON_TYPES.map((t) => (
          <option key={t} value={t}>
            {lessonTypeLabel[t]}
          </option>
        ))}
      </select>
      {value.type === "LINK" && (
        <input
          value={value.linkUrl}
          onChange={(e) => onChange({ ...value, linkUrl: e.target.value })}
          placeholder="https://…"
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
        />
      )}
      {value.type === "ASSIGNMENT" && (
        <>
          <textarea
            value={value.assignmentPrompt}
            onChange={(e) => onChange({ ...value, assignmentPrompt: e.target.value })}
            placeholder="Instructions for the employee — what should they submit?"
            rows={3}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
          />
          <p className="text-xs text-slate -mt-1">
            Employees must submit a response here before any later lesson in this course unlocks.
          </p>
        </>
      )}
      {error && <p className="text-xs text-crimson">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="w-fit">
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = form closed. A number = form open, inserting at that position
  // (0 = before the first lesson, lessons.length = append at the end).
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [newLesson, setNewLesson] = useState<NewLessonState>(EMPTY_NEW_LESSON);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [expandedSubmissions, setExpandedSubmissions] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<LessonSubmission[]>([]);
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [durationInput, setDurationInput] = useState("");

  async function load() {
    const body = await api.get(`/api/courses/${params.id}`);
    setCourse(body.course);
    return body.course as Course;
  }

  useEffect(() => {
    load().catch(() => setError("Couldn't load this course."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function openAddForm(position: number) {
    setInsertAt(position);
    setNewLesson(EMPTY_NEW_LESSON);
    setError(null);
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (insertAt === null || !course) return;
    if (!newLesson.title) return;
    if (newLesson.type === "LINK" && !newLesson.linkUrl) {
      setError("A link URL is required for link lessons.");
      return;
    }
    if (newLesson.type === "ASSIGNMENT" && !newLesson.assignmentPrompt) {
      setError("Instructions are required for assignment lessons.");
      return;
    }
    setError(null);
    try {
      const { lesson } = await api.post(`/api/courses/${params.id}/lessons`, {
        title: newLesson.title,
        type: newLesson.type,
        linkUrl: newLesson.type === "LINK" ? newLesson.linkUrl : undefined,
        assignmentPrompt: newLesson.type === "ASSIGNMENT" ? newLesson.assignmentPrompt : undefined,
      });

      // New lessons are always created at the end — if the admin picked an
      // earlier insertion point, immediately reorder it into place so
      // "add an assignment between lesson 2 and 3" actually works.
      if (insertAt < course.lessons.length) {
        const ids = course.lessons.map((l) => l.id);
        ids.splice(insertAt, 0, lesson.id);
        await api.patch(`/api/courses/${params.id}/lessons/reorder`, { lessonIds: ids });
      }

      setInsertAt(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add lesson.");
    }
  }

  async function removeLesson(lessonId: string) {
    if (!window.confirm("Remove this lesson? It will be hidden but progress history is kept.")) return;
    await api.delete(`/api/courses/lessons/${lessonId}`);
    await load();
  }

  async function moveLesson(lesson: Lesson, dir: -1 | 1) {
    if (!course) return;
    const ids = course.lessons.map((l) => l.id);
    const i = ids.indexOf(lesson.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api.patch(`/api/courses/${params.id}/lessons/reorder`, { lessonIds: ids });
    await load();
  }

  async function uploadFile(lessonId: string, file: File) {
    setUploadingLessonId(lessonId);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload(`/api/courses/lessons/${lessonId}/upload`, formData);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed — try again.");
    } finally {
      setUploadingLessonId(null);
    }
  }

  async function retryConversion(lessonId: string) {
    await api.post(`/api/courses/lessons/${lessonId}/retry-conversion`);
    await load();
  }

  function formatDuration(seconds: number | null | undefined) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function openDurationEditor(lesson: Lesson) {
    setEditingDurationId(lesson.id);
    setDurationInput(lesson.durationSeconds ? formatDuration(lesson.durationSeconds) ?? "" : "");
  }

  async function saveDuration(lessonId: string) {
    const match = durationInput.trim().match(/^(\d+):(\d{1,2})$/);
    const seconds = match
      ? parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
      : /^\d+$/.test(durationInput.trim())
      ? parseInt(durationInput.trim(), 10)
      : null;
    if (!seconds || seconds <= 0) {
      setError("Enter a duration as minutes:seconds (e.g. 4:30) or total seconds.");
      return;
    }
    setError(null);
    await api.patch(`/api/courses/lessons/${lessonId}`, { durationSeconds: seconds });
    setEditingDurationId(null);
    await load();
  }

  async function toggleSubmissions(lessonId: string) {
    if (expandedSubmissions === lessonId) {
      setExpandedSubmissions(null);
      return;
    }
    const body = await api.get(`/api/courses/lessons/${lessonId}/submissions`);
    setSubmissions(body.submissions);
    setExpandedSubmissions(lessonId);
  }

  async function reviewSubmission(submissionId: string, status: "APPROVED" | "REJECTED") {
    const body = await api.patch(`/api/courses/submissions/${submissionId}/review`, { status });
    setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? body.submission : s)));
  }

  async function downloadSubmissionFile(submission: LessonSubmission) {
    if (!submission.fileName) return;
    try {
      await downloadFile(`/api/courses/submissions/${submission.id}/file`, submission.fileName);
    } catch {
      setError("Couldn't download that file.");
    }
  }

  if (error && !course) {
    return <p className="text-sm text-crimson">{error}</p>;
  }
  if (!course) {
    return <p className="text-sm text-slate">Loading…</p>;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={course.title}
        subtitle={course.description || "No description yet."}
        action={
          <Button variant="ghost" size="sm" onClick={() => router.push("/admin/courses")}>
            Back to courses
          </Button>
        }
      />

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-ink">Lessons</h3>
          <Button size="sm" onClick={() => openAddForm(course.lessons.length)}>
            <Plus size={14} /> Add lesson
          </Button>
        </div>

        <p className="text-xs text-slate mb-3">
          Hover between two lessons to insert one there — handy for slotting an assignment in the
          middle of a course to gate what comes after it.
        </p>

        <div className="flex flex-col">
          <InsertDivider position={0} insertAt={insertAt} onOpen={openAddForm} />
          {insertAt === 0 && (
            <AddLessonForm
              value={newLesson}
              onChange={setNewLesson}
              onSubmit={addLesson}
              onCancel={() => setInsertAt(null)}
              error={error}
            />
          )}

          {course.lessons.map((lesson, i) => (
            <div key={lesson.id}>
              <div className="py-3 flex items-center gap-3 border-t border-slate-100 first:border-t-0">
                <span className="h-8 w-8 flex-none rounded-lg bg-slate-50 flex items-center justify-center">
                  <LessonTypeIcon type={lesson.type} className="h-4 w-4 text-slate" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{lesson.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate">{lessonTypeLabel[lesson.type]}</span>
                    {lesson.type === "LINK" ? (
                      <a
                        href={lesson.linkUrl ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink size={10} /> open
                      </a>
                    ) : lesson.type === "ASSIGNMENT" ? (
                      <Badge tone="cool">gates later lessons</Badge>
                    ) : lesson.fileName ? (
                      <Badge tone="success">{lesson.fileName}</Badge>
                    ) : (
                      <Badge tone="neutral">no file uploaded</Badge>
                    )}
                    {(lesson.type === "PPT" || lesson.type === "DOC") && (
                      <Badge
                        tone={
                          lesson.conversionStatus === "DONE"
                            ? "success"
                            : lesson.conversionStatus === "FAILED"
                            ? "warm"
                            : "neutral"
                        }
                      >
                        {lesson.conversionStatus.toLowerCase().replace("_", " ")}
                      </Badge>
                    )}
                    {lesson.type === "VIDEO" && editingDurationId !== lesson.id && (
                      <button
                        onClick={() => openDurationEditor(lesson)}
                        className="inline-flex"
                        title="Click to set/edit duration"
                      >
                        {lesson.durationSeconds ? (
                          <Badge tone="neutral">{formatDuration(lesson.durationSeconds)}</Badge>
                        ) : (
                          <Badge tone="warm">duration not set — won&apos;t complete</Badge>
                        )}
                      </button>
                    )}
                    {lesson.type === "VIDEO" && editingDurationId === lesson.id && (
                      <span className="inline-flex items-center gap-1">
                        <input
                          autoFocus
                          value={durationInput}
                          onChange={(e) => setDurationInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveDuration(lesson.id)}
                          placeholder="mm:ss"
                          className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-indigo"
                        />
                        <button onClick={() => saveDuration(lesson.id)} className="text-xs text-indigo hover:underline">
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDurationId(null)}
                          className="text-xs text-slate hover:text-crimson"
                        >
                          Cancel
                        </button>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-none">
                  {lesson.type === "ASSIGNMENT" && (
                    <button
                      onClick={() => toggleSubmissions(lesson.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate hover:text-indigo"
                    >
                      <ClipboardCheck size={13} /> Submissions
                      {expandedSubmissions === lesson.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                  {lesson.type !== "LINK" && lesson.type !== "ASSIGNMENT" && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadFile(lesson.id, file);
                          e.target.value = "";
                        }}
                      />
                      <span className="inline-flex items-center gap-1 text-xs text-slate hover:text-indigo">
                        <Upload size={13} />
                        {uploadingLessonId === lesson.id ? "Uploading…" : "Upload"}
                      </span>
                    </label>
                  )}
                  {lesson.conversionStatus === "FAILED" && (
                    <button
                      onClick={() => retryConversion(lesson.id)}
                      className="text-slate hover:text-indigo"
                      title="Retry conversion"
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => moveLesson(lesson, -1)}
                    disabled={i === 0}
                    className="text-slate hover:text-ink disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => moveLesson(lesson, 1)}
                    disabled={i === course.lessons.length - 1}
                    className="text-slate hover:text-ink disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button onClick={() => removeLesson(lesson.id)} className="text-slate hover:text-crimson">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedSubmissions === lesson.id && (
                <div className="pb-4 pl-11 flex flex-col gap-2">
                  {submissions.length === 0 && <p className="text-xs text-slate">No submissions yet.</p>}
                  {submissions.map((s) => (
                    <div key={s.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-ink">
                          {s.employee?.name} <span className="text-slate font-normal">· {s.employee?.email}</span>
                        </p>
                        <Badge
                          tone={s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "warm" : "neutral"}
                        >
                          {s.status.toLowerCase()}
                        </Badge>
                      </div>
                      {s.responseText && (
                        <p className="text-sm text-ink whitespace-pre-wrap mb-2">{s.responseText}</p>
                      )}
                      {s.fileName && (
                        <button
                          onClick={() => downloadSubmissionFile(s)}
                          className="inline-flex items-center gap-1.5 text-xs text-indigo hover:underline mb-2"
                        >
                          <Download size={12} /> {s.fileName}
                        </button>
                      )}
                      {s.status === "SUBMITTED" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => reviewSubmission(s.id, "APPROVED")}
                            className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() => reviewSubmission(s.id, "REJECTED")}
                            className="inline-flex items-center gap-1 text-xs text-crimson hover:underline"
                          >
                            <XIcon size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <InsertDivider position={i + 1} insertAt={insertAt} onOpen={openAddForm} />
              {insertAt === i + 1 && (
                <AddLessonForm
                  value={newLesson}
                  onChange={setNewLesson}
                  onSubmit={addLesson}
                  onCancel={() => setInsertAt(null)}
                  error={error}
                />
              )}
            </div>
          ))}

          {course.lessons.length === 0 && (
            <p className="text-sm text-slate py-6 text-center">No lessons yet — add the first one.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
