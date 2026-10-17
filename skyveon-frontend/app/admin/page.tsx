"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-context";
import type { AdminPermission, Assignment, CourseOption, EmployeeOption } from "@/lib/api-types";
import { Users, BookOpen, ClipboardList, TrendingUp } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

function friendlyAction(action: string) {
  const map: Record<string, string> = {
    "auth.login": "signed in",
    "lesson.complete": "completed a lesson",
    "lesson.view": "opened a lesson",
    "course.create": "created a course",
    "user.create": "added an employee",
    "assignment.create": "assigned a course",
    "cms.update_home": "updated the home page",
  };
  return map[action] ?? action.replace(/[._]/g, " ");
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<EmployeeOption[] | null>(null);
  const [courses, setCourses] = useState<CourseOption[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [overallPercent, setOverallPercent] = useState<number | null>(null);

  const can = (...perms: AdminPermission[]) =>
    user?.role === "MASTER_ADMIN" || perms.some((p) => user?.adminPermissions.includes(p));
  const canEmployees = can("MANAGE_EMPLOYEES", "MANAGE_ASSIGNMENTS");
  const canCourses = can("MANAGE_COURSES", "MANAGE_ASSIGNMENTS", "VIEW_PROGRESS");
  const canAssignments = can("MANAGE_ASSIGNMENTS");
  const canActivity = can("MANAGE_EMPLOYEES", "VIEW_PROGRESS");
  const canProgress = can("VIEW_PROGRESS");

  useEffect(() => {
    if (!user) return;
    // Only ask for what this admin is allowed to see — a 403 per card
    // helps nobody — and each card fails independently of the others.
    if (canEmployees) api.get("/api/lookups/employees").then((b) => setEmployees(b.employees)).catch(() => {});
    if (canCourses) api.get("/api/lookups/courses").then((b) => setCourses(b.courses)).catch(() => {});
    if (canAssignments) api.get("/api/assignments").then((b) => setAssignments(b.assignments)).catch(() => {});
    if (canActivity) api.get("/api/activity?take=6").then((b) => setActivity(b.logs)).catch(() => setActivity([]));
    if (canProgress) api.get("/api/progress/overview").then((b) => setOverallPercent(b.percent)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeEmployees = employees?.filter((e) => e.status === "ACTIVE").length ?? null;
  const totalCourses = courses?.length ?? null;
  const activeAssignments = assignments?.length ?? null;

  const stats = [
    { label: "Active employees", value: activeEmployees, icon: Users, tone: "cool" as const },
    { label: "Courses", value: totalCourses, icon: BookOpen, tone: "warm" as const },
    { label: "Assignments", value: activeAssignments, icon: ClipboardList, tone: "cool" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="A quick look at how training is progressing across Skyveon."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span
                className={
                  "h-9 w-9 rounded-lg flex items-center justify-center " +
                  (s.tone === "warm" ? "bg-orange/10" : "bg-indigo/10")
                }
              >
                <s.icon size={18} className={s.tone === "warm" ? "text-orange" : "text-indigo"} />
              </span>
            </div>
            <p className="font-display font-semibold text-3xl text-ink">
              {s.value ?? "—"}
            </p>
            <p className="text-sm text-slate mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink">Recent activity</h3>
          </div>
          <div className="flex flex-col divide-y divide-slate-100">
            {activity?.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {entry.user?.name ?? "System"}
                  </p>
                  <p className="text-xs text-slate truncate">{friendlyAction(entry.action)}</p>
                </div>
                <Badge tone="neutral">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            ))}
            {activity?.length === 0 && (
              <p className="text-sm text-slate py-6 text-center">No activity yet.</p>
            )}
            {activity === null && (
              <p className="text-sm text-slate py-6 text-center">
                {canActivity ? "Loading…" : "Activity is visible to admins with employee or progress access."}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-slate text-xs mb-3">
            <TrendingUp size={14} />
            <span>Overall completion</span>
          </div>
          {canProgress ? (
            <ProgressRing percent={overallPercent ?? 0} size={110} label="lessons" />
          ) : (
            <p className="text-sm text-slate">Needs progress access.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
