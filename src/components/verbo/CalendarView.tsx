// Reusable calendar shared by Teacher and (later) Student panels.
//
// Consumers pass a flat list of `CalendarEvent` (see calendar-events.ts)
// and this component handles:
//   - Month grid + Day view toggle.
//   - Event-kind filter chips (1:1 Class / Book Club / Insight /
//     Spotlight / Workshop).
//   - Canonical 7-status legend.
//   - Origin badge (Course / Workshop) on each pill.
//
// It is presentation-only: it does not read from any store directly, so
// the Student panel can wire it later with its own event source.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GhostButton } from "@/components/verbo/ui";
import {
  CALENDAR_STATUS_META,
  CANONICAL_STATUS_ORDER,
  EVENT_KIND_META,
  eventPillDisplay,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/lib/calendar-events";
import { SUB_STATUS_META, type ExtSessionStatus } from "@/lib/sessions-store";

export type CalendarViewMode = "month" | "day";

export interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
  initialMode?: CalendarViewMode;
  /** Restrict the filter chips to a subset (e.g. Student panel hides "workshop"). */
  availableKinds?: CalendarEventKind[];
}

function dayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function buildMonthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function colorForEvent(ev: CalendarEvent): string {
  // Sessions use the canonical status color; clubs & spotlights use their kind color.
  if ((ev.kind === "class" || ev.kind === "workshop") && ev.status && ev.status in CALENDAR_STATUS_META) {
    return CALENDAR_STATUS_META[ev.status as ExtSessionStatus].color;
  }
  return EVENT_KIND_META[ev.kind].color;
}

