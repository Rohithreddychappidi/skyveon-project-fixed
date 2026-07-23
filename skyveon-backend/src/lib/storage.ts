import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { env } from "../config/env";

const UPLOADS_ROOT = path.resolve(process.cwd(), env.UPLOADS_DIR);

function ensureUploadsRoot() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
}
ensureUploadsRoot();

/** Namespaced, collision-resistant storage key for an uploaded file. */
export function makeStorageKey(originalName: string) {
  const ext = path.extname(originalName);
  const safeBase = uuid();
  const date = new Date();
  const folder = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${folder}/${safeBase}${ext}`;
}

interface StorageDriver {
  save(key: string, data: Buffer, contentType?: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  async save(key: string, data: Buffer) {
    const abs = this.absolutePath(key);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, data);
  }

  async read(key: string) {
    return fsp.readFile(this.absolutePath(key));
  }

  async exists(key: string) {
    try {
      await fsp.access(this.absolutePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string) {
    try {
      await fsp.unlink(this.absolutePath(key));
    } catch {
      // already gone — fine
    }
  }

  private absolutePath(key: string) {
    const abs = path.resolve(UPLOADS_ROOT, key);
    // guard against path traversal via a crafted key
    if (!abs.startsWith(UPLOADS_ROOT)) {
      throw new Error("Invalid storage key");
    }
    return abs;
  }
}

/**
 * Backblaze B2, via its S3-compatible API — so this is just a normal S3
 * client pointed at B2's endpoint. Bucket, keys, and endpoint come from
 * B2_* env vars (see config/env.ts and .env.example for where to find
 * these in the B2 dashboard: Application Keys page for keyID/
 * applicationKey, Bucket Details for the endpoint).
 */
class B2StorageDriver implements StorageDriver {
  private client: import("@aws-sdk/client-s3").S3Client;
  private bucket: string;

  constructor() {
    if (!env.B2_ENDPOINT || !env.B2_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET) {
      throw new Error(
        "STORAGE_DRIVER=b2 but B2_ENDPOINT/B2_KEY_ID/B2_APPLICATION_KEY/B2_BUCKET aren't all set in .env"
      );
    }
    // Lazy-required so the local-only path never needs the AWS SDK installed
    // to boot (it's a devDependency-weight package either way, but keeps
    // the intent clear).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require("@aws-sdk/client-s3");
    this.client = new S3Client({
      endpoint: env.B2_ENDPOINT,
      region: env.B2_REGION,
      credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APPLICATION_KEY },
      // B2's S3-compatible API wants path-style addressing, not the
      // virtual-hosted-style AWS defaults to.
      forcePathStyle: true,
    });
    this.bucket = env.B2_BUCKET;
  }

  async save(key: string, data: Buffer, contentType?: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType })
    );
  }

  async read(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = result.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async exists(key: string) {
    try {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string) {
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // already gone — fine
    }
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  driver = env.STORAGE_DRIVER === "b2" ? new B2StorageDriver() : new LocalStorageDriver();
  return driver;
}
