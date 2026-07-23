import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { corsOrigins, env } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      // lesson content is served inline in <iframe>/<video>/<img> tags from
      // the frontend origin, so keep CORP relaxed for the /api/files routes
      crossOriginResourcePolicy: { policy: "cross-origin" },
      // same reason: X-Frame-Options: SAMEORIGIN and the default CSP's
      // frame-ancestors 'self' would both block the PDF/PPT/DOC viewer's
      // <iframe>, which loads from a different origin than this API. This
      // server never renders its own HTML pages, so there's no clickjacking
      // surface to protect here.
      frameguard: false,
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
  }

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
