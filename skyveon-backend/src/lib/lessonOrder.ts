/**
 * The one true lesson sequence for a course, matching what employees and
 * admins see: each module's lessons in module order, then ungrouped
 * lessons. Lesson.order alone isn't enough — reordering modules doesn't
 * touch it — so gating, "next lesson" and progress all go through this.
 */
export function sortLessonsForDisplay<
  L extends { id: string; order: number; moduleId: string | null },
  M extends { id: string; order: number }
>(lessons: L[], modules: M[]): L[] {
  const moduleRank = new Map([...modules].sort((a, b) => a.order - b.order).map((m, i) => [m.id, i]));
  const rank = (l: L) => (l.moduleId != null && moduleRank.has(l.moduleId) ? moduleRank.get(l.moduleId)! : modules.length);
  return [...lessons].sort((a, b) => rank(a) - rank(b) || a.order - b.order);
}
