"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LessonTypeIcon } from "@/components/ui/lesson-icon";
import { api } from "@/lib/api";
import type { HomeCmsContent } from "@/lib/cms-types";
import type { PublicCourse } from "@/lib/api-types";
import { BookOpen, Layers } from "lucide-react";

export function CoursesSection({
  coursesSection,
}: {
  coursesSection: HomeCmsContent["coursesSection"];
}) {
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);

  useEffect(() => {
    api
      .get("/api/courses/public")
      .then((body) => setCourses(body.courses))
      .catch(() => setCourses([]));
  }, []);

  const ordered = !courses
    ? []
    : coursesSection.featuredCourseIds.length
    ? (coursesSection.featuredCourseIds
        .map((id) => courses.find((c) => c.id === id))
        .filter(Boolean) as PublicCourse[])
    : courses;

  return (
    <section id="courses" className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10">
          <h2 className="font-display font-semibold text-2xl sm:text-3xl text-ink dark:text-white tracking-tight">
            {coursesSection.title}
          </h2>
          <p className="text-slate dark:text-white/70 mt-2">
            {coursesSection.subtitle}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses === null &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="clay h-48 rounded-[28px] animate-pulse" />
            ))}

          {courses !== null &&
            ordered.map((course) => (
              <Link key={course.id} href="/login" className="group">
                <div className="clay h-full rounded-[28px] p-5 transition-transform duration-300 group-hover:-translate-y-1.5">
                  <div className="flex items-start justify-between mb-4">
                    <span className="glass h-11 w-11 rounded-2xl flex items-center justify-center">
                      <BookOpen size={19} className="text-indigo dark:text-white" strokeWidth={1.8} />
                    </span>
                    <span className="glass rounded-full px-3 py-1 text-[11px] font-medium font-mono tracking-tight text-indigo dark:text-white">
                      {course.department}
                    </span>
                  </div>

                  <h3 className="font-display font-semibold text-ink dark:text-white mb-1.5">
                    {course.title}
                  </h3>
                  <p className="text-sm text-slate dark:text-white/60 line-clamp-2 mb-5">
                    {course.description}
                  </p>

                  <div className="clay-pressed rounded-2xl px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate dark:text-white/60">
                      {course.lessonTypes.slice(0, 5).map((type) => (
                        <LessonTypeIcon key={type} type={type} className="h-3.5 w-3.5" />
                      ))}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-slate dark:text-white/60 font-mono">
                      <Layers size={12} />
                      {course.lessonCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}

          {courses !== null && ordered.length === 0 && (
            <p className="text-sm text-slate dark:text-white/60 col-span-full">
              No courses published yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
