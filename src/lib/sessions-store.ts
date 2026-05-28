// Shared sessions store — persisted to localStorage, broadcast across tabs.
import { SESSIONS as SEED_SESSIONS, type Session } from "./mock-data";

export type ExtSessionStatus =
  | "scheduled"
  | "rescheduled"
  | "ready"
  | "rearranged"
  | "completed"
  | "absent"
  | "delayed";

export interface ExtSession extends Omit<Session, "status"> {
  status: ExtSessionStatus;
}

export const SESSIONS_KEY = "verbo:sessions";
export const SESSIONS_EVENT = "verbo:sessions-updated";

export function loadSessions(): ExtSession[] {
  if (typeof window === "undefined") return SEED_SESSIONS as ExtSession[];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw) as ExtSession[];
  } catch { /* noop */ }
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(SEED_SESSIONS)); } catch { /* noop */ }
  return SEED_SESSIONS as ExtSession[];
}

let cached: ExtSession[] | null = null;
const SSR_SNAPSHOT: ExtSession[] = SEED_SESSIONS as ExtSession[];

export function getSessionsSnapshot(): ExtSession[] {
  if (cached === null) cached = loadSessions();
  return cached;
}

export function getServerSessionsSnapshot(): ExtSession[] {
  return SSR_SNAPSHOT;
}

export function persistSessions(sessions: ExtSession[]) {
  if (typeof window === "undefined") return;
  try {
    cached = sessions;
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent(SESSIONS_EVENT));
  } catch { /* noop */ }
}

export function subscribeSessions(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const invalidate = () => { cached = null; cb(); };
  const onStorage = (e: StorageEvent) => { if (e.key === SESSIONS_KEY) invalidate(); };
  window.addEventListener(SESSIONS_EVENT, invalidate);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SESSIONS_EVENT, invalidate);
    window.removeEventListener("storage", onStorage);
  };
}


export function statusTone(s: ExtSessionStatus): "default" | "success" | "warning" | "danger" | "muted" {
  switch (s) {
    case "completed": return "success";
    case "absent": return "danger";
    case "delayed":
    case "rearranged": return "warning";
    case "ready": return "default";
    default: return "muted"; // scheduled / rescheduled — Gris Neutro
  }
}
