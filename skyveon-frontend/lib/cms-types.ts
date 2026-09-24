// Content model for the public home page.
// Everything the Admin CMS can edit lives in this shape, so the home page
// simply renders whatever is in HomeCmsContent — nothing here is hardcoded
// in the page itself once wired up.

export type ImagePosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface HomeCmsContent {
  brand: {
    name: string;
    tagline: string;
  };
  hero: {
    // Pure visual banner — intentionally no headline/body copy.
    // Leave imageUrl empty to use the generated clay/glass illustration.
    imageUrl: string;
    // Position of the image within the banner container (object-position).
    imagePosition?: ImagePosition;
    // Optional — a separate crop/image for small screens, since a single
    // wide banner rarely looks right at both a phone width and a desktop
    // width. Falls back to imageUrl on mobile if left empty.
    mobileImageUrl?: string;
    mobileImagePosition?: ImagePosition;
    // Every image ever uploaded for this slot, most recent last. imageUrl
    // is simply "whichever one is currently selected as active" — uploading
    // a new photo adds to this stack rather than discarding the old ones,
    // so an admin can switch back to a previous banner without re-uploading.
    imageGallery?: string[];
    mobileImageGallery?: string[];
    // When true, pick a random image from imageGallery on each page load.
    // imageUrl is used as the fallback if the gallery is empty.
    randomiseOnLoad?: boolean;
    altText: string;
  };
  about: {
    title: string;
    body: string;
    highlights: { label: string; value: string }[];
    // Leave imageUrl empty to use the generated clay/glass illustration.
    imageUrl: string;
    imagePosition?: ImagePosition;
    imageGallery?: string[];
    randomiseOnLoad?: boolean;
  };
  coursesSection: {
    title: string;
    subtitle: string;
    // course ids from lib/mock-data, in the order they should appear.
    // empty array = show all available courses.
    featuredCourseIds: string[];
  };
  footer: {
    tagline: string;
    email: string;
    phone: string;
    address: string;
  };
  defaultTheme: "light" | "dark";
}