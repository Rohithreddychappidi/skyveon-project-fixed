import { describe, expect, it } from "vitest";
import { sortLessonsForDisplay } from "../src/lib/lessonOrder";

const lesson = (id: string, order: number, moduleId: string | null) => ({ id, order, moduleId });

describe("sortLessonsForDisplay", () => {
  it("orders by module order first, then lesson order, ungrouped last", () => {
    const modules = [
      { id: "m2", order: 0 }, // moved above m1
      { id: "m1", order: 1 },
    ];
    const lessons = [
      lesson("a", 0, "m1"),
      lesson("b", 1, "m1"),
      lesson("c", 2, "m2"),
      lesson("loose", -1, null),
      lesson("d", 3, "m2"),
    ];
    expect(sortLessonsForDisplay(lessons, modules).map((l) => l.id)).toEqual(["c", "d", "a", "b", "loose"]);
  });

  it("treats lessons pointing at a missing module as ungrouped", () => {
    const sorted = sortLessonsForDisplay([lesson("x", 0, "gone"), lesson("y", 1, "m1")], [{ id: "m1", order: 0 }]);
    expect(sorted.map((l) => l.id)).toEqual(["y", "x"]);
  });
});
