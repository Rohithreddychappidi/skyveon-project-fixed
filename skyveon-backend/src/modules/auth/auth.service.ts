import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../../lib/jwt";
import { signAuthLinkToken, verifyAuthLinkToken } from "../../lib/signedLink";
import { setupPasswordEmail, resetPasswordEmail } from "../../lib/email";
import { emailQueue } from "../../lib/queue";
import { ApiError } from "../../lib/apiError";
import { env } from "../../config/env";
import { logActivity } from "../../lib/activityLog";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // keep in sync with REFRESH_TOKEN_TTL default

async function issueTokenPair(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const refreshRecord = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: "pending", // filled in right after, once we have the signed token
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  const refreshToken = signRefreshToken({ sub: userId, jti: refreshRecord.id });
  await prisma.refreshToken.update({
    where: { id: refreshRecord.id },
    data: { tokenHash: hashToken(refreshToken) },
  });

  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });

  return { accessToken, refreshToken, user };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || user.isDeleted) throw ApiError.unauthorized("Invalid email or password");
  if (user.status === "INACTIVE") throw ApiError.forbidden("This account has been deactivated");
  if (!user.passwordHash) {
    throw ApiError.badRequest("This account hasn't been set up yet — check your email for the setup link.");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logActivity({ userId: user.id, action: "auth.login" });

  return issueTokenPair(user.id);
}

export async function refresh(refreshTokenRaw: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenRaw);
  } catch {
    throw ApiError.unauthorized("Invalid refresh token");
  }

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti }, include: { user: true } });
  if (!record || record.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token expired or revoked");
  }
  if (record.tokenHash !== hashToken(refreshTokenRaw)) {
    throw ApiError.unauthorized("Refresh token mismatch");
  }
  if (record.user.isDeleted || record.user.status === "INACTIVE") {
    throw ApiError.unauthorized("This account has been deactivated");
  }

  if (record.revokedAt) {
    // Two requests (or two tabs) refreshing with the same cookie at once:
    // the first rotates it, the second arrives a moment later with the
    // now-rotated token. Within a short grace window, hand the late request
    // a fresh pair instead of logging the user out. Logout and password
    // resets overwrite the stored hash (see KILLED_HASH), so those tokens
    // already failed the hash check above and never get here.
    if (Date.now() - record.revokedAt.getTime() <= ROTATION_GRACE_MS) {
      return issueTokenPair(record.userId);
    }
    throw ApiError.unauthorized("Refresh token expired or revoked");
  }

  // rotate: revoke the old token, issue a new pair. The revokedAt: null
  // guard makes this atomic; a concurrent request that loses the race is
  // simply inside the grace window too.
  await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return issueTokenPair(record.userId);
}

const ROTATION_GRACE_MS = 30_000;
// Written over tokenHash when a session is ended on purpose (logout,
// password reset/change), so the token can never match again — unlike a
// routine rotation, which keeps its hash for the grace window above.
const KILLED_HASH = "revoked";

export async function logout(refreshTokenRaw: string | undefined) {
  if (!refreshTokenRaw) return;
  try {
    const payload = verifyRefreshToken(refreshTokenRaw);
    const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti },
      data: { revokedAt: record?.revokedAt ?? new Date(), tokenHash: KILLED_HASH },
    });
  } catch {
    // already invalid/expired — nothing to revoke
  }
}

export async function sendSetupLink(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = signAuthLinkToken({ sub: user.id, purpose: "SETUP_PASSWORD" }, "48h");

  await prisma.authToken.create({
    data: {
      userId: user.id,
      purpose: "SETUP_PASSWORD",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  const link = `${env.APP_URL}/setup-password?token=${encodeURIComponent(token)}`;
  const { subject, html, text } = setupPasswordEmail({ name: user.name, link });
  await emailQueue.add(`setup-${user.id}`, { to: user.email, subject, html, text });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always behave the same whether or not the account exists, to avoid
  // leaking which emails are registered.
  if (!user || user.isDeleted || user.status === "INACTIVE") return;

  const token = signAuthLinkToken({ sub: user.id, purpose: "RESET_PASSWORD" }, "1h");
  await prisma.authToken.create({
    data: {
      userId: user.id,
      purpose: "RESET_PASSWORD",
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const link = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const { subject, html, text } = resetPasswordEmail({ name: user.name, link });
  await emailQueue.add(`reset-${user.id}`, { to: user.email, subject, html, text });
}

async function consumeAuthLink(token: string, purpose: "SETUP_PASSWORD" | "RESET_PASSWORD") {
  let payload;
  try {
    payload = verifyAuthLinkToken(token);
  } catch {
    throw ApiError.badRequest("This link is invalid or has expired.");
  }
  if (payload.purpose !== purpose) throw ApiError.badRequest("This link is invalid.");

  const record = await prisma.authToken.findFirst({
    where: { userId: payload.sub, purpose, tokenHash: hashToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("This link is invalid or has expired.");
  }

  return { userId: payload.sub, authTokenId: record.id };
}

export async function setupPassword(token: string, newPassword: string) {
  const { userId, authTokenId } = await consumeAuthLink(token, "SETUP_PASSWORD");
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash, status: "ACTIVE" } }),
    prisma.authToken.update({ where: { id: authTokenId }, data: { usedAt: new Date() } }),
  ]);

  await logActivity({ userId, action: "auth.setup_password" });
}

export async function resetPassword(token: string, newPassword: string) {
  const { userId, authTokenId } = await consumeAuthLink(token, "RESET_PASSWORD");
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.authToken.update({ where: { id: authTokenId }, data: { usedAt: new Date() } }),
    // resetting a password invalidates every existing session
    prisma.refreshToken.updateMany({
      where: { userId, tokenHash: { not: KILLED_HASH } },
      data: { revokedAt: new Date(), tokenHash: KILLED_HASH },
    }),
  ]);

  await logActivity({ userId, action: "auth.reset_password" });
}

// Logged-in self-service change (as opposed to the emailed reset link flow
// above) — used from the profile page.
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentRefreshToken?: string
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw ApiError.badRequest("Account hasn't been set up yet.");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Current password is incorrect");

  // Keep the session the change was made from; sign out every other one.
  let keepJti: string | undefined;
  if (currentRefreshToken) {
    try {
      keepJti = verifyRefreshToken(currentRefreshToken).jti;
    } catch {
      // cookie missing/expired — revoke everything
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, tokenHash: { not: KILLED_HASH }, ...(keepJti ? { id: { not: keepJti } } : {}) },
      data: { revokedAt: new Date(), tokenHash: KILLED_HASH },
    }),
  ]);
  await logActivity({ userId, action: "auth.change_password" });
}
