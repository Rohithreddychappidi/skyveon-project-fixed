import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

/**
 * Reads a video's duration with ffprobe (ships alongside ffmpeg). Returns
 * null (rather than throwing) if ffprobe isn't available or the file can't
 * be read — callers treat that as "duration unknown, admin can set it
 * manually" rather than a hard failure of the upload itself.
 */
export async function getVideoDurationSeconds(filePath: string): Promise<number | null> {
  try {
    const ffprobeBin = env.FFMPEG_BIN.replace(/ffmpeg$/, "ffprobe");
    const { stdout } = await execFileAsync(
      ffprobeBin,
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
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
  }
}
