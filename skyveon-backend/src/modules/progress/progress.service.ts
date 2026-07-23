import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { logActivity } from "../../lib/activityLog";
import { enqueueAssignmentSubmittedEmail } from "../../lib/notifications";
import { ensureLessonUnlocked } from "../../lib/lessonGating";
import type { LessonType } from "@prisma/client";

const VIDEO_COMPLETE_RATIO = 0.9;
// Anti-skip guard: on a FIRST watch, a heartbeat can't advance the counted
// "watched" position by more than this many seconds at once, so scrubbing
// straight to the end doesn't count as having watched the video. Once a
// video has been completed once already, this stops applying — see
// videoHeartbeat() below.
const MAX_FORWARD_JUMP_SECONDS = 45;

async function getLessonOrThrow(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, isDeleted: false } });
  if (!lesson) throw ApiError.notFound("Lesson not found");
  return lesson;
}

async function ensureAssigned(employeeId: string, courseId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: employeeId } });
  const assignment = await prisma.assignment.findFirst({
    where: {
      courseId,
      isDeleted: false,
      OR: [
        { targetType: "INDIVIDUAL", employeeId },
        ...(user.departmentId ? [{ targetType: "DEPARTMENT" as const, departmentId: user.departmentId }] : []),
      ],
    },
  });
  if (!assignment) throw ApiError.forbidden("This lesson isn't assigned to you.");
}

async function getOrCreateProgress(employeeId: string, lessonId: string) {
  return prisma.progress.upsert({
    where: { employeeId_lessonId: { employeeId, lessonId } },
    update: {},
    create: { employeeId, lessonId },
  });
}

/** Called when the employee opens a lesson — flips NOT_STARTED -> IN_PROGRESS. */
export async function startLesson(employeeId: string, lessonId: string) {
  const lesson = await getLessonOrThrow(lessonId);
  await ensureAssigned(employeeId, lesson.courseId);
  await ensureLessonUnlocked(employeeId, lesson.courseId, lesson.order);

  const progress = await getOrCreateProgress(employeeId, lessonId);
  if (progress.status === "NOT_STARTED") {
    return prisma.progress.update({ where: { id: progress.id }, data: { status: "IN_PROGRESS" } });
  }
  return progress;
}

/** Video heartbeat: reports playback position every ~15-30s from the player. */
export async function videoHeartbeat(employeeId: string, lessonId: string, positionSeconds: number) {
  const lesson = await getLessonOrThrow(lessonId);
  if (lesson.type !== "VIDEO") throw ApiError.badRequest("Not a video lesson");
  await ensureAssigned(employeeId, lesson.courseId);

  const progress = await getOrCreateProgress(employeeId, lessonId);
  const alreadyCompletedOnce = !!progress.completedAt;

  // Rewatch: the 90% rule and anti-skip clamp only apply the first time a
  // video is completed. Once it's done, scrubbing freely is fine and the
  // lesson stays COMPLETED regardless of where playback is.
  if (alreadyCompletedOnce) {
    const position = Math.max(positionSeconds, 0);
    return prisma.progress.update({
      where: { id: progress.id },
      data: {
        lastPositionSeconds: position,
        watchedSeconds: Math.max(progress.watchedSeconds, position),
        // status/completedAt intentionally left untouched — never regress
      },
    });
  }

  const clampedPosition = Math.min(
    Math.max(positionSeconds, 0),
    progress.lastPositionSeconds + MAX_FORWARD_JUMP_SECONDS
  );
  const newWatched = Math.max(progress.watchedSeconds, clampedPosition);

  // Heartbeats only track playback position now — they no longer flip the
  // lesson to COMPLETED by themselves. Reaching 90% just unlocks the
  // "I have completed" button on the frontend; the employee still has to
  // click it (see confirmLesson below), same as PDF/PPT/DOC/IMAGE lessons.
  const updated = await prisma.progress.update({
    where: { id: progress.id },
    data: {
      lastPositionSeconds: clampedPosition,
      watchedSeconds: newWatched,
      status: "IN_PROGRESS",
    },
  });

  return updated;
}

/** PDF/PPT/DOC/IMAGE/VIDEO "I've reviewed this" / "I have completed" click, or LINK confirm-after-open click. */
export async function confirmLesson(employeeId: string, lessonId: string) {
  const lesson = await getLessonOrThrow(lessonId);
  const confirmableTypes: LessonType[] = ["PDF", "PPT", "DOC", "IMAGE", "LINK", "VIDEO"];
  if (!confirmableTypes.includes(lesson.type)) {
    throw ApiError.badRequest("This lesson type doesn't use manual confirmation.");
  }
  await ensureAssigned(employeeId, lesson.courseId);

  const progress = await getOrCreateProgress(employeeId, lessonId);
  // Require the lesson to have actually been opened first — confirming
  // without ever starting it doesn't count.
  if (progress.status === "NOT_STARTED") {
    throw ApiError.badRequest("Open the lesson before marking it complete.");
  }

  // Videos additionally require having actually watched at least 90% —
  // enforced server-side so the gate can't be bypassed by calling this
  // endpoint directly.
  if (lesson.type === "VIDEO" && !progress.completedAt) {
    const duration = lesson.durationSeconds ?? 0;
    const watchedEnough = duration > 0 && progress.watchedSeconds >= duration * VIDEO_COMPLETE_RATIO;
    if (!watchedEnough) {
      throw ApiError.badRequest("Watch at least 90% of the video before marking it complete.");
    }
  }

  const updated = await prisma.progress.update({
    where: { id: progress.id },
    data: { status: "COMPLETED", confirmedAt: new Date(), completedAt: progress.completedAt ?? new Date() },
  });

  await logActivity({ userId: employeeId, action: "lesson.complete", metadata: { lessonId } });
  return updated;
}

