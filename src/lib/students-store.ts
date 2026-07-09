// Shared student profile store.
//
// The admin Students view persists per-student profile edits (including the
// Video Call Link) as overrides in localStorage and mutates the in-memory
// USERS singleton. This module exposes the SAME underlying data so other
// views (e.g. Sessions) read and write the exact same field instead of
// duplicating it. Editing the link here reflects in Students and vice-versa.
import { USERS, type User } from "./mock-data";

// NOTE: these keys must match the ones used by src/routes/admin.students.tsx
export const PROFILE_KEY = "verbo:student-profile-overrides";
export const REGISTERED_KEY = "verbo:registered-students";
export const STUDENTS_EVENT = "verbo:students-updated";

function readProfileOverrides(): Record<string, Partial<User>> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); } catch { return {}; }
}
function writeProfileOverrides(map: Record<string, Partial<User>>) {
  if (typeof window !== "undefined") localStorage.setItem(PROFILE_KEY, JSON.stringify(map));
}
function readRegisteredStudents(): User[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(REGISTERED_KEY) || "[]"); } catch { return []; }
}

// Apply persisted overrides + locally-registered students onto the USERS
// singleton. Idempotent — safe to call on every mount.
export function hydrateStudents() {
  if (typeof window === "undefined") return;
  const overrides = readProfileOverrides();
  USERS.forEach((u) => { if (overrides[u.id]) Object.assign(u, overrides[u.id]); });
  readRegisteredStudents().forEach((u) => {
    if (!USERS.find((x) => x.id === u.id)) USERS.push(u);
  });
}

export function getStudentVideoLink(studentId: string): string {
  const u = USERS.find((x) => x.id === studentId);
  return u?.video_call_link ?? "";
}

// Update a student's video call link — the single shared field. Mutates USERS,
// persists the override, and broadcasts so subscribers refresh.
export function setStudentVideoLink(studentId: string, link: string) {
  const u = USERS.find((x) => x.id === studentId);
  if (u) u.video_call_link = link;
  if (typeof window === "undefined") return;
  const overrides = readProfileOverrides();
  overrides[studentId] = { ...(overrides[studentId] ?? {}), video_call_link: link };
  writeProfileOverrides(overrides);
  window.dispatchEvent(new CustomEvent(STUDENTS_EVENT));
}

/** Toggle a completed level into "Reopened for Review" (read-only student access). */
export function setLevelReopened(studentId: string, levelName: string, on: boolean) {
  const u = USERS.find((x) => x.id === studentId);
  const current = u?.reopened_levels ?? [];
  const next = on
    ? Array.from(new Set([...current, levelName]))
    : current.filter((n) => n !== levelName);
  if (u) u.reopened_levels = next;
  if (typeof window === "undefined") return;
  const overrides = readProfileOverrides();
  overrides[studentId] = { ...(overrides[studentId] ?? {}), reopened_levels: next };
  writeProfileOverrides(overrides);
  window.dispatchEvent(new CustomEvent(STUDENTS_EVENT));
}

export function getReopenedLevels(studentId: string): string[] {
  return USERS.find((x) => x.id === studentId)?.reopened_levels ?? [];
}

/* -------------------------------------------------------------------------- */
/* Challenges: chosen + completed, with streak tracking.                       */
/* -------------------------------------------------------------------------- */

function persistStudentPatch(studentId: string, patch: Partial<User>) {
  const u = USERS.find((x) => x.id === studentId);
  if (u) Object.assign(u, patch);
  if (typeof window === "undefined") return;
  const overrides = readProfileOverrides();
  overrides[studentId] = { ...(overrides[studentId] ?? {}), ...patch };
  writeProfileOverrides(overrides);
  window.dispatchEvent(new CustomEvent(STUDENTS_EVENT));
}

/** Add a challenge to `chosen_challenges` (idempotent). Returns true if this
 *  was the first time this student picks that challenge — the caller can then
 *  fire the teacher notification once. */
export function chooseChallenge(studentId: string, challengeId: string): boolean {
  const u = USERS.find((x) => x.id === studentId);
  const list = u?.chosen_challenges ?? [];
  if (list.some((c) => c.challenge_id === challengeId)) return false;
  persistStudentPatch(studentId, {
    chosen_challenges: [...list, { challenge_id: challengeId, chosen_at: new Date().toISOString() }],
  });
  return true;
}

export function hasChosenChallenge(studentId: string, challengeId: string): boolean {
  const u = USERS.find((x) => x.id === studentId);
  return (u?.chosen_challenges ?? []).some((c) => c.challenge_id === challengeId);
}

