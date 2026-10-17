import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requireAnyPermission } from "../../middleware/auth";
import { prisma } from "../../lib/prisma";

export const activityRouter = Router();
// The log names users and what they did — only admins who already see
// people or progress data get it, not an admin with zero permissions.
activityRouter.use(requireAuth, requireRole("ADMIN"), requireAnyPermission("MANAGE_EMPLOYEES", "VIEW_PROGRESS"));

const querySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

activityRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, action, take, skip } = querySchema.parse(req.query);
    const logs = await prisma.activityLog.findMany({
      where: { userId, action: action ? { contains: action } : undefined },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    });
    res.json({ logs });
  })
);
