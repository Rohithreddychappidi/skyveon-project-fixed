"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Employee, Course, Assignment } from "@/lib/api-types";
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
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);
  const [overallPercent, setOverallPercent] = useState<number | null>(null);

  useEffect(() => {
    api.get("/api/users").then((b) => setEmployees(b.employees));
    api.get("/api/assignments").then((b) => setAssignments(b.assignments));
    api.get("/api/activity?take=6").then((b) => setActivity(b.logs));

    api.get("/api/courses").then(async (b) => {
      const list: Course[] = b.courses;
      setCourses(list);

      // Aggregate a rough overall completion percentage across every
      // course's progress table — fine for the handful of courses a
      // company like this runs at a time.
      const tables = await Promise.all(
        list.map((c) =>
          api.get(`/api/progress/course/${c.id}/table`).catch(() => null)
        )
      );
      let completed = 0;
      let total = 0;
      for (const t of tables) {
        if (!t) continue;
        for (const row of t.rows) {
          completed += row.completedLessons;
          total += row.totalLessons;
        }
      }
      setOverallPercent(total ? Math.round((completed / total) * 100) : 0);
    });
  }, []);

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

      <div className="grid grid-cols-3 gap-4 mb-6">
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

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-5">
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
              <p className="text-sm text-slate py-6 text-center">Loading…</p>
            )}
          </div>
        </Card>

        <Card className="p-5 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-slate text-xs mb-3">
            <TrendingUp size={14} />
            <span>Overall completion</span>
          </div>
          <ProgressRing percent={overallPercent ?? 0} size={110} label="lessons" />
        </Card>
      </div>
    </div>
  );
}
