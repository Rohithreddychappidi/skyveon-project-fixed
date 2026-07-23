import type { Request, Response } from "express";
import { z } from "zod";
import * as adminsService from "./admins.service";
import { logActivity } from "../../lib/activityLog";

const PERMISSIONS = ["MANAGE_EMPLOYEES", "MANAGE_COURSES", "MANAGE_ASSIGNMENTS", "VIEW_PROGRESS", "MANAGE_CMS"] as const;

export async function list(_req: Request, res: Response) {
  const admins = await adminsService.listAdmins();
  res.json({ admins });
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

export async function create(req: Request, res: Response) {
  const input = createSchema.parse(req.body);
  const admin = await adminsService.createAdmin(input);
  await logActivity({ userId: req.user!.id, action: "admin.create", metadata: { targetUserId: admin.id } });
  res.status(201).json({ admin });
}

const permissionsSchema = z.object({ permissions: z.array(z.enum(PERMISSIONS)) });
export async function updatePermissions(req: Request, res: Response) {
  const { permissions } = permissionsSchema.parse(req.body);
  const admin = await adminsService.updatePermissions(req.params.id, permissions);
  await logActivity({
    userId: req.user!.id,
    action: "admin.update_permissions",
    metadata: { targetUserId: admin.id, permissions },
  });
  res.json({ admin });
}

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });
export async function setStatus(req: Request, res: Response) {
  const { status } = statusSchema.parse(req.body);
  const admin = await adminsService.setAdminStatus(req.params.id, status);
  await logActivity({
    userId: req.user!.id,
    action: status === "ACTIVE" ? "admin.activate" : "admin.deactivate",
    metadata: { targetUserId: admin.id },
  });
  res.json({ admin });
}

export async function remove(req: Request, res: Response) {
  await adminsService.softDeleteAdmin(req.params.id);
  await logActivity({ userId: req.user!.id, action: "admin.delete", metadata: { targetUserId: req.params.id } });
  res.status(204).send();
}
