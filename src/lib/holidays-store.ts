// Holidays reference list.
//
// Admin-managed collection of official holiday dates. NOTHING in the system
// blocks or auto-cancels based on this list — it exists purely as a reference
// for Admin so that when a teacher retro-annotates a Session Report with
// "Cancelled Holiday" (or a student justifies with the same), the Admin has
// a canonical date list to cross-check.
import { useSyncExternalStore } from "react";

export interface Holiday {
  id: string;
  /** ISO date only, YYYY-MM-DD. */
  date: string;
  label: string;
  created_at: string;
}

const KEY = "verbo:holidays";
export const HOLIDAYS_EVENT = "verbo:holidays-updated";

const SEED: Holiday[] = [];

function read(): Holiday[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Holiday[];
  } catch { /* noop */ }
  return SEED;
}
function write(list: Holiday[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(HOLIDAYS_EVENT));
  } catch { /* noop */ }
}

export function loadHolidays(): Holiday[] {
  return read().slice().sort((a, b) => a.date.localeCompare(b.date));
}

export function addHoliday(input: { date: string; label: string }): Holiday {
  const h: Holiday = {
    id: `hol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: input.date,
    label: input.label.trim() || "Holiday",
    created_at: new Date().toISOString(),
  };
  write([h, ...read()]);
  return h;
}

export function removeHoliday(id: string): void {
  write(read().filter((h) => h.id !== id));
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener(HOLIDAYS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(HOLIDAYS_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useHolidays(): Holiday[] {
  return useSyncExternalStore(subscribe, loadHolidays, () => SEED);
}
