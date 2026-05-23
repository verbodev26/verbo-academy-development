import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, userById, type Session, type SessionStatus } from "@/lib/mock-data";
import { Card, Pill, SectionTitle, PrimaryButton, GhostButton } from "@/components/verbo/ui";
import { CalendarClock, Video, ChevronLeft, ChevronRight, X, Download, AlertTriangle, CheckCircle2, Users } from "lucide-react";

export const Route = createFileRoute("/student/sessions")({ component: Page });

// ---------- Event model (extends sessions with club events) ----------
type EventKind = "one-on-one" | "verbo-insights" | "book-club";
type ExtStatus = SessionStatus | "pending-reschedule" | "cancelled";

interface CalEvent {
  id: string;
  kind: EventKind;
  title: string;
  date: string; // ISO
  duration_minutes: number;
  teacher_id?: string;
  teams_link?: string;
  status: ExtStatus;
  // Club-specific
  spots_total?: number;
  spots_booked?: number;
  user_booked?: boolean;
  material_url?: string;
  topic?: string;
}

const COLORS: Record<string, string> = {
  scheduled: "#8b5cf6",          // purple — 1-on-1 scheduled
  completed: "#16a34a",          // green
  absent: "#dc2626",              // red
  cancelled: "#94a3b8",           // gray
  "pending-reschedule": "#eab308",// yellow
  delayed: "#eab308",
  "verbo-insights": "#f38934",   // brand orange
  "book-club": "#0f766e",        // teal
};

function eventColor(ev: CalEvent): string {
  if (ev.kind === "one-on-one") return COLORS[ev.status] ?? "#8b5cf6";
  return COLORS[ev.kind];
}

function statusLabel(s: ExtStatus): string {
  const map: Record<ExtStatus, string> = {
    scheduled: "Scheduled",
    completed: "Completed",
    absent: "Absent",
    delayed: "Delayed",
    cancelled: "Cancelled",
    "pending-reschedule": "Pending Reschedule",
  };
  return map[s];
}

