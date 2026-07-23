import type { Request, Response } from "express";
import { z } from "zod";
import * as coursesService from "./courses.service";
import { logActivity } from "../../lib/activityLog";
import { ApiError } from "../../lib/apiError";
import { prisma } from "../../lib/prisma";

// --- Admin: courses ------------------------------------------------------

export async function listAdmin(_req: Request, res: Response) {
  const courses = await coursesService.listCoursesAdmin();
  res.json({ courses });
}

export async function getAdmin(req: Request, res: Response) {
  const course = await coursesService.getCourseAdmin(req.params.courseId);
  res.json({ course });
}

const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  department: z.string().optional(),
});

export async function create(req: Request, res: Response) {
  const input = createCourseSchema.parse(req.body);
  const course = await coursesService.createCourse({ ...input, createdById: req.user!.id });
  await logActivity({ userId: req.user!.id, action: "course.create", metadata: { courseId: course.id } });
  res.status(201).json({ course });
}

const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  department: z.string().optional(),
});

export async function update(req: Request, res: Response) {
  const input = updateCourseSchema.parse(req.body);
  const course = await coursesService.updateCourse(req.params.courseId, input);
  await logActivity({ userId: req.user!.id, action: "course.update", metadata: { courseId: course.id } });
  res.json({ course });
}

export async function remove(req: Request, res: Response) {
  await coursesService.softDeleteCourse(req.params.courseId);
  await logActivity({ userId: req.user!.id, action: "course.delete", metadata: { courseId: req.params.courseId } });
  res.status(204).send();
}

// --- Admin: lessons --------------------------------------------------------

const addLessonSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["VIDEO", "PDF", "PPT", "DOC", "IMAGE", "LINK", "ASSIGNMENT"]),
  linkUrl: z.string().url().optional(),
  durationSeconds: z.number().int().positive().optional(),
  assignmentPrompt: z.string().optional(),
});

export async function addLesson(req: Request, res: Response) {
  const input = addLessonSchema.parse(req.body);
  if (input.type === "LINK" && !input.linkUrl) {
    throw ApiError.badRequest("linkUrl is required for LINK lessons");
  }
  if (input.type === "ASSIGNMENT" && !input.assignmentPrompt) {
    throw ApiError.badRequest("assignmentPrompt is required for ASSIGNMENT lessons");
  }
  const lesson = await coursesService.addLesson(req.params.courseId, input);
  await logActivity({ userId: req.user!.id, action: "lesson.create", metadata: { lessonId: lesson.id } });
  res.status(201).json({ lesson });
}

const updateLessonSchema = z.object({
  title: z.string().min(1).optional(),
  linkUrl: z.string().url().optional(),
  durationSeconds: z.number().int().positive().optional(),
  assignmentPrompt: z.string().optional(),
});

export async function updateLesson(req: Request, res: Response) {
  const input = updateLessonSchema.parse(req.body);
  const lesson = await coursesService.updateLesson(req.params.lessonId, input);
  res.json({ lesson });
}

const reorderSchema = z.object({ lessonIds: z.array(z.string()).min(1) });
export async function reorderLessons(req: Request, res: Response) {
  const { lessonIds } = reorderSchema.parse(req.body);
  await coursesService.reorderLessons(req.params.courseId, lessonIds);
  res.status(204).send();
}

export async function removeLesson(req: Request, res: Response) {
  await coursesService.softDeleteLesson(req.params.lessonId);
  res.status(204).send();
}

export async function uploadLessonContent(req: Request, res: Response) {
  if (!req.file) throw ApiError.badRequest("No file uploaded");
  const lesson = await coursesService.uploadLessonContent(req.params.lessonId, req.file);
  await logActivity({
    userId: req.user!.id,
    action: "lesson.upload",
    metadata: { lessonId: lesson.id, fileName: lesson.fileName },
  });
  res.json({ lesson });
}

export async function retryConversion(req: Request, res: Response) {
  await coursesService.retryConversion(req.params.lessonId);
  res.json({ message: "Conversion restarted." });
}

// --- Employee: courses -------------------------------------------------------

export async function listMine(req: Request, res: Response) {
  const departmentId = await getDepartmentId(req.user!.id);
  const courses = await coursesService.listCoursesForEmployee(req.user!.id, departmentId);
  res.json({ courses });
}

export async function getMine(req: Request, res: Response) {
  const departmentId = await getDepartmentId(req.user!.id);
  const course = await coursesService.getCourseForEmployee(req.params.courseId, req.user!.id, departmentId);
  res.json({ course });
}

async function getDepartmentId(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return user.departmentId;
}

// --- Public ------------------------------------------------------------------

export async function listPublic(_req: Request, res: Response) {
  const courses = await coursesService.listCoursesPublic();
  res.json({ courses });
}

// --- Admin: assignment-lesson submissions -------------------------------------

export async function listSubmissions(req: Request, res: Response) {
  const submissions = await coursesService.listSubmissions(req.params.lessonId);
  res.json({ submissions });
}

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().optional(),
});
export async function reviewSubmission(req: Request, res: Response) {
  const input = reviewSchema.parse(req.body);
  const submission = await coursesService.reviewSubmission(req.params.submissionId, {
    ...input,
    reviewerId: req.user!.id,
  });
  await logActivity({
    userId: req.user!.id,
    action: "submission.review",
    metadata: { submissionId: submission.id, status: submission.status },
  });
  res.json({ submission });
}

export async function downloadSubmissionFile(req: Request, res: Response) {
  const { buffer, mime, fileName } = await coursesService.getSubmissionFile(req.params.submissionId);
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(buffer);
}
