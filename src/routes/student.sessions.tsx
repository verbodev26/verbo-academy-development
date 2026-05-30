import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, userById, type Session, type SessionStatus } from "@/lib/mock-data";
import { Card, Pill, PrimaryButton, GhostButton } from "@/components/verbo/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarClock, Video, ChevronLeft, ChevronRight, X, Download, AlertTriangle, CheckCircle2, Users, BookOpen, Zap, Sparkles, GraduationCap } from "lucide-react";
import { getLessonPlan, subscribeLessonPlans, type LessonPlan } from "@/lib/lesson-plans-store";
import { loadLevels } from "@/lib/courses-store";

export const Route = createFileRoute("/student/sessions")({ component: Page });

// ---------- Event model ----------
type EventKind = "one-on-one" | "verbo-insights" | "book-club" | "spotlights" | "focus-workshop";
type ExtStatus = SessionStatus | "ready" | "pending-reschedule" | "cancelled";

interface CalEvent {
  id: string;
  kind: EventKind;
  title: string;
  date: string;
  duration_minutes: number;
  teacher_id?: string;
  teams_link?: string;
  status: ExtStatus;
  spots_total?: number;
  spots_booked?: number;
  user_booked?: boolean;
  material_url?: string;
  topic?: string;
}

const COLORS: Record<string, string> = {
  scheduled: "#8b5cf6",
  ready: "#8b5cf6",
  completed: "#16a34a",
  absent: "#dc2626",
  cancelled: "#94a3b8",
  "pending-reschedule": "#eab308",
  delayed: "#eab308",
  "verbo-insights": "#f38934",
  "book-club": "#0f766e",
  spotlights: "#06b6d4",          // electric cyan
  "focus-workshop": "#a855f7",    // magenta/amethyst
};

function eventColor(ev: CalEvent): string {
  if (ev.kind === "one-on-one") return COLORS[ev.status] ?? "#8b5cf6";
  return COLORS[ev.kind];
}

function statusLabel(s: ExtStatus): string {
  const map: Record<ExtStatus, string> = {
    scheduled: "Scheduled",
    ready: "Ready",
    completed: "Completed",
    absent: "Absent",
    delayed: "Delayed",
    cancelled: "Cancelled",
    "pending-reschedule": "Pending Reschedule",
  };
  return map[s];
}

function kindLabel(k: EventKind): string {
  switch (k) {
    case "one-on-one": return "1-on-1";
    case "verbo-insights": return "Verbo Insights";
    case "book-club": return "Book Club";
    case "spotlights": return "Spotlights";
    case "focus-workshop": return "Focus Workshop";
  }
}

// ---------- LIVE detection ----------
function liveState(ev: CalEvent): "live" | "soon" | null {
  const start = new Date(ev.date).getTime();
  const end = start + ev.duration_minutes * 60_000;
  const now = Date.now();
  if (now >= start && now <= end) return "live";
  if (start - now > 0 && start - now <= 15 * 60_000) return "soon";
  return null;
}

// ---------- Seed events ----------
function seedClubs(): CalEvent[] {
  const now = new Date();
  const at = (dayOffset: number, hour: number, min = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  };
  return [
    { id: "vi1", kind: "verbo-insights", title: "Verbo Insights — Leadership in Tech", topic: "Leadership in Tech", date: at(2, 18), duration_minutes: 45, status: "scheduled", spots_total: 4, spots_booked: 2, user_booked: false, material_url: "#" },
    { id: "vi2", kind: "verbo-insights", title: "Verbo Insights — Negotiation Tactics", topic: "Negotiation Tactics", date: at(9, 17), duration_minutes: 45, status: "scheduled", spots_total: 4, spots_booked: 3, user_booked: false, material_url: "#" },
    { id: "bc1", kind: "book-club", title: "Book Club — Atomic Habits, Ch. 4–6", topic: "Atomic Habits, Chapters 4–6", date: at(5, 19), duration_minutes: 60, status: "scheduled", spots_total: 4, spots_booked: 1, user_booked: false, material_url: "#" },
    { id: "bc2", kind: "book-club", title: "Book Club — The Culture Map, Ch. 1–3", topic: "The Culture Map, Chapters 1–3", date: at(14, 19), duration_minutes: 60, status: "scheduled", spots_total: 4, spots_booked: 4, user_booked: false, material_url: "#" },
    { id: "sp1", kind: "spotlights", title: "Spotlights — Executive Storytelling", topic: "Executive Storytelling", date: at(3, 16), duration_minutes: 30, status: "scheduled", spots_total: 6, spots_booked: 2, user_booked: false, material_url: "#" },
    { id: "sp2", kind: "spotlights", title: "Spotlights — Pitch Like a CEO", topic: "Pitch Like a CEO", date: at(11, 16), duration_minutes: 30, status: "scheduled", spots_total: 6, spots_booked: 1, user_booked: false, material_url: "#" },
    { id: "fw1", kind: "focus-workshop", title: "Focus Workshop — Advanced Email Writing", topic: "Advanced Email Writing", date: at(4, 15), duration_minutes: 75, status: "scheduled", spots_total: 5, spots_booked: 3, user_booked: false, material_url: "#" },
    { id: "fw2", kind: "focus-workshop", title: "Focus Workshop — Cross-Cultural Meetings", topic: "Cross-Cultural Meetings", date: at(12, 15), duration_minutes: 75, status: "scheduled", spots_total: 5, spots_booked: 2, user_booked: false, material_url: "#" },
  ];
}

