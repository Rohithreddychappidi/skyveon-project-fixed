"use client";

import { api, ApiError } from "./api";

// Formats the API can process (it re-encodes uploads with sharp). Listing
// them explicitly — rather than "image/*" — also makes iPhones and iPads
// convert HEIC photos to JPEG when one is picked, instead of uploading a
// file the server can't read.
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const IMAGE_HINT = "JPG, PNG, WebP or GIF, up to 20 MB.";
const MAX_IMAGE_MB = 20; // matches imageUpload's limit in the API's middleware/upload.ts

/** Why a picked file can't be used as a cover/CMS image, or null if it's fine. */
export function imageFileProblem(file: Pick<File, "name" | "type" | "size">): string | null {
  const name = file.name.toLowerCase();
  if (/\.(heic|heif)$/.test(name) || /image\/hei[cf]/.test(file.type)) {
    return `"${file.name}" is a HEIC photo, which isn't supported. Export it as JPG or PNG and upload that instead.`;
  }
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) && !/\.(jpe?g|png|webp|gif)$/.test(name)) {
    return `"${file.name}" isn't a supported image. Use ${IMAGE_HINT}`;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `"${file.name}" is ${mb} MB — images must be ${MAX_IMAGE_MB} MB or smaller.`;
  }
  return null;
}

/**
 * Checks the file, then uploads it to the first endpoint the admin is
 * allowed to use (cover images fall back to the CMS endpoint for admins with
 * MANAGE_CMS but not MANAGE_COURSES). Throws an Error whose message is safe
 * to show as-is — the server's own reason, not a generic "failed".
 */
export async function uploadImageFile(file: File, endpoints: string[]): Promise<string> {
  const problem = imageFileProblem(file);
  if (problem) throw new Error(problem);

  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const body = await api.upload(endpoint, fd);
      return body.url as string;
    } catch (err) {
      lastError = err;
      // Only a permission problem is worth retrying on the next endpoint;
      // a bad file would be rejected there too.
      if (!(err instanceof ApiError && err.status === 403)) break;
    }
  }
  if (lastError instanceof ApiError) {
    throw new Error(lastError.status === 413 ? `"${file.name}" is too large — images must be ${MAX_IMAGE_MB} MB or smaller.` : lastError.message);
  }
  throw new Error("The image couldn't be uploaded — check your connection and try again.");
}
