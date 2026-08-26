"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonTypeIcon, lessonTypeLabel } from "@/components/ui/lesson-icon";
import { api, ApiError, downloadFile } from "@/lib/api";
import type { Course, Lesson, LessonType, LessonSubmission, Module } from "@/lib/api-types";
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
  Pencil,
  FolderPlus,
  Folder,
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
// losing focus back to the title field (which has autoFocus) after each
// character typed.
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

// A single lesson row — used both inside a module's list and in the
// ungrouped section. Kept as its own component (module scope, same
// stable-identity reasoning as above) since it's now rendered from two
// different places.
function LessonRow({
  lesson,
  i,
  count,
  editingTitleId,
  titleInput,
  onStartEditTitle,
  onTitleInputChange,
  onSaveTitle,
  onCancelEditTitle,
  editingDurationId,
  durationInput,
  onDurationInputChange,
  onOpenDurationEditor,
  onSaveDuration,
  onCancelDurationEditor,
  uploadingLessonId,
  onUploadFile,
  onRetryConversion,
  onMove,
  onRemove,
  expandedSubmissions,
  onToggleSubmissions,
  submissions,
  onReviewSubmission,
  onDownloadSubmissionFile,
  formatDuration,
}: {
  lesson: Lesson;
  i: number;
  count: number;
  editingTitleId: string | null;
  titleInput: string;
  onStartEditTitle: (lesson: Lesson) => void;
  onTitleInputChange: (v: string) => void;
  onSaveTitle: (lessonId: string) => void;
  onCancelEditTitle: () => void;
  editingDurationId: string | null;
  durationInput: string;
  onDurationInputChange: (v: string) => void;
  onOpenDurationEditor: (lesson: Lesson) => void;
  onSaveDuration: (lessonId: string) => void;
  onCancelDurationEditor: () => void;
  uploadingLessonId: string | null;
  onUploadFile: (lessonId: string, file: File) => void;
  onRetryConversion: (lessonId: string) => void;
  onMove: (lesson: Lesson, dir: -1 | 1) => void;
  onRemove: (lessonId: string) => void;
  expandedSubmissions: string | null;
  onToggleSubmissions: (lessonId: string) => void;
  submissions: LessonSubmission[];
  onReviewSubmission: (submissionId: string, status: "APPROVED" | "REJECTED") => void;
  onDownloadSubmissionFile: (submission: LessonSubmission) => void;
  formatDuration: (seconds: number | null | undefined) => string | null;
}) {
  return (
    <div>
      <div className="py-3 flex items-center gap-3 border-t border-slate-100 first:border-t-0">
        <span className="h-8 w-8 flex-none rounded-lg bg-slate-50 flex items-center justify-center">
          <LessonTypeIcon type={lesson.type} className="h-4 w-4 text-slate" />
        </span>
        <div className="flex-1 min-w-0">
          {editingTitleId === lesson.id ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={titleInput}
                onChange={(e) => onTitleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveTitle(lesson.id);
                  if (e.key === "Escape") onCancelEditTitle();
                }}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
              />
              <button onClick={() => onSaveTitle(lesson.id)} className="text-xs text-indigo hover:underline flex-none">
                Save
              </button>
              <button onClick={onCancelEditTitle} className="text-xs text-slate hover:text-crimson flex-none">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => onStartEditTitle(lesson)}
              className="group/title flex items-center gap-1.5 text-left"
              title="Click to rename"
            >
              <p className="text-sm font-medium text-ink truncate">{lesson.title}</p>
              <Pencil size={11} className="text-slate-300 group-hover/title:text-indigo flex-none transition-colors" />
            </button>
          )}
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
              <button onClick={() => onOpenDurationEditor(lesson)} className="inline-flex" title="Click to set/edit duration">
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
                  onChange={(e) => onDurationInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSaveDuration(lesson.id)}
                  placeholder="mm:ss"
                  className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-indigo"
                />
                <button onClick={() => onSaveDuration(lesson.id)} className="text-xs text-indigo hover:underline">
                  Save
                </button>
                <button onClick={onCancelDurationEditor} className="text-xs text-slate hover:text-crimson">
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-none">
          {lesson.type === "ASSIGNMENT" && (
            <button
              onClick={() => onToggleSubmissions(lesson.id)}
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
                  if (file) onUploadFile(lesson.id, file);
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
            <button onClick={() => onRetryConversion(lesson.id)} className="text-slate hover:text-indigo" title="Retry conversion">
              <RefreshCw size={14} />
            </button>
          )}
          <button onClick={() => onMove(lesson, -1)} disabled={i === 0} className="text-slate hover:text-ink disabled:opacity-30">
            <ArrowUp size={14} />
          </button>
          <button onClick={() => onMove(lesson, 1)} disabled={i === count - 1} className="text-slate hover:text-ink disabled:opacity-30">
            <ArrowDown size={14} />
          </button>
          <button onClick={() => onRemove(lesson.id)} className="text-slate hover:text-crimson">
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
                <Badge tone={s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "warm" : "neutral"}>
                  {s.status.toLowerCase()}
                </Badge>
              </div>
              {s.responseText && <p className="text-sm text-ink whitespace-pre-wrap mb-2">{s.responseText}</p>}
              {s.fileName && (
                <button
                  onClick={() => onDownloadSubmissionFile(s)}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo hover:underline mb-2"
                >
                  <Download size={12} /> {s.fileName}
                </button>
              )}
              {s.status === "SUBMITTED" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onReviewSubmission(s.id, "APPROVED")}
                    className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={() => onReviewSubmission(s.id, "REJECTED")}
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
    </div>
  );
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which module (or "ungrouped") the add-lesson form is currently open
  // for, and at what position within that module's own lesson list.
  // null = no form open anywhere.
  const [addTarget, setAddTarget] = useState<{ moduleId: string | null; position: number } | null>(null);
  const [newLesson, setNewLesson] = useState<NewLessonState>(EMPTY_NEW_LESSON);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [expandedSubmissions, setExpandedSubmissions] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<LessonSubmission[]>([]);
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [durationInput, setDurationInput] = useState("");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleTitleInput, setModuleTitleInput] = useState("");

  async function load() {
    const body = await api.get(`/api/courses/${params.id}`);
    setCourse(body.course);
    return body.course as Course;
  }

  useEffect(() => {
    load().catch(() => setError("Couldn't load this course."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function lessonsInModule(mod: Module | null) {
    if (!course) return [];
    return course.lessons
      .filter((l) => (mod ? l.moduleId === mod.id : !l.moduleId))
      .sort((a, b) => a.order - b.order);
  }

  // Rebuilds the FULL course-wide lesson order (every module's lessons, in
  // module order, followed by ungrouped lessons) and sends it through the
  // existing /lessons/reorder endpoint. That endpoint treats whatever array
  // it's given as the complete, authoritative order for the whole course —
  // it's what lessonGating.ts and the progress-percent math key off, so a
  // reorder within just one module still has to produce a full, valid
  // course-wide sequence, not just reindex that module in isolation.
  async function flattenAndPersistOrder(next: {
    modules: Module[];
    lessonsByModule: Map<string, Lesson[]>;
    ungrouped: Lesson[];
  }) {
    const ids: string[] = [];
    for (const mod of next.modules) {
      for (const l of next.lessonsByModule.get(mod.id) ?? []) ids.push(l.id);
    }
    for (const l of next.ungrouped) ids.push(l.id);
    await api.patch(`/api/courses/${params.id}/lessons/reorder`, { lessonIds: ids });
    await load();
  }

  function openAddForm(moduleId: string | null, position: number) {
    setAddTarget({ moduleId, position });
    setNewLesson(EMPTY_NEW_LESSON);
    setError(null);
  }

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!addTarget || !course) return;
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
        moduleId: addTarget.moduleId ?? undefined,
      });

      // New lessons are always created at the end of the whole course — if
      // the admin picked an earlier insertion point within this module's
      // list, immediately flatten + reorder so "add a lesson between these
      // two in this module" actually works, same as before modules existed.
      const targetModule = course.modules.find((m) => m.id === addTarget.moduleId) ?? null;
      const currentModuleLessons = lessonsInModule(targetModule);
      if (addTarget.position < currentModuleLessons.length) {
        const reordered = [...currentModuleLessons];
        reordered.splice(addTarget.position, 0, lesson);
        const lessonsByModule = new Map(course.modules.map((m) => [m.id, lessonsInModule(m)]));
        let ungrouped = lessonsInModule(null);
        if (targetModule) {
          lessonsByModule.set(targetModule.id, reordered);
        } else {
          ungrouped = reordered;
        }
        await flattenAndPersistOrder({ modules: course.modules, lessonsByModule, ungrouped });
      }

      setAddTarget(null);
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
    const mod = course.modules.find((m) => m.id === lesson.moduleId) ?? null;
    const list = lessonsInModule(mod);
    const i = list.findIndex((l) => l.id === lesson.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];

    const lessonsByModule = new Map(course.modules.map((m) => [m.id, lessonsInModule(m)]));
    let ungrouped = lessonsInModule(null);
    if (mod) {
      lessonsByModule.set(mod.id, reordered);
    } else {
      ungrouped = reordered;
    }
    await flattenAndPersistOrder({ modules: course.modules, lessonsByModule, ungrouped });
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

  function startEditTitle(lesson: Lesson) {
    setEditingTitleId(lesson.id);
    setTitleInput(lesson.title);
  }

  async function saveTitle(lessonId: string) {
    const title = titleInput.trim();
    if (!title) {
      setError("Lesson title can't be empty.");
      return;
    }
    setError(null);
    await api.patch(`/api/courses/lessons/${lessonId}`, { title });
    setEditingTitleId(null);
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

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    setError(null);
    try {
      await api.post(`/api/courses/${params.id}/modules`, { title: newModuleTitle.trim() });
      setNewModuleTitle("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add module.");
    } finally {
      setAddingModule(false);
    }
  }

  function startEditModule(mod: Module) {
    setEditingModuleId(mod.id);
    setModuleTitleInput(mod.title);
  }

  async function saveModuleTitle(moduleId: string) {
    const title = moduleTitleInput.trim();
    if (!title) return;
    await api.patch(`/api/courses/modules/${moduleId}`, { title });
    setEditingModuleId(null);
    await load();
  }

  async function moveModule(mod: Module, dir: -1 | 1) {
    if (!course) return;
    const mods = [...course.modules].sort((a, b) => a.order - b.order);
    const i = mods.findIndex((m) => m.id === mod.id);
    const j = i + dir;
    if (j < 0 || j >= mods.length) return;
    [mods[i], mods[j]] = [mods[j], mods[i]];
    await api.patch(`/api/courses/${params.id}/modules/reorder`, { moduleIds: mods.map((m) => m.id) });
    await load();
  }

  async function removeModule(moduleId: string) {
    if (!window.confirm("Remove this module? Its lessons stay in the course, just ungrouped.")) return;
    await api.delete(`/api/courses/modules/${moduleId}`);
    await load();
  }

  if (error && !course) {
    return <p className="text-sm text-crimson">{error}</p>;
  }
  if (!course) {
    return <p className="text-sm text-slate">Loading…</p>;
  }

  const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
  const ungroupedLessons = lessonsInModule(null);

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
          <h3 className="font-display font-semibold text-ink">Modules</h3>
        </div>
        <p className="text-xs text-slate mb-3">
          Group lessons into modules — e.g. &quot;Week 1&quot; or &quot;Onboarding Basics&quot;. Each module
          holds its own ordered list of lessons and assessments.
        </p>

        <form onSubmit={addModule} className="flex gap-2 mb-5">
          <input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="New module name"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
          />
          <Button type="submit" size="sm" disabled={addingModule || !newModuleTitle.trim()}>
            <FolderPlus size={14} /> {addingModule ? "Adding…" : "Add module"}
          </Button>
        </form>

        <div className="flex flex-col gap-5">
          {sortedModules.map((mod, mi) => {
            const modLessons = lessonsInModule(mod);
            return (
              <div key={mod.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-3">
                  <Folder size={15} className="text-slate flex-none" />
                  {editingModuleId === mod.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={moduleTitleInput}
                        onChange={(e) => setModuleTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveModuleTitle(mod.id)}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                      />
                      <button onClick={() => saveModuleTitle(mod.id)} className="text-xs text-indigo hover:underline flex-none">
                        Save
                      </button>
                      <button onClick={() => setEditingModuleId(null)} className="text-xs text-slate hover:text-crimson flex-none">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditModule(mod)}
                      className="group/mtitle flex-1 flex items-center gap-1.5 text-left"
                      title="Click to rename"
                    >
                      <span className="text-sm font-semibold text-ink">{mod.title}</span>
                      <Pencil size={11} className="text-slate-300 group-hover/mtitle:text-indigo transition-colors" />
                      <span className="text-xs text-slate font-normal ml-1">
                        {modLessons.length} lesson{modLessons.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  )}
                  <div className="flex items-center gap-1 flex-none">
                    <button
                      onClick={() => moveModule(mod, -1)}
                      disabled={mi === 0}
                      className="text-slate hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={() => moveModule(mod, 1)}
                      disabled={mi === sortedModules.length - 1}
                      className="text-slate hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => removeModule(mod.id)} className="text-slate hover:text-crimson">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="px-4">
                  <InsertDivider
                    position={0}
                    insertAt={addTarget?.moduleId === mod.id ? addTarget.position : null}
                    onOpen={(p) => openAddForm(mod.id, p)}
                  />
                  {addTarget?.moduleId === mod.id && addTarget.position === 0 && (
                    <AddLessonForm value={newLesson} onChange={setNewLesson} onSubmit={addLesson} onCancel={() => setAddTarget(null)} error={error} />
                  )}

                  {modLessons.map((lesson, i) => (
                    <div key={lesson.id}>
                      <LessonRow
                        lesson={lesson}
                        i={i}
                        count={modLessons.length}
                        editingTitleId={editingTitleId}
                        titleInput={titleInput}
                        onStartEditTitle={startEditTitle}
                        onTitleInputChange={setTitleInput}
                        onSaveTitle={saveTitle}
                        onCancelEditTitle={() => setEditingTitleId(null)}
                        editingDurationId={editingDurationId}
                        durationInput={durationInput}
                        onDurationInputChange={setDurationInput}
                        onOpenDurationEditor={openDurationEditor}
                        onSaveDuration={saveDuration}
                        onCancelDurationEditor={() => setEditingDurationId(null)}
                        uploadingLessonId={uploadingLessonId}
                        onUploadFile={uploadFile}
                        onRetryConversion={retryConversion}
                        onMove={moveLesson}
                        onRemove={removeLesson}
                        expandedSubmissions={expandedSubmissions}
                        onToggleSubmissions={toggleSubmissions}
                        submissions={submissions}
                        onReviewSubmission={reviewSubmission}
                        onDownloadSubmissionFile={downloadSubmissionFile}
                        formatDuration={formatDuration}
                      />
                      <InsertDivider
                        position={i + 1}
                        insertAt={addTarget?.moduleId === mod.id ? addTarget.position : null}
                        onOpen={(p) => openAddForm(mod.id, p)}
                      />
                      {addTarget?.moduleId === mod.id && addTarget.position === i + 1 && (
                        <AddLessonForm value={newLesson} onChange={setNewLesson} onSubmit={addLesson} onCancel={() => setAddTarget(null)} error={error} />
                      )}
                    </div>
                  ))}

                  {modLessons.length === 0 && addTarget?.moduleId !== mod.id && (
                    <p className="text-xs text-slate py-4 text-center">No lessons in this module yet.</p>
                  )}
                </div>
              </div>
            );
          })}

          {sortedModules.length === 0 && (
            <p className="text-sm text-slate py-4 text-center">
              No modules yet — add one above to start grouping lessons.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-ink">Ungrouped lessons</h3>
            <p className="text-xs text-slate mt-0.5">Not filed into a module yet — still part of the course either way.</p>
          </div>
          <Button size="sm" onClick={() => openAddForm(null, ungroupedLessons.length)}>
            <Plus size={14} /> Add lesson
          </Button>
        </div>

        <div className="flex flex-col">
          <InsertDivider position={0} insertAt={addTarget?.moduleId === null ? addTarget.position : null} onOpen={(p) => openAddForm(null, p)} />
          {addTarget?.moduleId === null && addTarget.position === 0 && (
            <AddLessonForm value={newLesson} onChange={setNewLesson} onSubmit={addLesson} onCancel={() => setAddTarget(null)} error={error} />
          )}

          {ungroupedLessons.map((lesson, i) => (
            <div key={lesson.id}>
              <LessonRow
                lesson={lesson}
                i={i}
                count={ungroupedLessons.length}
                editingTitleId={editingTitleId}
                titleInput={titleInput}
                onStartEditTitle={startEditTitle}
                onTitleInputChange={setTitleInput}
                onSaveTitle={saveTitle}
                onCancelEditTitle={() => setEditingTitleId(null)}
                editingDurationId={editingDurationId}
                durationInput={durationInput}
                onDurationInputChange={setDurationInput}
                onOpenDurationEditor={openDurationEditor}
                onSaveDuration={saveDuration}
                onCancelDurationEditor={() => setEditingDurationId(null)}
                uploadingLessonId={uploadingLessonId}
                onUploadFile={uploadFile}
                onRetryConversion={retryConversion}
                onMove={moveLesson}
                onRemove={removeLesson}
                expandedSubmissions={expandedSubmissions}
                onToggleSubmissions={toggleSubmissions}
                submissions={submissions}
                onReviewSubmission={reviewSubmission}
                onDownloadSubmissionFile={downloadSubmissionFile}
                formatDuration={formatDuration}
              />
              <InsertDivider
                position={i + 1}
                insertAt={addTarget?.moduleId === null ? addTarget.position : null}
                onOpen={(p) => openAddForm(null, p)}
              />
              {addTarget?.moduleId === null && addTarget.position === i + 1 && (
                <AddLessonForm value={newLesson} onChange={setNewLesson} onSubmit={addLesson} onCancel={() => setAddTarget(null)} error={error} />
              )}
            </div>
          ))}

          {ungroupedLessons.length === 0 && (
            <p className="text-sm text-slate py-6 text-center">No ungrouped lessons.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
