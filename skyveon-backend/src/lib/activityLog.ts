import type { Request } from "express";
import type { Prisma } from "@prisma/client";
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
        // Prisma's generated Json input type doesn't structurally accept a
        // plain Record<string, unknown> (it wants its own InputJsonValue
        // union) even though any JSON-safe object is fine at runtime — cast
        // here rather than loosen the public param type callers rely on.
        metadata: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        ip: params.req?.ip,
      },
    });
  } catch (err) {
    // Audit logging should never break the request it's logging.
    // eslint-disable-next-line no-console
    console.error("Failed to write activity log:", err);
  }
}