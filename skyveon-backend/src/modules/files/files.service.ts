import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { getStorage } from "../../lib/storage";
import { watermarkPdf, watermarkImage } from "../../lib/watermark";
import { signFileToken, verifyFileToken } from "../../lib/signedLink";
import { ensureLessonUnlocked } from "../../lib/lessonGating";
import type { Lesson } from "@prisma/client";

async function ensureCanAccess(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, isDeleted: false } });
  if (!lesson) throw ApiError.notFound("Lesson not found");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted || user.status !== "ACTIVE") {
    throw ApiError.forbidden("You don't have access to this content.");
  }
  if (user.role === "EMPLOYEE") {
    const assignment = await prisma.assignment.findFirst({
      where: {
        courseId: lesson.courseId,
        isDeleted: false,
        OR: [
          { targetType: "INDIVIDUAL", employeeId: userId },
          ...(user.departmentId ? [{ targetType: "DEPARTMENT" as const, departmentId: user.departmentId }] : []),
        ],
      },
    });
    if (!assignment) throw ApiError.forbidden("You don't have access to this content.");
    await ensureLessonUnlocked(userId, lesson.courseId, lesson.id);
  }
  // ADMIN / MASTER_ADMIN can preview any lesson's content, no assignment needed.

  return { lesson, user };
}

/**
 * How long a signed stream link stays valid. A <video> element keeps
 * re-requesting byte ranges from the same URL for as long as it plays, so a
 * video link has to outlive the video itself (multi-hour lectures included)
 * — every request still re-checks the viewer's access, so a long-lived link
 * doesn't outlive a revoked assignment or deactivated account.
 */
export function linkTtlSeconds(lesson: Pick<Lesson, "type" | "durationSeconds">) {
  if (lesson.type === "VIDEO") {
    const duration = lesson.durationSeconds ?? 0;
    return Math.min(Math.max(duration * 3, 4 * 60 * 60), 12 * 60 * 60);
  }
  return 30 * 60;
}

type ContentKind = "pdf" | "image" | "video";

function contentKind(lesson: Lesson): { kind: ContentKind; key: string } {
  if (lesson.type === "PPT" || lesson.type === "DOC") {
    // Office files are only ever served as their converted PDF — never the
    // original .pptx/.docx, which the browser would simply download.
    if (lesson.conversionStatus === "PENDING") {
      throw ApiError.conflict("This document is still being converted — check back shortly.");
    }
    if (!lesson.convertedKey) {
      throw ApiError.conflict("This document couldn't be converted. Contact your admin.");
    }
    return { kind: "pdf", key: lesson.convertedKey };
  }
  if (!lesson.fileKey) throw ApiError.notFound("No file uploaded for this lesson yet.");
  if (lesson.type === "PDF") return { kind: "pdf", key: lesson.fileKey };
  if (lesson.type === "IMAGE") return { kind: "image", key: lesson.fileKey };
  if (lesson.type === "VIDEO") {
    if (lesson.fileMime && !lesson.fileMime.startsWith("video/")) {
      throw new ApiError(422, "This lesson's file isn't a video. Ask your admin to re-upload it.");
    }
    return { kind: "video", key: lesson.fileKey };
  }
  throw ApiError.badRequest("This lesson type has no file to view.");
}

export async function createSignedLink(userId: string, lessonId: string) {
  const { lesson } = await ensureCanAccess(userId, lessonId);
  contentKind(lesson); // fail now (e.g. "still converting") rather than inside an <iframe>
  const ttl = linkTtlSeconds(lesson);
  const token = signFileToken({ lessonId, userId }, ttl);
  return { path: `/api/files/${lessonId}/stream?token=${encodeURIComponent(token)}`, expiresInSeconds: ttl };
}

export async function authorizeStream(lessonId: string, token: string) {
  let payload;
  try {
    payload = verifyFileToken(token);
  } catch {
    throw ApiError.unauthorized("This link has expired. Reopen the lesson to get a new one.");
  }
  if (payload.lessonId !== lessonId) throw ApiError.unauthorized("Invalid link");

  const { lesson, user } = await ensureCanAccess(payload.userId, lessonId);
  return { lesson, viewer: user, ...contentKind(lesson) };
}

/** PDF and image lessons are watermarked per viewer, so they're built in memory and sent whole. */
export async function renderWatermarked(
  kind: "pdf" | "image",
  key: string,
  lesson: Lesson,
  viewer: { id: string; name: string; email: string }
) {
  const raw = await getStorage().read(key);
  const identity = { name: viewer.name, email: viewer.email, id: viewer.id };

  if (kind === "pdf") {
    if (raw.subarray(0, 1024).indexOf("%PDF") === -1) {
      throw new ApiError(422, "This lesson's file isn't a valid PDF. Ask your admin to re-upload it.");
    }
    return { buffer: await watermarkPdf(raw, identity), mime: "application/pdf", fileName: pdfName(lesson) };
  }
  return {
    buffer: await watermarkImage(raw, identity),
    mime: lesson.fileMime?.startsWith("image/") ? lesson.fileMime : "image/jpeg",
    fileName: lesson.fileName ?? "image",
  };
}

function pdfName(lesson: Lesson) {
  const base = (lesson.fileName ?? "document").replace(/\.[^.]+$/, "");
  return `${base}.pdf`;
}

export async function getAdminDownload(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, isDeleted: false } });
  if (!lesson?.fileKey) throw ApiError.notFound("No file uploaded for this lesson yet.");
  return {
    key: lesson.fileKey,
    mime: lesson.fileMime ?? "application/octet-stream",
    fileName: lesson.fileName ?? "file",
  };
}
