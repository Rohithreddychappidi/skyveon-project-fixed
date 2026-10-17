import sharp from "sharp";
import { ApiError } from "./apiError";

const MAX_WIDTH = 2400;

/**
 * Re-encodes an uploaded cover/CMS image as WebP, capped at MAX_WIDTH —
 * the home page hero images were 1.2–1.6 MB PNGs; this typically brings
 * them under 200 KB with no visible difference. GIFs keep their animation.
 */
export async function optimizeImage(input: Buffer): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  try {
    const image = sharp(input, { animated: true }).rotate();
    const meta = await image.metadata();
    const resized = meta.width && meta.width > MAX_WIDTH ? image.resize({ width: MAX_WIDTH }) : image;
    const buffer = await resized.webp({ quality: 82 }).toBuffer();
    return { buffer, ext: ".webp", mime: "image/webp" };
  } catch {
    throw ApiError.badRequest("That file couldn't be read as an image.");
  }
}

export function imageMimeForKey(key: string) {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  return "image/jpeg";
}
