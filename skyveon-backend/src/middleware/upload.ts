import os from "os";
import fs from "fs/promises";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";

// Lesson content and assignment submissions can be up to MAX_UPLOAD_MB
// (2 GB by default) — far too big to hold in RAM, so they're spooled to a
// temp file and streamed into storage from there. Callers read
// req.file.path, never req.file.buffer.
export const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

// Cover/CMS images are small and get re-encoded with sharp straight away,
// so memory storage is fine here — with a much tighter limit.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

/** Removes the temp file multer's disk storage wrote, once the request is done with it. */
export function cleanupTempUpload(req: Request, res: Response, next: NextFunction) {
  res.on("close", () => {
    if (req.file?.path) fs.rm(req.file.path, { force: true }).catch(() => {});
  });
  next();
}
