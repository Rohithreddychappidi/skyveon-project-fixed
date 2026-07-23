"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { useAuth } from "@/components/auth/auth-context";
import { api } from "@/lib/api";
import type { Course } from "@/lib/api-types";
import { BookOpen, Layers } from "lucide-react";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);

  useEffect(() => {
    api.get("/api/courses/mine").then((body) => setCourses(body.courses));
  }, []);

  return (
    <div>
      <PageHeader
        title={`Welcome back${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        subtitle="Your assigned training, all in one place."
      />

      <div className="grid sm:grid-cols-2 gap-4">
        {courses?.map((course) => (
          <Link key={course.id} href={`/employee/courses/${course.id}`}>
            <Card className="p-5 h-full hover:border-indigo/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <span className="h-9 w-9 rounded-lg bg-orange/10 flex items-center justify-center">
                  <BookOpen size={18} className="text-orange" />
                </span>
                <Badge tone="cool">{course.department}</Badge>
              </div>
              <h3 className="font-display font-semibold text-ink mb-1">{course.title}</h3>
              <p className="text-sm text-slate line-clamp-2 mb-4">{course.description}</p>

              <ProgressBar percent={course.progress?.percent ?? 0} showLabel />
              <div className="flex items-center justify-between mt-2">
                <span className="flex items-center gap-1 text-xs text-slate font-mono">
                  <Layers size={12} />
                  {course.progress?.completedLessons ?? 0}/{course.progress?.totalLessons ?? course.lessons.length} lessons
                </span>
              </div>
            </Card>
          </Link>
        ))}

        {courses !== null && courses.length === 0 && (
          <p className="text-sm text-slate col-span-full py-8 text-center">
            No courses assigned to you yet — check back soon.
          </p>
        )}
        {courses === null && <p className="text-sm text-slate">Loading…</p>}
      </div>
    </div>
  );
}
