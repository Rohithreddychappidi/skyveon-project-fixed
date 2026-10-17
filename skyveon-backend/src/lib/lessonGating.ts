import { prisma } from "./prisma";
import { ApiError } from "./apiError";
import { sortLessonsForDisplay } from "./lessonOrder";

/**
 * ASSIGNMENT-type lessons gate everything after them in the course: an
 * employee can't start or view a lesson if an earlier ASSIGNMENT lesson in
 * the same course hasn't been submitted yet. "Earlier" means earlier in the
 * displayed sequence (see lessonOrder.ts).
 */
export async function ensureLessonUnlocked(employeeId: string, courseId: string, lessonId: string) {
  const [lessons, modules] = await Promise.all([
    prisma.lesson.findMany({
      where: { courseId, isDeleted: false },
      select: { id: true, order: true, moduleId: true, type: true, title: true },
    }),
    prisma.module.findMany({ where: { courseId, isDeleted: false }, select: { id: true, order: true } }),
  ]);
  const sequence = sortLessonsForDisplay(lessons, modules);
  const index = sequence.findIndex((l) => l.id === lessonId);
  const earlierAssignments = sequence.slice(0, Math.max(index, 0)).filter((l) => l.type === "ASSIGNMENT");
  if (earlierAssignments.length === 0) return;

  const submissions = await prisma.lessonSubmission.findMany({
    where: { employeeId, lessonId: { in: earlierAssignments.map((l) => l.id) } },
    select: { lessonId: true },
  });
  const submittedIds = new Set(submissions.map((s) => s.lessonId));

  const blocking = earlierAssignments.find((l) => !submittedIds.has(l.id));
  if (blocking) {
    throw ApiError.forbidden(`Complete the assignment "${blocking.title}" before continuing.`);
  }
}
