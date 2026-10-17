import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { env } from "../config/env";
import { safeExtension } from "./storage";

const execFileAsync = promisify(execFile);

/**
 * Converts an Office document (ppt/doc/etc.) to PDF using LibreOffice's
 * headless CLI. Requires LibreOffice to be installed on the host — see
 * README for install notes. Throws if the binary isn't found so callers
 * can mark the lesson's conversion as FAILED rather than hang.
 */
export async function convertToPdf(input: Buffer, originalFileName: string): Promise<Buffer> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "skyveon-convert-"));
  // Never use the client-supplied name as a path: "../../x" would write
  // outside workDir. Only its (validated) extension matters to LibreOffice.
  const inputPath = path.join(workDir, `input${safeExtension(originalFileName) || ".bin"}`);
  // A private profile per run: two soffice processes sharing the default
  // profile make the second one hand off to the first and exit with no
  // output, which showed up as random conversion failures.
  const profileUrl = pathToFileURL(path.join(workDir, "profile")).href;

  try {
    await fs.writeFile(inputPath, input);

    await execFileAsync(
      env.LIBREOFFICE_BIN,
      [`-env:UserInstallation=${profileUrl}`, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", workDir, inputPath],
      { timeout: 120_000 }
    );

    return await fs.readFile(path.join(workDir, "input.pdf"));
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
