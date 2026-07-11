// Student > Live Sessions.
//
// Reuses the same CalendarView + calendar-events adapter used by the Teacher
// Panel (see teacher.calendar.tsx). The student sees their own 1:1 sessions
// plus Insights / Book Clubs / Spotlights. Focus Workshops live on a separate
// route for workshop-only students.
//
// The 4-branch "Can't Attend" flow is driven by the student's Reschedule
// Policy (parseReschedulePolicy → notice hours + monthly cap %).
//   a) inside the notice window  → Late Cancellation Warning (Absent).
//   b) enough notice, quota used → Late Cancellation Warning with
//      "You've used all the reschedules allowed by your plan this cycle."
//   c) enough notice + quota OK  → Session Cancellation modal with two
//      actions: Reschedule (opens Reschedule Request flow) or
//      Cancel Without Rescheduling.
//   d) Groups: strict unanimity — a member's decision only affects THEIR
//      `member_statuses[studentId]` and always counts against their monthly
//      quota. The class keeps running for the remaining members. The session
//      only auto-cancels top-level when every roster member has cancelled or
//      requested a reschedule (handled inside `applyGroupMemberCancellation`).
//
// The Spotlight Session flow ("Request a Spotlight Session") is a separate
// modal chain: explainer (5s Understood delay) → slot picker + context text
// → publish as a Spotlight Request (or convert an overlapping regular session
// into "Converted to Spotlight" if the picked slot already has one).

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { USERS, userById } from "@/lib/mock-data";
import {
  loadSessions, subscribeSessions, updateSession, applyGroupMemberCancellation,
  SUB_STATUS_META,
  type ExtSession, type ExtSessionStatus,
} from "@/lib/sessions-store";
import { CalendarView } from "@/components/verbo/CalendarView";
import {
  studentCalendarEvents, CALENDAR_STATUS_META, EVENT_KIND_META,
  type CalendarEvent, type CalendarEventKind,
} from "@/lib/calendar-events";
import { Card, PrimaryButton, GhostButton } from "@/components/verbo/ui";
import { X, Video, AlertTriangle, Sparkles, CalendarClock, Users as UsersIcon } from "lucide-react";
import {
  addStudentRequest,
  convertSessionToSpotlight,
  parseReschedulePolicy,
  reschedulesUsedThisMonth,
  rescheduleQuota,
} from "@/lib/student-requests-store";
import { isTeacherAvailableAt, findAvailableStartSlots } from "@/lib/availability-store";
import { ClubReservationModal } from "@/components/verbo/ClubReservationModal";
import type { Club } from "@/lib/clubs-store";
import { resolvedRemainingSeats, resolvedMonthlyCap } from "@/lib/club-bookings-store";
import { useCoreFreemiumGate } from "@/components/verbo/CoreFreemiumFlow";
import { isSilenced } from "@/lib/core-freemium-store";



export const Route = createFileRoute("/student/sessions")({ component: Page });

const ALL_STUDENT_KINDS: CalendarEventKind[] = ["class", "insight", "book_club", "spotlight"];


function fmtDT(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 36e5;
}

