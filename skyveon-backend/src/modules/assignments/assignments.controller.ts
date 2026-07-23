import type { Request, Response } from "express";
import { z } from "zod";
import * as assignmentsService from "./assignments.service";
import { logActivity } from "../../lib/activityLog";

export async function list(req: Request, res: Response) {
  const courseId = typeof req.query.courseId === "string" ? req.query.courseId : undefined;
  const assignments = await assignmentsService.listAssignments(courseId);
  res.json({ assignments });
}

const assignSchema = z
  .object({
    courseId: z.string().min(1),
    targetType: z.enum(["INDIVIDUAL", "DEPARTMENT"]),
    employeeId: z.string().optional(),
    departmentId: z.string().optional(),
  })
  .refine((v) => (v.targetType === "INDIVIDUAL" ? !!v.employeeId : !!v.departmentId), {
    message: "employeeId or departmentId is required depending on targetType",
  });

export async function assign(req: Request, res: Response) {
  const input = assignSchema.parse(req.body);
  const assignment = await assignmentsService.assignCourse({ ...input, assignedById: req.user!.id });
  await logActivity({ userId: req.user!.id, action: "assignment.create", metadata: { assignmentId: assignment.id } });
  res.status(201).json({ assignment });
}

export async function unassign(req: Request, res: Response) {
  await assignmentsService.unassign(req.params.id);
  await logActivity({ userId: req.user!.id, action: "assignment.remove", metadata: { assignmentId: req.params.id } });
  res.status(204).send();
}
