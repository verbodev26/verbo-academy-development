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