function Page() {
  const { user } = useAuth();
  const [, tick] = useState(0);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [cantAttendFor, setCantAttendFor] = useState<ExtSession | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<ExtSession | null>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [clubModal, setClubModal] = useState<Club | null>(null);

  useEffect(() => subscribeSessions(() => tick((n) => n + 1)), []);


  const events = useMemo<CalendarEvent[]>(() => {
    if (!user) return [];
    return studentCalendarEvents(user.id, {
      teacherNameOf: (id) => userById(id)?.name,
    });
  }, [user]);

  if (!user) return null;

  const policy = parseReschedulePolicy(user);
  const quota = rescheduleQuota(user);
  const used = reschedulesUsedThisMonth(user.id);
  const isSignature = user.access_plan === "Signature";
  const isCore = user.access_plan === "Core";
  const spotlightCapNum = resolvedMonthlyCap(user.id, "spotlight");
  const spotlightCapDisplay = isSignature ? "∞" : String(spotlightCapNum);
  const spotlightVisible = isSignature || spotlightCapNum > 0;

  // Dynamic kinds — for Advance/Elite/Signature, only include a consumable
  // kind when the student has effective access to it. Core keeps all three
  // visible while their freemium credit is live, and each type gets removed
  // once the student silences it (Modal 3). "class" is always included.
  const insightSilenced = isCore && isSilenced(user.id, "insight");
  const bookSilenced = isCore && isSilenced(user.id, "book");
  const spotSilenced = isCore && isSilenced(user.id, "spotlight");
  const studentKinds: CalendarEventKind[] = ["class"];
  const hasInsight = isCore ? !insightSilenced : (isSignature || resolvedRemainingSeats(user.id, "insight") > 0 || resolvedMonthlyCap(user.id, "insight") > 0);
  const hasBook = isCore ? !bookSilenced : (isSignature || resolvedRemainingSeats(user.id, "book") > 0 || resolvedMonthlyCap(user.id, "book") > 0);
  const hasSpot = isCore ? !spotSilenced : (isSignature || spotlightCapNum > 0);
  if (hasInsight) studentKinds.push("insight");
  if (hasBook) studentKinds.push("book_club");
  if (hasSpot) studentKinds.push("spotlight");

  const freemium = useCoreFreemiumGate(user);

  const handleEventClick = (ev: CalendarEvent) => {
    if (ev.club && (ev.kind === "insight" || ev.kind === "book_club")) {
      const club = ev.club;
      const kind = ev.kind === "book_club" ? "book" : "insight";
      freemium.tryOpen(kind, () => setClubModal(club));
      return;
    }
    setSelected(ev);
  };



  const onCantAttend = (session: ExtSession) => {
    setSelected(null);
    setCantAttendFor(session);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Sessions</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Your calendar of 1:1 Classes, Verbo Insights, Book Clubs and Spotlight Sessions.
          </p>
        </div>
        {hasSpot && (
          <button
            onClick={() => freemium.tryOpen("spotlight", () => setSpotlightOpen(true))}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0d9488] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" /> Request a Spotlight Session
          </button>
        )}
      </div>


      <Card>
        <CalendarView
          events={events}
          onEventClick={handleEventClick}
          availableKinds={studentKinds}
        />
      </Card>

      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">Reschedule Policy:</span> {policy.noticeHours}h notice, up to {policy.maxPct}% of monthly sessions
          </div>
          <div className="text-muted-foreground">
            Used this cycle: <span className="font-semibold text-foreground">{used}/{quota}</span>
          </div>
          {spotlightVisible && (
            <div className="text-muted-foreground">
              Spotlight cap: <span className="font-semibold text-foreground">{spotlightCapDisplay}/month</span>
            </div>
          )}
        </div>
      </Card>


      {selected && (
        <EventDetailsModal
          event={selected}
          onClose={() => setSelected(null)}
          onCantAttend={(s) => onCantAttend(s)}
        />
      )}

      {cantAttendFor && (
        <CantAttendRouter
          session={cantAttendFor}
          user={user}
          onClose={() => setCantAttendFor(null)}
          onReschedule={() => { const s = cantAttendFor; setCantAttendFor(null); setRescheduleFor(s); }}
        />
      )}

      {rescheduleFor && (
        <RescheduleRequestModal
          session={rescheduleFor}
          onClose={() => setRescheduleFor(null)}
        />
      )}

      {spotlightOpen && (
        <SpotlightRequestFlow
          studentId={user.id}
          onClose={() => setSpotlightOpen(false)}
        />
      )}

      {clubModal && (
        <ClubReservationModal
          club={clubModal}
          studentId={user.id}
          onClose={() => setClubModal(null)}
        />
      )}

      {freemium.node}

    </div>

  );
}

