import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "./auth.service";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";

const REFRESH_COOKIE = "skyveon_refresh";
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: "/api/auth",
  });
}

function userDTO(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  adminPermissions: string[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    adminPermissions: user.adminPermissions,
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const { accessToken, refreshToken, user } = await authService.login(email, password);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user: userDTO(user) });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized("No refresh token");
  const { accessToken, refreshToken, user } = await authService.refresh(token);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user: userDTO(user) });
}

export async function logout(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.status(204).send();
}

const forgotSchema = z.object({ email: z.string().email() });
export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotSchema.parse(req.body);
  await authService.forgotPassword(email);
  // Same response whether or not the account exists.
  res.json({ message: "If that email is registered, a reset link is on its way." });
}

const setupSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });
export async function setupPassword(req: Request, res: Response) {
  const { token, password } = setupSchema.parse(req.body);
  await authService.setupPassword(token, password);
  res.json({ message: "Password set. You can now sign in." });
}

const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = resetSchema.parse(req.body);
  await authService.resetPassword(token, password);
  res.json({ message: "Password reset. You can now sign in." });
}

export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.json({ user: userDTO(user) });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ message: "Password updated." });
}
