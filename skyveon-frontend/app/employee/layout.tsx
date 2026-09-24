"use client";

import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { RequireRole } from "@/components/auth/require-role";
import { useAuth } from "@/components/auth/auth-context";
import { BookOpen, UserCircle } from "lucide-react";

const navItems: NavItem[] = [
  { label: "My Courses", href: "/employee", icon: BookOpen },
  { label: "Profile", href: "/employee/profile", icon: UserCircle },
];

function EmployeeShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar items={navItems} user={user} roleLabel="Employee Portal" />
      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 pt-20 md:pt-8 max-w-7xl">{children}</main>
    </div>
  );
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="EMPLOYEE">
      <EmployeeShell>{children}</EmployeeShell>
    </RequireRole>
  );
}
