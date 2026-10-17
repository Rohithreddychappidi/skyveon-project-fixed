import type { HomeCmsContent } from "./cms-types";

export const defaultHomeContent: HomeCmsContent = {
  brand: {
    name: "Skyveon Learning Hub",
    tagline: "SOLUTIONS IN EVERY HORIZON",
  },
  hero: {
    imageUrl: "",
    imagePosition: "center",
    mobileImageUrl: "",
    mobileImagePosition: "center",
    imageGallery: [],
    mobileImageGallery: [],
    randomiseOnLoad: false,
    altText: "Skyveon Learning Hub",
  },
  about: {
    title: "Built for how Skyveon actually works",
    body: "Skyveon Learning Hub is our internal training platform, built to onboard new hires fast and keep every team sharp — from Cloud & DevOps to AI & Machine Learning. Admins build and assign courses; employees learn at their own pace with progress tracked automatically.",
    highlights: [
      { label: "Departments covered", value: "5+" },
      { label: "Content types supported", value: "Video, PDF, PPT, Docs" },
      { label: "Progress tracking", value: "Automatic" },
    ],
    imageUrl: "",
    imagePosition: "center",
    imageGallery: [],
    randomiseOnLoad: false,
  },
  coursesSection: {
    title: "Explore our courses",
    subtitle: "A look at what's currently available on the platform.",
    featuredCourseIds: [],
  },
  footer: {
    tagline: "SOLUTIONS IN EVERY HORIZON",
    email: "hr@skyveon.ai",
    phone: "+1 (614) 673-3427",
    address: "15 Clairedan Drive, 15A, Powell, OH 43065",
  },
  defaultTheme: "light",
};

// Shallow-merges saved content over the defaults so new fields added to
// HomeCmsContent later don't break older data saved before the change.
export function mergeWithDefaults(saved: Partial<HomeCmsContent>): HomeCmsContent {
  return {
    ...defaultHomeContent,
    ...saved,
    brand: { ...defaultHomeContent.brand, ...saved.brand },
    hero: {
      ...defaultHomeContent.hero,
      ...saved.hero,
      imageGallery: saved.hero?.imageGallery ?? defaultHomeContent.hero.imageGallery,
      mobileImageGallery: saved.hero?.mobileImageGallery ?? defaultHomeContent.hero.mobileImageGallery,
    },
    about: {
      ...defaultHomeContent.about,
      ...saved.about,
      highlights: saved.about?.highlights ?? defaultHomeContent.about.highlights,
      imageGallery: saved.about?.imageGallery ?? defaultHomeContent.about.imageGallery,
    },
    coursesSection: { ...defaultHomeContent.coursesSection, ...saved.coursesSection },
    footer: { ...defaultHomeContent.footer, ...saved.footer },
  };
}
