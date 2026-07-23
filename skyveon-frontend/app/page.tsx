"use client";

import { useEffect, useState } from "react";
import { useCms } from "@/components/cms/cms-context";
import { Navbar } from "@/components/home/navbar";
import { Hero } from "@/components/home/hero";
import { About } from "@/components/home/about";
import { CoursesSection } from "@/components/home/courses-section";
import { SiteFooter } from "@/components/home/site-footer";

const THEME_KEY = "skyveon-home-theme";

export default function HomePage() {
  const { content } = useCms();
  const [theme, setTheme] = useState<"light" | "dark">(content.defaultTheme);

  // Load the visitor's saved preference (or the CMS default) once on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    } else {
      setTheme(content.defaultTheme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, next);
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
          <CoursesSection coursesSection={content.coursesSection} />
          <SiteFooter brand={content.brand} footer={content.footer} />
        </div>
      </div>
    </div>
  );
}
