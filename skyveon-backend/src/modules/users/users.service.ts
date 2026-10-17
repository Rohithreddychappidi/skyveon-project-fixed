import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { sendSetupLink } from "../auth/auth.service";
import { getStorage } from "../../lib/storage";

export async function listEmployees(params: { search?: string; status?: "ACTIVE" | "INACTIVE"; departmentId?: string }) {
  const employees = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      isDeleted: false,
      status: params.status,
      departmentId: params.departmentId,
      OR: params.search
        ? [
            { name: { contains: params.search, mode: "insensitive" } },
            { email: { contains: params.search, mode: "insensitive" } },
          ]
        : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      departmentId: true,
      department: true,
      createdAt: true,
      lastLoginAt: true,
      passwordHash: true, // stripped to a boolean below — never sent as-is
    },
    orderBy: { createdAt: "desc" },
  });

  return employees.map(({ passwordHash, ...rest }) => ({ ...rest, hasSetPassword: !!passwordHash }));
}

// This module only ever manages EMPLOYEE accounts. Admin accounts are
// created and managed exclusively by the master admin via /api/admins —
// otherwise an admin with MANAGE_EMPLOYEES could mint new admins, or
// rename/deactivate/delete the master admin.
export async function createEmployee(input: { name: string; email: string; departmentId?: string }) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "EMPLOYEE") {
      throw ApiError.conflict("This email belongs to an admin account");
    }
    if (existing.isDeleted) {
      const restored = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          departmentId: input.departmentId ?? null,
          status: "ACTIVE",
          isDeleted: false,
          passwordHash: null,
        },
      });
      await sendSetupLink(restored.id);
      return restored;
    }
    if (!existing.passwordHash) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { name: input.name, departmentId: input.departmentId ?? existing.departmentId, status: "ACTIVE" },
      });
      await sendSetupLink(updated.id);
      return updated;
    }
    throw ApiError.conflict("An active user with this email already exists");
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      departmentId: input.departmentId,
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  await sendSetupLink(user.id);

  return user;
}

export async function updateEmployee(id: string, input: { name?: string; departmentId?: string | null }) {
  await getEmployeeOr404(id);
  return prisma.user.update({ where: { id }, data: input });
}

export async function setEmployeeStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  await getEmployeeOr404(id);
  // Deactivating disables login without touching historical records —
  // courses, assignments, and progress all stay intact.
  return prisma.user.update({ where: { id }, data: { status } });
}

export async function softDeleteEmployee(id: string) {
  await getEmployeeOr404(id);
  return prisma.user.update({ where: { id }, data: { isDeleted: true, status: "INACTIVE" } });
}

/**
 * Permanently removes an employee and everything tied to them (progress,
 * submissions, assignments, sessions). Activity log rows are kept with the
 * user reference nulled, so the audit trail survives. Uploaded submission
 * files are removed from storage best-effort.
 */
export async function permanentlyDeleteEmployee(id: string) {
  const user = await prisma.user.findFirst({ where: { id, role: "EMPLOYEE" } });
  if (!user) throw ApiError.notFound("Employee not found");

  const submissions = await prisma.lessonSubmission.findMany({
    where: { employeeId: id, fileKey: { not: null } },
    select: { fileKey: true },
  });

  await prisma.user.delete({ where: { id } });

  const storage = getStorage();
  await Promise.all(submissions.map((s) => storage.remove(s.fileKey!)));
  return user;
}

export async function resendSetupLink(id: string) {
  const user = await getEmployeeOr404(id);
  if (user.passwordHash) throw ApiError.badRequest("This account has already been set up.");
  await sendSetupLink(id);
}

async function getEmployeeOr404(id: string) {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false, role: "EMPLOYEE" } });
  if (!user) throw ApiError.notFound("Employee not found");
  return user;
}

// --- Departments -----------------------------------------------------------

export async function listDepartments() {
  return prisma.department.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } });
}

export async function createDepartment(name: string) {
  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) {
    if (existing.isDeleted) {
      return prisma.department.update({ where: { id: existing.id }, data: { isDeleted: false } });
    }
    throw ApiError.conflict("A department with this name already exists");
  }
  return prisma.department.create({ data: { name } });
}
