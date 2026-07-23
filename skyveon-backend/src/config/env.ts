import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("30d"),
  SIGNED_LINK_SECRET: z.string().min(1),

  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  APP_URL: z.string().default("http://localhost:3000"),

  STORAGE_DRIVER: z.enum(["local", "b2"]).default("local"),
  UPLOADS_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().default(200),

  // Backblaze B2 — via its S3-compatible API, so the driver is just a
  // normal S3 client pointed at B2's endpoint. Only needed when
  // STORAGE_DRIVER=b2. See src/lib/storage.ts.
  B2_ENDPOINT: z.string().optional().default(""), // e.g. https://s3.us-west-004.backblazeb2.com
  B2_REGION: z.string().optional().default("us-west-004"),
  B2_KEY_ID: z.string().optional().default(""), // "keyID" from the B2 application key
  B2_APPLICATION_KEY: z.string().optional().default(""),
  B2_BUCKET: z.string().optional().default(""),
  B2_PUBLIC_URL: z.string().optional().default(""), // only if the bucket is public; otherwise leave blank

  // Redis / BullMQ — optional. Without it, email sending and file
  // conversion just run inline (same behavior as before) instead of
  // through a managed, retryable queue. See src/lib/queue.ts.
  REDIS_URL: z.string().optional().default(""),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("Skyveon Learning Hub <hr@skyveon.ai>"),

  LIBREOFFICE_BIN: z.string().default("soffice"),
  FFMPEG_BIN: z.string().default("ffmpeg"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
