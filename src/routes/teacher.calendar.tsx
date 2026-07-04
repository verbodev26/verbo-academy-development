import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, userById } from "@/lib/mock-data";
import { Card, GhostButton, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { loadLevels, subscribeLevels } from "@/lib/courses-store";
import type { Level } from "@/lib/mock-data";
import {
  loadLessonPlans,
  saveLessonPlan,
  subscribeLessonPlans,
  type LessonPlan,
  type LessonSessionType,
} from "@/lib/lesson-plans-store";
import {
  loadSessions,
  persistSessions,
  subscribeSessions,
  type ExtSession,
  type ExtSessionStatus,
} from "@/lib/sessions-store";
import { PlanModal } from "@/components/verbo/PlanModal";

export const Route = createFileRoute("/teacher/calendar")({ component: Page });

// Status → badge color (matches spec)
const STATUS_COLOR: Record<ExtSessionStatus, string> = {
  scheduled: "#94a3b8",     // Neutral Grey
  rescheduled: "#94a3b8",   // Neutral Grey
  ready: "#8b5cf6",         // Premium Purple
  rearranged: "#eab308",    // Amber/Yellow
  completed: "#16a34a",     // Emerald
  absent: "#dc2626",        // Crimson
  delayed: "#eab308",
};

const STATUS_LABEL: Record<ExtSessionStatus, string> = {
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  ready: "Ready",
  rearranged: "Rearranged",
  completed: "Completed",
  absent: "Absent",
  delayed: "Delayed",
};

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

function Page() {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<ExtSession[]>([]);
  const [plans, setPlans] = useState<Record<string, LessonPlan>>({});
  const [levels, setLevels] = useState<Level[]>([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Hydrate on the client only — avoids SSR/client mismatch
  useEffect(() => {
    const syncSessions = () => {
      const stored = loadSessions();
      // Merge in any seed sessions not yet stored (first visit)
      const ids = new Set(stored.map((s) => s.id));
      const merged: ExtSession[] = [
        ...stored,
        ...SESSIONS.filter((s) => !ids.has(s.id)).map((s) => ({ ...s }) as ExtSession),
      ];
      setSessions(merged);
    };
    syncSessions();
    setPlans(loadLessonPlans());
    setLevels(loadLevels());
    const u1 = subscribeSessions(syncSessions);
    const u2 = subscribeLessonPlans(() => setPlans(loadLessonPlans()));
    const u3 = subscribeLevels(() => setLevels(loadLevels()));
    return () => { u1(); u2(); u3(); };
  }, []);

  const mine = useMemo(
    () => sessions.filter((s) => s.teacher_id === user?.id),
    [sessions, user?.id],
  );

  // Effective status = "ready" whenever a saved lesson plan exists
  const effectiveStatus = (s: ExtSession): ExtSessionStatus => {
    if (plans[s.id] && (s.status === "scheduled" || s.status === "rescheduled")) return "ready";
    return s.status;
  };

  const eventsByDay = useMemo(() => {
    const m = new Map<string, ExtSession[]>();
    mine.forEach((s) => {
      const k = dayKey(new Date(s.date_time));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    });
    return m;
  }, [mine]);

  const upcoming = useMemo(
    () => mine
      .filter((s) => +new Date(s.date_time) >= Date.now() - 60 * 60_000)
      .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time))
      .slice(0, 3),
    [mine],
  );

  const grid = buildMonthGrid(cursor);
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const selected = selectedId ? mine.find((s) => s.id === selectedId) ?? null : null;

  const openPlanner = (s: ExtSession) => {
    const status = effectiveStatus(s);
    // Only Grey or Amber are plannable per spec; Ready re-opens for review too.
    if (["completed", "absent"].includes(status)) return;
    setSelectedId(s.id);
  };

  const handleSavePlan = (plan: LessonPlan) => {
    saveLessonPlan(plan);
    // Promote session status to "ready" (unless admin had it as "rearranged")
    const next = sessions.map((s) => {
      if (s.id !== plan.session_id) return s;
      if (s.status === "rearranged") return s; // keep amber until teacher confirms
      return { ...s, status: "ready" as ExtSessionStatus };
    });
    persistSessions(next);
    setSessions(next);
    setPlans({ ...plans, [plan.session_id]: plan });
    setSelectedId(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-slate-50">Calendar</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Monthly overview of your assigned sessions. Click any pending or rearranged session
          to prepare its pedagogical plan.
        </p>
      </div>

      {/* Calendar */}
      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground text-slate-50">{monthLabel}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Click a session badge to plan or review it.</p>
          </div>
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setCursor(addMonths(cursor, -1))} className="!px-2.5 cursor-pointer"><ChevronLeft className="h-4 w-4" /></GhostButton>
            <GhostButton onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="cursor-pointer">Today</GhostButton>
            <GhostButton onClick={() => setCursor(addMonths(cursor, 1))} className="!px-2.5 cursor-pointer"><ChevronRight className="h-4 w-4" /></GhostButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
            <div key={d} className="bg-secondary px-2 py-2 text-center font-medium text-muted-foreground">{d}</div>
          ))}
          {grid.map((day, i) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
            return (
              <div key={i} className={`min-h-[96px] bg-card p-1.5 ${inMonth ? "" : "opacity-40"}`}>
                <div className="mb-1 text-[11px] font-medium text-foreground">{day.getDate()}</div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((s) => {
                    const st = effectiveStatus(s);
                    const student = userById(s.student_id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => openPlanner(s)}
                        className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[10.5px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
                        style={{ backgroundColor: STATUS_COLOR[st] }}
                        title={`${student?.name ?? ""} — ${STATUS_LABEL[st]}`}
                      >
                        {new Date(s.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {student?.name?.split(" ")[0] ?? "Student"}
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          {(["scheduled","ready","rearranged","completed","absent"] as ExtSessionStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[s] }} />
              <span>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Upcoming feed */}
      <div>
        <SectionTitle>Active & Upcoming Sessions</SectionTitle>
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <Card><p className="text-sm text-muted-foreground">No upcoming sessions on your calendar.</p></Card>
          )}
          {upcoming.map((s) => {
            const student = userById(s.student_id);
            const st = effectiveStatus(s);
            return (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{student?.name}</div>
                    <div className="text-xs text-muted-foreground">{student?.company ?? "—"} · {new Date(s.date_time).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: STATUS_COLOR[st] }}>{STATUS_LABEL[st]}</span>
                  <PrimaryButton onClick={() => openPlanner(s)} className="cursor-pointer">Plan</PrimaryButton>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {selected && (
        <PlanModal
          session={selected}
          existing={plans[selected.id]}
          levels={levels}
          onClose={() => setSelectedId(null)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  );
}

