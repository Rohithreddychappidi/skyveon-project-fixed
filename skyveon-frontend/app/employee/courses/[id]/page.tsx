"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonTypeIcon } from "@/components/ui/lesson-icon";
import { useContentProtection } from "@/components/employee/use-content-protection";
import { api, ApiError } from "@/lib/api";
import type { Course, Lesson } from "@/lib/api-types";
import { Check, ExternalLink, CircleDashed, CheckCircle2, Lock, EyeOff, Paperclip, X as XIcon, SkipForward, SkipBack, Maximize, Minimize } from "lucide-react";

const CONFIRMABLE_TYPES = ["PDF", "PPT", "DOC", "IMAGE", "LINK", "VIDEO"];
const VIDEO_COMPLETE_RATIO = 0.9;
const ASSIGNMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

export default function LessonViewerPage() {
  const params = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [linkOpened, setLinkOpened] = useState(false);
  const [assignmentResponse, setAssignmentResponse] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastHeartbeatRef = useRef(0);

  const { blurred, reason } = useContentProtection();

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    // Fullscreen the WRAPPER div (video + skip buttons together), not just
    // the <video> element — the native fullscreen button in video controls
    // only fullscreens the video itself, which is why our overlay buttons
    // were disappearing in fullscreen. We disable the native button
    // (controlsList="nofullscreen") and drive fullscreen from here instead.
    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapper.requestFullscreen().catch(() => {});
    }
  }

  const activeLesson = course?.lessons.find((l) => l.id === activeLessonId) ?? null;

  const loadCourse = useCallback(async () => {
    const body = await api.get(`/api/courses/mine/${params.id}`);
    setCourse(body.course);
    return body.course as Course;
  }, [params.id]);

  useEffect(() => {
    loadCourse().then((c) => {
      const firstIncomplete = c.lessons.find((l: Lesson) => l.progress?.status !== "COMPLETED");
      setActiveLessonId((firstIncomplete ?? c.lessons[0])?.id ?? null);
    });
  }, [loadCourse]);

  // Whenever the active lesson changes: mark it started, and if it has
  // hosted content, fetch a fresh 5-minute signed URL for it.
  useEffect(() => {
    if (!activeLesson) return;
    setSignedUrl(null);
    setLinkOpened(false);
    setAssignmentResponse("");
    setAssignmentFile(null);
    setLockedNotice(null);

    api.post(`/api/progress/${activeLesson.id}/start`).catch((err) => {
      if (err instanceof ApiError) setLockedNotice(err.message);
    });

    if (activeLesson.type !== "LINK" && activeLesson.type !== "ASSIGNMENT") {
      api
        .get(`/api/files/${activeLesson.id}/link`)
        .then((body) => setSignedUrl(body.url))
        .catch(() => setSignedUrl(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId]);

  async function sendHeartbeat(positionSeconds: number) {
    if (!activeLesson) return;
    lastHeartbeatRef.current = Date.now();
    const body = await api.post(`/api/progress/${activeLesson.id}/heartbeat`, {
      positionSeconds: Math.floor(positionSeconds),
    });
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            lessons: prev.lessons.map((l) => (l.id === activeLesson.id ? { ...l, progress: body.progress } : l)),
          }
        : prev
    );
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !activeLesson) return;
    if (Date.now() - lastHeartbeatRef.current < 10_000) return; // throttle to every ~10s
    sendHeartbeat(video.currentTime);
  }

  function handleEnded() {
    // Send one last heartbeat right at the end, bypassing the throttle —
    // otherwise the final few seconds before the video finishes can be
    // skipped and watchedSeconds never actually reaches the 90% mark.
    const video = videoRef.current;
    if (!video || !activeLesson) return;
    sendHeartbeat(video.duration || video.currentTime);
  }

  const programmaticSeekRef = useRef(false);

  function handleSkip(seconds: number) {
    // Only ever rendered/enabled once the lesson has already been completed
    // once (see the buttons below) — on a first watch there are no skip
    // buttons at all, matching the seek-clamp in handleSeeking.
    const video = videoRef.current;
    if (!video) return;

    const applySkip = () => {
      const target = Math.min(
        Math.max(video.currentTime + seconds, 0),
        video.duration || Infinity
      );
      // Flag this as an intentional, app-triggered seek so handleSeeking
      // never clamps it back — this is more reliable than trusting
      // activeLesson.progress?.completedAt to be fresh at the exact instant
      // the native 'seeking' event fires.
      programmaticSeekRef.current = true;
      video.currentTime = target;
    };

    // Setting currentTime before the browser has loaded metadata can get
    // silently overwritten back to 0 once metadata finishes loading — wait
    // for it first if it hasn't fired yet (readyState 0 = HAVE_NOTHING).
    if (video.readyState > 0) {
      applySkip();
    } else {
      video.addEventListener("loadedmetadata", applySkip, { once: true });
    }
  }

  function handleSeeking() {
    // Our own skip buttons flag their seeks as programmatic — never clamp
    // those, regardless of completedAt state.
    if (programmaticSeekRef.current) {
      programmaticSeekRef.current = false;
      return;
    }
    // Client-side mirror of the server's anti-skip rule — but only on a
    // FIRST watch. Once a video's already been completed once, the server
    // allows free scrubbing on rewatch, so this stops enforcing too.
    const video = videoRef.current;
    if (!video || !activeLesson) return;
    if (activeLesson.progress?.completedAt) return;
    const watched = activeLesson.progress?.watchedSeconds ?? 0;
    if (video.currentTime > watched + 45) {
      video.currentTime = watched;
    }
  }

  async function handleConfirm() {
    if (!activeLesson) return;
    setConfirming(true);
    try {
      const body = await api.post(`/api/progress/${activeLesson.id}/confirm`);
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              lessons: prev.lessons.map((l) => (l.id === activeLesson.id ? { ...l, progress: body.progress } : l)),
            }
          : prev
      );
    } finally {
      setConfirming(false);
    }
  }

  async function handleSubmitAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLesson || (!assignmentResponse.trim() && !assignmentFile)) return;
    setSubmittingAssignment(true);
    try {
      const formData = new FormData();
      if (assignmentResponse.trim()) formData.append("responseText", assignmentResponse);
      if (assignmentFile) formData.append("file", assignmentFile);
      await api.upload(`/api/progress/${activeLesson.id}/submit-assignment`, formData);
      await loadCourse();
    } catch (err) {
      setLockedNotice(err instanceof ApiError ? err.message : "Couldn't submit — try again.");
    } finally {
      setSubmittingAssignment(false);
    }
  }

  function openLink() {
    if (!activeLesson?.linkUrl) return;
    window.open(activeLesson.linkUrl, "_blank", "noopener,noreferrer");
    setLinkOpened(true);
  }

  function selectLesson(lesson: Lesson) {
    if (lesson.locked) return;
    setActiveLessonId(lesson.id);
  }

  if (!course) return <p className="text-sm text-slate">Loading…</p>;

  const completedCount = course.lessons.filter((l) => l.progress?.status === "COMPLETED").length;

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <Card className="p-0 h-fit lg:sticky lg:top-8">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-display font-semibold text-ink text-sm">{course.title}</h2>
          <p className="text-xs text-slate mt-0.5">
            {completedCount}/{course.lessons.length} lessons complete
          </p>
        </div>
        <div className="flex flex-col divide-y divide-slate-50">
          {course.lessons.map((lesson) => {
            const status = lesson.progress?.status ?? "NOT_STARTED";
            return (
              <button
                key={lesson.id}
                onClick={() => selectLesson(lesson)}
                disabled={lesson.locked}
                className={`flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors ${
                  lesson.locked
                    ? "text-slate-300 cursor-not-allowed"
                    : lesson.id === activeLessonId
                    ? "bg-indigo/[0.06] text-indigo"
                    : "text-ink hover:bg-slate-50"
                }`}
              >
                {lesson.locked ? (
                  <Lock size={16} className="text-slate-300 flex-none" />
                ) : status === "COMPLETED" ? (
                  <CheckCircle2 size={16} className="text-green-600 flex-none" />
                ) : (
                  <CircleDashed size={16} className="text-slate-300 flex-none" />
                )}
                <LessonTypeIcon type={lesson.type} className="h-3.5 w-3.5 text-slate flex-none" />
                <span className="truncate">{lesson.title}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div>
        {activeLesson ? (
          <Card className="p-6 relative overflow-hidden">
            {/* Deterrent-level content protection: blurs the lesson content
                when the tab is hidden or dev tools look open. See
                components/employee/use-content-protection.ts for the
                honest tradeoffs of both signals. */}
            {blurred && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/90 backdrop-blur-md">
                <EyeOff size={22} className="text-slate" />
                <p className="text-sm text-slate font-medium">
                  {reason === "devtools" ? "Content paused while developer tools are open" : "Content paused — tab inactive"}
                </p>
              </div>
            )}

            <div
              onContextMenu={(e) => e.preventDefault()}
              className="select-none"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="font-display font-semibold text-xl text-ink">{activeLesson.title}</h1>
                  <Badge tone="cool">{activeLesson.type}</Badge>
                </div>
                {activeLesson.progress?.status === "COMPLETED" && (
                  <Badge tone="success">
                    <Check size={12} /> Completed
                  </Badge>
                )}
              </div>

              {lockedNotice && (
                <p className="text-sm text-crimson bg-crimson/5 border border-crimson/20 rounded-lg px-4 py-2.5 mb-4">
                  {lockedNotice}
                </p>
              )}

              {/* Video */}
              {activeLesson.type === "VIDEO" && (
                <div ref={videoWrapperRef} className="relative rounded-xl overflow-hidden bg-ink aspect-video mb-4">
                  {signedUrl ? (
                    <>
                      <video
                        ref={videoRef}
                        src={signedUrl}
                        controls
                        controlsList="nodownload nofullscreen"
                        onContextMenu={(e) => e.preventDefault()}
                        onTimeUpdate={handleTimeUpdate}
                        onSeeking={handleSeeking}
                        onEnded={handleEnded}
                        className="h-full w-full"
                      />
                      {/* Backward skip is always safe — rewinding can never
                          let someone skip past unwatched content, so there's
                          no reason to restrict it to rewatch-only. Forward
                          skip stays gated behind a first completion, since
                          that's the one that actually matters for the
                          "no skipping ahead" rule (matching the seek-clamp
                          in handleSeeking). */}
                      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSkip(-10)}
                          className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-black/75 text-white text-xs font-medium px-3 py-2 backdrop-blur-sm transition-colors"
                        >
                          <SkipBack size={14} /> 10s
                        </button>
                        {activeLesson.progress?.completedAt && (
                          <button
                            type="button"
                            onClick={() => handleSkip(10)}
                            className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-black/75 text-white text-xs font-medium px-3 py-2 backdrop-blur-sm transition-colors"
                          >
                            <SkipForward size={14} /> 10s
                          </button>
                        )}
                        {/* Custom fullscreen toggle — replaces the native
                            control's fullscreen button (disabled above via
                            controlsList) so this wrapper (video + skip
                            buttons) fullscreens together instead of just the
                            video element on its own. */}
                        <button
                          type="button"
                          onClick={toggleFullscreen}
                          className="flex items-center gap-1.5 rounded-lg bg-black/60 hover:bg-black/75 text-white text-xs font-medium px-3 py-2 backdrop-blur-sm transition-colors"
                        >
                          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/50 text-sm">
                      Loading video…
                    </div>
                  )}
                </div>
              )}

              {/* PDF / PPT / DOC (served pre-converted to PDF) */}
              {(activeLesson.type === "PDF" || activeLesson.type === "PPT" || activeLesson.type === "DOC") && (
                <div
                  className="rounded-xl overflow-hidden border border-slate-200 mb-4"
                  style={{ height: "min(92vh, 1400px)" }}
                >
                  {signedUrl ? (
                    <iframe
                      src={`${signedUrl}#toolbar=0&navpanes=0&statusbar=0`}
                      className="h-full w-full"
                      title={activeLesson.title}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate text-sm">
                      {activeLesson.conversionStatus === "PENDING"
                        ? "This document is still being converted — check back shortly."
                        : activeLesson.conversionStatus === "FAILED"
                        ? "This document couldn't be converted. Contact your admin."
                        : "Loading…"}
                    </div>
                  )}
                </div>
              )}

              {/* Image */}
              {activeLesson.type === "IMAGE" && (
                <div className="rounded-xl overflow-hidden border border-slate-200 mb-4">
                  {signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signedUrl} alt={activeLesson.title} className="w-full" draggable={false} />
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate text-sm">Loading…</div>
                  )}
                </div>
              )}

              {/* Link */}
              {activeLesson.type === "LINK" && (
                <div className="rounded-xl border border-slate-200 p-6 mb-4 text-center">
                  <p className="text-sm text-slate mb-4">This lesson links out to an external resource.</p>
                  <Button variant="secondary" onClick={openLink}>
                    <ExternalLink size={16} /> Open link
                  </Button>
                </div>
              )}

              {/* Assignment */}
              {activeLesson.type === "ASSIGNMENT" && (
                <div className="rounded-xl border border-slate-200 p-5 mb-4">
                  <p className="text-sm text-ink whitespace-pre-wrap mb-4">{activeLesson.assignmentPrompt}</p>

                  {activeLesson.submission ? (
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs text-slate mb-1.5">Your submission</p>
                      {activeLesson.submission.responseText && (
                        <p className="text-sm text-ink whitespace-pre-wrap mb-2">
                          {activeLesson.submission.responseText}
                        </p>
                      )}
                      {activeLesson.submission.fileName && (
                        <p className="text-xs text-ink flex items-center gap-1.5 mb-2">
                          <Paperclip size={12} className="text-slate" /> {activeLesson.submission.fileName}
                        </p>
                      )}
                      <Badge
                        tone={
                          activeLesson.submission.status === "APPROVED"
                            ? "success"
                            : activeLesson.submission.status === "REJECTED"
                            ? "warm"
                            : "cool"
                        }
                      >
                        {activeLesson.submission.status.toLowerCase()}
                      </Badge>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitAssignment} className="flex flex-col gap-3">
                      <textarea
                        value={assignmentResponse}
                        onChange={(e) => setAssignmentResponse(e.target.value)}
                        placeholder="Write your response… (optional if you're attaching a file)"
                        rows={5}
                        className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
                      />

                      {assignmentFile ? (
                        <div className="flex items-center gap-2 text-sm text-ink bg-slate-50 rounded-lg px-3 py-2 w-fit">
                          <Paperclip size={14} className="text-slate" />
                          {assignmentFile.name}
                          <button
                            type="button"
                            onClick={() => setAssignmentFile(null)}
                            className="text-slate hover:text-crimson"
                          >
                            <XIcon size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer w-fit">
                          <input
                            type="file"
                            accept={ASSIGNMENT_ACCEPT}
                            className="hidden"
                            onChange={(e) => setAssignmentFile(e.target.files?.[0] ?? null)}
                          />
                          <span className="inline-flex items-center gap-1.5 text-sm text-indigo hover:underline">
                            <Paperclip size={14} /> Attach a file (PDF, Word, or Excel)
                          </span>
                        </label>
                      )}

                      <Button
                        type="submit"
                        className="w-fit"
                        disabled={submittingAssignment || (!assignmentResponse.trim() && !assignmentFile)}
                      >
                        {submittingAssignment ? "Submitting…" : "Submit"}
                      </Button>
                      <p className="text-xs text-slate">Submitting unlocks the rest of this course.</p>
                    </form>
                  )}
                </div>
              )}

              {/* Confirm control for manually-confirmed types */}
              {CONFIRMABLE_TYPES.includes(activeLesson.type) && activeLesson.progress?.status !== "COMPLETED" && (
                (() => {
                  const isVideo = activeLesson.type === "VIDEO";
                  const duration = activeLesson.durationSeconds ?? 0;
                  const watchedSeconds = activeLesson.progress?.watchedSeconds ?? 0;
                  const watchedEnough = !isVideo || (duration > 0 && watchedSeconds >= duration * VIDEO_COMPLETE_RATIO);
                  return (
                    <Button
                      onClick={handleConfirm}
                      disabled={confirming || (activeLesson.type === "LINK" && !linkOpened) || (isVideo && !watchedEnough)}
                    >
                      {confirming
                        ? "Marking complete…"
                        : activeLesson.type === "LINK"
                        ? linkOpened
                          ? "Mark as complete"
                          : "Open the link first"
                        : isVideo && !watchedEnough
                        ? "Watch at least 90% to continue"
                        : "I have completed"}
                    </Button>
                  );
                })()
              )}
            </div>
          </Card>
        ) : (
          <p className="text-sm text-slate">This course has no lessons yet.</p>
        )}
      </div>
    </div>
  );
}