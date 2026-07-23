import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requirePermission } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import * as controller from "./progress.controller";

export const progressRouter = Router();
progressRouter.use(requireAuth);

// Employee
progressRouter.post("/:lessonId/start", asyncHandler(controller.start));
progressRouter.post("/:lessonId/heartbeat", asyncHandler(controller.heartbeat));
progressRouter.post("/:lessonId/confirm", asyncHandler(controller.confirm));
progressRouter.post(
  "/:lessonId/submit-assignment",
  upload.single("file"),
  asyncHandler(controller.submitAssignment)
);
progressRouter.get("/:lessonId/mine", asyncHandler(controller.mine));

// Admin
progressRouter.get(
  "/course/:courseId/table",
  requireRole("ADMIN"),
  requirePermission("VIEW_PROGRESS"),
  asyncHandler(controller.courseTable)
);
