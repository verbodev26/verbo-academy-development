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

import type { ExtSession, ExtSessionStatus, AttendanceSubStatus } from "./sessions-store";
import { loadSessions, SUB_STATUS_META } from "./sessions-store";
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
  /** Refinement of Absent/Cancelled status. When set, the pill renders the
   *  2-letter initials + the sub-status color instead of the base color. */
  sub_status?: AttendanceSubStatus;
  // Passthrough refs so click handlers can open the right modal / route.
  session?: ExtSession;
  club?: Club;
}

function sessionEvent(s: ExtSession, title: string, subStatus?: AttendanceSubStatus): CalendarEvent {
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
    sub_status: subStatus ?? s.attendance_sub_status,
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

/** Every event a student should see on their calendar. Mirrors the teacher
 *  adapter but scoped to the student's own sessions + booked clubs. */
export function studentCalendarEvents(studentId: string, opts?: {
  teacherNameOf?: (id: string) => string | undefined;
}): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const s of loadSessions()) {
    const isMember = !!s.member_statuses && Object.keys(s.member_statuses).includes(studentId);
    if (s.student_id !== studentId && !isMember) continue;
    if (s.origin === "workshop") continue;
    const teacherName = opts?.teacherNameOf?.(s.teacher_id) ?? "Teacher";
    // For group sessions the student's own sub-status is the one we render.
    const memberSub = s.group_id ? s.member_sub_statuses?.[studentId] : undefined;
    const ev = sessionEvent(s, `Session with ${teacherName}`, memberSub);
    events.push(ev);
  }
  // Verbo Insights + Book Clubs — every upcoming/live club is visible on the
  // student calendar so they can browse and open the reservation modal from
  // there. Cancelled clubs are hidden. Cap/plan gating happens at reserve time.
  for (const c of loadClubs()) {
    if (c.type !== "insight" && c.type !== "book") continue;
    if (c.status === "cancelled") continue;
    events.push(clubEvent(c));
  }
  return events;
}



/** Meta a chip/legend can render for each supported event kind. */
export const EVENT_KIND_META: Record<CalendarEventKind, { label: string; color: string; short: string }> = {
  class:      { label: "1:1 Class",      color: "#01304a", short: "1:1" },
  workshop:   { label: "Workshop",       color: "#7c3aed", short: "WS" },
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
  // Cancelled reassigned to a slate blue-gray, distinct from Scheduled's
  // #94a3b8. The lighter tint used for justified-cancelled variants lives in
  // SUB_STATUS_META (#cbd5e1).
  cancelled:          { label: "Cancelled",          color: "#64748B" },
  pending_reschedule: { label: "Pending Reschedule", color: "#b45309" },
  no_show:            { label: "No Show",            color: "#334155" },
  rescheduled:        { label: "Rescheduled",        color: "#94a3b8" },
  rearranged:         { label: "Rearranged",         color: "#eab308" },
  delayed:            { label: "Delayed",            color: "#eab308" },
  converted_to_spotlight: { label: "Converted to Spotlight", color: "#4f46e5" },
};

export const CANONICAL_STATUS_ORDER: ExtSessionStatus[] = [
  "scheduled", "ready", "completed", "absent", "cancelled", "pending_reschedule", "no_show",
];

/** Renderer helper: given an event, return the pill color + short label to
 *  display in the calendar cell. Sub-status wins over base status when set. */
export function eventPillDisplay(ev: CalendarEvent): { color: string; short: string; cellLabel: string } {
  if (ev.sub_status) {
    const meta = SUB_STATUS_META[ev.sub_status];
    return { color: meta.color, short: meta.initials, cellLabel: meta.initials };
  }
  const kind = EVENT_KIND_META[ev.kind];
  const status = ev.status as ExtSessionStatus | undefined;
  const color = (ev.kind === "class" || ev.kind === "workshop") && status
    ? (CALENDAR_STATUS_META[status]?.color ?? kind.color)
    : kind.color;
  const cellLabel = status && (status === "absent" || status === "cancelled")
    ? CALENDAR_STATUS_META[status].label
    : "";
  return { color, short: ev.is_group ? "G" : kind.short, cellLabel };
}