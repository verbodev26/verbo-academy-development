// ============================================================================
// Internal notifications (bell) — DERIVED from existing stores.
//
// This module does NOT own its own event log. Instead, it computes the current
// notification list on demand from the events already persisted by other
// stores (sessions, clubs, availability, strikes, KPIs, announcements). The
// only thing we persist here is the per-user READ state so the badge counter
// stays accurate across reloads.
//
// Adding a new notification kind = adding a derivation branch below.
// Do NOT build a parallel event log — reuse the source of truth.
// ============================================================================
import { useSyncExternalStore } from "react";
import { USERS, type Role, type User } from "./mock-data";
import { loadSessions, SESSIONS_EVENT } from "./sessions-store";
import {
  loadClubs, loadReleaseRequests,
  CLUBS_EVENT, RELEASE_REQUESTS_EVENT,
} from "./clubs-store";
import {
  listChangeRequests, AVAIL_EVENT,
} from "./availability-store";
import { loadStrikes, STRIKES_EVENT, activeStrikeCount } from "./strikes-store";
import { computeTeacherKpis } from "./teacher-kpis";
import { teacherStatus } from "./teacher-model";
import { activeAnnouncements, ANN_EVENT } from "./announcements-store";
import { loadFinancialIssues, FIN_ISSUES_EVENT } from "./financial-issues-store";
import { REPORTS_KEY, REPORTS_EVENT, type StudentReport } from "./student-reports-store";
import { ASSIGNMENTS } from "./mock-data";
import { loadChallenges, CHALLENGES_EVENT } from "./challenges-store";
import { STUDENTS_EVENT } from "./students-store";

function readStudentReportsRaw(): StudentReport[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]") as StudentReport[]; }
  catch { return []; }
}

export type NotificationKind =
  // teacher-facing
  | "session_assigned"
  | "club_substitute_match"
  | "avail_request_approved"
  | "avail_request_rejected"
  | "club_claim_confirmed"
  | "club_released"
  | "freeze_applied"
  | "kpi_below_threshold"
  | "bonus_eligible"
  | "announcement"
  | "student_challenge_selected"
  // admin-facing
  | "needs_substitute"
  | "release_request"
  | "avail_change_request"
  | "teacher_three_strikes"
  | "student_report_filed"
  | "financial_issue_reported";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  /** ISO timestamp used for sorting and "time ago" formatting. */
  createdAt: string;
  /** Route to navigate to when the user clicks the notification. Reuses
   *  existing panels — the bell never creates new pages. */
  to: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// Read-state persistence (per user)
// ---------------------------------------------------------------------------
const READ_KEY = "verbo:notifications-read";
export const NOTIF_EVENT = "verbo:notifications-updated";

type ReadMap = Record<string, Record<string, true>>; // userId -> notifId -> true

function readAllRead(): ReadMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(READ_KEY) || "{}"); } catch { return {}; }
}
function writeAllRead(map: ReadMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT));
  } catch { /* noop */ }
}

function readSetFor(userId: string): Record<string, true> {
  return readAllRead()[userId] ?? {};
}

export function markNotificationRead(userId: string, id: string) {
  const map = readAllRead();
  const set = { ...(map[userId] ?? {}) };
  set[id] = true;
  map[userId] = set;
  writeAllRead(map);
}

export function markAllNotificationsRead(userId: string, ids: string[]) {
  const map = readAllRead();
  const set = { ...(map[userId] ?? {}) };
  for (const id of ids) set[id] = true;
  map[userId] = set;
  writeAllRead(map);
}

