import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, CalendarClock, Lock } from "lucide-react";
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Monthly overview of your assigned sessions. Click any pending or rearranged session
          to prepare its pedagogical plan.
        </p>
      </div>

      {/* Calendar */}
      <Card>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{monthLabel}</h2>
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

// ---------- Planning Modal ----------
function PlanModal({
  session, existing, levels, onClose, onSave,
}: {
  session: ExtSession;
  existing?: LessonPlan;
  levels: Level[];
  onClose: () => void;
  onSave: (plan: LessonPlan) => void;
}) {
  const student = userById(session.student_id);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [type, setType] = useState<LessonSessionType>(existing?.type ?? "Syllabus content");
  const [levelId, setLevelId] = useState(existing?.level_id ?? (student?.current_level ?? levels[0]?.id ?? ""));
  const [unitId, setUnitId] = useState(existing?.unit_id ?? "");
  const [comments, setComments] = useState(existing?.comments ?? "");

  const showLevelUnit = type === "Syllabus content" || type === "Evaluation";
  const currentLevel = levels.find((l) => l.id === levelId);

  useEffect(() => {
    // Reset unit when level changes if missing
    if (showLevelUnit && currentLevel && !currentLevel.units.find((u) => u.id === unitId)) {
      setUnitId(currentLevel.units[0]?.id ?? "");
    }
  }, [levelId, showLevelUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!title.trim()) { alert("Please enter a session title."); return; }
    if (showLevelUnit && (!levelId || !unitId)) { alert("Please select a level and unit."); return; }
    const gap = +new Date(session.date_time) - Date.now();
    const planning_status: LessonPlan["planning_status"] = gap < 5 * 24 * 3_600_000 ? "late" : "on-time";
    onSave({
      session_id: session.id,
      title: title.trim(),
      type,
      level_id: showLevelUnit ? levelId : undefined,
      unit_id: showLevelUnit ? unitId : undefined,
      comments: comments.trim(),
      planning_status,
      saved_at: new Date().toISOString(),
    });
  };

  const inputCls = "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring";
  const readOnlyCls = "mt-1.5 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed";

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-2xl rounded-2xl bg-card p-6 shadow-floating max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-lg font-semibold tracking-tight text-foreground">Lesson Plan</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Prepare the pedagogical plan for this session.</p>

        {/* Read-only context */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Student</label>
            <input readOnly value={student?.name ?? ""} className={readOnlyCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Date & Time</label>
            <input readOnly value={new Date(session.date_time).toLocaleString()} className={readOnlyCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> MS Teams Link</label>
            <input readOnly value={session.teams_link || "—"} className={readOnlyCls} />
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground">Session Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Workplace small talk practice"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">Session Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as LessonSessionType)} className={`${inputCls} cursor-pointer`}>
              <option>Syllabus content</option>
              <option>Additional Content</option>
              <option>Review Session</option>
              <option>Casual Topic</option>
              <option>Evaluation</option>
            </select>
          </div>

          {showLevelUnit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">Select Level</label>
                <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Select Unit</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                  {currentLevel?.units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-foreground">Teacher's comments and instructions</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Add goals, vocabulary focus, prep notes for the student…"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <GhostButton onClick={onClose} className="cursor-pointer">Cancel</GhostButton>
          <button
            onClick={submit}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#f38934" }}
          >
            Save Lesson Plan
          </button>
        </div>
      </div>
    </div>
  );
}
