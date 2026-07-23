"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import type { Role } from "@/lib/api-types";

// MASTER_ADMIN outranks ADMIN outranks EMPLOYEE — mirrors the backend's
// middleware/auth.ts hierarchy. A route guarded for "ADMIN" also admits a
// MASTER_ADMIN.
const ROLE_RANK: Record<Role, number> = { EMPLOYEE: 0, ADMIN: 1, MASTER_ADMIN: 2 };

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();

  const hasAccess = !!user && ROLE_RANK[user.role] >= ROLE_RANK[role];

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user && !hasAccess) {
      router.replace(user.role === "EMPLOYEE" ? "/employee" : "/admin");
    }
  }, [status, user, hasAccess, router]);

  if (status === "loading" || status === "unauthenticated" || !hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-2 text-sm text-slate">
          <span className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-indigo animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
