"use client";

import { useEffect, useState } from "react";
import type { HomeCmsContent } from "@/lib/cms-types";
import type { PublicCourse } from "@/lib/api-types";
import { Navbar } from "./navbar";
import { Hero } from "./hero";
import { About } from "./about";
import { CoursesSection } from "./courses-section";
import { SiteFooter } from "./site-footer";

const THEME_KEY = "skyveon-home-theme";

/** Interactive shell of the public home page; its content arrives pre-fetched from the server. */
export function HomeView({ content, courses }: { content: HomeCmsContent; courses: PublicCourse[] }) {
  const [theme, setTheme] = useState<"light" | "dark">(content.defaultTheme);

  // Apply the visitor's saved preference (if any) once on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // storage unavailable — keep the CMS default
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        // not persisted — fine
      }
      return next;
    });
  };

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="relative min-h-screen overflow-hidden bg-[#EEF0F7] dark:bg-[#101127] transition-colors">
        {/* ambient background blobs, shared across the whole page */}
        <div
          className="animate-blob-slow pointer-events-none absolute top-[6%] -left-24 h-72 w-72 rounded-full opacity-30 dark:opacity-20 blur-3xl"
          style={{ background: "linear-gradient(135deg, #4B4E9E, #2E3192)" }}
        />
        <div
          className="animate-blob pointer-events-none absolute bottom-[10%] -right-24 h-80 w-80 rounded-full opacity-25 dark:opacity-20 blur-3xl"
          style={{ background: "linear-gradient(135deg, #E63946, #F5821F)" }}
        />

        <div className="relative">
          <Navbar brandName={content.brand.name} theme={theme} onToggleTheme={toggleTheme} />
          <Hero hero={content.hero} />
          <About about={content.about} />
          <CoursesSection coursesSection={content.coursesSection} courses={courses} />
          <SiteFooter brand={content.brand} footer={content.footer} />
        </div>
      </div>
    </div>
  );
}
