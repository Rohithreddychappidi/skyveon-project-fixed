import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { sendSetupLink } from "../auth/auth.service";

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

export async function createEmployee(input: { name: string; email: string; departmentId?: string; role?: "ADMIN" | "EMPLOYEE" }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      departmentId: input.departmentId,
      role: input.role ?? "EMPLOYEE",
      status: "ACTIVE",
    },
  });

  // Fire the setup email — deliberately not awaited-and-swallowed: if this
  // fails, the caller should know so they can resend from the admin UI.
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

export async function resendSetupLink(id: string) {
  const user = await getEmployeeOr404(id);
  if (user.passwordHash) throw ApiError.badRequest("This account has already been set up.");
  await sendSetupLink(id);
}

async function getEmployeeOr404(id: string) {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!user) throw ApiError.notFound("Employee not found");
  return user;
}

// --- Departments -----------------------------------------------------------

export async function listDepartments() {
  return prisma.department.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } });
}

export async function createDepartment(name: string) {
  const existing = await prisma.department.findUnique({ where: { name } });
  if (existing) throw ApiError.conflict("A department with this name already exists");
  return prisma.department.create({ data: { name } });
}