export function CalendarView({
  events,
  onEventClick,
  initialMode = "month",
  availableKinds,
}: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarViewMode>(initialMode);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [dayCursor, setDayCursor] = useState(() => new Date());
  const [enabledKinds, setEnabledKinds] = useState<Set<CalendarEventKind>>(
    () => new Set(availableKinds ?? (Object.keys(EVENT_KIND_META) as CalendarEventKind[])),
  );

  const kindsToShow = availableKinds ?? (Object.keys(EVENT_KIND_META) as CalendarEventKind[]);

  const filtered = useMemo(
    () => events.filter((e) => enabledKinds.has(e.kind)),
    [events, enabledKinds],
  );

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const k = dayKey(new Date(e.date));
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return m;
  }, [filtered]);

  const toggleKind = (k: CalendarEventKind) => {
    setEnabledKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            {(["month", "day"] as CalendarViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  mode === m ? "bg-[#01304a] text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === "month" ? (
            <div className="flex items-center gap-2">
              <GhostButton onClick={() => setCursor(addMonths(cursor, -1))} className="!px-2.5 cursor-pointer"><ChevronLeft className="h-4 w-4" /></GhostButton>
              <GhostButton onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="cursor-pointer">Today</GhostButton>
              <GhostButton onClick={() => setCursor(addMonths(cursor, 1))} className="!px-2.5 cursor-pointer"><ChevronRight className="h-4 w-4" /></GhostButton>
              <span className="ml-1 text-sm font-semibold text-foreground">
                {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <GhostButton onClick={() => setDayCursor(addDays(dayCursor, -1))} className="!px-2.5 cursor-pointer"><ChevronLeft className="h-4 w-4" /></GhostButton>
              <GhostButton onClick={() => setDayCursor(new Date())} className="cursor-pointer">Today</GhostButton>
              <GhostButton onClick={() => setDayCursor(addDays(dayCursor, 1))} className="!px-2.5 cursor-pointer"><ChevronRight className="h-4 w-4" /></GhostButton>
              <span className="ml-1 text-sm font-semibold text-foreground">
                {dayCursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>
          )}
        </div>

        {/* Event-kind filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {kindsToShow.map((k) => {
            const meta = EVENT_KIND_META[k];
            const on = enabledKinds.has(k);
            return (
              <button
                key={k}
                onClick={() => toggleKind(k)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  on ? "border-transparent text-white" : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
                style={on ? { background: meta.color } : undefined}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-white" : ""}`} style={on ? undefined : { background: meta.color }} />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {mode === "month" ? (
        <MonthGrid cursor={cursor} eventsByDay={eventsByDay} onEventClick={onEventClick} />
      ) : (
        <DayList day={dayCursor} events={eventsByDay.get(dayKey(dayCursor)) ?? []} onEventClick={onEventClick} />
      )}

      {/* Canonical 7-status legend */}
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        {CANONICAL_STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CALENDAR_STATUS_META[s].color }} />
            <span>{CALENDAR_STATUS_META[s].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({
  cursor, eventsByDay, onEventClick,
}: {
  cursor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  const grid = buildMonthGrid(cursor);
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
      {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
        <div key={d} className="bg-secondary px-2 py-2 text-center font-medium text-muted-foreground">{d}</div>
      ))}
      {grid.map((day, i) => {
        const inMonth = day.getMonth() === cursor.getMonth();
        const dayEvents = eventsByDay.get(dayKey(day)) ?? [];
        return (
          <div key={i} className={`min-h-[110px] bg-card p-1.5 ${inMonth ? "" : "opacity-40"}`}>
            <div className="mb-1 text-[11px] font-medium text-foreground">{day.getDate()}</div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((e) => (
                <EventPill key={e.id} ev={e} onClick={() => onEventClick?.(e)} />
              ))}
              {dayEvents.length > 3 && (
                <div className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayList({
  day, events, onEventClick,
}: {
  day: Date;
  events: CalendarEvent[];
  onEventClick?: (ev: CalendarEvent) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No events on {day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {events.map((e) => (
        <button
          key={e.id}
          onClick={() => onEventClick?.(e)}
          className="flex w-full items-center gap-4 border-b border-border p-3 text-left transition-colors last:border-0 hover:bg-secondary/60"
        >
          <div className="w-16 shrink-0 text-sm font-semibold tabular-nums" style={{ color: "#01304a" }}>
            {fmtTime(e.date)}
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: EVENT_KIND_META[e.kind].color }}
          >
            {EVENT_KIND_META[e.kind].label}
          </span>
          {e.is_group && (
            <span className="inline-flex items-center rounded-full bg-[#01304a] px-2 py-0.5 text-[10px] font-bold text-white" title="Group session">
              G
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{e.title}</div>
            {e.subtitle && <div className="truncate text-xs text-muted-foreground">{e.subtitle}</div>}
          </div>
          {e.status && (e.kind === "class" || e.kind === "workshop") && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: CALENDAR_STATUS_META[e.status as ExtSessionStatus]?.color ?? "#94a3b8" }}
            >
              {CALENDAR_STATUS_META[e.status as ExtSessionStatus]?.label ?? e.status}
            </span>
          )}
          {e.origin === "workshop" && (
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">WS</span>
          )}
        </button>
      ))}
    </div>
  );
}

function EventPill({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const color = colorForEvent(ev);
  const kindMeta = EVENT_KIND_META[ev.kind];
  const shortLabel = ev.is_group ? "G" : kindMeta.short;
  const isClub = ev.kind === "insight" || ev.kind === "book_club";
  const seats = isClub && ev.spots_total != null
    ? `${ev.spots_taken ?? 0}/${ev.spots_total} Seats`
    : null;
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className="flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[10.5px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: color }}
        title={`${ev.is_group ? "Group" : kindMeta.label} — ${ev.title}`}
      >
        <span className="rounded bg-white/20 px-1 text-[9px] font-bold leading-none">
          {shortLabel}
        </span>
        <span className="truncate">
          {isClub
            ? `${fmtTime(ev.date)} · ${ev.title}${seats ? ` · ${seats}` : ""}`
            : `${fmtTime(ev.date)} · ${ev.is_group ? ev.title : ev.title.split(" ")[0]}`}
        </span>
      </button>
      {isClub && ev.enrolled_names && ev.enrolled_names.length > 0 && (
        <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 hidden w-52 rounded-lg border border-border bg-card p-3 text-left text-[11px] shadow-floating group-hover:block">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Enrolled Students</div>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-foreground">
            {ev.enrolled_names.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}