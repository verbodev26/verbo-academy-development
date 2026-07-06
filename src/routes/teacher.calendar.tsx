import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, FileEdit } from "lucide-react";
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
  const [, tick] = useState(0);

  useEffect(() => {
    setSessions(loadSessions());
    setPlans(loadLessonPlans());
    setLevels(loadLevels());
    const u1 = subscribeSessions(() => setSessions(loadSessions()));
    const u2 = subscribeLessonPlans(() => setPlans(loadLessonPlans()));
    const u3 = subscribeLevels(() => setLevels(loadLevels()));
    const onWorkshops = (e: StorageEvent) => { if (e.key === WORKSHOPS_KEY) tick((n) => n + 1); };
    if (typeof window !== "undefined") window.addEventListener("storage", onWorkshops);
    return () => { u1(); u2(); u3(); if (typeof window !== "undefined") window.removeEventListener("storage", onWorkshops); };
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
    // Clubs / spotlights: no modal wired here yet — they're read-only on this
    // calendar. Owners edit via Admin > Manage Clubs / Focus Workshops.
    if (ev.kind === "insight" || ev.kind === "book_club" || ev.kind === "spotlight") return;

    if (!ev.session) return;
    const s = ev.session;
    // Completed/absent sessions have a Session Report already — no re-open here.
    if (s.status === "completed" || s.status === "absent" || s.status === "no_show") return;
    // Otherwise open the Lesson Plan modal (Scheduled → Ready).
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-slate-50">Calendar</h1>
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
    </div>
  );
}

