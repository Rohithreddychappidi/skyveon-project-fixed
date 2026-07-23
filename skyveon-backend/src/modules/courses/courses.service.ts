import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { getStorage, makeStorageKey } from "../../lib/storage";
import { convertToPdf } from "../../lib/fileConversion";
import type { LessonType, Course, Lesson } from "@prisma/client";

// --- Courses (admin) ---------------------------------------------------------

export async function listCoursesAdmin() {
  return prisma.course.findMany({
    where: { isDeleted: false },
    include: { lessons: { where: { isDeleted: false }, orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCourseAdmin(id: string) {
  const course = await prisma.course.findFirst({
    where: { id, isDeleted: false },
    include: { lessons: { where: { isDeleted: false }, orderBy: { order: "asc" } } },
  });
  if (!course) throw ApiError.notFound("Course not found");
  return course;
}

export async function createCourse(input: { title: string; description?: string; department?: string; createdById: string }) {
  return prisma.course.create({
    data: {
      title: input.title,
      description: input.description ?? "",
      department: input.department ?? "General",
      createdById: input.createdById,
    },
  });
}

export async function updateCourse(id: string, input: { title?: string; description?: string; department?: string }) {
  await getCourseAdmin(id);
  return prisma.course.update({ where: { id }, data: input });
}

export async function softDeleteCourse(id: string) {
  await getCourseAdmin(id);
  // soft delete cascades logically: the course simply stops showing up
  // anywhere, lessons/assignments/progress stay for historical record.
  return prisma.course.update({ where: { id }, data: { isDeleted: true } });
}

// --- Lessons (admin) ---------------------------------------------------------

export async function addLesson(courseId: string, input: { title: string; type: LessonType; linkUrl?: string; durationSeconds?: number; assignmentPrompt?: string }) {
  await getCourseAdmin(courseId);
  const last = await prisma.lesson.findFirst({
    where: { courseId, isDeleted: false },
    orderBy: { order: "desc" },
  });

  return prisma.lesson.create({
    data: {
      courseId,
      title: input.title,
      type: input.type,
      linkUrl: input.linkUrl,
      durationSeconds: input.durationSeconds,
      assignmentPrompt: input.type === "ASSIGNMENT" ? input.assignmentPrompt : undefined,
      order: (last?.order ?? -1) + 1,
      conversionStatus: input.type === "PPT" || input.type === "DOC" ? "PENDING" : "NOT_REQUIRED",
    },
  });
}

export async function updateLesson(
  lessonId: string,
  input: { title?: string; linkUrl?: string; durationSeconds?: number; assignmentPrompt?: string }
) {
  const lesson = await getLessonOr404(lessonId);
  return prisma.lesson.update({ where: { id: lesson.id }, data: input });
}

export async function reorderLessons(courseId: string, orderedLessonIds: string[]) {
  await getCourseAdmin(courseId);
  await prisma.$transaction(
    orderedLessonIds.map((lessonId, index) =>
      prisma.lesson.update({ where: { id: lessonId }, data: { order: index } })
    )
  );
}

export async function softDeleteLesson(lessonId: string) {
  const lesson = await getLessonOr404(lessonId);
  return prisma.lesson.update({ where: { id: lesson.id }, data: { isDeleted: true } });
}

async function getLessonOr404(id: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id, isDeleted: false } });
  if (!lesson) throw ApiError.notFound("Lesson not found");
  return lesson;
}

// --- Lesson content upload ----------------------------------------------------

const OFFICE_TYPES: LessonType[] = ["PPT", "DOC"];

export async function uploadLessonContent(lessonId: string, file: Express.Multer.File) {
  const lesson = await getLessonOr404(lessonId);
  const storage = getStorage();
  const key = makeStorageKey(file.originalname);
  const isReplacement = !!lesson.fileKey;

  // The 90%-watched completion rule divides by durationSeconds — without
  // this, it silently never completes. Detected automatically here so
  // admins never have to know it's needed; retryDurationDetection below
  // covers ffprobe-not-installed as a manual fallback.
  let durationSeconds: number | undefined;
  if (lesson.type === "VIDEO") {
    const { getVideoDurationSeconds } = await import("../../lib/videoProbe");
    durationSeconds = (await getVideoDurationSeconds(file.buffer)) ?? undefined;
  }

  await storage.save(key, file.buffer);
  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      fileKey: key,
      fileName: file.originalname,
      fileMime: file.mimetype,
      conversionStatus: OFFICE_TYPES.includes(lesson.type) ? "PENDING" : "NOT_REQUIRED",
      convertedKey: null,
      conversionError: null,
      ...(durationSeconds ? { durationSeconds } : {}),
    },
  });

  if (isReplacement) {
    // Replacing the file invalidates whatever anyone already watched/read —
    // they need to go through the new content again.
    await prisma.progress.updateMany({
      where: { lessonId: lesson.id },
      data: {
        status: "NOT_STARTED",
        watchedSeconds: 0,
        lastPositionSeconds: 0,
        confirmedAt: null,
        completedAt: null,
      },
    });
  }

  if (OFFICE_TYPES.includes(lesson.type)) {
    await enqueueConversion(lesson.id, key, file.originalname);
  }

  return prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
}

