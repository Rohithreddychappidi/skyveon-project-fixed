import { describe, expect, it } from "vitest";
import { assertFileMatchesLessonType, normalizeMime } from "../src/lib/lessonFiles";

describe("assertFileMatchesLessonType", () => {
  it("accepts matching files regardless of extension case", () => {
    expect(() => assertFileMatchesLessonType("VIDEO", "Lecture 1.MP4")).not.toThrow();
    expect(() => assertFileMatchesLessonType("PDF", "notes.pdf")).not.toThrow();
    expect(() => assertFileMatchesLessonType("IMAGE", "Create Notification.JPG")).not.toThrow();
  });

  it("rejects the mismatches that broke production lessons", () => {
    expect(() => assertFileMatchesLessonType("VIDEO", "Org Assignment.pdf")).toThrow(/This is a video lesson/);
    expect(() => assertFileMatchesLessonType("PDF", "FullStack_Class14.mp4")).toThrow(/This is a PDF lesson/);
  });

  it("rejects uploads for types that don't take files", () => {
    expect(() => assertFileMatchesLessonType("LINK", "x.pdf")).toThrow();
  });
});

describe("normalizeMime", () => {
  it("fixes videos sent as application/octet-stream", () => {
    expect(normalizeMime("VIDEO", "a.mp4", "application/octet-stream")).toBe("video/mp4");
    expect(normalizeMime("VIDEO", "a.webm", "application/octet-stream")).toBe("video/webm");
    expect(normalizeMime("VIDEO", "a.mp4", "video/mp4")).toBe("video/mp4");
  });
});
