import { prisma } from "./prisma";
import { ApiError } from "./apiError";

/**
 * ASSIGNMENT-type lessons gate everything after them in the course: an
 * employee can't start or view a lesson if an earlier ASSIGNMENT lesson in
 * the same course hasn't been submitted yet.
 */
export async function ensureLessonUnlocked(employeeId: string, courseId: string, lessonOrder: number) {
  const earlierAssignments = await prisma.lesson.findMany({
    where: { courseId, isDeleted: false, type: "ASSIGNMENT", order: { lt: lessonOrder } },
    orderBy: { order: "asc" },
  });
  if (earlierAssignments.length === 0) return;

  const submissions = await prisma.lessonSubmission.findMany({
    where: { employeeId, lessonId: { in: earlierAssignments.map((l) => l.id) } },
  });
  const submittedIds = new Set(submissions.map((s) => s.lessonId));

  const blocking = earlierAssignments.find((l) => !submittedIds.has(l.id));
  if (blocking) {
    throw ApiError.forbidden(`Complete the assignment "${blocking.title}" before continuing.`);
  }
}
