import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

/**
 * Converts an Office document (ppt/doc/etc.) to PDF using LibreOffice's
 * headless CLI. Requires LibreOffice to be installed on the host — see
 * README for install notes. Throws if the binary isn't found so callers
 * can mark the lesson's conversion as FAILED rather than hang.
 */
export async function convertToPdf(input: Buffer, originalFileName: string): Promise<Buffer> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "skyveon-convert-"));
  const inputPath = path.join(workDir, originalFileName);

  try {
    await fs.writeFile(inputPath, input);

    await execFileAsync(env.LIBREOFFICE_BIN, [
      "--headless",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      inputPath,
    ], { timeout: 60_000 });

    const outputName = `${path.parse(originalFileName).name}.pdf`;
    const outputPath = path.join(workDir, outputName);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
