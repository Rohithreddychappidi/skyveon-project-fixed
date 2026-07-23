import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireMasterAdmin } from "../../middleware/auth";
import * as controller from "./admins.controller";

export const adminsRouter = Router();
adminsRouter.use(requireAuth, requireMasterAdmin);

adminsRouter.get("/", asyncHandler(controller.list));
adminsRouter.post("/", asyncHandler(controller.create));
adminsRouter.patch("/:id/permissions", asyncHandler(controller.updatePermissions));
adminsRouter.patch("/:id/status", asyncHandler(controller.setStatus));
adminsRouter.delete("/:id", asyncHandler(controller.remove));