export function hasCompletedChallenge(studentId: string, challengeId: string): boolean {
  const u = USERS.find((x) => x.id === studentId);
  return (u?.completed_challenges ?? []).some((c) => c.challenge_id === challengeId);
}

/** Milliseconds between allowed "Mark as Completed" actions per student. */
export const COMPLETE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Returns null if the student may complete a challenge now, or the number of
 *  milliseconds remaining before the 24-hour cooldown expires. */
export function completeCooldownRemaining(studentId: string): number | null {
  const u = USERS.find((x) => x.id === studentId);
  if (!u?.last_completed_at) return null;
  const elapsed = Date.now() - +new Date(u.last_completed_at);
  const remaining = COMPLETE_COOLDOWN_MS - elapsed;
  return remaining > 0 ? remaining : null;
}

/** Mark a challenge as completed. Idempotent + updates streak counters using
 *  the same "≤14 days keeps the streak alive" rule used elsewhere. Enforces a
 *  24-hour cooldown between completions — returns false if blocked. */
export function completeChallenge(studentId: string, challengeId: string): boolean {
  const u = USERS.find((x) => x.id === studentId);
  if (!u) return false;
  const done = u.completed_challenges ?? [];
  if (done.some((c) => c.challenge_id === challengeId)) return false;
  if (completeCooldownRemaining(studentId) !== null) return false;

  const now = new Date();
  const nowIso = now.toISOString();
  const last = u.last_completed_at ? new Date(u.last_completed_at) : null;
  const diffDays = last ? (now.getTime() - last.getTime()) / 86_400_000 : Infinity;
  const nextCurrent = last && diffDays <= 14 ? (u.current_streak ?? 0) + 1 : 1;
  const nextLongest = Math.max(u.longest_streak ?? 0, nextCurrent);

  persistStudentPatch(studentId, {
    completed_challenges: [...done, { challenge_id: challengeId, completed_at: nowIso }],
    last_completed_at: nowIso,
    current_streak: nextCurrent,
    longest_streak: nextLongest,
  });
  return true;
}

/** Set / update the shared_link on a completed-challenge entry. `shared_at` is
 *  set exactly ONCE (the first time the link goes from empty → non-empty) and
 *  is preserved on every subsequent edit so the teacher notification never
 *  re-fires. */
export function shareChallengeResult(
  studentId: string,
  challengeId: string,
  link: string,
): void {
  const u = USERS.find((x) => x.id === studentId);
  if (!u) return;
  const list = u.completed_challenges ?? [];
  const idx = list.findIndex((c) => c.challenge_id === challengeId);
  if (idx < 0) return;
  const trimmed = link.trim();
  const prev = list[idx];
  const next = [...list];
  next[idx] = {
    ...prev,
    shared_link: trimmed || undefined,
    shared_at: prev.shared_at ?? (trimmed ? new Date().toISOString() : undefined),
  };
  persistStudentPatch(studentId, { completed_challenges: next });
}

export function getSharedResult(studentId: string, challengeId: string): string {
  const u = USERS.find((x) => x.id === studentId);
  const entry = (u?.completed_challenges ?? []).find((c) => c.challenge_id === challengeId);
  return entry?.shared_link ?? "";
}



/* -------------------------------------------------------------------------- */
/* Mystery Box (Verbo Flash) — 24h cooldown independent from challenge          */
/* completion. Tracks last_mystery_box_opened_at per student.                   */
/* -------------------------------------------------------------------------- */

export const MYSTERY_BOX_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function mysteryBoxCooldownRemaining(studentId: string): number | null {
  const u = USERS.find((x) => x.id === studentId);
  if (!u?.last_mystery_box_opened_at) return null;
  const elapsed = Date.now() - +new Date(u.last_mystery_box_opened_at);
  const remaining = MYSTERY_BOX_COOLDOWN_MS - elapsed;
  return remaining > 0 ? remaining : null;
}

/** Attempt to open today's Mystery Box. Returns true if the cooldown allowed
 *  it (and stamps the open time), false if still on cooldown. */
export function openMysteryBox(studentId: string): boolean {
  if (mysteryBoxCooldownRemaining(studentId) !== null) return false;
  persistStudentPatch(studentId, { last_mystery_box_opened_at: new Date().toISOString() });
  return true;
}


export function subscribeStudents(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === PROFILE_KEY) cb(); };
  window.addEventListener(STUDENTS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STUDENTS_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
