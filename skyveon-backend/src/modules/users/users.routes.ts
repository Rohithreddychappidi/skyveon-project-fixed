import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requirePermission } from "../../middleware/auth";
import * as controller from "./users.controller";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole("ADMIN"), requirePermission("MANAGE_EMPLOYEES"));

usersRouter.get("/", asyncHandler(controller.list));
usersRouter.post("/", asyncHandler(controller.create));
usersRouter.patch("/:id", asyncHandler(controller.update));
usersRouter.patch("/:id/status", asyncHandler(controller.setStatus));
usersRouter.delete("/:id", asyncHandler(controller.remove));
usersRouter.post("/:id/resend-setup", asyncHandler(controller.resendSetup));

export const departmentsRouter = Router();
departmentsRouter.use(requireAuth);
departmentsRouter.get("/", asyncHandler(controller.listDepartments));
departmentsRouter.post(
  "/",
  requireRole("ADMIN"),
  requirePermission("MANAGE_EMPLOYEES"),
  asyncHandler(controller.createDepartment)
);
