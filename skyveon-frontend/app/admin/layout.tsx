"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { RequireRole } from "@/components/auth/require-role";
import { useAuth } from "@/components/auth/auth-context";
import type { AdminPermission } from "@/lib/api-types";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  BarChart3,
  LayoutTemplate,
  ShieldCheck,
} from "lucide-react";

interface AdminNavItem extends NavItem {
  // undefined = always visible to any admin/master admin. Otherwise the
  // signed-in admin needs this permission (master admins always pass).
  requires?: AdminPermission;
  masterAdminOnly?: boolean;
}

const navItems: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Employees", href: "/admin/employees", icon: Users, requires: "MANAGE_EMPLOYEES" },
  { label: "Courses", href: "/admin/courses", icon: BookOpen, requires: "MANAGE_COURSES" },
  { label: "Assignments", href: "/admin/assignments", icon: ClipboardList, requires: "MANAGE_ASSIGNMENTS" },
  { label: "Progress", href: "/admin/progress", icon: BarChart3, requires: "VIEW_PROGRESS" },
  { label: "Home Page CMS", href: "/admin/cms", icon: LayoutTemplate, requires: "MANAGE_CMS" },
  { label: "Admins", href: "/admin/admins", icon: ShieldCheck, masterAdminOnly: true },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;

  const isMasterAdmin = user.role === "MASTER_ADMIN";
  const visibleItems = navItems.filter((item) => {
    if (item.masterAdminOnly) return isMasterAdmin;
    if (!item.requires) return true;
    return isMasterAdmin || user.adminPermissions.includes(item.requires);
  });

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar items={visibleItems} user={user} roleLabel={isMasterAdmin ? "Master Admin" : "Admin Portal"} />
      <main className="flex-1 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="ADMIN">
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
