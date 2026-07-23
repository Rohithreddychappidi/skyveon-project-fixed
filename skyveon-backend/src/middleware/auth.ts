import type { NextFunction, Request, Response } from "express";
import type { AdminPermission, Role } from "@prisma/client";
import { verifyAccessToken } from "../lib/jwt";
import { ApiError } from "../lib/apiError";
import { prisma } from "../lib/prisma";

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  adminPermissions: AdminPermission[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw ApiError.unauthorized("Missing access token");
    }
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.isDeleted) {
      throw ApiError.unauthorized("Account no longer exists");
    }
    if (user.status === "INACTIVE") {
      throw ApiError.forbidden("This account has been deactivated");
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      status: user.status,
      adminPermissions: user.adminPermissions,
    };
    next();
  } catch (err) {
    next(ApiError.unauthorized("Invalid or expired access token"));
  }
}

// MASTER_ADMIN outranks ADMIN outranks EMPLOYEE. requireRole("ADMIN") is
// satisfied by an ADMIN *or* a MASTER_ADMIN — the master admin can do
// everything a regular admin can, plus manage other admins.
const ROLE_RANK: Record<Role, number> = { EMPLOYEE: 0, ADMIN: 1, MASTER_ADMIN: 2 };

export function requireRole(...roles: Role[]) {
  const minRank = Math.min(...roles.map((r) => ROLE_RANK[r]));
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (ROLE_RANK[req.user.role] < minRank) return next(ApiError.forbidden());
    next();
  };
}

export function requireMasterAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== "MASTER_ADMIN") return next(ApiError.forbidden("Master admin only"));
  next();
}

/**
 * Gate an admin-only action behind a specific permission. MASTER_ADMIN
 * always passes. A regular ADMIN passes only if the permission was
 * explicitly granted (see /api/admins). Must run after requireAuth and
 * requireRole("ADMIN").
 */
export function requirePermission(permission: AdminPermission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === "MASTER_ADMIN") return next();
    if (req.user.role === "ADMIN" && req.user.adminPermissions.includes(permission)) return next();
    return next(ApiError.forbidden(`Missing the ${permission} permission`));
  };
}
