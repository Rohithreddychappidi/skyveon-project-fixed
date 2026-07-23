import type { Request, Response } from "express";
import { z } from "zod";
import * as filesService from "./files.service";
import { ApiError } from "../../lib/apiError";
import { logActivity } from "../../lib/activityLog";

export async function getLink(req: Request, res: Response) {
  const path = await filesService.createSignedLink(req.user!.id, req.params.lessonId);
  const url = `${req.protocol}://${req.get("host")}${path}`;
  await logActivity({ userId: req.user!.id, action: "lesson.view", metadata: { lessonId: req.params.lessonId } });
  res.json({ url, expiresInSeconds: 300 });
}

const streamQuerySchema = z.object({ token: z.string().min(1) });

export async function stream(req: Request, res: Response) {
  const { token } = streamQuerySchema.parse(req.query);
  if (!token) throw ApiError.badRequest("Missing token");

  const { buffer, mime, fileName } = await filesService.streamLessonContent(req.params.lessonId, token);

  // Best-effort download deterrents — a determined user can still screenshot
  // or use browser devtools; real hard-blocking needs the native mobile app
  // (see architecture notes).
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Required for <video>/<audio> seeking (and some PDF viewers) to work at
  // all: without Accept-Ranges + honoring the Range header, the browser has
  // no way to request a specific byte offset, so any seek attempt just
  // re-requests the whole file from byte 0 — which looks exactly like
  // "seeking always resets to 0:00", even though nothing is wrong with the
  // video file itself.
  res.setHeader("Accept-Ranges", "bytes");

  const totalSize = buffer.length;
  const range = req.headers.range;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : totalSize - 1;

    if (!match || Number.isNaN(start) || Number.isNaN(end) || start > end || end >= totalSize) {
      res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
      return;
    }

    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    res.setHeader("Content-Length", String(end - start + 1));
    res.end(buffer.subarray(start, end + 1));
    return;
  }

  res.setHeader("Content-Length", String(totalSize));
  res.status(200);
  res.end(buffer);
}

export async function adminDownload(req: Request, res: Response) {
  const { buffer, mime, fileName } = await filesService.adminDownload(req.params.lessonId);
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.send(buffer);
}