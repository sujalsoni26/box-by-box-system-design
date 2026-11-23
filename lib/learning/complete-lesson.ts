import { emitCompanionEvent } from "@/lib/companion-events";
import { getLesson, moduleProgress, overallProgress } from "@/lib/curriculum";
import { useProgressStore } from "@/stores/progress-store";

/**
 * Mark a lesson learned and tell the companion (which celebrates module and course completion).
 * Shared by the "Mark as learned" button and the companion's end-of-lesson prompt. No-op if already done.
 */
export function completeLesson(slug: string): boolean {
  const lesson = getLesson(slug);
  const store = useProgressStore.getState();
  if (!lesson || store.completed[slug]) return false;
  const before = store.completed;
  const moduleWasDone = moduleProgress(lesson.moduleId, before).fraction === 1;
  const courseWasDone = overallProgress(before).fraction === 1;
  store.setCompleted(slug, true);
  const after = useProgressStore.getState().completed;
  emitCompanionEvent({
    type: "lesson-complete",
    slug,
    moduleCompleted: !moduleWasDone && moduleProgress(lesson.moduleId, after).fraction === 1,
    courseCompleted: !courseWasDone && overallProgress(after).fraction === 1,
  });
  return true;
}
