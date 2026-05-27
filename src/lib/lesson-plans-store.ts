// Shared lesson-plans store. Keyed by session_id so Teacher (planner) and
// Student (calendar modal) read the exact same record in real-time.
export type LessonSessionType =
  | "Syllabus content"
  | "Additional Content"
  | "Review Session"
  | "Casual Topic"
  | "Evaluation";

export interface LessonPlan {
  session_id: string;
  title: string;
  type: LessonSessionType;
  level_id?: string;
  unit_id?: string;
  comments: string;
  planning_status: "on-time" | "late";
  saved_at: string; // ISO
}

export const LESSON_PLANS_KEY = "verbo:lesson-plans";
export const LESSON_PLANS_EVENT = "verbo:lesson-plans-updated";

type Store = Record<string, LessonPlan>;

export function loadLessonPlans(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LESSON_PLANS_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

export function persistLessonPlans(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LESSON_PLANS_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(LESSON_PLANS_EVENT));
  } catch { /* noop */ }
}

export function saveLessonPlan(plan: LessonPlan) {
  const store = loadLessonPlans();
  store[plan.session_id] = plan;
  persistLessonPlans(store);
}

export function getLessonPlan(sessionId: string): LessonPlan | undefined {
  return loadLessonPlans()[sessionId];
}

export function subscribeLessonPlans(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === LESSON_PLANS_KEY) cb(); };
  window.addEventListener(LESSON_PLANS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(LESSON_PLANS_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
