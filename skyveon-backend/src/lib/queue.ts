import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { sendEmail } from "./email";

const connection = env.REDIS_URL ? new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }) : null;

if (connection) {
  connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis] connection error:", err.message);
  });
}

/**
 * Creates a queue+worker pair backed by Redis when REDIS_URL is set. When
 * it isn't, `.add()` just runs the handler immediately in-process — same
 * call sites either way, no retries/backoff in that fallback mode, and
 * nothing to install locally before the app works.
 */
function createJobRunner<T>(name: string, handler: (data: T) => Promise<void>) {
  if (connection) {
    const queue = new Queue<T, void, string, T, void, string>(name, { connection });
    const worker = new Worker<T, void, string>(name, (job: Job<T, void, string>) => handler(job.data), {
      connection,
      concurrency: 2,
    });
    worker.on("failed", (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`[queue:${name}] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
    });
    return {
      add: async (jobName: string, data: T) => {
        await queue.add(jobName, data, {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { age: 60 * 60 * 24 }, // keep a day of history for debugging
          removeOnFail: { age: 60 * 60 * 24 * 7 },
        });
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
