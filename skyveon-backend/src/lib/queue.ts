import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { sendEmail } from "./email";

function createRedisClient() {
  if (!env.REDIS_URL) return null;
  const client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 8000,
    retryStrategy(times) {
      return Math.min(times * 200, 3000);
    },
  });
  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[redis] connection warning:", err.message);
  });
  return client;
}

/**
 * Creates a queue+worker pair backed by Redis when REDIS_URL is set. When
 * it isn't or when Redis is unreachable, `.add()` executes the handler
 * inline in-process — ensuring user operations (like adding employees or
 * assigning courses) never fail or hang due to queue/network issues.
 */
function createJobRunner<T>(name: string, handler: (data: T) => Promise<void>) {
  const queueConnection = createRedisClient();
  const workerConnection = createRedisClient();

  if (queueConnection && workerConnection) {
    const queue = new Queue<T, void, string, T, void, string>(name, { connection: queueConnection });
    const worker = new Worker<T, void, string>(name, (job: Job<T, void, string>) => handler(job.data), {
      connection: workerConnection,
      concurrency: 2,
    });
    worker.on("failed", (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`[queue:${name}] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
    });
    return {
      add: async (jobName: string, data: T) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Queue add timed out")), 3500)
          );
          await Promise.race([
            queue.add(jobName, data, {
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
              removeOnComplete: { age: 60 * 60 * 24 }, // keep a day of history for debugging
              removeOnFail: { age: 60 * 60 * 24 * 7 },
            }),
            timeoutPromise,
          ]);
        } catch (queueErr) {
          // eslint-disable-next-line no-console
          console.warn(
            `[queue:${name}] Redis queue add failed or timed out, executing inline fallback:`,
            queueErr instanceof Error ? queueErr.message : queueErr
          );
          try {
            await handler(data);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[queue:${name}] inline fallback failed:`, err);
          }
        }
      },
      backedByRedis: true as const,
    };
  }

  // eslint-disable-next-line no-console
  console.warn(`[queue:${name}] REDIS_URL not set — jobs run inline, no retries. Fine for local dev.`);
  return {
    add: async (_jobName: string, data: T) => {
      try {
        await handler(data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[queue:${name}] inline job failed:`, err);
      }
    },
    backedByRedis: false as const,
  };
}

// --- Email --------------------------------------------------------------

interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const emailQueue = createJobRunner<EmailJob>("email", async (data) => {
  await sendEmail(data);
});

// --- Office → PDF conversion --------------------------------------------

interface ConversionJob {
  lessonId: string;
  key: string;
  originalFileName: string;
}

export const conversionQueue = createJobRunner<ConversionJob>("conversion", async (data) => {
  // Dynamic import breaks the circular dependency (courses.service also
  // enqueues onto this queue).
  const { runConversion } = await import("../modules/courses/courses.service");
  await runConversion(data.lessonId, data.key, data.originalFileName);
});
