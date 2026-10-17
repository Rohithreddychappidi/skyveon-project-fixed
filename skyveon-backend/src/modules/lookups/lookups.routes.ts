import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requireAnyPermission } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

// Slim id/name lists for dropdowns and counts. The full /api/courses and
// /api/users endpoints need MANAGE_COURSES / MANAGE_EMPLOYEES, so an admin
// granted only MANAGE_ASSIGNMENTS or VIEW_PROGRESS couldn't even fill the
// course or employee pickers on their own pages.
export const lookupsRouter = Router();
lookupsRouter.use(requireAuth, requireRole("ADMIN"));

lookupsRouter.get(
  "/courses",
  requireAnyPermission("MANAGE_COURSES", "MANAGE_ASSIGNMENTS", "VIEW_PROGRESS"),
  asyncHandler(async (_req, res) => {
    const courses = await prisma.course.findMany({
      where: { isDeleted: false },
      select: { id: true, title: true, department: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ courses });
  })
);

lookupsRouter.get(
  "/employees",
  requireAnyPermission("MANAGE_EMPLOYEES", "MANAGE_ASSIGNMENTS"),
  asyncHandler(async (_req, res) => {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE", isDeleted: false },
      select: { id: true, name: true, email: true, status: true, departmentId: true },
      orderBy: { name: "asc" },
    });
    res.json({ employees });
  })
);