/**
 * ASSIGNMENT-type lesson: submitting a response is what satisfies the
 * completion rule and unlocks whatever comes after it (see ensureUnlocked
 * above). Resubmitting overwrites the previous response but doesn't
 * un-complete the lesson.
 */
export async function submitAssignment(
  employeeId: string,
  lessonId: string,
  input: { responseText?: string; file?: Express.Multer.File }
) {
  const lesson = await getLessonOrThrow(lessonId);
  if (lesson.type !== "ASSIGNMENT") throw ApiError.badRequest("Not an assignment lesson");
  const responseText = input.responseText?.trim() || undefined;
  if (!responseText && !input.file) {
    throw ApiError.badRequest("Write a response or attach a file.");
  }
  await ensureAssigned(employeeId, lesson.courseId);

  const progress = await getOrCreateProgress(employeeId, lessonId);
  if (progress.status === "NOT_STARTED") {
    throw ApiError.badRequest("Open the lesson before submitting.");
  }

  let fileFields: { fileKey?: string; fileName?: string; fileMime?: string } = {};
  if (input.file) {
    const { getStorage, makeStorageKey } = await import("../../lib/storage");
    const storage = getStorage();
    const key = makeStorageKey(input.file.originalname);
    await storage.save(key, input.file.buffer, input.file.mimetype);
    fileFields = { fileKey: key, fileName: input.file.originalname, fileMime: input.file.mimetype };
  }

  const [submission] = await prisma.$transaction([
    prisma.lessonSubmission.upsert({
      where: { lessonId_employeeId: { lessonId, employeeId } },
      update: {
        responseText,
        ...fileFields,
        status: "SUBMITTED",
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
      },
      create: { lessonId, employeeId, responseText, ...fileFields },
    }),
    prisma.progress.update({
      where: { id: progress.id },
      data: { status: "COMPLETED", confirmedAt: new Date(), completedAt: progress.completedAt ?? new Date() },
    }),
  ]);

  await logActivity({ userId: employeeId, action: "lesson.complete", metadata: { lessonId, type: "ASSIGNMENT" } });

  const employee = await prisma.user.findUniqueOrThrow({ where: { id: employeeId } });
  await enqueueAssignmentSubmittedEmail(lesson, employee).catch(() => {});

  return submission;
}

export async function getMyProgress(employeeId: string, lessonId: string) {
  await getLessonOrThrow(lessonId);
  return prisma.progress.findUnique({ where: { employeeId_lessonId: { employeeId, lessonId } } });
}

// --- Admin progress table ----------------------------------------------------

export async function getCourseProgressTable(courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, isDeleted: false },
    include: { lessons: { where: { isDeleted: false } } },
  });
  if (!course) throw ApiError.notFound("Course not found");

  const assignments = await prisma.assignment.findMany({
    where: { courseId, isDeleted: false },
    include: { employee: true, department: { include: { users: { where: { isDeleted: false, role: "EMPLOYEE" } } } } },
  });

  const employeeIds = new Set<string>();
  for (const a of assignments) {
    if (a.targetType === "INDIVIDUAL" && a.employee) employeeIds.add(a.employee.id);
    if (a.targetType === "DEPARTMENT" && a.department) {
      for (const u of a.department.users) employeeIds.add(u.id);
    }
  }

  const employees = await prisma.user.findMany({ where: { id: { in: [...employeeIds] } } });
  const lessonIds = course.lessons.map((l) => l.id);
  const progress = await prisma.progress.findMany({
    where: { employeeId: { in: [...employeeIds] }, lessonId: { in: lessonIds } },
  });

  const rows = employees.map((employee) => {
    const employeeRows = progress.filter((p) => p.employeeId === employee.id);
    const completed = employeeRows.filter((p) => p.status === "COMPLETED").length;
    return {
      employee: { id: employee.id, name: employee.name, email: employee.email },
      completedLessons: completed,
      totalLessons: course.lessons.length,
      percent: course.lessons.length ? Math.round((completed / course.lessons.length) * 100) : 0,
      status:
        completed === course.lessons.length && course.lessons.length > 0
          ? "COMPLETED"
          : completed > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED",
    };
  });

  return { course: { id: course.id, title: course.title }, rows };
}
