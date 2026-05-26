// Mock activities engine — persisted to localStorage so admin edits + student
// progress survive reloads without a backend.
import { LEVELS } from "./mock-data";

export type ExerciseType =
  | "fill_gaps"
  | "drag_drop"
  | "listen_select"
  | "read_select"
  | "record"
  | "read_complete"
  | "match";

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  fill_gaps: "Fill in the gaps",
  drag_drop: "Drag and drop",
  listen_select: "Listen and select",
  read_select: "Read and select",
  record: "Record yourself",
  read_complete: "Read and complete",
  match: "Match",
};

export interface MatchItem {
  text: string;
  key: string;
}

export interface Activity {
  id: string;
  unit_id: string;
  name: string;
  type: ExerciseType;
  // fill_gaps / read_complete
  paragraph?: string;
  answer?: string;
  // drag_drop / match
  items?: MatchItem[];
  // read_select / listen_select
  prompt?: string;
  audioName?: string; // listen_select only (mock placeholder)
  question?: string;
  options?: string[];
  correctIndex?: number;
}

const ACTIVITIES_KEY = "verbo:activities";
const COMPLETION_KEY = "verbo:unit-completion";
const ATTEMPTS_KEY = "verbo:unit-attempts";

function safeRead<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}
function safeWrite(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ }
}

const SEED: Activity[] = [
  { id: "act-seed-1", unit_id: "A1-U1", name: "Greeting basics", type: "fill_gaps", paragraph: "Hello, my [blank] is Sarah.", answer: "name" },
  { id: "act-seed-2", unit_id: "A1-U1", name: "Pick the greeting", type: "read_select", prompt: "Morning at the office.", question: "Which greeting fits best?", options: ["Good night", "Good morning", "See you", "Bye"], correctIndex: 1 },
  { id: "act-seed-3", unit_id: "A1-U1", name: "Say it out loud", type: "record", answer: "Nice to meet you." },
];

export function loadActivities(): Activity[] {
  const stored = safeRead<Activity[] | null>(ACTIVITIES_KEY, null);
  if (stored) return stored;
  safeWrite(ACTIVITIES_KEY, SEED);
  return SEED;
}
export function saveActivities(list: Activity[]) { safeWrite(ACTIVITIES_KEY, list); }

export function activitiesForUnit(unitId: string): Activity[] {
  return loadActivities().filter((a) => a.unit_id === unitId);
}

export function addActivity(a: Activity) {
  const list = loadActivities();
  list.push(a);
  saveActivities(list);
}

export function removeActivity(id: string) {
  saveActivities(loadActivities().filter((a) => a.id !== id));
}

/* ---- Completion + attempts ---- */
export function loadCompletion(): Record<string, boolean> {
  return safeRead<Record<string, boolean>>(COMPLETION_KEY, {});
}
export function setUnitCompleted(unitId: string, value: boolean) {
  const c = loadCompletion();
  c[unitId] = value;
  safeWrite(COMPLETION_KEY, c);
}

export function loadAttempts(): Record<string, number> {
  return safeRead<Record<string, number>>(ATTEMPTS_KEY, {});
}
export function incrementAttempts(unitId: string): number {
  const a = loadAttempts();
  a[unitId] = (a[unitId] ?? 0) + 1;
  safeWrite(ATTEMPTS_KEY, a);
  return a[unitId];
}
export function resetAttempts(unitId: string) {
  const a = loadAttempts();
  delete a[unitId];
  safeWrite(ATTEMPTS_KEY, a);
}

export function renameUnitReferences(oldUnitId: string, newUnitId: string) {
  const activities = loadActivities();
  let changed = false;
  for (const a of activities) {
    if (a.unit_id === oldUnitId) {
      a.unit_id = newUnitId;
      changed = true;
    }
  }
  if (changed) saveActivities(activities);

  const completion = loadCompletion();
  if (oldUnitId in completion) {
    completion[newUnitId] = completion[oldUnitId];
    delete completion[oldUnitId];
    safeWrite(COMPLETION_KEY, completion);
  }

  const attempts = loadAttempts();
  if (oldUnitId in attempts) {
    attempts[newUnitId] = attempts[oldUnitId];
    delete attempts[oldUnitId];
    safeWrite(ATTEMPTS_KEY, attempts);
  }
}

/** A unit is unlocked if it's the first of its level, the previous unit is completed,
 *  or it has already been completed itself. */
export function isUnitUnlocked(unitId: string): boolean {
  const completion = loadCompletion();
  if (completion[unitId]) return true;
  for (const lvl of LEVELS) {
    const idx = lvl.units.findIndex((u) => u.id === unitId);
    if (idx === -1) continue;
    if (idx === 0) return true;
    return !!completion[lvl.units[idx - 1].id];
  }
  return true;
}