// ---------------------------------------------------------------------------
// Session details modal — student view.
// Logistics only (no Lesson Plan surface here).
// ---------------------------------------------------------------------------
function EventDetailsModal({
  event, onClose, onCantAttend,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onCantAttend: (session: ExtSession) => void;
}) {
  const isClass = event.kind === "class";
  const session = event.session;
  const teacherName = session ? userById(session.teacher_id)?.name : undefined;
  const status = event.status as ExtSessionStatus | undefined;
  const statusMeta = status ? CALENDAR_STATUS_META[status] : null;
  const kindMeta = EVENT_KIND_META[event.kind];
  const canAct =
    isClass && session &&
    (status === "scheduled" || status === "ready" || status === "rescheduled");
  const connect = () => {
    if (session?.teams_link) window.open(session.teams_link, "_blank");
  };
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white" style={{ background: kindMeta.color }}>
            {kindMeta.label}
          </span>
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {isClass && teacherName ? `Session with ${teacherName}` : event.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmtDT(event.date)} · {event.duration_minutes} min
        </p>

        {isClass && session && (
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Teacher" value={teacherName ?? "—"} />
            <Row
              label="Status"
              value={
                session.attendance_sub_status
                  ? `${statusMeta?.label ?? ""} · ${SUB_STATUS_META[session.attendance_sub_status].label}`.trim().replace(/^·\s*/, "")
                  : (statusMeta?.label ?? "—")
              }
              accent={
                session.attendance_sub_status
                  ? SUB_STATUS_META[session.attendance_sub_status].color
                  : statusMeta?.color
              }
            />
            {session.teams_link && <Row label="Video Call" value="Ready" />}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {canAct ? (
            <>
              <PrimaryButton className="flex-1" onClick={connect}>
                <Video className="h-4 w-4" /> Connect
              </PrimaryButton>
              <GhostButton className="flex-1" onClick={() => session && onCantAttend(session)}>
                Can't Attend
              </GhostButton>
            </>
          ) : (
            <GhostButton className="w-full" onClick={onClose}>Close</GhostButton>
          )}
        </div>
      </div>
    </div>
  );
}
function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Can't Attend router — evaluates the 4 branches and shows the right modal.
// ---------------------------------------------------------------------------
function CantAttendRouter({
  session, user, onClose, onReschedule,
}: {
  session: ExtSession;
  user: { id: string; sessions_per_week?: number; reschedule_policy?: string; reschedule_custom_hours?: number; reschedule_custom_pct?: number };
  onClose: () => void;
  onReschedule: () => void;
}) {
  const policy = parseReschedulePolicy(user);
  const quota = rescheduleQuota(user);
  const used = reschedulesUsedThisMonth(user.id);
  const hours = hoursUntil(session.date_time);
  const insideLateWindow = hours < policy.noticeHours;
  const quotaExhausted = used >= quota;
  const isGroup = Boolean(session.group_id);

  // For groups, "Absent" is recorded per-member (top-level stays scheduled
  // unless the whole roster is out). For 1:1, top-level flips to Absent.
  const confirmAbsent = () => {
    if (isGroup) {
      const nextMemberStatuses = { ...(session.member_statuses ?? {}), [user.id]: "absent" as ExtSessionStatus };
      updateSession(session.id, { member_statuses: nextMemberStatuses });
      toast("You've been marked Absent. The session continues for the other members.");
    } else {
      updateSession(session.id, { status: "absent" });
      toast("Session marked as Absent.");
    }
    onClose();
  };
  const confirmCancelNoReschedule = () => {
    if (isGroup) {
      const res = applyGroupMemberCancellation(session.id, user.id, "cancelled");
      toast(
        res.outcome.kind === "unanimous_cancel"
          ? "All members cancelled — the group session has been cancelled."
          : "You've cancelled this group session. Credit forfeited. The class continues for the remaining members.",
      );
    } else {
      updateSession(session.id, { status: "cancelled" });
      toast("Session cancelled. Credit forfeited.");
    }
    onClose();
  };

  if (insideLateWindow) {
    return (
      <LateCancellationModal
        firstLine={
          isGroup
            ? "Cancellation received with less than the notice required by your plan. You'll be marked Absent for this group session. The class continues for the remaining members. No reschedule is available."
            : "Cancellation received with less than the notice required by your plan. The session will be marked as Absent and forfeited. No reschedule is available."
        }
        onClose={onClose}
        onConfirm={confirmAbsent}
      />
    );
  }
  if (quotaExhausted) {
    return (
      <LateCancellationModal
        firstLine={
          isGroup
            ? "You've used all the reschedules allowed by your plan this cycle. You'll be marked Absent for this group session. The class continues for the remaining members. No reschedule is available."
            : "You've used all the reschedules allowed by your plan this cycle. The session will be marked as Absent and forfeited. No reschedule is available."
        }
        onClose={onClose}
        onConfirm={confirmAbsent}
      />
    );
  }
  return (
    <SessionCancellationModal
      policy={policy}
      quota={quota}
      used={used}
      isGroup={isGroup}
      onClose={onClose}
      onReschedule={onReschedule}
      onCancelNoReschedule={confirmCancelNoReschedule}
    />
  );
}


function LateCancellationModal({
  firstLine, onClose, onConfirm,
}: { firstLine: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-card p-6 ring-1 ring-red-200"
        style={{ boxShadow: "0 10px 30px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.1)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Late Cancellation Warning!</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{firstLine}</p>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 cursor-pointer rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-soft transition-opacity hover:opacity-90">
            Go Back
          </button>
          <button onClick={onConfirm} className="flex-1 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-90">
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionCancellationModal({
  policy, quota, used, isGroup, onClose, onReschedule, onCancelNoReschedule,
}: {
  policy: { noticeHours: number; maxPct: number };
  quota: number;
  used: number;
  isGroup?: boolean;
  onClose: () => void;
  onReschedule: () => void;
  onCancelNoReschedule: () => void;
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <h3 className="text-lg font-semibold tracking-tight" style={{ color: "#01304a" }}>Session Cancellation</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your membership allows you to cancel or reschedule up to <strong>{policy.maxPct}%</strong> of
          your booked sessions without penalty. You've used <strong>{used} of {quota}</strong> reschedules this cycle.
        </p>
        {isGroup && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            This is a group session. Your decision only affects your seat and counts against your monthly quota — the class will continue for the remaining members unless every member opts out.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onReschedule}
            className="w-full cursor-pointer rounded-lg bg-[#f38934] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Reschedule
          </button>
          <GhostButton className="w-full justify-center" onClick={onCancelNoReschedule}>
            Cancel Without Rescheduling
          </GhostButton>
          <GhostButton className="w-full justify-center" onClick={onClose}>
            Return
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reschedule Request — pick a new slot backed by ANY qualified teacher's
// declared availability with ≥24h notice.
// ---------------------------------------------------------------------------
function todayYMD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fmtSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Grid of valid :00 / :30 start times for the chosen date. Selecting a slot
 *  writes the ISO datetime; students can't type an arbitrary minute. */
function SlotPickerGrid({
  dateYMD, durationMin, qualifiedTeacherIds, selectedISO, onSelect,
}: {
  dateYMD: string;
  durationMin: number;
  qualifiedTeacherIds: string[];
  selectedISO: string;
  onSelect: (iso: string) => void;
}) {
  const slots = useMemo(
    () => findAvailableStartSlots({ dateYMD, durationMin, qualifiedTeacherIds }),
    [dateYMD, durationMin, qualifiedTeacherIds],
  );
  if (slots.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-input bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
        No available start times on this date. Try another day.
      </div>
    );
  }
  return (
    <div className="mt-2 grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
      {slots.map((iso) => {
        const active = iso === selectedISO;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelect(iso)}
            className={`cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium ring-1 transition-colors ${
              active
                ? "bg-[#01304a] text-white ring-[#01304a]"
                : "bg-background text-foreground ring-input hover:bg-secondary"
            }`}
          >
            {fmtSlotTime(iso)}
          </button>
        );
      })}
    </div>
  );
}

function RescheduleRequestModal({ session, onClose }: { session: ExtSession; onClose: () => void }) {
  const { user } = useAuth();
  const [dateYMD, setDateYMD] = useState<string>(todayYMD());
  const [slotISO, setSlotISO] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const isGroup = Boolean(session.group_id);
  const actingStudentId = isGroup && user ? user.id : session.student_id;
  const studentUser = userById(actingStudentId);
  const product = studentUser?.product;
  // Duration for the reschedule ALWAYS inherits from the student's profile
  // (Access Plan defines the allowed values; Admin fixed one on registration).
  // Fall back to the original session's duration only if the profile is
  // missing that field, and finally to 60min.
  const durationMin = studentUser?.session_duration ?? session.duration_minutes ?? 60;

  const qualifiedTeachers = useMemo(() => {
    return USERS.filter((u) => u.role === "teacher" && u.teacher_status === "active"
      && (!product || (u.qualified_products ?? []).includes(product)));
  }, [product]);
  const qualifiedIds = useMemo(() => qualifiedTeachers.map((t) => t.id), [qualifiedTeachers]);

  const submit = () => {
    if (!slotISO) { setError("Pick one of the available start times."); return; }
    const stillOk = qualifiedIds.some((tid) => isTeacherAvailableAt(tid, slotISO, durationMin));
    if (!stillOk) { setError("That slot is no longer available. Please pick another."); return; }
    addStudentRequest({
      kind: "reschedule",
      student_id: actingStudentId,
      assigned_teacher_id: session.teacher_id,
      origin_session_id: session.id,
      proposed_datetime: slotISO,
      duration_minutes: durationMin,
    });
    if (isGroup) {
      const res = applyGroupMemberCancellation(session.id, actingStudentId, "pending_reschedule");
      toast.success(
        res.outcome.kind === "unanimous_reschedule"
          ? "All members requested a reschedule — the group session will be moved."
          : "Reschedule Request published. The group session continues for the remaining members.",
      );
    } else {
      updateSession(session.id, { status: "pending_reschedule" });
      toast.success("Reschedule Request published. Teachers have been notified.");
    }
    onClose();
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-4 w-4" /></button>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" />
          <h3 className="text-base font-semibold text-foreground">Reschedule Request</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pick one of the available start times. Duration is fixed at <strong>{durationMin} min</strong> (from your plan). Start times are on the hour or half hour, and require at least 24h notice.
        </p>
        <div className="mt-4">
          <label className="text-xs font-medium text-foreground">Date</label>
          <input
            type="date"
            value={dateYMD}
            min={todayYMD()}
            onChange={(e) => { setDateYMD(e.target.value); setSlotISO(""); setError(null); }}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-foreground">Available start times</label>
          <SlotPickerGrid
            dateYMD={dateYMD}
            durationMin={durationMin}
            qualifiedTeacherIds={qualifiedIds}
            selectedISO={slotISO}
            onSelect={(iso) => { setSlotISO(iso); setError(null); }}
          />
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={onClose}>Return</GhostButton>
          <PrimaryButton onClick={submit}>Publish Request</PrimaryButton>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Spotlight Request flow — explainer (5s Understood delay) → slot + context.
// Special case: if the picked slot exactly matches an existing regular 1:1
// with the student's own teacher, we convert instead of claiming.
// ---------------------------------------------------------------------------
function SpotlightRequestFlow({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [step, setStep] = useState<"explain" | "form">("explain");
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (step !== "explain") return;
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [step, secondsLeft]);

  if (step === "explain") {
    return (
      <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
          <div className="flex items-center gap-2 text-[#0d9488]">
            <Sparkles className="h-5 w-5" />
            <h3 className="text-base font-semibold text-foreground">What is a Spotlight Session?</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A Spotlight Session is an additional 1:1 session of up to 60 minutes with any available qualified teacher on the platform. Use it to work on a specific challenge — a presentation coming up, a mock interview, a difficult negotiation, a document review — outside your regular schedule.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You'll describe what you need in the next step so the teacher who claims it can arrive prepared.
          </p>
          <div className="mt-6 flex justify-end">
            <button
              disabled={secondsLeft > 0}
              onClick={() => setStep("form")}
              className="cursor-pointer rounded-lg bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {secondsLeft > 0 ? `Understood (${secondsLeft})` : "Understood"}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <SpotlightFormModal studentId={studentId} onClose={onClose} />;
}

function SpotlightFormModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [dateYMD, setDateYMD] = useState<string>(todayYMD());
  const [slotISO, setSlotISO] = useState<string>("");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOverlap, setConfirmOverlap] = useState<{ session: ExtSession; iso: string } | null>(null);

  // Spotlight duration is ALWAYS 60 minutes, regardless of the student's
  // regular session_duration.
  const SPOTLIGHT_DURATION = 60;
  const studentUser = userById(studentId);
  const product = studentUser?.product;
  const qualifiedIds = useMemo(
    () => USERS.filter((u) => u.role === "teacher" && u.teacher_status === "active"
      && (!product || (u.qualified_products ?? []).includes(product)))
      .map((t) => t.id),
    [product],
  );

  const submit = () => {
    if (!slotISO) { setError("Pick one of the available start times."); return; }
    if (context.trim().length === 0) { setError("Please describe what you need for your Spotlight."); return; }
    // Overlap check with an existing regular 1:1 for this student at the
    // exact same start.
    const overlap = loadSessions().find((s) =>
      s.student_id === studentId &&
      !s.origin && // regular 1:1
      s.status !== "completed" && s.status !== "absent" && s.status !== "cancelled" &&
      +new Date(s.date_time) === +new Date(slotISO),
    );
    if (overlap) {
      setConfirmOverlap({ session: overlap, iso: slotISO });
      return;
    }
    publishSpotlightRequest(slotISO, context);
  };

  const publishSpotlightRequest = (iso: string, ctx: string) => {
    addStudentRequest({
      kind: "spotlight",
      student_id: studentId,
      assigned_teacher_id: undefined,
      proposed_datetime: iso,
      duration_minutes: SPOTLIGHT_DURATION,
      spotlight_context: ctx.trim(),
      last_report_summary: studentUser ? `Level ${studentUser.current_level ?? "—"}` : undefined,
    });
    toast.success("Spotlight Request published. Teachers have been notified.");
    onClose();
  };


  if (confirmOverlap) {
    const teacherName = userById(confirmOverlap.session.teacher_id)?.name ?? "your teacher";
    const overlapIso = confirmOverlap.iso;
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
          <h3 className="text-base font-semibold text-foreground">Overlaps with an existing class</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            This overlaps with your already-scheduled class with <strong>{teacherName}</strong> at that time — would you like to replace it with this Spotlight instead?
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The original session will change to <strong>Converted to Spotlight</strong>. It won't count as a cancellation or a strike, and the credit is returned to your Hired / Remaining Sessions.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <GhostButton onClick={() => setConfirmOverlap(null)}>Return</GhostButton>
            <PrimaryButton onClick={() => {
              convertSessionToSpotlight({
                originalSessionId: confirmOverlap.session.id,
                spotlightContext: context.trim(),
              });
              // Refund remaining_sessions (as if never scheduled).
              const u = USERS.find((x) => x.id === studentId);
              if (u && typeof u.remaining_sessions === "number") u.remaining_sessions += 1;
              toast.success("Session replaced with a Spotlight in the same slot.");
              onClose();
              void overlapIso;
            }}>
              Replace with Spotlight
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-4 w-4" /></button>
        <div className="flex items-center gap-2 text-[#0d9488]">
          <Sparkles className="h-5 w-5" />
          <h3 className="text-base font-semibold text-foreground">Request a Spotlight Session</h3>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pick one of the available start times. Spotlight sessions are always <strong>60 min</strong>, and require at least 24h notice.
        </p>
        <div className="mt-4">
          <label className="text-xs font-medium text-foreground">Date</label>
          <input
            type="date"
            value={dateYMD}
            min={todayYMD()}
            onChange={(e) => { setDateYMD(e.target.value); setSlotISO(""); setError(null); }}
            className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-3">
          <label className="text-xs font-medium text-foreground">Available start times</label>
          <SlotPickerGrid
            dateYMD={dateYMD}
            durationMin={SPOTLIGHT_DURATION}
            qualifiedTeacherIds={qualifiedIds}
            selectedISO={slotISO}
            onSelect={(iso) => { setSlotISO(iso); setError(null); }}
          />
        </div>
        <div className="mt-4">
          <label className="text-xs font-medium text-foreground">What do you need this Spotlight for? <span className="text-destructive">*</span></label>
          <textarea
            value={context}
            onChange={(e) => { setContext(e.target.value); setError(null); }}
            rows={4}
            placeholder="e.g. Prepare for a Q&A with our US investors next week — focus on hedging language and confident pushback."
            className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={onClose}>Return</GhostButton>
          <PrimaryButton onClick={submit}>Publish Request</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// Ensures the UsersIcon import is referenced (linter placation for tree-shake).
void UsersIcon;
