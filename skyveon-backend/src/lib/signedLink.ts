import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

// --- Password setup / reset links ---------------------------------------
// The raw token goes out in the email link; only its SHA-256 hash is
// stored in the DB (see lib/jwt.ts hashToken), so a DB read alone can't
// forge a valid link.

export interface AuthLinkPayload {
  sub: string; // user id
  purpose: "SETUP_PASSWORD" | "RESET_PASSWORD";
}

export function signAuthLinkToken(payload: AuthLinkPayload, ttl: string) {
  return jwt.sign(payload, env.SIGNED_LINK_SECRET, { expiresIn: ttl } as SignOptions);
}

export function verifyAuthLinkToken(token: string): AuthLinkPayload {
  return jwt.verify(token, env.SIGNED_LINK_SECRET) as AuthLinkPayload;
}

// --- File streaming signed URLs ------------------------------------------
// Stands in for S3/R2 presigned URLs while files live on local disk.
// A signed URL is only valid for the specific lesson + viewer, for a few
// minutes — swap this out for real R2 presigned URLs later without
// touching any calling code (see modules/files/files.service.ts).

export interface FileLinkPayload {
  lessonId: string;
  userId: string;
}

export function signFileToken(payload: FileLinkPayload, ttlSeconds = 300) {
  return jwt.sign(payload, env.SIGNED_LINK_SECRET, { expiresIn: ttlSeconds } as SignOptions);
}

export function verifyFileToken(token: string): FileLinkPayload {
  return jwt.verify(token, env.SIGNED_LINK_SECRET) as FileLinkPayload;
}
