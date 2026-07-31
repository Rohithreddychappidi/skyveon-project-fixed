import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth, requireRole, requirePermission } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { logActivity } from "../../lib/activityLog";
import { ApiError } from "../../lib/apiError";
import { getStorage, makeStorageKey } from "../../lib/storage";

export const cmsRouter = Router();

// Public — the home page itself reads this with no auth required.
cmsRouter.get(
  "/home",
  asyncHandler(async (_req, res) => {
    const row = await prisma.homeContent.findUnique({ where: { id: "home" } });
    // null content means "nothing saved yet" — the frontend falls back to
    // its own bundled defaults in that case.
    res.json({ content: row?.content ?? null, updatedAt: row?.updatedAt ?? null });
  })
);

const saveSchema = z.object({
  // Free-form: the frontend owns the shape (HomeCmsContent). Validating the
  // full shape here would duplicate that type — the frontend is the only
  // writer, gated behind admin auth below.
  content: z.record(z.any()),
});

cmsRouter.put(
  "/home",
  requireAuth,
  requireRole("ADMIN"),
  requirePermission("MANAGE_CMS"),
  asyncHandler(async (req, res) => {
    const { content } = saveSchema.parse(req.body);
    const row = await prisma.homeContent.upsert({
      where: { id: "home" },
      update: { content, updatedById: req.user!.id },
      create: { id: "home", content, updatedById: req.user!.id },
    });
    await logActivity({ userId: req.user!.id, action: "cms.update_home" });
    res.json({ content: row.content, updatedAt: row.updatedAt });
  })
);

// Admin uploads a hero/about image here instead of pasting a URL. Stored
// through the same storage driver as everything else (local disk or B2),
// then served back publicly via the route below — these are marketing
// images on the public home page, not protected employee content, so no
// signed URL / watermarking / expiry is needed.
cmsRouter.post(
  "/upload-image",
  requireAuth,
  requireRole("ADMIN"),
  requirePermission("MANAGE_CMS"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("No file uploaded");
    if (!req.file.mimetype.startsWith("image/")) {
      throw ApiError.badRequest("Only image files are allowed here.");
    }
    const key = makeStorageKey(req.file.originalname);
    await getStorage().save(`cms/${key}`, req.file.buffer, req.file.mimetype);
    await logActivity({ userId: req.user!.id, action: "cms.upload_image" });
    res.status(201).json({ url: `/api/cms/image/${key}` });
  })
);

// Public, unauthenticated, cacheable — serves whatever was uploaded above.
// Express doesn't like a bare "*" wildcard param name, so this matches
// everything after /image/ via a regex instead.
cmsRouter.get(
  /^\/image\/(.+)/,
  asyncHandler(async (req, res) => {
    const key = `cms/${req.params[0]}`;
    try {
      const buffer = await getStorage().read(key);
      const ext = key.split(".").pop()?.toLowerCase();
      const mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch (err) {
      // Log the REAL cause (wrong B2 region/credentials, network issue,
      // genuinely missing key, etc.) — without this, every possible failure
      // looks identical from the client side ("Image not found"), which
      // makes B2 misconfiguration nearly impossible to diagnose.
      // eslint-disable-next-line no-console
      console.error(`[cms image] failed to read "${key}":`, err instanceof Error ? err.message : err);
      res.status(404).json({ error: "Image not found" });
    }
  })
);