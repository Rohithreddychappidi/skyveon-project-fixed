import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { env } from "../config/env";
import type { WatermarkIdentity } from "./watermark";

const execFileAsync = promisify(execFile);

function escapeForDrawtext(text: string) {
  // ffmpeg's drawtext filter treats : , ' and \ specially inside the
  // filtergraph string — escape them so a name/email with those characters
  // doesn't break the filter.
  return text.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
}

/**
 * Re-encodes the video with a translucent, tiled watermark burned into
 * every frame — unlike the PDF/image watermark, this can't reasonably be
 * regenerated on every single request (a multi-minute training video would
 * take far longer to re-encode than anyone will wait), so callers should
 * cache the result per (lessonId, viewerId) and only call this once per
 * pair. See modules/files/files.service.ts.
 */
export async function burnVideoWatermark(input: Buffer, identity: WatermarkIdentity): Promise<Buffer> {
  const label = escapeForDrawtext(`${identity.name} · ${identity.email} · ${identity.id}`);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "skyveon-watermark-"));
  const inputPath = path.join(workDir, "input.mp4");
  const outputPath = path.join(workDir, "output.mp4");

  // A 2x3 grid of positions, tiled across the frame. ffmpeg's drawtext x/y
  // expressions are evaluated by its own math parser, which does NOT
  // understand CSS-style "10%" strings (that '%' is a parse error — see
  // "Invalid chars '%' at the end of expression"). Instead we express each
  // position as a fraction of the frame using ffmpeg's built-in `w`/`h`
  // variables (main video width/height), which still scales with any
  // resolution.
  const positions = [
    ["w*0.10", "h*0.15"],
    ["w*0.55", "h*0.15"],
    ["w*0.10", "h*0.50"],
    ["w*0.55", "h*0.50"],
    ["w*0.10", "h*0.85"],
    ["w*0.55", "h*0.85"],
  ];

  const drawtextFilters = positions
    .map(
      ([x, y]) =>
        `drawtext=text='${label}':fontcolor=white@0.28:fontsize=18:x=${x}:y=${y}`
    )
    .join(",");

  try {
    await fs.writeFile(inputPath, input);

    await execFileAsync(
      env.FFMPEG_BIN,
      [
        "-y",
        "-i",
        inputPath,
        "-vf",
        drawtextFilters,
        "-codec:a",
        "copy",
        "-preset",
        "veryfast",
        outputPath,
      ],
      { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 * 32 }
    );

    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}