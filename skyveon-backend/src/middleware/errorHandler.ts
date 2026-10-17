import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/apiError";
import { env } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found", path: req.originalUrl });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) {
    // A streamed response failed midway — nothing useful left to send.
    res.destroy();
    return;
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "That file is too large to upload." });
    }
    return res.status(400).json({ error: `Upload failed: ${err.message}` });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return res.status(404).json({ error: "Not found" });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  // Internal details (stack traces, parser/DB messages) stay in the server
  // log — only expose them to the client in local development.
  const body: { error: string; message?: string } = { error: "Internal server error" };
  if (env.NODE_ENV === "development" && err instanceof Error) body.message = err.message;
  return res.status(500).json(body);
}
