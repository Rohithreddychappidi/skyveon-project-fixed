"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { api } from "@/lib/api";
import type { Course, ProgressTableRow } from "@/lib/api-types";
import { statusLabel, statusTone } from "@/components/ui/lesson-icon";

export default function ProgressPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [rows, setRows] = useState<ProgressTableRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/courses").then((body) => {
      setCourses(body.courses);
      if (body.courses.length > 0) setSelectedCourseId(body.courses[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setRows(null);
    api.get(`/api/progress/course/${selectedCourseId}/table`).then((body) => setRows(body.rows));
  }, [selectedCourseId]);

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Completion by employee for a selected course."
        action={
          courses.length > 0 ? (
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/15"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate uppercase tracking-wide border-b border-slate-200">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Progress</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.map((row) => (
              <tr key={row.employee.id}>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-ink">{row.employee.name}</p>
                  <p className="text-xs text-slate">{row.employee.email}</p>
                </td>
                <td className="px-5 py-3.5 w-48">
                  <ProgressBar percent={row.percent} showLabel />
                  <span className="text-[11px] text-slate font-mono">
                    {row.completedLessons}/{row.totalLessons} lessons
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                </td>
              </tr>
            ))}
            {rows !== null && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate">
                  No one is assigned to this course yet.
                </td>
              </tr>
            )}
            {rows === null && !loading && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {!loading && courses.length === 0 && (
        <p className="text-sm text-slate mt-4">Create a course first to see progress here.</p>
      )}
    </div>
  );
}