export async function runConversion(lessonId: string, key: string, originalFileName: string) {
  await convertLessonInBackground(lessonId, key, originalFileName);
}

async function convertLessonInBackground(lessonId: string, key: string, originalFileName: string) {
  try {
    const storage = getStorage();
    const original = await storage.read(key);
    const pdfBuffer = await convertToPdf(original, originalFileName);
    const convertedKey = makeStorageKey(`${originalFileName}.pdf`);
    await storage.save(convertedKey, pdfBuffer);

    await prisma.lesson.update({
      where: { id: lessonId },
      data: { convertedKey, conversionStatus: "DONE", conversionError: null },
    });
  } catch (err) {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        conversionStatus: "FAILED",
        conversionError: err instanceof Error ? err.message : "Conversion failed",
      },
    });
    throw err; // let the queue's retry policy see the failure
  }
}

async function enqueueConversion(lessonId: string, key: string, originalFileName: string) {
  const { conversionQueue } = await import("../../lib/queue");
  await conversionQueue.add(lessonId, { lessonId, key, originalFileName });
}

export async function retryConversion(lessonId: string) {
  const lesson = await getLessonOr404(lessonId);
  if (!lesson.fileKey || !lesson.fileName) {
    throw ApiError.badRequest("No uploaded file to convert.");
  }
  await prisma.lesson.update({ where: { id: lesson.id }, data: { conversionStatus: "PENDING", conversionError: null } });
  await enqueueConversion(lesson.id, lesson.fileKey, lesson.fileName);
}

// --- Courses (employee) -------------------------------------------------------

export async function listCoursesForEmployee(employeeId: string, departmentId: string | null) {
  const assignments = await prisma.assignment.findMany({
    where: {
      isDeleted: false,
      OR: [
        { targetType: "INDIVIDUAL", employeeId },
        ...(departmentId ? [{ targetType: "DEPARTMENT" as const, departmentId }] : []),
      ],
    },
    include: {
      course: { include: { lessons: { where: { isDeleted: false }, orderBy: { order: "asc" as const } } } },
    },
  });

  const courses = assignments
    .map((a) => a.course)
    .filter((c) => !c.isDeleted);

  // de-dupe (an employee could theoretically be assigned both individually
  // and via their department)
  const seen = new Set<string>();
  const unique = courses.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  return attachProgressSummary(unique, employeeId);
}

async function attachProgressSummary(courses: (Course & { lessons: Lesson[] })[], employeeId: string) {
  const lessonIds = courses.flatMap((c) => c.lessons.map((l) => l.id));
  const progress = await prisma.progress.findMany({
    where: { employeeId, lessonId: { in: lessonIds } },
  });
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));

  return courses.map((course) => {
    const total = course.lessons.length;
    const completed = course.lessons.filter((l) => progressByLesson.get(l.id)?.status === "COMPLETED").length;
    return {
      ...course,
      progress: { completedLessons: completed, totalLessons: total, percent: total ? Math.round((completed / total) * 100) : 0 },
    };
  });
}

