import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(controller.login));
authRouter.post("/refresh", asyncHandler(controller.refresh));
authRouter.post("/logout", asyncHandler(controller.logout));
authRouter.post("/forgot-password", asyncHandler(controller.forgotPassword));
authRouter.post("/setup-password", asyncHandler(controller.setupPassword));
authRouter.post("/reset-password", asyncHandler(controller.resetPassword));
authRouter.get("/me", requireAuth, asyncHandler(controller.me));
authRouter.post("/change-password", requireAuth, asyncHandler(controller.changePassword));
