import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requirePermission } from "../../middleware/auth";
import * as controller from "./assignments.controller";

export const assignmentsRouter = Router();
assignmentsRouter.use(requireAuth, requireRole("ADMIN"), requirePermission("MANAGE_ASSIGNMENTS"));

assignmentsRouter.get("/", asyncHandler(controller.list));
assignmentsRouter.post("/", asyncHandler(controller.assign));
assignmentsRouter.delete("/:id", asyncHandler(controller.unassign));
