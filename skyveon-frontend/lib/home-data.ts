import type { HomeCmsContent } from "./cms-types";
import type { PublicCourse } from "./api-types";
import { defaultHomeContent, mergeWithDefaults } from "./cms-data";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Re-fetched at most once a minute; everyone else gets the cached page, so
// a CMS save shows up on the public site within ~60 seconds.
const REVALIDATE_SECONDS = 60;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // API unreachable at build/revalidate time — fall back to defaults
  }
}

/** Server-side data for the public home page, so it renders as real HTML instead of a client-side spinner. */
export async function getHomeData(): Promise<{ content: HomeCmsContent; courses: PublicCourse[] }> {
  const [cms, publicCourses] = await Promise.all([
    getJson<{ content: Partial<HomeCmsContent> | null }>("/api/cms/home"),
    getJson<{ courses: PublicCourse[] }>("/api/courses/public"),
  ]);
  return {
    content: cms?.content ? mergeWithDefaults(cms.content) : defaultHomeContent,
    courses: publicCourses?.courses ?? [],
  };
}
