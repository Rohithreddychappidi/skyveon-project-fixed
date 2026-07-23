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

  const record = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token expired or revoked");
  }
  if (record.tokenHash !== hashToken(refreshTokenRaw)) {
    throw ApiError.unauthorized("Refresh token mismatch");
  }

  // rotate: revoke the old token, issue a new pair
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  return issueTokenPair(record.userId);
}

export async function logout(refreshTokenRaw: string | undefined) {
  if (!refreshTokenRaw) return;
  try {
    const payload = verifyRefreshToken(refreshTokenRaw);
    await prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
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
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logActivity({ userId, action: "auth.reset_password" });
}

// Logged-in self-service change (as opposed to the emailed reset link flow
// above) — used from the profile page.
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw ApiError.badRequest("Account hasn't been set up yet.");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.unauthorized("Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await logActivity({ userId, action: "auth.change_password" });
}
