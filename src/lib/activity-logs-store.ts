// ============================================================================
// Activity Logs — derived business-event log for Super Admin.
//
// Same philosophy as notifications-store: DO NOT build a parallel event log.
// Compute the current log on demand from data already persisted by existing
// stores. Every entry has a stable id so filtering & pagination are cheap.
// ============================================================================
import { useSyncExternalStore } from "react";
import { USERS, type Role } from "./mock-data";
import { loadSessions, SESSIONS_EVENT } from "./sessions-store";
import { loadClubs, loadReleaseRequests, CLUBS_EVENT, RELEASE_REQUESTS_EVENT } from "./clubs-store";
import { loadClubReports, CLUB_REPORTS_EVENT } from "./club-reports-store";
import { loadStrikes, STRIKES_EVENT } from "./strikes-store";
import { listChangeRequests, AVAIL_EVENT } from "./availability-store";
import { teacherStatus } from "./teacher-model";
import { loadStudentReports, REPORTS_EVENT } from "./student-reports-store";
import { loadFinancialIssues, FIN_ISSUES_EVENT } from "./financial-issues-store";

export type ActivityKind =
  | "session_scheduled"
  | "session_rescheduled"
  | "session_report_submitted"
  | "club_report_submitted"
  | "financial_adjustment"
  | "rating_submitted"
  | "club_created"
  | "club_claimed"
  | "club_completed"
  | "absent_student"
  | "absent_teacher"
  | "no_show"
  | "freeze_applied"
  | "strike_justified"
  | "avail_request_approved"
  | "avail_request_rejected"
  | "release_request_submitted"
  | "report_filed";

export type ActorRole = "admin" | "teacher" | "student" | "system";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  action: string;                 // human-readable action
  detail: string;                 // affected entity summary
  timestamp: string;              // ISO
  actorId: string | null;         // null when system
  actorName: string;              // "System" when null
  actorRole: ActorRole;
  personId?: string | null;       // primary affected person (student/teacher)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function userName(id?: string | null): string {
  if (!id) return "—";
  return USERS.find((u) => u.id === id)?.name ?? id;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------
