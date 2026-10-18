import type { LessonType } from "@prisma/client";
import { ApiError } from "./apiError";

// Which uploads each lesson type accepts. Checked on upload so a PDF can't
// land in a VIDEO lesson (or an .mp4 in a PDF lesson) — both happened in
// production and left the lesson impossible to view or complete.
const RULES: Partial<Record<LessonType, { extensions: string[]; label: string }>> = {
  VIDEO: { extensions: [".mp4", ".m4v", ".mov", ".webm"], label: "a video (MP4, MOV or WebM)" },
  PDF: { extensions: [".pdf"], label: "a PDF" },
  PPT: { extensions: [".ppt", ".pptx", ".odp", ".key"], label: "a PowerPoint file (.ppt/.pptx)" },
  DOC: { extensions: [".doc", ".docx", ".odt", ".rtf", ".txt"], label: "a Word document (.doc/.docx)" },
  IMAGE: { extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"], label: "an image (JPG, PNG, GIF or WebP)" },
};

const TYPE_NAMES: Partial<Record<LessonType, string>> = {
  VIDEO: "a video",
  PDF: "a PDF",
  PPT: "a presentation",
  DOC: "a document",
  IMAGE: "an image",
};

export function acceptedExtensions(type: LessonType) {
  return RULES[type]?.extensions ?? [];
}

export function assertFileMatchesLessonType(type: LessonType, fileName: string) {
  const rule = RULES[type];
  if (!rule) throw ApiError.badRequest(`${type} lessons don't take a file upload.`);
  const lower = fileName.toLowerCase();
  if (!rule.extensions.some((ext) => lower.endsWith(ext))) {
    throw ApiError.badRequest(`This is ${TYPE_NAMES[type]} lesson — upload ${rule.label}.`);
  }
}

/** MIME type stored for a lesson file — browsers sometimes send application/octet-stream for videos. */
export function normalizeMime(type: LessonType, fileName: string, sentMime: string) {
  if (type === "VIDEO" && !sentMime.startsWith("video/")) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".mov")) return "video/quicktime";
    return "video/mp4";
  }
  if (type === "PDF") return "application/pdf";
  return sentMime;
}
