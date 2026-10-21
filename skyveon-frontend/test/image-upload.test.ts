import { describe, expect, it } from "vitest";
import { imageFileProblem } from "@/lib/image-upload";

const f = (name: string, type: string, mb = 1) => ({ name, type, size: mb * 1024 * 1024 });

describe("imageFileProblem", () => {
  it("accepts the formats the API can process", () => {
    for (const [n, t] of [["a.jpg", "image/jpeg"], ["b.PNG", "image/png"], ["c.webp", "image/webp"], ["d.gif", "image/gif"]]) {
      expect(imageFileProblem(f(n, t))).toBeNull();
    }
  });

  it("explains HEIC photos, by extension or MIME type", () => {
    expect(imageFileProblem(f("IMG_0042.HEIC", ""))).toMatch(/HEIC photo/);
    expect(imageFileProblem(f("photo", "image/heif"))).toMatch(/HEIC photo/);
  });

  it("rejects non-images and files over 20 MB with the reason", () => {
    expect(imageFileProblem(f("brochure.pdf", "application/pdf"))).toMatch(/isn't a supported image/);
    expect(imageFileProblem(f("banner.png", "image/png", 25))).toMatch(/25\.0 MB .* 20 MB or smaller/);
    expect(imageFileProblem(f("ok.png", "image/png", 19.9))).toBeNull();
  });
});