function sessionToEvent(s: Session): CalEvent {
  const t = userById(s.teacher_id);
  return {
    id: s.id, kind: "one-on-one",
    title: `1-on-1 with ${t?.name ?? "Teacher"}`,
    date: s.date_time, duration_minutes: s.duration_minutes,
    teacher_id: s.teacher_id, teams_link: s.teams_link,
    status: s.status,
  };
}

const CANCEL_LIMIT = 3;
const CANCEL_KEY_OLD = "verbo:club-cancels";
const CANCEL_KEY = "verbo:club-cancels-v2";

function readCancels(userId?: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CANCEL_KEY);
    if (raw) return JSON.parse(raw);
    const oldRaw = localStorage.getItem(CANCEL_KEY_OLD);
    if (oldRaw && userId) {
      const n = Number(oldRaw);
      localStorage.removeItem(CANCEL_KEY_OLD);
      return { [userId]: n };
    }
    return {};
  } catch { return {}; }
}

function persistCancels(map: Record<string, number>) {
  if (typeof window !== "undefined") localStorage.setItem(CANCEL_KEY, JSON.stringify(map));
}

function Page() {
  const { user } = useAuth();

  // Re-render every 30s for live detection
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to lesson plans to derive "ready" status
  const [planVersion, setPlanVersion] = useState(0);
  useEffect(() => subscribeLessonPlans(() => setPlanVersion((n) => n + 1)), []);

  const initial = useMemo<CalEvent[]>(() => {
    const own = SESSIONS.filter((s) => s.student_id === user?.id).map(sessionToEvent).map((e) => {
      if (e.kind === "one-on-one" && (e.status === "scheduled") && getLessonPlan(e.id)) {
        return { ...e, status: "ready" as ExtStatus };
      }
      return e;
    });
    return [...own, ...seedClubs()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, planVersion]);

  const [events, setEvents] = useState<CalEvent[]>(initial);
  useEffect(() => setEvents(initial), [initial]);

  const [cancelMap, setCancelMap] = useState<Record<string, number>>(() => readCancels(user?.id));
  const cancelCount = cancelMap[user?.id ?? "guest"] ?? 0;
  const blocked = cancelCount >= CANCEL_LIMIT;

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const updateEvent = (id: string, patch: Partial<CalEvent>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const cancelOneOnOne = (ev: CalEvent) => {
    const hoursUntil = (new Date(ev.date).getTime() - Date.now()) / 36e5;
    if (hoursUntil > 24) {
      updateEvent(ev.id, { status: "pending-reschedule" });
      alert("Cancellation confirmed. Your session is now Pending Reschedule — our team will reach out shortly to set a new time.");
    } else {
      updateEvent(ev.id, { status: "absent" });
      alert("⚠ Cancellation received with less than 24 hours notice. The session has been marked as Absent and forfeited — no reschedule is available.");
    }
    setSelected(null);
  };

  const confirmClub = (ev: CalEvent) => {
    if (ev.user_booked) return;
    if ((ev.spots_booked ?? 0) >= (ev.spots_total ?? 4)) { alert("This club is fully booked. Please choose another session."); return; }
    const ok = window.confirm("By reserving your spot, you commit to attending. Space is highly limited for corporate teams.");
    if (!ok) return;
    updateEvent(ev.id, { user_booked: true, spots_booked: (ev.spots_booked ?? 0) + 1 });
    setSelected({ ...ev, user_booked: true, spots_booked: (ev.spots_booked ?? 0) + 1 });
  };

  const cancelClub = (ev: CalEvent) => {
    if (!ev.user_booked) return;
    const freedSpots = Math.max(0, (ev.spots_booked ?? 1) - 1);
    updateEvent(ev.id, { user_booked: false, spots_booked: freedSpots });
    setSelected({ ...ev, user_booked: false, spots_booked: freedSpots });
    if (blocked) return;
    const next = cancelCount + 1;
    const nextMap = { ...cancelMap, [user?.id ?? "guest"]: next };
    setCancelMap(nextMap);
    persistCancels(nextMap);
    if (next >= CANCEL_LIMIT) alert("You have reached your cancellation limit (3/3). You have been excluded from booking further club sessions. Please contact your organization's administrator.");
    else alert(`Cancellation ${next} of ${CANCEL_LIMIT}. Please remember that club spots are highly limited for your team.`);
  };

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach((e) => {
      const k = dayKey(new Date(e.date));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return m;
  }, [events]);

  const oneOnOnes = events.filter((e) => e.kind === "one-on-one");
  const upcoming = oneOnOnes
    .filter((s) => s.status === "scheduled" || s.status === "ready" || s.status === "pending-reschedule" || liveState(s) === "live")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const past = oneOnOnes
    .filter((s) => (s.status === "completed" || s.status === "absent" || s.status === "cancelled") && liveState(s) !== "live")
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstName = user?.name?.split(" ")[0] ?? "Student";

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#f4f6f8] px-4 py-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Sessions</h1>
        </div>

        {/* Hero card */}
        <div className="relative overflow-hidden rounded-2xl bg-[#01304a] p-6 text-white shadow-[0_10px_40px_-12px_rgba(1,48,74,0.45)]">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#f38934]/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <Sparkles className="h-6 w-6 text-[#f38934]" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f38934]">Live Space</div>
              <h2 className="mt-1 text-lg font-semibold leading-snug">
                Welcome to your Live Space, {firstName}!
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">
                Here is your professional academic engine. Your current attendance is at{" "}
                <span className="font-semibold text-white">92%</span> — keep up that incredible corporate momentum! 🚀
              </p>
            </div>
          </div>
        </div>

        {blocked && (
          <Card className="border-destructive/40 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div className="text-sm text-foreground">
                You have exceeded your cancellation limit (3/3). Club bookings are temporarily disabled — please contact your organization's administrator.
              </div>
            </div>
          </Card>
        )}

        {/* Calendar */}
        <div className="rounded-2xl border border-border bg-white p-6" style={{ boxShadow: "0 4px 20px -2px rgba(1, 48, 74, 0.05)" }}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-foreground">{monthLabel}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Click any event to view details.</p>
            </div>
            <div className="flex items-center gap-2">
              <GhostButton onClick={() => setCursor(addMonths(cursor, -1))} className="!px-2.5"><ChevronLeft className="h-4 w-4" /></GhostButton>
              <GhostButton onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</GhostButton>
              <GhostButton onClick={() => setCursor(addMonths(cursor, 1))} className="!px-2.5"><ChevronRight className="h-4 w-4" /></GhostButton>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="bg-secondary px-2 py-2 text-center font-medium text-muted-foreground">{d}</div>
            ))}
            {grid.map((day, i) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = dayKey(day) === dayKey(new Date());
              const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
              return (
                <div
                  key={i}
                  className={`min-h-[96px] p-1.5 transition-colors ${inMonth ? "" : "opacity-40"} ${isToday ? "bg-[#e6f0fa] ring-2 ring-inset ring-[#01304a]/40" : "bg-card"}`}
                >
                  <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? "bg-[#01304a] text-white shadow-sm" : "text-foreground"}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const live = liveState(ev);
                      const color = eventColor(ev);
                      return (
                        <button
                          key={ev.id}
                          onClick={() => setSelected(ev)}
                          className={`relative flex w-full items-center gap-1 truncate rounded-[8px] px-1.5 py-1 text-left text-[10.5px] font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 ${live === "live" ? "verbo-live-pulse" : ""}`}
                          style={{ background: `linear-gradient(135deg, ${color}, ${shade(color, -12)})` }}
                          title={ev.title}
                        >
                          {live === "live" && (
                            <span className="verbo-live-dot mr-0.5 inline-flex items-center gap-0.5 rounded-sm bg-red-600/95 px-1 py-px text-[8.5px] font-bold leading-none tracking-wide text-white">
                              <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
                            </span>
                          )}
                          <span className="truncate">
                            {new Date(ev.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {shortLabel(ev)}
                          </span>
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

          {/* Legend */}
          <div className="mt-5 flex flex-wrap gap-2 text-[11px]">
            {[
              ["Scheduled 1-on-1", COLORS.scheduled],
              ["Completed", COLORS.completed],
              ["Absent", COLORS.absent],
              ["Pending Reschedule", COLORS["pending-reschedule"]],
              ["Cancelled", COLORS.cancelled],
              ["Verbo Insights", COLORS["verbo-insights"]],
              ["Book Club", COLORS["book-club"]],
              ["Spotlights", COLORS.spotlights],
              ["Focus Workshop", COLORS["focus-workshop"]],
            ].map(([label, color]) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${color}, ${shade(color, -12)})` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                <span className="font-semibold tracking-wide">{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Tabbed agenda */}
        <div>
          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-white p-1 shadow-soft">
              <TabsTrigger value="upcoming">Upcoming & Live Agenda</TabsTrigger>
              <TabsTrigger value="past">Past Session History</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-4 space-y-3">
              {upcoming.length === 0 && (
                <div className="rounded-xl bg-white p-6 text-sm text-muted-foreground shadow-soft">No upcoming sessions on your calendar.</div>
              )}
              {upcoming.map((s) => <BoardingPass key={s.id} s={s} onOpen={() => setSelected(s)} />)}
            </TabsContent>

            <TabsContent value="past" className="mt-4 space-y-3">
              {past.length === 0 && (
                <div className="rounded-xl bg-white p-6 text-sm text-muted-foreground shadow-soft">No archived sessions yet.</div>
              )}
              {past.map((s) => <PastRow key={s.id} s={s} />)}
            </TabsContent>
          </Tabs>
        </div>

        {selected && (
          <EventModal
            event={selected}
            onClose={() => setSelected(null)}
            onCancelOneOnOne={() => cancelOneOnOne(selected)}
            onConfirmClub={() => confirmClub(selected)}
            onCancelClub={() => cancelClub(selected)}
            blocked={blocked}
            cancelCount={cancelCount}
          />
        )}
      </div>
    </div>
  );
}

// ---------- Boarding Pass (upcoming/live) ----------
function BoardingPass({ s, onOpen }: { s: CalEvent; onOpen: () => void }) {
  const teacher = s.teacher_id ? userById(s.teacher_id) : undefined;
  const live = liveState(s);
  const tone =
    s.status === "ready" ? "default" :
    s.status === "pending-reschedule" ? "warning" :
    s.status === "scheduled" ? "default" : "muted";
  const initials = (teacher?.name ?? "T").split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white shadow-[0_4px_20px_-2px_rgba(1,48,74,0.06)] ring-1 ring-border ${live === "live" ? "verbo-live-pulse" : ""}`}
    >
      {live === "live" && (
        <div className="verbo-live-dot absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
        </div>
      )}
      <div className="flex items-stretch">
        <div className="hidden w-2 bg-gradient-to-b from-[#01304a] to-[#f38934] sm:block" />
        <div className="flex-1 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#01304a] text-sm font-semibold text-white shadow-sm">
                {initials}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#f38934]">1-on-1 Session</div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">{new Date(s.date).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                <div className="text-xs text-muted-foreground">with {teacher?.name ?? "Teacher"} · {s.duration_minutes} min</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={tone as "default" | "success" | "warning" | "danger" | "muted"}>{statusLabel(s.status)}</Pill>
              {s.status === "ready" ? (
                <button
                  onClick={onOpen}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#01304a] px-4 py-2 text-sm font-medium text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-md"
                >
                  <BookOpen className="h-4 w-4" /> View Lesson Details
                </button>
              ) : live === "live" && s.teams_link ? (
                <button
                  onClick={() => window.open(s.teams_link, "_blank")}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-success-foreground shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  <Zap className="h-4 w-4" /> Join Live
                </button>
              ) : (
                <PrimaryButton onClick={onOpen}>
                  <Video className="h-4 w-4" /> View
                </PrimaryButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PastRow({ s }: { s: CalEvent }) {
  const t = s.teacher_id ? userById(s.teacher_id) : undefined;
  const tone = s.status === "completed" ? "success" : s.status === "absent" ? "danger" : "muted";
  return (
    <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-soft ring-1 ring-border">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <div className="text-sm font-medium text-foreground">{new Date(s.date).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">with {t?.name}</div>
        </div>
      </div>
      <Pill tone={tone as "success" | "danger" | "muted"}>{statusLabel(s.status)}</Pill>
    </div>
  );
}

// ---------- Modal ----------
function EventModal({
  event, onClose, onCancelOneOnOne, onConfirmClub, onCancelClub, blocked, cancelCount,
}: {
  event: CalEvent;
  onClose: () => void;
  onCancelOneOnOne: () => void;
  onConfirmClub: () => void;
  onCancelClub: () => void;
  blocked: boolean;
  cancelCount: number;
}) {
  const teacher = event.teacher_id ? userById(event.teacher_id) : undefined;
  const isClub = event.kind !== "one-on-one";
  const full = (event.spots_booked ?? 0) >= (event.spots_total ?? 4);
  const live = liveState(event);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: eventColor(event) }} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {kindLabel(event.kind)}
          </span>
          {live === "live" && (
            <span className="verbo-live-dot ml-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
            </span>
          )}
        </div>

        <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          {isClub ? event.topic : `Session with ${teacher?.name ?? "Teacher"}`}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(event.date).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}{event.duration_minutes} min
        </p>

        {!isClub && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Teacher</span><span className="font-medium text-foreground">{teacher?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Pill tone={event.status === "scheduled" || event.status === "ready" ? "default" : event.status === "pending-reschedule" ? "warning" : event.status === "completed" ? "success" : "danger"}>{statusLabel(event.status)}</Pill></div>
            {event.teams_link && (
              <div className="flex justify-between"><span className="text-muted-foreground">MS Teams</span><span className="truncate text-foreground">link ready</span></div>
            )}
            <LessonPlanBlock sessionId={event.id} />
          </div>
        )}

        {isClub && (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
              <div className="flex items-center gap-2 text-foreground"><Users className="h-4 w-4" /> Availability</div>
              <span className="font-medium text-foreground">{event.spots_booked}/{event.spots_total} spots taken</span>
            </div>
            {event.user_booked && (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> You're booked for this club.
              </div>
            )}
            <GhostButton className="w-full" onClick={() => alert("Pre-club material download would start now.")}>
              <Download className="h-4 w-4" /> Download Pre-Club Material
            </GhostButton>
            <p className="text-[11px] text-muted-foreground">Cancellations used: {cancelCount}/{CANCEL_LIMIT}</p>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {!isClub && (event.status === "scheduled" || event.status === "ready") && (
            <>
              <PrimaryButton className="flex-1" onClick={() => { if (event.teams_link) window.open(event.teams_link, "_blank"); }}>
                <Video className="h-4 w-4" /> Connect
              </PrimaryButton>
              <GhostButton className="flex-1" onClick={onCancelOneOnOne}>Can't Attend</GhostButton>
            </>
          )}
          {!isClub && event.status !== "scheduled" && event.status !== "ready" && (
            <GhostButton className="w-full" onClick={onClose}>Close</GhostButton>
          )}

          {isClub && (
            <>
              <PrimaryButton className="flex-1" disabled={event.user_booked || full || blocked} onClick={onConfirmClub}>
                {full && !event.user_booked ? "Fully Booked" : event.user_booked ? "Confirmed" : "Confirm Attendance"}
              </PrimaryButton>
              <GhostButton className="flex-1" disabled={!event.user_booked} onClick={onCancelClub}>
                Can't Attend
              </GhostButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonPlanBlock({ sessionId }: { sessionId: string }) {
  const [plan, setPlan] = useState<LessonPlan | undefined>(undefined);
  useEffect(() => {
    const refresh = () => setPlan(getLessonPlan(sessionId));
    refresh();
    return subscribeLessonPlans(refresh);
  }, [sessionId]);
  if (!plan) return null;
  const levels = loadLevels();
  const level = levels.find((l) => l.id === plan.level_id);
  const unit = level?.units.find((u) => u.id === plan.unit_id);
  return (
    <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-foreground">
        <GraduationCap className="h-3.5 w-3.5" /> Lesson plan
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Title</span><span className="font-medium text-foreground text-right">{plan.title}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Type</span><span className="text-foreground">{plan.type}</span></div>
        {unit && (
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Unit</span><span className="text-foreground text-right">{level?.id} · {unit.title}</span></div>
        )}
        {plan.comments && (
          <div>
            <div className="text-muted-foreground">Teacher's notes</div>
            <p className="mt-1 whitespace-pre-wrap text-foreground">{plan.comments}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Helpers ----------
function shortLabel(ev: CalEvent): string {
  if (ev.kind === "verbo-insights") return "Verbo Insights";
  if (ev.kind === "book-club") return "Book Club";
  if (ev.kind === "spotlights") return "Spotlights";
  if (ev.kind === "focus-workshop") return "Focus Workshop";
  return "1-on-1";
}
function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
function shade(hex: string, pct: number): string {
  const m = hex.replace("#", "");
  const num = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.round(r + (r * pct) / 100)));
  g = Math.max(0, Math.min(255, Math.round(g + (g * pct) / 100)));
  b = Math.max(0, Math.min(255, Math.round(b + (b * pct) / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
