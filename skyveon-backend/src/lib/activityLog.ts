import type { Request } from "express";
import { prisma } from "./prisma";

export async function logActivity(params: {
  userId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        metadata: params.metadata ?? undefined,
        ip: params.req?.ip,
      },
    });
  } catch (err) {
    // Audit logging should never break the request it's logging.
    // eslint-disable-next-line no-console
    console.error("Failed to write activity log:", err);
  }
}
