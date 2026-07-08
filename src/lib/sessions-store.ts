// Shared sessions store — persisted to localStorage, broadcast across tabs.
import { SESSIONS as SEED_SESSIONS, type Session } from "./mock-data";
import { setCoverageNote } from "./coverage-notes-store";
import { saveSubskillEvaluation } from "./performance-store";
import { decrementGroupRemaining } from "./groups-store";

export type ExtSessionStatus =
  | "scheduled"
  | "rescheduled"
  | "ready"
  | "rearranged"
  | "completed"
  | "absent"
  | "delayed"
  | "cancelled"
  | "pending_reschedule"
  | "no_show"
  // Student replaced this 1:1 with a Spotlight in the same slot. Not a strike,
  // not Cancelled, not Absent — its own status with its own indigo color.
  | "converted_to_spotlight";

export interface ExtSession extends Omit<Session, "status"> {
  status: ExtSessionStatus;
  // ---- Group session support ----
  // When set, this session represents ONE shared live class attended by
  // multiple students belonging to the same Group (see groups-store). The
  // top-level `student_id` still points at the primary/first member (for
  // legacy consumers), but `member_statuses` is the source of truth for
  // per-member attendance / report submission.
  group_id?: string;
  member_statuses?: Record<string, ExtSessionStatus>;
  member_absent_cause?: Record<string, "student" | "teacher">;
  // ---- Teacher "Can't Attend" cancellation ----
  cancellation_reason?: "illness" | "personal" | "major_issue" | "other";
  cancellation_note?: string;
  /** True when a teacher cancelled with <24h notice — Admin needs to find
   *  a substitute manually (the matching engine is a future phase). */
  needs_substitute?: boolean;
  /** Free-text comments left by the teacher in the Session Report. */
  report_comments?: string;
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

/** All sessions that belong to a given Focus Workshop cohort. */
export function sessionsForCohort(cohortId: string): ExtSession[] {
  return loadSessions().filter(
    (s) => s.origin === "workshop" && s.workshop_cohort_id === cohortId,
  );
}

/** Adds one workshop session record to the shared sessions store. */
export function addWorkshopSession(input: {
  cohortId: string;
  templateId: string;
  teacherId: string;
  teamsLink: string;
  dateISO?: string;
  durationMinutes?: number;
  topic?: string;
}): ExtSession {
  const s: ExtSession = {
    id: `ws-${input.cohortId}-${Math.random().toString(36).slice(2, 8)}`,
    student_id: input.cohortId, // sentinel; workshop cohorts hold the roster
    teacher_id: input.teacherId,
    date_time: input.dateISO ?? "",
    duration_minutes: input.durationMinutes ?? 60,
    teams_link: input.teamsLink,
    status: "scheduled",
    origin: "workshop",
    workshop_cohort_id: input.cohortId,
    workshop_template_id: input.templateId,
    workshop_topic: input.topic,
  };
  persistSessions([s, ...loadSessions()]);
  return s;
}

export function updateWorkshopSession(id: string, patch: Partial<ExtSession>) {
  const next = loadSessions().map((s) => (s.id === id ? { ...s, ...patch } : s));
  persistSessions(next);
}

export function removeWorkshopSession(id: string) {
  persistSessions(loadSessions().filter((s) => s.id !== id));
}

/** Generic patcher — used by Lesson Plan (→ Ready) and by any other
 *  surface that needs to update a single session while keeping every
 *  consumer live-synced. */
export function updateSession(id: string, patch: Partial<ExtSession>) {
  const next = loadSessions().map((s) => (s.id === id ? { ...s, ...patch } : s));
  persistSessions(next);
}

/** Final Session Report submit. Single source of truth for the four
 *  effects the spec requires:
 *    1. Session → Completed (Present/Delayed) or Absent (with cause).
 *    2. Attendance metadata (delayed flag).
 *    3. Real per-subskill scores flow into the same performance store
 *       the student dashboard + Teacher > Mis Alumnos read from.
 *    4. Any coverage note for (teacher, student) is cleared — this is
 *       the auto-clear hook the Fase 1 TODO in coverage-notes-store
 *       was waiting for. If this session is a substitute coverage,
 *       clearing the note reflects that the situation is resolved.
 *
 *  Not handled here on purpose: PDF generation and email dispatch. Those
 *  are deferred until we migrate to Supabase.
 */
export function submitSessionReport(input: {
  sessionId: string;
  teacherId: string;
  studentId: string;
  attendance: "present" | "delayed" | "absent";
  absentCause?: "student" | "teacher";
  subskills: Record<string, number>;
}): ExtSession | null {
  const status: ExtSessionStatus = input.attendance === "absent" ? "absent" : "completed";
  let updated: ExtSession | null = null;
  const next = loadSessions().map((s) => {
    if (s.id !== input.sessionId) return s;
    updated = {
      ...s,
      status,
      absent_cause: status === "absent" ? (input.absentCause ?? "student") : undefined,
      attendance_delayed: input.attendance === "delayed",
      report_submitted_at: new Date().toISOString(),
    };
    return updated;
  });
  persistSessions(next);

  if (status !== "absent" && Object.keys(input.subskills).length > 0) {
    saveSubskillEvaluation(input.sessionId, input.subskills);
  }

  // Auto-clear coverage note (Fase 1 TODO hook).
  setCoverageNote(input.teacherId, input.studentId, "");

  return updated;
}

// -----------------------------------------------------------------------------
// Group Session Report — one shared class, per-member attendance & evaluation.
// Called by the Session Report modal when the session has a `group_id` set.
// -----------------------------------------------------------------------------
export function submitGroupSessionReport(input: {
  sessionId: string;
  teacherId: string;
  groupId: string;
  perMember: Array<{
    studentId: string;
    attendance: "present" | "delayed" | "absent";
    absentCause?: "student" | "teacher";
    subskills: Record<string, number>;
  }>;
}): ExtSession | null {
  let updated: ExtSession | null = null;
  const memberStatuses: Record<string, ExtSessionStatus> = {};
  const memberAbsentCause: Record<string, "student" | "teacher"> = {};
  for (const m of input.perMember) {
    memberStatuses[m.studentId] = m.attendance === "absent" ? "absent" : "completed";
    if (m.attendance === "absent") memberAbsentCause[m.studentId] = m.absentCause ?? "student";
  }
  // The top-level session status is "completed" if any member attended.
  const anyPresent = input.perMember.some((m) => m.attendance !== "absent");
  const nextTop: ExtSessionStatus = anyPresent ? "completed" : "absent";

  const next = loadSessions().map((s) => {
    if (s.id !== input.sessionId) return s;
    updated = {
      ...s,
      status: nextTop,
      member_statuses: memberStatuses,
      member_absent_cause: memberAbsentCause,
      report_submitted_at: new Date().toISOString(),
    };
    return updated;
  });
  persistSessions(next);

  // Individual per-member effects: skills recorded per student, coverage
  // notes cleared per student. PDF/report generation reuses the same
  // per-student store so each Completed member gets their own record.
  for (const m of input.perMember) {
    if (m.attendance !== "absent" && Object.keys(m.subskills).length > 0) {
      saveSubskillEvaluation(input.sessionId, m.subskills);
    }
    setCoverageNote(input.teacherId, m.studentId, "");
  }

  // Group progress advances exactly once (not per member), and only when
  // the class actually took place. If every member is Absent with cause
  // "teacher", the teacher didn't deliver the class — do not consume a
  // session from the group's contract.
  const classOccurred = input.perMember.some(
    (m) => m.attendance !== "absent" || (m.absentCause ?? "student") === "student",
  );
  if (classOccurred) decrementGroupRemaining(input.groupId);

  return updated;
}

/** Cascade update: when a cohort's teacher or shared link changes, keep
 *  future/non-completed sessions in sync so admin.sessions and the cohort
 *  view stay consistent without manual re-entry. */
export function syncCohortFieldsToSessions(
  cohortId: string,
  patch: { teacher_id?: string; teams_link?: string },
) {
  const next = loadSessions().map((s) => {
    if (s.origin !== "workshop" || s.workshop_cohort_id !== cohortId) return s;
    if (s.status === "completed" || s.status === "absent" || s.status === "no_show") return s;
    return { ...s, ...patch };
  });
  persistSessions(next);
}

export const WORKSHOP_STATUS_META: Record<
  ExtSessionStatus,
  { label: string; bg: string; color: string }
> = {
  scheduled: { label: "Scheduled", bg: "#f1f5f9", color: "#475569" },
  ready: { label: "Ready", bg: "#ede9fe", color: "#7c3aed" },
  completed: { label: "Completed", bg: "#dcfce7", color: "#15803d" },
  absent: { label: "Absent", bg: "#fee2e2", color: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "#fce7f3", color: "#be185d" },
  pending_reschedule: { label: "Pending Reschedule", bg: "#fef3c7", color: "#b45309" },
  no_show: { label: "No Show", bg: "#334155", color: "#ffffff" },
  rescheduled: { label: "Rescheduled", bg: "#f1f5f9", color: "#475569" },
  rearranged: { label: "Rearranged", bg: "#fde68a", color: "#92400e" },
  delayed: { label: "Delayed", bg: "#fde68a", color: "#92400e" },
  converted_to_spotlight: { label: "Converted to Spotlight", bg: "#e0e7ff", color: "#4f46e5" },
};
export const WORKSHOP_STATUS_OPTIONS: ExtSessionStatus[] = [
  "scheduled", "ready", "completed", "absent", "cancelled", "pending_reschedule", "no_show",
];


export function statusTone(s: ExtSessionStatus): "default" | "success" | "warning" | "danger" | "muted" {
  switch (s) {
    case "completed": return "success";
    case "absent":
    case "no_show": return "danger";
    case "delayed":
    case "rearranged":
    case "pending_reschedule": return "warning";
    case "ready": return "default";
    default: return "muted"; // scheduled / rescheduled / cancelled — Gris Neutro
  }
}
