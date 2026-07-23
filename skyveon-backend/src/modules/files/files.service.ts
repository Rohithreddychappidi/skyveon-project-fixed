import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/apiError";
import { getStorage } from "../../lib/storage";
import { watermarkPdf, watermarkImage } from "../../lib/watermark";
import { burnVideoWatermark } from "../../lib/videoWatermark";
import { signFileToken, verifyFileToken } from "../../lib/signedLink";
import { ensureLessonUnlocked } from "../../lib/lessonGating";

async function ensureEmployeeCanAccess(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, isDeleted: false } });
  if (!lesson) throw ApiError.notFound("Lesson not found");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
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
    await ensureLessonUnlocked(userId, lesson.courseId, lesson.order);
  }
  // ADMIN / MASTER_ADMIN can preview any lesson's content, no assignment needed.

  return lesson;
}

export async function createSignedLink(userId: string, lessonId: string) {
  await ensureEmployeeCanAccess(userId, lessonId);
  const token = signFileToken({ lessonId, userId }, 300); // 5 minutes
  return `/api/files/${lessonId}/stream?token=${encodeURIComponent(token)}`;
}

export async function streamLessonContent(lessonId: string, token: string) {
  let payload;
  try {
    payload = verifyFileToken(token);
  } catch {
    throw ApiError.unauthorized("This link has expired. Reopen the lesson to get a new one.");
  }
  if (payload.lessonId !== lessonId) throw ApiError.unauthorized("Invalid link");

  const lesson = await ensureEmployeeCanAccess(payload.userId, lessonId);
  const viewer = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });

  const key = lesson.convertedKey || lesson.fileKey;
  if (!key) throw ApiError.notFound("No file uploaded for this lesson yet.");

  const storage = getStorage();
  const identity = { name: viewer.name, email: viewer.email, id: viewer.id };

  const isPdf = key.endsWith(".pdf") || lesson.type === "PDF" || !!lesson.convertedKey;
  const isImage = lesson.type === "IMAGE";
  const isVideo = lesson.type === "VIDEO";

  if (isPdf) {
    const raw = await storage.read(key);
    return { buffer: await watermarkPdf(raw, identity), mime: "application/pdf", fileName: lesson.fileName ?? "document.pdf" };
  }
  if (isImage) {
    const raw = await storage.read(key);
    return { buffer: await watermarkImage(raw, identity), mime: lesson.fileMime ?? "image/jpeg", fileName: lesson.fileName ?? "image" };
  }
  if (isVideo) {
    return { buffer: await getWatermarkedVideo(key, lesson.id, viewer, identity), mime: lesson.fileMime ?? "video/mp4", fileName: lesson.fileName ?? "video.mp4" };
  }

  const raw = await storage.read(key);
  return { buffer: raw, mime: lesson.fileMime ?? "application/octet-stream", fileName: lesson.fileName ?? "file" };
}

/**
 * Burning a watermark into a multi-minute video takes real time (a
 * re-encode), so unlike PDF/image it's not something we can afford to do
 * fresh on every single request. Instead, the watermarked copy is computed
 * once per (lesson, viewer) pair and cached in storage — every view after
 * the first is served instantly. If ffmpeg isn't available (e.g. not
 * installed yet in a fresh environment), this falls back to the
 * unmodified video rather than failing the request outright.
 */
async function getWatermarkedVideo(
  sourceKey: string,
  lessonId: string,
  viewer: { id: string },
  identity: { name: string; email: string; id: string }
) {
  const storage = getStorage();
  const cacheKey = `watermarked-video/${lessonId}/${viewer.id}.mp4`;

  if (await storage.exists(cacheKey)) {
    return storage.read(cacheKey);
  }

  const raw = await storage.read(sourceKey);
  try {
    const watermarked = await burnVideoWatermark(raw, identity);
    await storage.save(cacheKey, watermarked, "video/mp4");
    return watermarked;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[video watermark] failed for lesson ${lessonId} — serving unwatermarked video instead. Is ffmpeg installed? `,
      err instanceof Error ? err.message : err
    );
    return raw;
  }
}

export async function adminDownload(lessonId: string) {
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, isDeleted: false } });
  if (!lesson?.fileKey) throw ApiError.notFound("No file uploaded for this lesson yet.");
  const storage = getStorage();
  const raw = await storage.read(lesson.fileKey);
  return { buffer: raw, mime: lesson.fileMime ?? "application/octet-stream", fileName: lesson.fileName ?? "file" };
}
