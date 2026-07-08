## Scope

Refines (does not replace) the 7-status canon and the group unanimity system already in place. All UI text stays in English, verbatim status strings.

---

## 1. Data model changes (`src/lib/sessions-store.ts`)

Add optional sub-status metadata on `ExtSession`:

```ts
attendance_sub_status?:
  | "absent_work" | "absent_illness" | "absent_vacation"
  | "cancelled_illness" | "cancelled_holiday" | "cancelled_work";
member_sub_statuses?: Record<string, ExtSession["attendance_sub_status"]>;
report_locked?: boolean;         // true once submitSessionReport runs
report_admin_edits?: Array<{     // for post-submit Admin corrections
  at: string; actorId: string;
  studentId?: string;
  from: ExtSessionStatus | string; to: ExtSessionStatus | string;
  note?: string;
}>;
```

Helpers:

- `SUB_STATUS_META` — label + parent (`absent` / `cancelled`) + affects-metrics flag (false for all six).
- `isJustificationWindowOpen(sessionDate)` — true iff `now <= lastDayOfMonth(sessionDate)`.
- `applySubStatus(sessionId, studentId | null, sub, actor)` — writes sub-status, appends to `report_admin_edits` if `report_locked` and actor is admin, blocks otherwise.
- `adminOverrideStatus(...)` — same shape for top-level status corrections after lock.

Refactor `submitSessionReport` / `submitGroupSessionReport` to set `report_locked: true` and accept an optional per-student `sub_status` map for the Absent rows.

## 2. Unanimity refinement (`src/lib/sessions-store.ts` + `student-requests-store.ts`)

Current `applyGroupMemberCancellation` treats `cancelled` OR `pending_reschedule` as "member left" — that made a mixed roster count as unanimous. Fix: unanimity is **literal**, only when every active roster member picks the **same** action.

New helper `evaluateGroupUnanimity(session)`:

- Counts per action across `member_statuses`.
- All-cancelled → top-level `status = "cancelled"`, log `group_session_auto_cancelled` (unanimous cancel).
- All-pending-reschedule → keep top-level status but flag `unanimous_reschedule: true` so `student-requests-store` can wire a single group Reschedule Request instead of N individuals (existing code path; we just gate on this flag).
- Mixed / partial → top-level stays `scheduled`; any member marked `cancelled` gets sub-status `null` and — when the session date passes without them attending — the Session Report's default row for that student is `Absent` (the spec's "auto-Absent if unanimity fails"). Teacher can then reclassify.

Wire both `applyGroupMemberCancellation` and the reschedule-request path (`addStudentRequest` for `kind: "reschedule"` on a group session) to call `evaluateGroupUnanimity` after mutation.

## 3. Session Report modal (Teacher Panel)

File search-scope: `src/components/verbo/` (SessionReport modal — need to open it), plus teacher.calendar.tsx / teacher.students.tsx entry points.

Changes:

- For each row where attendance is `absent`, show a sub-status `<select>` with: **Absent**, **Absent Work**, **Absent Illness**, **Absent Vacation**.
- For rows where the row is `cancelled` (only reachable when the top-level session is Cancelled and the teacher is retro-annotating): sub-status `<select>` with **Cancelled**, **Cancelled Illness**, **Cancelled Holiday**, **Cancelled Work**.
- Sub-status selects are disabled if `!isJustificationWindowOpen(session.date_time)` and current sub-status is not already set (block *changes* to justifications past month end).
- On Submit → sets `report_locked = true`; the entire form re-renders read-only for teacher role.
- If already locked and viewer role is teacher: read-only banner "Session Report submitted. Only Admin can amend."
- If viewer is Admin: full edit stays enabled, and each change appends an entry to `report_admin_edits` (logged in Activity Logs).

Frequent-Illness flag: after submit, if the same student has ≥3 sessions with `attendance_sub_status === "absent_illness"` in the current calendar period (rolling 30 days), append synthetic Activity Log entry `student_flagged_illness` via a derivation in `activity-logs-store.ts` (no new persistence — computed in `buildActivityLog`).

## 4. Admin Panel — Holidays + Corrections

**Holidays store** (`src/lib/holidays-store.ts`, new):
- `Holiday = { id, date: "YYYY-MM-DD", label, created_at }`.
- Persist to `localStorage: "verbo:holidays"`, broadcast `HOLIDAYS_EVENT`.
- `loadHolidays()`, `addHoliday()`, `removeHoliday()`, `useHolidays()`.

**Route** `src/routes/admin.holidays.tsx`: table with add (date + label) / delete. Reference-only, no automatic blocking. Link from admin nav.

**Corrections logging** (`src/lib/activity-logs-store.ts`):
- New `ActivityKind` values: `session_report_amended`, `student_flagged_illness`.
- Emit one entry per `report_admin_edits[]` element with detail "Status X → Y by {admin}".

## 5. Calendar coloring (`src/lib/calendar-events.ts` + `CalendarView.tsx`)

Add to `CalendarEvent`:
- `sub_status?: SubStatus`  (piped from the session or, for group events, from `member_sub_statuses[studentId]` in `studentCalendarEvents`).

Extend `CALENDAR_STATUS_META` with palette variants (used only by pill renderer, not the 7-status legend):

| Sub | Color | Cell label |
|-----|-------|------------|
| Absent (plain) | `#dc2626` | "Absent" |
| Absent Work / Illness / Vacation | `#ea580c` (orange-red, same for the three) | "AW" / "AI" / "AV" |
| Cancelled (plain) | `#64748B` (slate blue-gray) | "Cancelled" |
| Cancelled Illness / Holiday / Work | `#94a3b8` (lighter slate, same for the three) | "CI" / "CH" / "CW" |

Note: current Cancelled color is pink `#be185d`. Reassigning it to `#64748B` and simultaneously verifying `scheduled` (`#94a3b8`) stays visually distinct — since the lighter Cancelled variant collides with Scheduled's exact hex, use `#cbd5e1` (slate-300) for the justified-cancelled tint instead. Legend keeps the 7 canonical entries; sub-status is a pill-only refinement.

Update `EventPill` and `DayList` badge renderer:
- If `sub_status` set, replace the short kind label with the 2-letter code and use the sub-status color instead of the base status color.
- Modal (`EventDetailsModal`) already shows full status text — extend `Row label="Status"` to show `"{statusLabel} · {subStatusLabel}"` when sub is set.

## 6. Files touched

New:
- `src/lib/holidays-store.ts`
- `src/routes/admin.holidays.tsx`

Edited:
- `src/lib/sessions-store.ts` — sub-statuses, unanimity fix, report_lock, admin overrides
- `src/lib/student-requests-store.ts` — call `evaluateGroupUnanimity` on reschedule-of-group-member
- `src/lib/calendar-events.ts` — sub_status projection + palette
- `src/components/verbo/CalendarView.tsx` — pill rendering with initials
- `src/components/verbo/SessionReportModal` (whichever file owns it — will identify) — sub-status selects, lock behavior, admin-only edits
- `src/lib/activity-logs-store.ts` — new kinds (amended, flagged_illness)
- `src/routes/admin.tsx` (nav) — add Holidays link
- `src/routes/student.sessions.tsx` — pass sub-status into event details modal (no logic change)

## Out of scope

- Substitute engine.
- Per-role permission wiring beyond Admin vs Teacher (uses existing `useAuth().user.role`).
- Automatic reversal of `Absent Vacation` — Admin edits manually via override.
