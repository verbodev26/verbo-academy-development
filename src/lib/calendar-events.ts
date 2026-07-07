// Adapters that turn the various platform data sources into a single
// list of CalendarEvent objects the shared CalendarView can render.
//
// This is a *read-only projection* — nothing here mutates state. All
// underlying data lives in its canonical store:
//   - Regular classes  → sessions-store (origin: "course")
//   - Workshop live    → sessions-store (origin: "workshop")
//   - Book Clubs       → clubs-store (type: "book")
//   - Insights         → clubs-store (type: "insight")
//   - Spotlights       → not yet cross-app persisted (see TODO below)
//
// Consumers pass a `teacherId` (or `studentId`) and get back the events
// that surface belongs to. When Spotlight Sessions get their own store,
// wire it here — no CalendarView changes required.

import type { ExtSession, ExtSessionStatus } from "./sessions-store";
import { loadSessions } from "./sessions-store";
import { loadClubs, type Club, type ClubType, type TimeStatus } from "./clubs-store";
import { groupsByStudentId } from "./groups-store";

export type CalendarEventKind =
  | "class"        // 1:1 Performance Session (course)
  | "workshop"     // Focus Workshop live session
  | "insight"      // Verbo Insight (club)
  | "book_club"    // Book Club (club)
  | "spotlight";   // Spotlight Session

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  date: string;            // ISO
  duration_minutes: number;
  title: string;
  subtitle?: string;
  status?: ExtSessionStatus | TimeStatus;
  origin?: "course" | "workshop";
  // ---- Group indicator (Performance Sessions groups) ----
  // When true, the event pill renders a "G" badge instead of the default
  // "1:1" badge, and the title is the Group Name.
  is_group?: boolean;
  group_id?: string;
  // ---- Club chip enrichment ----
  spots_taken?: number;
  spots_total?: number;
  enrolled_names?: string[];
  // Passthrough refs so click handlers can open the right modal / route.
  session?: ExtSession;
  club?: Club;
}

function sessionEvent(s: ExtSession, title: string): CalendarEvent {
  return {
    id: s.id,
    kind: s.origin === "workshop" ? "workshop" : "class",
    date: s.date_time,
    duration_minutes: s.duration_minutes,
    title,
    subtitle: s.workshop_topic,
    status: s.status,
    origin: s.origin ?? "course",
    is_group: !!s.group_id,
    group_id: s.group_id,
    session: s,
  };
}

// Deterministic enrolled-student placeholders — the seed data only tracks
// spots_taken counts, so we hydrate a stable list of names for the hover
// popover. When the real roster ships, replace with a lookup here.
const CLUB_NAME_POOL = [
  "Elena Ruiz", "Marco Silva", "Yuki Tanaka", "Ana Torres", "Liam Bennett",
  "Priya Shah", "Noah Kim", "Sofía López", "Mateo Rossi", "Grace Lee",
  "Diego Álvarez", "Emma Wright", "Hana Sato", "Kai Nakamura", "Isabela Costa",
  "Owen Fischer", "Camila Vega", "Ruben Ortiz", "Aiko Mori", "Jonas Weber",
  "Zara Ahmed", "Luca Bianchi", "Nora Park", "Theo Rossi", "Maya Chen",
  "Felix Meyer", "Yara Haddad", "Iker Núñez", "Elif Demir", "Aarav Patel",
];
function enrolledNamesFor(c: Club): string[] {
  const taken = Math.max(0, Math.min(c.spots_taken ?? 0, CLUB_NAME_POOL.length));
  return CLUB_NAME_POOL.slice(0, taken);
}
function clubEvent(c: Club): CalendarEvent {
  return {
    id: c.id,
    kind: c.type === "book" ? "book_club" : "insight",
    date: c.date,
    duration_minutes: c.duration_minutes,
    title: c.title,
    subtitle: c.type === "book" ? "Book Club" : "Insight",
    status: c.status,
    spots_taken: c.spots_taken,
    spots_total: c.spots_total,
    enrolled_names: enrolledNamesFor(c),
    club: c,
  };
}

/** Every event the given teacher should see on their calendar. */
export function teacherCalendarEvents(teacherId: string, opts?: {
  studentNameOf?: (id: string) => string | undefined;
  cohortNameOf?: (id: string) => string | undefined;
}): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const gMap = groupsByStudentId();

  // Sessions — classes + workshop live sessions live in the same store.
  for (const s of loadSessions()) {
    if (s.teacher_id !== teacherId) continue;
    if (s.origin === "workshop") {
      const name = opts?.cohortNameOf?.(s.workshop_cohort_id ?? "") ?? "Workshop cohort";
      events.push(sessionEvent(s, name));
    } else {
      // Group session: use the shared Group Name instead of a single student.
      const g = s.group_id
        ? (gMap.get(s.student_id) ?? null)
        : null;
      const name = g ? g.name : (opts?.studentNameOf?.(s.student_id) ?? "Student");
      events.push(sessionEvent(s, name));
    }
  }

  // Clubs — Insights + Book Clubs the teacher has claimed / been assigned.
  for (const c of loadClubs()) {
    if (c.teacher_id === teacherId) events.push(clubEvent(c));
  }

  // TODO(spotlight): once Spotlight Sessions get a cross-app store,
  // filter here by teacher assignment and push events with kind: "spotlight".

  return events;
}

/** Meta a chip/legend can render for each supported event kind. */
export const EVENT_KIND_META: Record<CalendarEventKind, { label: string; color: string; short: string }> = {
  class:      { label: "Clase regular",  color: "#01304a", short: "1:1" },
  workshop:   { label: "Taller",         color: "#7c3aed", short: "WS" },
  insight:    { label: "Insight",        color: "#0ea5e9", short: "IN" },
  book_club:  { label: "Book Club",      color: "#d97706", short: "BC" },
  spotlight:  { label: "Spotlight",      color: "#06b6d4", short: "SP" },
};

/** The 7 canonical statuses in the order they appear in the legend. */
export const CALENDAR_STATUS_META: Record<ExtSessionStatus, { label: string; color: string }> = {
  scheduled:          { label: "Scheduled",          color: "#94a3b8" },
  ready:              { label: "Ready",              color: "#8b5cf6" },
  completed:          { label: "Completed",          color: "#16a34a" },
  absent:             { label: "Absent",             color: "#dc2626" },
  cancelled:          { label: "Cancelled",          color: "#be185d" },
  pending_reschedule: { label: "Pending Reschedule", color: "#b45309" },
  no_show:            { label: "No Show",            color: "#334155" },
  // Not part of the canonical 7 but tolerated by the type — mapped to a
  // muted color so any stray legacy value still renders sanely.
  rescheduled:        { label: "Rescheduled",        color: "#94a3b8" },
  rearranged:         { label: "Rearranged",         color: "#eab308" },
  delayed:            { label: "Delayed",            color: "#eab308" },
};

export const CANONICAL_STATUS_ORDER: ExtSessionStatus[] = [
  "scheduled", "ready", "completed", "absent", "cancelled", "pending_reschedule", "no_show",
];