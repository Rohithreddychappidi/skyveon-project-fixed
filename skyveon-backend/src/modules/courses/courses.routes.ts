import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requirePermission } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import * as controller from "./courses.controller";

export const coursesRouter = Router();

// Public — no auth. Must come first, before the blanket requireAuth below.
coursesRouter.get("/public", asyncHandler(controller.listPublic));

coursesRouter.use(requireAuth);

// Employee-facing (must come before admin routes to avoid clashing)
coursesRouter.get("/mine", asyncHandler(controller.listMine));
coursesRouter.get("/mine/:courseId", asyncHandler(controller.getMine));

// Admin-only from here down
coursesRouter.use(requireRole("ADMIN"), requirePermission("MANAGE_COURSES"));

coursesRouter.get("/", asyncHandler(controller.listAdmin));
coursesRouter.post("/", asyncHandler(controller.create));
coursesRouter.get("/:courseId", asyncHandler(controller.getAdmin));
coursesRouter.patch("/:courseId", asyncHandler(controller.update));
coursesRouter.delete("/:courseId", asyncHandler(controller.remove));

coursesRouter.post("/:courseId/lessons", asyncHandler(controller.addLesson));
coursesRouter.patch("/:courseId/lessons/reorder", asyncHandler(controller.reorderLessons));
coursesRouter.patch("/lessons/:lessonId", asyncHandler(controller.updateLesson));
coursesRouter.delete("/lessons/:lessonId", asyncHandler(controller.removeLesson));
coursesRouter.post(
  "/lessons/:lessonId/upload",
  upload.single("file"),
  asyncHandler(controller.uploadLessonContent)
);
coursesRouter.post("/lessons/:lessonId/retry-conversion", asyncHandler(controller.retryConversion));

// ASSIGNMENT-lesson submissions — admin review side (employee submit action
// lives in /api/progress, alongside the other completion-rule endpoints)
coursesRouter.get("/lessons/:lessonId/submissions", asyncHandler(controller.listSubmissions));
coursesRouter.patch("/submissions/:submissionId/review", asyncHandler(controller.reviewSubmission));
coursesRouter.get("/submissions/:submissionId/file", asyncHandler(controller.downloadSubmissionFile));