// ---------- Seed club events relative to today ----------
function seedClubs(): CalEvent[] {
  const now = new Date();
  const at = (dayOffset: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  return [
    {
      id: "vi1", kind: "verbo-insights", title: "Verbo Insights — Leadership in Tech",
      topic: "Leadership in Tech", date: at(2, 18), duration_minutes: 45,
      status: "scheduled", spots_total: 4, spots_booked: 2, user_booked: false,
      material_url: "#",
    },
    {
      id: "vi2", kind: "verbo-insights", title: "Verbo Insights — Negotiation Tactics",
      topic: "Negotiation Tactics", date: at(9, 17), duration_minutes: 45,
      status: "scheduled", spots_total: 4, spots_booked: 3, user_booked: false,
      material_url: "#",
    },
    {
      id: "bc1", kind: "book-club", title: "Book Club — Atomic Habits, Ch. 4–6",
      topic: "Atomic Habits, Chapters 4–6", date: at(5, 19), duration_minutes: 60,
      status: "scheduled", spots_total: 4, spots_booked: 1, user_booked: false,
      material_url: "#",
    },
    {
      id: "bc2", kind: "book-club", title: "Book Club — The Culture Map, Ch. 1–3",
      topic: "The Culture Map, Chapters 1–3", date: at(14, 19), duration_minutes: 60,
      status: "scheduled", spots_total: 4, spots_booked: 4, user_booked: false,
      material_url: "#",
    },
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
  } catch {
    return {};
  }
}

function persistCancels(map: Record<string, number>) {
  if (typeof window !== "undefined") localStorage.setItem(CANCEL_KEY, JSON.stringify(map));
}

function Page() {
  const { user } = useAuth();

  // Combine 1-on-1 sessions for this user + seeded club events
  const initial = useMemo<CalEvent[]>(() => {
    const own = SESSIONS.filter((s) => s.student_id === user?.id).map(sessionToEvent);
    return [...own, ...seedClubs()];
  }, [user?.id]);

  const [events, setEvents] = useState<CalEvent[]>(initial);
  useEffect(() => setEvents(initial), [initial]);

  // Cancellation tracking (per-student, persisted)
  const [cancelMap, setCancelMap] = useState<Record<string, number>>(() => readCancels(user?.id));
  const cancelCount = cancelMap[user?.id ?? "guest"] ?? 0;
  const blocked = cancelCount >= CANCEL_LIMIT;

  // Calendar navigation
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const updateEvent = (id: string, patch: Partial<CalEvent>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // ---------- 1-on-1 cancellation logic ----------
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

  // ---------- Club booking logic ----------
  const confirmClub = (ev: CalEvent) => {
    if (ev.user_booked) return;
    if ((ev.spots_booked ?? 0) >= (ev.spots_total ?? 4)) {
      alert("This club is fully booked. Please choose another session.");
      return;
    }
    const ok = window.confirm("By reserving your spot, you commit to attending. Space is highly limited for corporate teams.");
    if (!ok) return;
    updateEvent(ev.id, { user_booked: true, spots_booked: (ev.spots_booked ?? 0) + 1 });
    setSelected({ ...ev, user_booked: true, spots_booked: (ev.spots_booked ?? 0) + 1 });
  };

  const cancelClub = (ev: CalEvent) => {
    if (!ev.user_booked) return;

    // Always free the spot immediately so a teammate can take it
    const freedSpots = Math.max(0, (ev.spots_booked ?? 1) - 1);
    updateEvent(ev.id, { user_booked: false, spots_booked: freedSpots });
    setSelected({ ...ev, user_booked: false, spots_booked: freedSpots });

    // If already blocked, release silently — counter stays at max, no extra alert
    if (blocked) return;

    const next = cancelCount + 1;
    const nextMap = { ...cancelMap, [user?.id ?? "guest"]: next };
    setCancelMap(nextMap);
    persistCancels(nextMap);

    if (next >= CANCEL_LIMIT) {
      alert("You have reached your cancellation limit (3/3). You have been excluded from booking further club sessions. Please contact your organization's administrator.");
    } else {
      alert(`Cancellation ${next} of ${CANCEL_LIMIT}. Please remember that club spots are highly limited for your team.`);
    }
  };

  // ---------- Calendar grid ----------
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

  const sessionsChrono = events
    .filter((e) => e.kind === "one-on-one")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Sessions</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Welcome to your Live Sessions hub. Here you can track your academic schedule, access your
          1-on-1 Microsoft Teams links, and book your spots for our exclusive corporate workshops
          and conversation clubs. Keep an eye on your attendance metrics.
        </p>
      </div>

      {blocked && (
        <Card className="border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="text-sm text-foreground">
              You have exceeded your cancellation limit (3/3). Club bookings are temporarily
              disabled — please contact your organization's administrator.
            </div>
          </div>
        </Card>
      )}

      {/* Calendar */}
      <Card>
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
              <div key={i} className={`min-h-[92px] bg-card p-1.5 ${inMonth ? "" : "opacity-40"}`}>
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium ${isToday ? "bg-[color:var(--primary)] text-primary-foreground" : "text-foreground"}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelected(ev)}
                      className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[10.5px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                      style={{ backgroundColor: eventColor(ev) }}
                      title={ev.title}
                    >
                      {new Date(ev.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {shortLabel(ev)}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          {[
            ["Scheduled 1-on-1", COLORS.scheduled],
            ["Completed", COLORS.completed],
            ["Absent", COLORS.absent],
            ["Pending Reschedule", COLORS["pending-reschedule"]],
            ["Cancelled", COLORS.cancelled],
            ["Verbo Insights", COLORS["verbo-insights"]],
            ["Book Club", COLORS["book-club"]],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* History list */}
      <div>
        <SectionTitle>Chronological history</SectionTitle>
        <div className="space-y-3">
          {sessionsChrono.map((s) => {
            const t = s.teacher_id ? userById(s.teacher_id) : undefined;
            const tone =
              s.status === "completed" ? "success" :
              s.status === "scheduled" ? "default" :
              s.status === "pending-reschedule" ? "warning" : "danger";
            return (
              <Card key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{new Date(s.date).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">with {t?.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={tone as "success" | "default" | "warning" | "danger"}>{statusLabel(s.status)}</Pill>
                  {s.status === "scheduled" && (
                    <PrimaryButton onClick={() => setSelected(s)}><Video className="h-4 w-4" /> View</PrimaryButton>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modal */}
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

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-floating">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: eventColor(event) }} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {event.kind === "one-on-one" ? "1-on-1 Session" : event.kind === "verbo-insights" ? "Verbo Insights" : "Book Club"}
          </span>
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
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Pill tone={event.status === "scheduled" ? "default" : event.status === "pending-reschedule" ? "warning" : event.status === "completed" ? "success" : "danger"}>{statusLabel(event.status)}</Pill></div>
            {event.teams_link && (
              <div className="flex justify-between"><span className="text-muted-foreground">MS Teams</span><span className="truncate text-foreground">link ready</span></div>
            )}
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
            <p className="text-[11px] text-muted-foreground">
              Cancellations used: {cancelCount}/{CANCEL_LIMIT}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          {!isClub && event.status === "scheduled" && (
            <>
              <PrimaryButton
                className="flex-1"
                onClick={() => { if (event.teams_link) window.open(event.teams_link, "_blank"); }}
              >
                <Video className="h-4 w-4" /> Connect
              </PrimaryButton>
              <GhostButton className="flex-1" onClick={onCancelOneOnOne}>Can't Attend</GhostButton>
            </>
          )}
          {!isClub && event.status !== "scheduled" && (
            <GhostButton className="w-full" onClick={onClose}>Close</GhostButton>
          )}

          {isClub && (
            <>
              <PrimaryButton
                className="flex-1"
                disabled={event.user_booked || full || blocked}
                onClick={onConfirmClub}
              >
                {full && !event.user_booked ? "Fully Booked" : event.user_booked ? "Confirmed" : "Confirm Attendance"}
              </PrimaryButton>
              <GhostButton
                className="flex-1"
                disabled={!event.user_booked}
                onClick={onCancelClub}
              >
                Can't Attend
              </GhostButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers ----------
function shortLabel(ev: CalEvent): string {
  if (ev.kind === "verbo-insights") return "Verbo Insights";
  if (ev.kind === "book-club") return "Book Club";
  return "1-on-1";
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function addMonths(d: Date, n: number) {
  const x = new Date(d); x.setMonth(x.getMonth() + n); return x;
}
function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  // Monday-first offset
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
