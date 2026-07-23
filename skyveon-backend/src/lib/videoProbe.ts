import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

/**
 * ffprobe ships alongside ffmpeg, so no extra install beyond what video
 * watermarking already needs. Returns null (rather than throwing) if
 * ffprobe isn't available or the file can't be read — callers should treat
 * that as "duration unknown, admin can set it manually" rather than a
 * hard failure of the upload itself.
 */
export async function getVideoDurationSeconds(input: Buffer): Promise<number | null> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "skyveon-probe-"));
  const inputPath = path.join(workDir, "input");

  try {
    await fs.writeFile(inputPath, input);
    const ffprobeBin = env.FFMPEG_BIN.replace(/ffmpeg$/, "ffprobe");
    const { stdout } = await execFileAsync(
      ffprobeBin,
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", inputPath],
      { timeout: 30_000 }
    );
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[video duration] couldn't auto-detect — is ffprobe installed? Admin can set duration manually.",
      err instanceof Error ? err.message : err
    );
    return null;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