export function buildActivityLog(): ActivityEntry[] {
  const out: ActivityEntry[] = [];

  // ---- Sessions --------------------------------------------------------
  const allSessions = loadSessions();
  for (const s of allSessions) {
    const teacher = userName(s.teacher_id);
    const student = userName(s.student_id);
    const detail = `${teacher} → ${student} · ${fmtDate(s.date_time)}`;

    // Scheduled / rescheduled — a human admin action.
    if (s.status === "scheduled" || s.status === "ready") {
      out.push({
        id: `sess-sched:${s.id}`,
        kind: "session_scheduled",
        action: "Session scheduled",
        detail,
        timestamp: s.date_time,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: s.teacher_id,
      });
    }
    if (s.status === "rescheduled" || s.status === "pending_reschedule") {
      out.push({
        id: `sess-resched:${s.id}`,
        kind: "session_rescheduled",
        action: "Session rescheduled",
        detail,
        timestamp: s.date_time,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: s.teacher_id,
      });
    }

    // Session Report submitted
    if (s.report_submitted_at) {
      out.push({
        id: `sess-report:${s.id}`,
        kind: "session_report_submitted",
        action: "Session Report submitted",
        detail: `${teacher} · ${student}`,
        timestamp: s.report_submitted_at,
        actorId: s.teacher_id, actorName: teacher, actorRole: "teacher",
        personId: s.student_id,
      });
    }

    // Rating submitted by student
    if (typeof s.student_rating === "number") {
      out.push({
        id: `rating:${s.id}`,
        kind: "rating_submitted",
        action: `Rating submitted (${s.student_rating}★)`,
        detail: `${student} → ${teacher}${s.student_comment ? ` — "${s.student_comment.slice(0, 80)}"` : ""}`,
        timestamp: s.date_time,
        actorId: s.student_id, actorName: student, actorRole: "student",
        personId: s.teacher_id,
      });
    }

    // Absent / No-Show
    if (s.status === "absent") {
      const kind: ActivityKind = s.absent_cause === "teacher" ? "absent_teacher" : "absent_student";
      out.push({
        id: `absent:${s.id}`,
        kind,
        action: s.absent_cause === "teacher" ? "Absent — Teacher" : "Absent — Student",
        detail,
        timestamp: s.date_time,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: s.absent_cause === "teacher" ? s.teacher_id : s.student_id,
      });
    }
    if (s.status === "no_show") {
      out.push({
        id: `noshow:${s.id}`,
        kind: "no_show",
        action: "No Show",
        detail,
        timestamp: s.date_time,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: s.student_id,
      });
    }
  }

  // ---- Club Reports (Insight / Book / Spotlight) ----------------------
  const reports = loadClubReports();
  const clubsById = new Map(loadClubs().map((c) => [c.id, c]));
  for (const r of Object.values(reports)) {
    const teacher = userName(r.teacher_id);
    const club = clubsById.get(r.event_id);
    const label =
      r.event_type === "book" ? "Book Club" :
      r.event_type === "insight" ? "Insight" : "Spotlight Session";
    out.push({
      id: `club-report:${r.event_id}`,
      kind: "club_report_submitted",
      action: `${label} Report submitted`,
      detail: club ? `${club.title} · ${teacher}` : `${label} · ${teacher}`,
      timestamp: r.submitted_at,
      actorId: r.teacher_id, actorName: teacher, actorRole: "teacher",
      personId: r.teacher_id,
    });
    // Club completed (delivered) — anchor to the report submission.
    out.push({
      id: `club-completed:${r.event_id}`,
      kind: "club_completed",
      action: `${label} delivered`,
      detail: club ? club.title : r.event_id,
      timestamp: r.submitted_at,
      actorId: r.teacher_id, actorName: teacher, actorRole: "teacher",
      personId: r.teacher_id,
    });
  }

  // ---- Clubs — created & claimed --------------------------------------
  for (const c of loadClubs()) {
    // Created — no created_at in the mock, anchor to the event date.
    out.push({
      id: `club-created:${c.id}`,
      kind: "club_created",
      action: `${c.type === "book" ? "Book Club" : "Insight"} created`,
      detail: `${c.title} · ${fmtDate(c.date)}`,
      timestamp: c.date,
      actorId: null, actorName: "Admin", actorRole: "admin",
    });
    if (c.teacher_id && c.claimed_at) {
      out.push({
        id: `club-claim:${c.id}:${c.claimed_at}`,
        kind: "club_claimed",
        action: "Club claimed by teacher",
        detail: `${c.title} · ${userName(c.teacher_id)}`,
        timestamp: c.claimed_at,
        actorId: c.teacher_id, actorName: userName(c.teacher_id), actorRole: "teacher",
        personId: c.teacher_id,
      });
    }
  }

  // ---- Financial adjustments (payroll: bonus, penalties, spotlight) ---
  for (const t of USERS) {
    if (t.role !== "teacher") continue;
    for (const a of t.adjustments ?? []) {
      out.push({
        id: `adj:${t.id}:${a.id}`,
        kind: "financial_adjustment",
        action: `Financial adjustment (${money(a.amount)})`,
        detail: `${t.name} — ${a.reason}`,
        timestamp: a.date,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: t.id,
      });
    }
  }

  // ---- Strikes: justified --------------------------------------------
  for (const s of loadStrikes()) {
    if (s.justified && s.justified_at) {
      const teacher = userName(s.teacher_id);
      out.push({
        id: `strike-just:${s.id}`,
        kind: "strike_justified",
        action: "Strike justified",
        detail: `${teacher} — ${s.justification_cause ?? "reviewed"}`,
        timestamp: s.justified_at,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: s.teacher_id,
      });
    }
  }

  // ---- Freeze applied (teacher currently frozen) ----------------------
  for (const t of USERS) {
    if (t.role !== "teacher") continue;
    if (teacherStatus(t) !== "frozen") continue;
    const strikes = loadStrikes()
      .filter((x) => x.teacher_id === t.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const anchor = strikes[0]?.created_at ?? new Date().toISOString();
    out.push({
      id: `freeze:${t.id}:${anchor}`,
      kind: "freeze_applied",
      action: "Teacher frozen (auto)",
      detail: `${t.name} — reached 3 unjustified cancellations.`,
      timestamp: anchor,
      actorId: null, actorName: "System", actorRole: "system",
      personId: t.id,
    });
  }

  // ---- Availability change requests: approved / rejected --------------
  for (const r of listChangeRequests()) {
    if (!r.resolvedAt) continue;
    if (r.status === "approved") {
      out.push({
        id: `avail-app:${r.id}`,
        kind: "avail_request_approved",
        action: "Availability change approved",
        detail: `${userName(r.teacherId)}${r.reason ? ` — ${r.reason}` : ""}`,
        timestamp: r.resolvedAt,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: r.teacherId,
      });
    } else if (r.status === "rejected") {
      out.push({
        id: `avail-rej:${r.id}`,
        kind: "avail_request_rejected",
        action: "Availability change rejected",
        detail: `${userName(r.teacherId)}${r.reason ? ` — ${r.reason}` : ""}`,
        timestamp: r.resolvedAt,
        actorId: null, actorName: "Admin", actorRole: "admin",
        personId: r.teacherId,
      });
    }
  }

  // ---- Club release requests submitted --------------------------------
  for (const r of loadReleaseRequests()) {
    const club = clubsById.get(r.club_id);
    out.push({
      id: `release:${r.id}`,
      kind: "release_request_submitted",
      action: "Club release request submitted",
      detail: `${userName(r.teacher_id)} · ${club?.title ?? r.club_id} — ${r.reason || "no reason"}`,
      timestamp: r.requested_at,
      actorId: r.teacher_id, actorName: userName(r.teacher_id), actorRole: "teacher",
      personId: r.teacher_id,
    });
  }

  // ---- Student reports (Teacher > Panel > Report) ---------------------
  for (const r of loadStudentReports()) {
    const teacher = userName(r.teacher_id);
    const student = userName(r.student_id);
    const preview = r.text.length > 80 ? `${r.text.slice(0, 80)}…` : r.text;
    out.push({
      id: `student-report:${r.id}`,
      kind: "report_filed",
      action: "Student report filed",
      detail: `${teacher} → ${student}${preview ? ` — "${preview}"` : ""}`,
      timestamp: r.created_at,
      actorId: r.teacher_id, actorName: teacher, actorRole: "teacher",
      personId: r.student_id,
    });
  }

  // ---- Financial issues (Teacher > Financial > Report) ----------------
  for (const f of loadFinancialIssues()) {
    const teacher = userName(f.teacher_id);
    const preview = f.text.length > 80 ? `${f.text.slice(0, 80)}…` : f.text;
    out.push({
      id: `fin-issue:${f.id}`,
      kind: "report_filed",
      action: "Financial issue reported",
      detail: `${teacher}${preview ? ` — "${preview}"` : ""}`,
      timestamp: f.created_at,
      actorId: f.teacher_id, actorName: teacher, actorRole: "teacher",
      personId: f.teacher_id,
    });
  }

  // Sort newest first, de-dupe by id (defensive).
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

// ---------------------------------------------------------------------------
// React binding
// ---------------------------------------------------------------------------
const SOURCE_EVENTS = [
  SESSIONS_EVENT, CLUBS_EVENT, RELEASE_REQUESTS_EVENT,
  CLUB_REPORTS_EVENT, STRIKES_EVENT, AVAIL_EVENT,
  REPORTS_EVENT, FIN_ISSUES_EVENT,
];

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  for (const e of SOURCE_EVENTS) window.addEventListener(e, cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    for (const e of SOURCE_EVENTS) window.removeEventListener(e, cb);
    window.removeEventListener("storage", onStorage);
  };
}

let lastList: ActivityEntry[] = [];
let lastTick = -1;
let tick = 0;

export function useActivityLog(): ActivityEntry[] {
  return useSyncExternalStore(
    (cb) => subscribe(() => { tick++; cb(); }),
    () => {
      if (tick !== lastTick) {
        lastTick = tick;
        lastList = buildActivityLog();
      }
      return lastList;
    },
    () => [],
  );
}

// Convenience label maps for the UI filter chips.
export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  session_scheduled: "Session scheduled",
  session_rescheduled: "Session rescheduled",
  session_report_submitted: "Session Report submitted",
  club_report_submitted: "Club Report submitted",
  financial_adjustment: "Financial adjustment",
  rating_submitted: "Rating submitted",
  club_created: "Club created",
  club_claimed: "Club claimed",
  club_completed: "Club completed",
  absent_student: "Absent — Student",
  absent_teacher: "Absent — Teacher",
  no_show: "No Show",
  freeze_applied: "Teacher frozen",
  strike_justified: "Strike justified",
  avail_request_approved: "Availability approved",
  avail_request_rejected: "Availability rejected",
  release_request_submitted: "Release request",
};

export const ACTOR_ROLE_LABELS: Record<ActorRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  system: "System",
};

export type { Role };