export async function getCourseForEmployee(courseId: string, employeeId: string, departmentId: string | null) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      courseId,
      isDeleted: false,
      OR: [
        { targetType: "INDIVIDUAL", employeeId },
        ...(departmentId ? [{ targetType: "DEPARTMENT" as const, departmentId }] : []),
      ],
    },
  });
  if (!assignment) throw ApiError.forbidden("This course isn't assigned to you.");

  const course = await prisma.course.findFirst({
    where: { id: courseId, isDeleted: false },
    include: { lessons: { where: { isDeleted: false }, orderBy: { order: "asc" } } },
  });
  if (!course) throw ApiError.notFound("Course not found");

  const lessonIds = course.lessons.map((l) => l.id);
  const [progress, submissions] = await Promise.all([
    prisma.progress.findMany({ where: { employeeId, lessonId: { in: lessonIds } } }),
    prisma.lessonSubmission.findMany({ where: { employeeId, lessonId: { in: lessonIds } } }),
  ]);
  const progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const submissionByLesson = new Map(submissions.map((s) => [s.lessonId, s]));

  // A lesson is locked if some earlier ASSIGNMENT lesson hasn't been
  // submitted yet — mirrors lib/lessonGating.ts so the UI can show a lock
  // icon before the employee even tries to open it.
  let blockingAssignmentOrder: number | null = null;
  const lessonsWithGating = course.lessons.map((l) => {
    const locked = blockingAssignmentOrder !== null && l.order > blockingAssignmentOrder;
    if (l.type === "ASSIGNMENT" && !submissionByLesson.has(l.id) && blockingAssignmentOrder === null) {
      blockingAssignmentOrder = l.order;
    }
    return {
      ...l,
      progress: progressByLesson.get(l.id) ?? null,
      submission: submissionByLesson.get(l.id) ?? null,
      locked,
    };
  });

  return { ...course, lessons: lessonsWithGating };
}

// --- Public (no auth) — powers the marketing home page's course cards ------

export async function listCoursesPublic() {
  const courses = await prisma.course.findMany({
    where: { isDeleted: false },
    include: { lessons: { where: { isDeleted: false } } },
    orderBy: { createdAt: "desc" },
  });
  // Deliberately thin: no lesson content, no assignment/progress info.
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    department: c.department,
    lessonCount: c.lessons.length,
    lessonTypes: [...new Set(c.lessons.map((l) => l.type))],
  }));
}

// --- ASSIGNMENT-lesson submissions (admin review) -----------------------------

export async function listSubmissions(lessonId: string) {
  const lesson = await getLessonOr404(lessonId);
  if (lesson.type !== "ASSIGNMENT") throw ApiError.badRequest("Not an assignment lesson");
  return prisma.lessonSubmission.findMany({
    where: { lessonId },
    include: { employee: { select: { id: true, name: true, email: true } } },
    orderBy: { submittedAt: "desc" },
  });
}

export async function reviewSubmission(
  submissionId: string,
  input: { status: "APPROVED" | "REJECTED"; reviewNote?: string; reviewerId: string }
) {
  const submission = await prisma.lessonSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) throw ApiError.notFound("Submission not found");

  return prisma.lessonSubmission.update({
    where: { id: submissionId },
    data: {
      status: input.status,
      reviewNote: input.reviewNote,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
    },
  });
}

export async function getSubmissionFile(submissionId: string) {
  const submission = await prisma.lessonSubmission.findUnique({ where: { id: submissionId } });
  if (!submission?.fileKey) throw ApiError.notFound("No file attached to this submission.");
  const raw = await getStorage().read(submission.fileKey);
  return { buffer: raw, mime: submission.fileMime ?? "application/octet-stream", fileName: submission.fileName ?? "submission" };
}