// ---------------------------------------------------------------------------
// Derivation — Teacher
// ---------------------------------------------------------------------------
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function teacherNotifications(teacherId: string): Notification[] {
  const out: Notification[] = [];
  const now = Date.now();

  // ---- New sessions assigned (Scheduled / Ready in the future) -----------
  for (const s of loadSessions()) {
    if (s.teacher_id !== teacherId) continue;
    if (s.status !== "scheduled" && s.status !== "ready" && s.status !== "rescheduled") continue;
    if (+new Date(s.date_time) < now) continue;
    out.push({
      id: `session-assigned:${s.id}`,
      kind: "session_assigned",
      title: "New session assigned",
      body: `${fmtDate(s.date_time)} · ${s.duration_minutes} min`,
      createdAt: s.date_time, // no created_at in mock — use scheduled time
      to: "/teacher/calendar",
      read: false,
    });
  }

  // ---- Club "Needs Substitute" that matches this teacher -----------------
  // A Created (no teacher_id) upcoming club is treated as an open substitute
  // opportunity every active teacher qualifies for in the mock model.
  const u = USERS.find((x) => x.id === teacherId);
  const isActive = u ? teacherStatus(u) === "active" : false;
  if (isActive) {
    for (const c of loadClubs()) {
      if (c.teacher_id) continue;
      if (c.status !== "upcoming") continue;
      out.push({
        id: `club-match:${c.id}`,
        kind: "club_substitute_match",
        title: "Club needs a substitute — you qualify",
        body: `${c.title} · ${fmtDate(c.date)}`,
        createdAt: c.date,
        to: "/teacher/clubs",
        read: false,
      });
    }
  }

  // ---- Availability change requests: approved / rejected -----------------
  for (const r of listChangeRequests()) {
    if (r.teacherId !== teacherId) continue;
    if (r.status === "approved" && r.resolvedAt) {
      out.push({
        id: `avail-approved:${r.id}`,
        kind: "avail_request_approved",
        title: "Availability change approved",
        body: r.reason || "Your new weekly availability is now active.",
        createdAt: r.resolvedAt,
        to: "/teacher/availability",
        read: false,
      });
    } else if (r.status === "rejected" && r.resolvedAt) {
      out.push({
        id: `avail-rejected:${r.id}`,
        kind: "avail_request_rejected",
        title: "Availability change rejected",
        body: r.reason || "Your previous availability remains in effect.",
        createdAt: r.resolvedAt,
        to: "/teacher/availability",
        read: false,
      });
    }
  }

  // ---- Club claim confirmed / released (release requests approved) -------
  // Claim confirmation: any club currently assigned to this teacher whose
  // claimed_at timestamp is known — treat as a confirmation notification.
  for (const c of loadClubs()) {
    if (c.teacher_id === teacherId && c.claimed_at) {
      out.push({
        id: `club-claim:${c.id}:${c.claimed_at}`,
        kind: "club_claim_confirmed",
        title: "Club assignment confirmed",
        body: `${c.title} · ${fmtDate(c.date)}`,
        createdAt: c.claimed_at,
        to: "/teacher/clubs",
        read: false,
      });
    }
  }
  // Release: any pending release request this teacher opened.
  for (const r of loadReleaseRequests()) {
    if (r.teacher_id !== teacherId) continue;
    out.push({
      id: `club-release:${r.id}`,
      kind: "club_released",
      title: "Club release request submitted",
      body: r.reason || "Awaiting Admin review.",
      createdAt: r.requested_at,
      to: "/teacher/clubs",
      read: false,
    });
  }

  // ---- Freeze applied ----------------------------------------------------
  if (u && teacherStatus(u) === "frozen") {
    // Anchor createdAt to the most recent strike so the notification is stable
    // across renders (not `Date.now()` — that would keep re-marking as unread).
    const strikes = loadStrikes()
      .filter((s) => s.teacher_id === teacherId)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const anchor = strikes[0]?.created_at ?? new Date().toISOString();
    out.push({
      id: `freeze:${teacherId}:${anchor}`,
      kind: "freeze_applied",
      title: "Your account was frozen",
      body: "Reached 3 unjustified cancellations in the last 6 months.",
      createdAt: anchor,
      to: "/teacher",
      read: false,
    });
  }

  // ---- KPI below threshold / Bonus eligible ------------------------------
  if (u && u.role === "teacher") {
    const k = computeTeacherKpis(u);
    // "Below threshold" uses a fixed operational threshold (70) so the bell
    // doesn't flood every teacher that isn't bonus-eligible.
    const monthKey = new Date().toISOString().slice(0, 7);
    if (k.composite < 70) {
      out.push({
        id: `kpi-below:${teacherId}:${monthKey}`,
        kind: "kpi_below_threshold",
        title: "A KPI dropped below its threshold",
        body: `Composite Score: ${k.composite} / 100.`,
        createdAt: new Date().toISOString(),
        to: "/teacher",
        read: false,
      });
    }
    if (k.bonusEligible) {
      out.push({
        id: `bonus:${teacherId}:${monthKey}`,
        kind: "bonus_eligible",
        title: "Bonus Eligible reached",
        body: `Composite Score: ${k.composite} / 100.`,
        createdAt: new Date().toISOString(),
        to: "/teacher/financial",
        read: false,
      });
    }
  }

  // ---- Announcements (teacher / all audiences) ---------------------------
  for (const a of activeAnnouncements()) {
    if (a.audience !== "all" && a.audience !== "teachers") continue;
    out.push({
      id: `ann:${a.id}`,
      kind: "announcement",
      title: "New announcement",
      body: a.message,
      createdAt: a.published_at,
      to: "/teacher",
      read: false,
    });
  }

  // ---- Students on this teacher's roster picked a Challenge --------------
  // Reuses the ASSIGNMENTS table (same source used by session_assigned) —
  // no new "assigned teacher" field needed.
  const roster = ASSIGNMENTS.filter((a) => a.teacher_id === teacherId).map((a) => a.student_id);
  if (roster.length > 0) {
    const challengeById = new Map(loadChallenges().map((c) => [c.id, c]));
    for (const sid of roster) {
      const st = USERS.find((x) => x.id === sid);
      if (!st) continue;
      for (const pick of st.chosen_challenges ?? []) {
        const ch = challengeById.get(pick.challenge_id);
        if (!ch) continue;
        out.push({
          id: `student-challenge:${sid}:${pick.challenge_id}`,
          kind: "student_challenge_selected",
          title: `${st.name} picked a Challenge`,
          body: `${ch.title}${ch.category ? ` (${ch.category})` : ""}`,
          createdAt: pick.chosen_at,
          to: "/teacher/students",
          read: false,
        });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Derivation — Admin
// ---------------------------------------------------------------------------
function adminNotifications(): Notification[] {
  const out: Notification[] = [];

  // ---- Needs Substitute cases -------------------------------------------
  for (const s of loadSessions()) {
    if (!s.needs_substitute) continue;
    const t = USERS.find((u) => u.id === s.teacher_id);
    out.push({
      id: `needs-sub:${s.id}`,
      kind: "needs_substitute",
      title: "New Needs Substitute case",
      body: `${t?.name ?? "Teacher"} · ${fmtDate(s.date_time)}`,
      createdAt: s.date_time,
      to: "/admin/sessions",
      read: false,
    });
  }

  // ---- New club release requests ----------------------------------------
  const clubsById = new Map(loadClubs().map((c) => [c.id, c]));
  for (const r of loadReleaseRequests()) {
    const c = clubsById.get(r.club_id);
    const t = USERS.find((u) => u.id === r.teacher_id);
    out.push({
      id: `release-req:${r.id}`,
      kind: "release_request",
      title: "New club release request",
      body: `${t?.name ?? "Teacher"} · ${c?.title ?? r.club_id}`,
      createdAt: r.requested_at,
      to: "/admin/clubs",
      read: false,
    });
  }

  // ---- Pending availability change requests -----------------------------
  for (const r of listChangeRequests("pending")) {
    const t = USERS.find((u) => u.id === r.teacherId);
    out.push({
      id: `avail-req:${r.id}`,
      kind: "avail_change_request",
      title: "New availability change request",
      body: `${t?.name ?? "Teacher"}${r.reason ? ` — ${r.reason}` : ""}`,
      createdAt: r.createdAt,
      to: "/admin/teachers",
      read: false,
    });
  }

  // ---- Teacher hit 3 strikes → auto-freeze ------------------------------
  const teachers = USERS.filter((u) => u.role === "teacher");
  for (const t of teachers) {
    if (activeStrikeCount(t.id) < 3) continue;
    const strikes = loadStrikes()
      .filter((s) => s.teacher_id === t.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    const anchor = strikes[0]?.created_at ?? new Date().toISOString();
    out.push({
      id: `three-strikes:${t.id}:${anchor}`,
      kind: "teacher_three_strikes",
      title: "Teacher auto-frozen (3 strikes)",
      body: `${t.name} reached 3 unjustified cancellations.`,
      createdAt: anchor,
      to: "/admin/teachers",
      read: false,
    });
  }

  // ---- Student reports filed by teachers --------------------------------
  for (const r of readStudentReportsRaw()) {
    const t = USERS.find((u) => u.id === r.teacher_id);
    const st = USERS.find((u) => u.id === r.student_id);
    out.push({
      id: `student-report:${r.id}`,
      kind: "student_report_filed",
      title: "New student report filed",
      body: `${t?.name ?? "Teacher"} → ${st?.name ?? "Student"}`,
      createdAt: r.created_at,
      to: "/admin/students",
      read: false,
    });
  }

  // ---- Financial issues reported by teachers ----------------------------
  for (const i of loadFinancialIssues()) {
    const t = USERS.find((u) => u.id === i.teacher_id);
    out.push({
      id: `fin-issue:${i.id}`,
      kind: "financial_issue_reported",
      title: "New financial issue reported",
      body: `${t?.name ?? "Teacher"}${i.text ? ` — ${i.text.slice(0, 80)}` : ""}`,
      createdAt: i.created_at,
      to: "/admin/financial",
      read: false,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function buildNotifications(role: Role, userId: string): Notification[] {
  const raw = role === "admin" ? adminNotifications() : teacherNotifications(userId);
  const readSet = readSetFor(userId);
  return raw
    .map((n) => ({ ...n, read: !!readSet[n.id] }))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

// ---------------------------------------------------------------------------
// React binding — one subscription that listens to every source event.
// ---------------------------------------------------------------------------
const SOURCE_EVENTS = [
  SESSIONS_EVENT, CLUBS_EVENT, RELEASE_REQUESTS_EVENT,
  AVAIL_EVENT, STRIKES_EVENT, ANN_EVENT, NOTIF_EVENT,
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

// Cache the derived array per (role,userId) so getSnapshot returns a stable
// reference between events — useSyncExternalStore compares by identity.
let lastKey = "";
let lastList: Notification[] = [];
let lastTick = 0;

function keyOf(user: User): string { return `${user.role}:${user.id}:${lastTick}`; }

/** React hook: current notification list for the given user. */
export function useNotifications(user: User | null): {
  notifications: Notification[];
  unreadCount: number;
} {
  const snap = useSyncExternalStore(
    (cb) => {
      const wrapped = () => { lastTick++; cb(); };
      return subscribe(wrapped);
    },
    () => {
      if (!user) return [];
      const key = keyOf(user);
      if (key !== lastKey) {
        lastKey = key;
        lastList = buildNotifications(user.role, user.id);
      }
      return lastList;
    },
    () => [],
  );
  const notifications = user ? snap : [];
  const unreadCount = notifications.reduce((n, x) => (x.read ? n : n + 1), 0);
  return { notifications, unreadCount };
}
