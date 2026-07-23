import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { sendSetupLink } from "../auth/auth.service";
import type { AdminPermission } from "@prisma/client";

export async function listAdmins() {
  return prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MASTER_ADMIN"] }, isDeleted: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      adminPermissions: true,
      createdAt: true,
      lastLoginAt: true,
      passwordHash: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  }).then((admins) => admins.map(({ passwordHash, ...rest }) => ({ ...rest, hasSetPassword: !!passwordHash })));
}

export async function createAdmin(input: { name: string; email: string; permissions: AdminPermission[] }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const admin = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      role: "ADMIN",
      status: "ACTIVE",
      adminPermissions: input.permissions,
    },
  });

  await sendSetupLink(admin.id);
  return admin;
}

export async function updatePermissions(id: string, permissions: AdminPermission[]) {
  const admin = await getManageableAdminOr404(id);
  return prisma.user.update({ where: { id: admin.id }, data: { adminPermissions: permissions } });
}

export async function setAdminStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  const admin = await getManageableAdminOr404(id);
  return prisma.user.update({ where: { id: admin.id }, data: { status } });
}

export async function softDeleteAdmin(id: string) {
  const admin = await getManageableAdminOr404(id);
  return prisma.user.update({ where: { id: admin.id }, data: { isDeleted: true, status: "INACTIVE" } });
}

// A master admin can manage regular ADMIN accounts, but not other master
// admins (and not itself, via this path) — prevents one master admin from
// locking another out, and keeps "who can deactivate a master admin" out
// of scope entirely (do that directly in the database if it's ever needed).
async function getManageableAdminOr404(id: string) {
  const admin = await prisma.user.findFirst({ where: { id, role: "ADMIN", isDeleted: false } });
  if (!admin) throw ApiError.notFound("Admin not found");
  return admin;
}
