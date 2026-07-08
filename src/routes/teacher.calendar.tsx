import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, FileEdit, Video, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { userById } from "@/lib/mock-data";
import { Card, GhostButton, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { loadLevels, subscribeLevels } from "@/lib/courses-store";
import type { Level } from "@/lib/mock-data";
import {
  loadLessonPlans, saveLessonPlan, subscribeLessonPlans, type LessonPlan,
} from "@/lib/lesson-plans-store";
import {
  loadSessions, subscribeSessions, updateSession, type ExtSession,
} from "@/lib/sessions-store";
import { PlanModal } from "@/components/verbo/PlanModal";
import { CalendarView } from "@/components/verbo/CalendarView";
import {
  teacherCalendarEvents, CALENDAR_STATUS_META, EVENT_KIND_META,
  type CalendarEvent,
} from "@/lib/calendar-events";
import { WORKSHOPS_KEY, loadWorkshops } from "@/lib/workshops-store";
import { SessionDetailsModal } from "@/components/verbo/SessionDetailsModal";
import { CantAttendModal } from "@/components/verbo/CantAttendModal";
import { subscribeStrikes } from "@/lib/strikes-store";
import { addReleaseRequest, type Club } from "@/lib/clubs-store";
import { ClubReportModal, type ClubReportEventInput } from "@/components/verbo/ClubReportModal";
import { getClubReport, subscribeClubReports } from "@/lib/club-reports-store";

export const Route = createFileRoute("/teacher/calendar")({ component: Page });

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<ExtSession[]>([]);
  const [plans, setPlans] = useState<Record<string, LessonPlan>>({});
  const [levels, setLevels] = useState<Level[]>([]);
  const [planning, setPlanning] = useState<ExtSession | null>(null);
  const [detailsFor, setDetailsFor] = useState<{ session: ExtSession; mode: "ready" | "completed"; title: string } | null>(null);
  const [cancelling, setCancelling] = useState<ExtSession | null>(null);
  const [clubModal, setClubModal] = useState<Club | null>(null);
  const [releaseFor, setReleaseFor] = useState<Club | null>(null);
  const [reportingClub, setReportingClub] = useState<ClubReportEventInput | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setSessions(loadSessions());
    setPlans(loadLessonPlans());
    setLevels(loadLevels());
    const u1 = subscribeSessions(() => setSessions(loadSessions()));
    const u2 = subscribeLessonPlans(() => setPlans(loadLessonPlans()));
    const u3 = subscribeLevels(() => setLevels(loadLevels()));
    const u4 = subscribeStrikes(() => tick((n) => n + 1));
    const u5 = subscribeClubReports(() => tick((n) => n + 1));
    const onWorkshops = (e: StorageEvent) => { if (e.key === WORKSHOPS_KEY) tick((n) => n + 1); };
    if (typeof window !== "undefined") window.addEventListener("storage", onWorkshops);
    return () => { u1(); u2(); u3(); u4(); u5(); if (typeof window !== "undefined") window.removeEventListener("storage", onWorkshops); };
  }, []);

  // Build calendar events (classes + workshops + clubs) via the shared adapter.
  const events: CalendarEvent[] = useMemo(() => {
    if (!user) return [];
    const templates = loadWorkshops();
    const cohortName = (cohortId: string): string => {
      for (const t of templates) {
        const c = t.cohorts.find((c) => c.id === cohortId);
        if (c) return `${t.name} · ${c.name}`;
      }
      return "Workshop";
    };
    return teacherCalendarEvents(user.id, {
      studentNameOf: (id) => userById(id)?.name,
      cohortNameOf: cohortName,
    });
  }, [user, sessions, plans]);

  // Active list: upcoming Scheduled/Ready class or workshop sessions only
  // (Session Report submission removes them; the calendar dot remains.).
  const upcoming = useMemo(
    () => events
      .filter((e) =>
        (e.kind === "class" || e.kind === "workshop") &&
        (e.status === "scheduled" || e.status === "ready" || e.status === "rescheduled") &&
        +new Date(e.date) >= Date.now() - 60 * 60_000,
      )
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      .slice(0, 4),
    [events],
  );

  const handleEventClick = (ev: CalendarEvent) => {
    // Clubs — quick modal (Join Club / Can't Attend).
    if (ev.kind === "insight" || ev.kind === "book_club") {
      const end = +new Date(ev.date) + ev.duration_minutes * 60_000;
      const alreadyReported = !!getClubReport(ev.id);
      const canReport = end <= Date.now() && !alreadyReported && ev.status !== "cancelled";
      if (canReport) {
        setReportingClub({
          id: ev.id,
          type: ev.kind === "book_club" ? "book" : "insight",
          title: ev.title,
          date: ev.date,
          enrolled_names: ev.enrolled_names ?? [],
        });
      } else if (ev.club) {
        setClubModal(ev.club);
      }
      return;
    }
    if (ev.kind === "spotlight") {
      const end = +new Date(ev.date) + ev.duration_minutes * 60_000;
      if (end <= Date.now() && !getClubReport(ev.id)) {
        setReportingClub({
          id: ev.id,
          type: "spotlight",
          title: ev.title,
          date: ev.date,
          enrolled_names: ev.enrolled_names ?? [],
        });
      }
      return;
    }

    if (!ev.session) return;
    const s = ev.session;
    if (s.status === "completed") {
      setDetailsFor({ session: s, mode: "completed", title: ev.title });
      return;
    }
    if (s.status === "ready") {
      setDetailsFor({ session: s, mode: "ready", title: ev.title });
      return;
    }
    if (s.status === "absent" || s.status === "no_show" || s.status === "cancelled") return;
    // Scheduled → open Lesson Plan modal to move to Ready.
    setPlanning(s);
  };

  const handleSavePlan = (plan: LessonPlan) => {
    saveLessonPlan(plan);
    updateSession(plan.session_id, { status: "ready" });
    setPlans((prev) => ({ ...prev, [plan.session_id]: plan }));
    setPlanning(null);
  };

  const goReport = (sessionId: string) => {
    // The Session Report modal lives on the dashboard's actionable list;
    // deep-link there so the same shared flow handles it.
    navigate({ to: "/teacher", search: { report: sessionId } as never });
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          All of your assigned events in one place: Performance Sessions, Focus Workshops,
          Verbo Insights, Book Clubs and Spotlight Sessions. Click a Scheduled session to plan it.
        </p>
      </div>

      <Card>
        <CalendarView events={events} onEventClick={handleEventClick} />
      </Card>

      <div>
        <SectionTitle>Upcoming Sessions</SectionTitle>
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <Card><p className="text-sm text-muted-foreground">No upcoming sessions on your calendar.</p></Card>
          )}
          {upcoming.map((ev) => {
            const statusKey = ((ev.status ?? "scheduled") as keyof typeof CALENDAR_STATUS_META);
            const meta = CALENDAR_STATUS_META[statusKey] ?? CALENDAR_STATUS_META.scheduled;
            const kindMeta = EVENT_KIND_META[ev.kind];
            const ended = ev.session ? +new Date(ev.date) + ev.session.duration_minutes * 60_000 <= Date.now() : false;
            return (
              <Card key={ev.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {ev.title}
                      <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: kindMeta.color }}>
                        {kindMeta.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDateTime(ev.date)}{ev.subtitle ? ` · ${ev.subtitle}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: meta.color }}>
                    {meta.label}
                  </span>
                  {ev.session && ended && ev.status === "ready" ? (
                    <PrimaryButton onClick={() => goReport(ev.session!.id)} className="cursor-pointer">
                      <FileEdit className="h-4 w-4" /> Fill Session Report
                    </PrimaryButton>
                  ) : ev.session && (ev.status === "scheduled" || ev.status === "rescheduled") ? (
                    <PrimaryButton onClick={() => setPlanning(ev.session!)} className="cursor-pointer">Plan</PrimaryButton>
                  ) : (
                    <GhostButton disabled className="cursor-not-allowed opacity-50">—</GhostButton>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {planning && (
        <PlanModal
          session={planning}
          existing={plans[planning.id]}
          levels={levels}
          onClose={() => setPlanning(null)}
          onSave={handleSavePlan}
        />
      )}

      {detailsFor && (
        <SessionDetailsModal
          session={detailsFor.session}
          plan={plans[detailsFor.session.id]}
          title={detailsFor.title}
          mode={detailsFor.mode}
          coverageNote={getCoverageNoteForStudent(detailsFor.session.student_id)}
          onClose={() => setDetailsFor(null)}
          onCantAttend={() => { const s = detailsFor.session; setDetailsFor(null); setCancelling(s); }}
          onEditPlan={() => { const s = detailsFor.session; setDetailsFor(null); setPlanning(s); }}
        />
      )}

      {cancelling && (
        <CantAttendModal
          session={cancelling}
          teacherId={user.id}
          onClose={() => setCancelling(null)}
          onDone={({ needsSubstitute }) => {
            setCancelling(null);
            toast.success(needsSubstitute
              ? "Cancellation submitted. Admin has been notified to find a substitute."
              : "Cancellation submitted. You can propose a reschedule with Admin.");
          }}
        />
      )}

      {clubModal && (
        <ClubQuickModal
          club={clubModal}
          onClose={() => setClubModal(null)}
          onCantAttend={() => { const c = clubModal; setClubModal(null); setReleaseFor(c); }}
        />
      )}

      {releaseFor && (
        <RequestReleaseModal
          club={releaseFor}
          onClose={() => setReleaseFor(null)}
          onSubmit={(reason) => {
            if (user) addReleaseRequest({ club_id: releaseFor.id, teacher_id: user.id, reason });
            setReleaseFor(null);
            toast.success("Release request submitted for admin approval");
          }}
        />
      )}

      {reportingClub && user && (
        <ClubReportModal
          event={reportingClub}
          teacherId={user.id}
          onClose={() => setReportingClub(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Club quick modal — Join / Can't Attend shortcut on the calendar. The
// "Can't Attend" branch reuses the existing Request Release flow from
// Fase 6 so there is exactly one release pipeline.
// ---------------------------------------------------------------------------
function ClubQuickModal({ club, onClose, onCantAttend }: {
  club: Club; onClose: () => void; onCantAttend: () => void;
}) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-floating">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{club.type === "book" ? "Book Club" : "Insight"}</div>
            <h2 className="mt-0.5 text-base font-semibold text-foreground">{club.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">
          {new Date(club.date).toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}{club.spots_taken}/{club.spots_total} Seats
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-3">
          <GhostButton onClick={onCantAttend}>Can't Attend</GhostButton>
          <a
            href={club.link || "#"} target="_blank" rel="noopener noreferrer"
            onClick={(e) => { if (!club.link) e.preventDefault(); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Video className="h-3.5 w-3.5" /> Join Club
          </a>
        </div>
      </div>
    </div>
  );
}

function RequestReleaseModal({ club, onClose, onSubmit }: {
  club: Club; onClose: () => void; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Request Release</h2>
          <button onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{club.title}</div>
            <div>{club.type === "book" ? "Book Club" : "Insight"} · {new Date(club.date).toLocaleString()}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="Why you need to release this club…" className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <p className="text-[11px] text-muted-foreground">This does not release the club immediately — an admin will review. If approved, a penalty may be applied.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => onSubmit(reason.trim())}>Submit Request</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

