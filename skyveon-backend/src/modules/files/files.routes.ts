import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as controller from "./files.controller";

export const filesRouter = Router();

// The stream endpoint is authorized via its own short-lived signed token
// (see files.service.ts), not the normal session, so a <video>/<img>/<iframe>
// tag can hit it directly without attaching an Authorization header.
filesRouter.get("/:lessonId/stream", asyncHandler(controller.stream));

filesRouter.get("/:lessonId/link", requireAuth, asyncHandler(controller.getLink));
filesRouter.get("/:lessonId/admin-download", requireAuth, requireRole("ADMIN"), asyncHandler(controller.adminDownload));
