import type { Request, Response } from "express";
import { pipeline } from "stream/promises";
import { z } from "zod";
import * as filesService from "./files.service";
import { logActivity } from "../../lib/activityLog";
import { getStorage } from "../../lib/storage";
import { parseRangeHeader } from "../../lib/httpRange";

export async function getLink(req: Request, res: Response) {
  const { path, expiresInSeconds } = await filesService.createSignedLink(req.user!.id, req.params.lessonId);
  await logActivity({ userId: req.user!.id, action: "lesson.view", metadata: { lessonId: req.params.lessonId } });
  // `path` is relative on purpose: the frontend prefixes its own API base
  // URL. Building an absolute URL here from req.protocol produced http://
  // links behind the TLS-terminating proxy, which browsers block inside the
  // https site. `url` is kept for older clients.
  res.json({ path, url: `https://${req.get("host")}${path}`, expiresInSeconds });
}

const streamQuerySchema = z.object({ token: z.string().min(1) });

function contentDisposition(fileName: string) {
  return `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function stream(req: Request, res: Response) {
  const { token } = streamQuerySchema.parse(req.query);
  const { lesson, viewer, kind, key } = await filesService.authorizeStream(req.params.lessonId, token);

  // Best-effort download deterrents — a determined user can still screenshot
  // or use browser devtools; real hard-blocking needs the native mobile app.
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (kind === "pdf" || kind === "image") {
    // Watermarked per viewer, so always sent whole: advertising byte ranges
    // here let PDF viewers stitch together chunks from different renders.
    const { buffer, mime, fileName } = await filesService.renderWatermarked(kind, key, lesson, viewer);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", contentDisposition(fileName));
    res.setHeader("Accept-Ranges", "none");
    res.setHeader("Content-Length", String(buffer.length));
    res.status(200).end(buffer);
    return;
  }

  // Video: stream straight from storage, honoring Range so seeking works
  // without ever loading the file into memory. The viewer's identity is
  // overlaid by the player instead of being burned into the frames.
  const storage = getStorage();
  const totalSize = await storage.size(key);
  const range = parseRangeHeader(req.headers.range, totalSize);

  res.setHeader("Content-Type", lesson.fileMime ?? "video/mp4");
  res.setHeader("Content-Disposition", contentDisposition(lesson.fileName ?? "video.mp4"));
  res.setHeader("Accept-Ranges", "bytes");

  if (range === "invalid") {
    res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
    return;
  }

  if (range) {
    res.status(206);
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`);
    res.setHeader("Content-Length", String(range.end - range.start + 1));
  } else {
    res.status(200);
    res.setHeader("Content-Length", String(totalSize));
  }

  const body = await storage.stream(key, range ?? undefined);
  await pipeStream(body, res);
}

export async function adminDownload(req: Request, res: Response) {
  const { key, mime, fileName } = await filesService.getAdminDownload(req.params.lessonId);
  const storage = getStorage();
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader("Content-Length", String(await storage.size(key)));
  await pipeStream(await storage.stream(key), res);
}

async function pipeStream(body: NodeJS.ReadableStream, res: Response) {
  try {
    await pipeline(body, res);
  } catch (err) {
    // The browser aborting a range request mid-seek is routine, not an error.
    if ((err as NodeJS.ErrnoException)?.code === "ERR_STREAM_PREMATURE_CLOSE") return;
    throw err;
  }
}
