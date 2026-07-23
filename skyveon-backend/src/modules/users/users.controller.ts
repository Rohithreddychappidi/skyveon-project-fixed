import type { Request, Response } from "express";
import { z } from "zod";
import * as usersService from "./users.service";
import { logActivity } from "../../lib/activityLog";

const listQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  departmentId: z.string().optional(),
});

export async function list(req: Request, res: Response) {
  const query = listQuerySchema.parse(req.query);
  const employees = await usersService.listEmployees(query);
  res.json({ employees });
}

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  departmentId: z.string().optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
});

export async function create(req: Request, res: Response) {
  const input = createSchema.parse(req.body);
  const employee = await usersService.createEmployee(input);
  await logActivity({ userId: req.user!.id, action: "user.create", metadata: { targetUserId: employee.id } });
  res.status(201).json({ employee });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  departmentId: z.string().nullable().optional(),
});

export async function update(req: Request, res: Response) {
  const input = updateSchema.parse(req.body);
  const employee = await usersService.updateEmployee(req.params.id, input);
  await logActivity({ userId: req.user!.id, action: "user.update", metadata: { targetUserId: employee.id } });
  res.json({ employee });
}

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });
export async function setStatus(req: Request, res: Response) {
  const { status } = statusSchema.parse(req.body);
  const employee = await usersService.setEmployeeStatus(req.params.id, status);
  await logActivity({
    userId: req.user!.id,
    action: status === "ACTIVE" ? "user.activate" : "user.deactivate",
    metadata: { targetUserId: employee.id },
  });
  res.json({ employee });
}

export async function remove(req: Request, res: Response) {
  await usersService.softDeleteEmployee(req.params.id);
  await logActivity({ userId: req.user!.id, action: "user.delete", metadata: { targetUserId: req.params.id } });
  res.status(204).send();
}

export async function resendSetup(req: Request, res: Response) {
  await usersService.resendSetupLink(req.params.id);
  res.json({ message: "Setup link resent." });
}

// --- Departments -------------------------------------------------------------

export async function listDepartments(_req: Request, res: Response) {
  const departments = await usersService.listDepartments();
  res.json({ departments });
}

const createDeptSchema = z.object({ name: z.string().min(1) });
export async function createDepartment(req: Request, res: Response) {
  const { name } = createDeptSchema.parse(req.body);
  const department = await usersService.createDepartment(name);
  res.status(201).json({ department });
}
