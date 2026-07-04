import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { USERS, ASSIGNMENTS, userById } from "@/lib/mock-data";
import {
  loadSessions,
  persistSessions,
  subscribeSessions,
  statusTone,
  type ExtSession,
  type ExtSessionStatus,
} from "@/lib/sessions-store";
import {
  hydrateStudents,
  getStudentVideoLink,
  setStudentVideoLink,
  subscribeStudents,
} from "@/lib/students-store";
import { Card, Pill, PrimaryButton, GhostButton, SectionTitle } from "@/components/verbo/ui";
import { CalendarPlus, ChevronDown, ChevronUp, X, Pencil, AlertTriangle, Users, Building2 } from "lucide-react";

// Status → dropdown options + distinct badge colors (no overlap).
const STATUS_META: Record<ExtSessionStatus, { label: string; bg: string; color: string }> = {
  scheduled: { label: "Scheduled", bg: "#f1f5f9", color: "#475569" },
  ready: { label: "Ready", bg: "#ede9fe", color: "#7c3aed" },
  completed: { label: "Completed", bg: "#dcfce7", color: "#15803d" },
  absent: { label: "Absent", bg: "#fee2e2", color: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "#fce7f3", color: "#be185d" },
  pending_reschedule: { label: "Pending Reschedule", bg: "#fef3c7", color: "#b45309" },
  no_show: { label: "No Show", bg: "#334155", color: "#ffffff" },
  rescheduled: { label: "Rescheduled", bg: "#f1f5f9", color: "#475569" },
  rearranged: { label: "Rearranged", bg: "#fde68a", color: "#92400e" },
  delayed: { label: "Delayed", bg: "#fde68a", color: "#92400e" },
};

// The 7 statuses offered in the edit dropdown.
const STATUS_OPTIONS: ExtSessionStatus[] = [
  "scheduled", "ready", "completed", "absent", "cancelled", "pending_reschedule", "no_show",
];

export const Route = createFileRoute("/admin/sessions")({ component: Page });

const BRAND = "#01304a";
const ORANGE = "#f38934";
const AMBER = "#eab308";
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6]; // JS getDay()

function Page() {
  // Ensure the USERS singleton has persisted profile overrides applied so the
  // Video Call Link matches the Students view even if that page wasn't visited.
  const [, forceTick] = useState(0);
  const students = USERS.filter((u) => u.role === "student");
  const teachers = USERS.filter((u) => u.role === "teacher");
  const [sessions, setSessions] = useState<ExtSession[]>(() => loadSessions());

  useEffect(() => {
    hydrateStudents();
    forceTick((n) => n + 1);
  }, []);
  useEffect(() => subscribeSessions(() => setSessions(loadSessions())), []);
  useEffect(() => subscribeStudents(() => forceTick((n) => n + 1)), []);

  const save = (next: ExtSession[]) => { setSessions(next); persistSessions(next); };

  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-slate-50">Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk-schedule live classes and manage each student's calendar from a single executive view.
        </p>
      </div>

      {/* Bulk schedule panel */}
      <Card className="!p-0 overflow-hidden">
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-secondary/40"
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-lg text-white"
              style={{ backgroundColor: ORANGE }}
            >
              <CalendarPlus className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">Bulk Schedule Live Classes</div>
              <div className="text-xs text-muted-foreground">
                Generate a recurring batch across a date range in one click.
              </div>
            </div>
          </div>
          {bulkOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {bulkOpen && (
          <div className="border-t border-border px-6 py-6">
            <BulkScheduler
              students={students}
              teachers={teachers}
              existing={sessions}
              onCreate={(batch) => save([...batch, ...sessions])}
            />
          </div>
        )}
      </Card>

      {/* Student cards grid */}
      <div>
        <SectionTitle>Students</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => {
            const scheduled = sessions.filter(
              (x) => x.student_id === s.id && !["completed", "absent"].includes(x.status),
            ).length;
            const hired = s.hired_sessions ?? 0;
            const remaining = Math.max(0, hired - scheduled);
            const pct = hired ? Math.min(100, (scheduled / hired) * 100) : 0;
            return (
              <button
                key={s.id}
                onClick={() => setOpenStudent(s.id)}
                className="group rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-floating"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base font-semibold text-foreground">{s.name}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      {s.company ?? "—"}
                    </div>
                  </div>
                  <Pill tone="muted">{s.current_level ?? "—"}</Pill>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scheduled</div>
                      <div className="text-2xl font-semibold" style={{ color: BRAND }}>{scheduled}<span className="text-sm text-muted-foreground"> / {hired}</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Remaining</div>
                      <div className="text-2xl font-semibold" style={{ color: remaining === 0 ? "#dc2626" : ORANGE }}>{remaining}</div>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: ORANGE }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openStudent && (
        <StudentSessionsModal
          studentId={openStudent}
          sessions={sessions}
          teachers={teachers}
          onClose={() => setOpenStudent(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// ============== Bulk scheduler ==============
function BulkScheduler({
  students,
  teachers,
  existing,
  onCreate,
}: {
  students: ReturnType<typeof USERS.filter>;
  teachers: ReturnType<typeof USERS.filter>;
  existing: ExtSession[];
  onCreate: (batch: ExtSession[]) => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const defaultTeacher = useMemo(
    () => ASSIGNMENTS.find((a) => a.student_id === studentId)?.teacher_id ?? teachers[0]?.id ?? "",
    [studentId, teachers],
  );
  const [teacherId, setTeacherId] = useState(defaultTeacher);
  useEffect(() => setTeacherId(defaultTeacher), [defaultTeacher]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [days, setDays] = useState<number[]>([1, 3]); // Mon, Wed

  const student = students.find((s) => s.id === studentId);
  // Shared source of truth: the student's Video Call Link (Students profile).
  const teamsLink = student
    ? (getStudentVideoLink(student.id) || `https://teams.microsoft.com/l/meetup/${student.id}`)
    : "";

  const scheduledForStudent = existing.filter(
    (x) => x.student_id === studentId && !["completed", "absent"].includes(x.status),
  ).length;
  const remaining = Math.max(0, (student?.hired_sessions ?? 0) - scheduledForStudent);

  const generated = useMemo(() => {
    if (!startDate || !endDate || days.length === 0) return [] as Date[];
    const [hh, mm] = time.split(":").map(Number);
    const out: Date[] = [];
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (end < start) return [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (days.includes(d.getDay())) {
        const dt = new Date(d);
        dt.setHours(hh, mm, 0, 0);
        out.push(dt);
      }
    }
    return out;
  }, [startDate, endDate, days, time]);

  const overLimit = generated.length > remaining;

  // Summary of dates skipped on the last Assign because the teacher was already
  // booked with another student at that exact date/time.
  const [conflictSummary, setConflictSummary] = useState<Date[]>([]);
  useEffect(() => { setConflictSummary([]); }, [startDate, endDate, time, days, teacherId, studentId]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const assign = () => {
    if (!studentId || !teacherId || generated.length === 0 || overLimit) return;

    // Teacher double-booking detection: skip any slot where the selected
    // teacher already has an active session with a different student.
    const isBlocking = (st: ExtSessionStatus) =>
      !["completed", "absent", "cancelled", "no_show"].includes(st);
    const clear: Date[] = [];
    const conflicts: Date[] = [];
    generated.forEach((dt) => {
      const clash = existing.some(
        (x) =>
          x.teacher_id === teacherId &&
          x.student_id !== studentId &&
          isBlocking(x.status) &&
          new Date(x.date_time).getTime() === dt.getTime(),
      );
      (clash ? conflicts : clear).push(dt);
    });

    if (clear.length > 0) {
      const batch: ExtSession[] = clear.map((dt, i) => ({
        id: `bulk-${Date.now()}-${i}`,
        student_id: studentId,
        teacher_id: teacherId,
        date_time: dt.toISOString(),
        duration_minutes: 60,
        teams_link: teamsLink,
        status: "scheduled",
      }));
      onCreate(batch);
    }
    setConflictSummary(conflicts);
    if (conflicts.length === 0) { setStartDate(""); setEndDate(""); }
  };


  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Student">
          <select className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.company}</option>)}
          </select>
        </Field>
        <Field label="Teacher">
          <select className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="MS Teams link (auto)">
          <input className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={teamsLink} readOnly />
        </Field>
        <Field label="Start date">
          <input type="date" className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <input type="date" className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Session start time">
          <input type="time" className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      <Field label="Frequency (days of week)">
        <div className="mt-1 flex flex-wrap gap-2">
          {DAY_LABELS.map((lbl, i) => {
            const v = DAY_INDEX[i];
            const active = days.includes(v);
            return (
              <button
                key={v}
                onClick={() => toggleDay(v)}
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: BRAND, color: "white", borderColor: BRAND }
                    : { backgroundColor: "transparent", color: "var(--foreground)", borderColor: "var(--border)" }
                }
              >
                {lbl}
              </button>
            );
          })}
        </div>
      </Field>

      {generated.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl border p-4 text-sm"
          style={
            overLimit
              ? { backgroundColor: "#fff4e6", borderColor: ORANGE, color: "#7a3d00" }
              : { backgroundColor: "var(--secondary)", borderColor: "var(--border)", color: "var(--foreground)" }
          }
        >
          {overLimit ? <AlertTriangle className="mt-0.5 h-4 w-4" style={{ color: ORANGE }} /> : <Users className="mt-0.5 h-4 w-4" />}
          <div>
            {overLimit ? (
              <>
                <div className="font-semibold">Attention: This range generates {generated.length} sessions, but the student only has {remaining} hours remaining.</div>
                <div className="mt-0.5 text-xs">Please adjust the range to fit within the contracted plan.</div>
              </>
            ) : (
              <div>This range will generate <span className="font-semibold">{generated.length}</span> sessions. Student has <span className="font-semibold">{remaining}</span> hours remaining in plan.</div>
            )}
          </div>
        </div>
      )}

      {conflictSummary.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl border p-4 text-sm"
          style={{ backgroundColor: "#fef2f2", borderColor: "#dc2626", color: "#7f1d1d" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4" style={{ color: "#dc2626" }} />
          <div>
            <div className="font-semibold">
              {conflictSummary.length} session{conflictSummary.length === 1 ? "" : "s"} could not be created — the teacher is already booked at that time.
            </div>
            <div className="mt-1 text-xs">
              Conflicting slots: {conflictSummary
                .map((d) => d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))
                .join(" · ")}
            </div>
            <div className="mt-0.5 text-xs">All other dates were scheduled. Change the teacher or time to resolve these, or handle them manually.</div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={assign}
          disabled={overLimit || generated.length === 0 || !studentId || !teacherId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: ORANGE }}
        >
          <CalendarPlus className="h-4 w-4" /> Assign {generated.length > 0 ? `(${generated.length})` : ""}
        </button>
      </div>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

// ============== Per-student modal ==============
function StudentSessionsModal({
  studentId,
  sessions,
  teachers,
  onClose,
  onSave,
}: {
  studentId: string;
  sessions: ExtSession[];
  teachers: ReturnType<typeof USERS.filter>;
  onClose: () => void;
  onSave: (next: ExtSession[]) => void;
}) {
  const student = userById(studentId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const studentSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.student_id === studentId)
        .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time))
        .slice(0, 10),
    [sessions, studentId],
  );

  // Shared source of truth: the student's Video Call Link (Students profile).
  const currentTeamsLink = getStudentVideoLink(studentId) || `https://teams.microsoft.com/l/meetup/${studentId}`;

  const updateSession = (id: string, patch: Partial<ExtSession>, rescheduleApplied = false) => {
    const next = sessions.map((s) => {
      if (s.id !== id) return s;
      const merged = { ...s, ...patch };
      if (rescheduleApplied) {
        if (s.status === "scheduled" || s.status === "rescheduled") merged.status = "rescheduled";
        else if (s.status === "ready" || s.status === "rearranged") merged.status = "rearranged";
      }
      return merged;
    });
    onSave(next);
  };


  const applyBulk = (opts: { teamsLink: string; teacherId: string; time: string; days: number[] }) => {
    const [hh, mm] = opts.time.split(":").map(Number);
    const next = sessions.map((s) => {
      if (s.student_id !== studentId) return s;
      if (["completed", "absent"].includes(s.status)) return s;
      const merged: ExtSession = { ...s, teams_link: opts.teamsLink, teacher_id: opts.teacherId };
      const dt = new Date(s.date_time);
      dt.setHours(hh, mm, 0, 0);
      if (opts.days.length > 0 && !opts.days.includes(dt.getDay())) {
        for (let i = 1; i <= 7; i++) {
          const d = new Date(dt); d.setDate(d.getDate() + i);
          if (opts.days.includes(d.getDay())) { dt.setDate(dt.getDate() + i); break; }
        }
      }
      merged.date_time = dt.toISOString();
      if (s.status === "scheduled" || s.status === "rescheduled") merged.status = "rescheduled";
      else if (s.status === "ready" || s.status === "rearranged") merged.status = "rearranged";
      return merged;
    });
    onSave(next);
    setBulkOpen(false);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-2xl bg-card p-6 shadow-floating max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 pr-10">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Student Calendar</div>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground text-slate-50">{student?.name}</h3>
            <div className="mt-0.5 text-sm text-muted-foreground">{student?.company} · {student?.hired_plan}</div>
          </div>
          <button
            onClick={() => setBulkOpen((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors hover:opacity-90"
            style={{ borderColor: BRAND, color: BRAND, backgroundColor: bulkOpen ? "#e6eef3" : "transparent" }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Bulk Schedule / Link
          </button>
        </div>

        {bulkOpen && (
          <BulkEditForm
            teachers={teachers}
            currentTeamsLink={currentTeamsLink}
            currentTeacherId={studentSessions.find((s) => !["completed","absent"].includes(s.status))?.teacher_id ?? teachers[0]?.id ?? ""}
            onCancel={() => setBulkOpen(false)}
            onApply={applyBulk}
          />
        )}

        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Teacher</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentSessions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No scheduled sessions yet.</td></tr>
              )}
              {studentSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  teachers={teachers}
                  editing={editingId === s.id}
                  onEdit={() => setEditingId(s.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => removeSession(s.id)}
                  onSubmit={(patch, rescheduled) => {
                    updateSession(s.id, patch, rescheduled);
                    setEditingId(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  teachers,
  editing,
  onEdit,
  onCancelEdit,
  onDelete,
  onSubmit,
}: {
  session: ExtSession;
  teachers: ReturnType<typeof USERS.filter>;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSubmit: (patch: Partial<ExtSession>, rescheduled: boolean) => void;
}) {
  const teacher = userById(session.teacher_id);
  const dt = new Date(session.date_time);
  const dateInput = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

  const [date, setDate] = useState(dateInput);
  const [teacherId, setTeacherId] = useState(session.teacher_id);

  const renderStatus = (s: ExtSessionStatus) => {
    if (s === "rearranged") {
      return (
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: AMBER, color: "white" }}
        >
          rearranged
        </span>
      );
    }
    return <Pill tone={statusTone(s)}>{s}</Pill>;
  };

  if (!editing) {
    return (
      <tr className="border-t border-border">
        <td className="px-4 py-3 text-foreground">{dt.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
        <td className="px-4 py-3 text-muted-foreground">{teacher?.name}</td>
        <td className="px-4 py-3">{renderStatus(session.status)}</td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            <button onClick={onEdit} className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={onDelete} className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border bg-secondary/30">
      <td className="px-4 py-3">
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
      </td>
      <td className="px-4 py-3">
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-full cursor-pointer rounded-md border border-input bg-background px-2 py-1.5 text-xs">
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{session.status}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onCancelEdit} className="!px-3 !py-1 text-xs">Cancel</GhostButton>
          <PrimaryButton
            onClick={() => {
              const newIso = new Date(date).toISOString();
              const dateChanged = newIso !== session.date_time;
              onSubmit({ date_time: newIso, teacher_id: teacherId }, dateChanged);
            }}
            className="!px-3 !py-1 text-xs"
            style={{ backgroundColor: ORANGE }}
          >
            Save
          </PrimaryButton>
        </div>
      </td>
    </tr>
  );
}

// ============== Bulk edit form (inside student modal) ==============
function BulkEditForm({
  teachers,
  currentTeamsLink,
  currentTeacherId,
  onCancel,
  onApply,
}: {
  teachers: ReturnType<typeof USERS.filter>;
  currentTeamsLink: string;
  currentTeacherId: string;
  onCancel: () => void;
  onApply: (opts: { teamsLink: string; teacherId: string; time: string; days: number[] }) => void;
}) {
  const [teamsLink, setTeamsLink] = useState(currentTeamsLink);
  const [teacherId, setTeacherId] = useState(currentTeacherId);
  const [time, setTime] = useState("19:00");
  const [days, setDays] = useState<number[]>([]);

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <div className="mb-5 rounded-xl border p-5" style={{ borderColor: BRAND, backgroundColor: "#f5f8fa" }}>
      <div className="mb-4 flex items-center gap-2">
        <Pencil className="h-4 w-4" style={{ color: BRAND }} />
        <div className="text-sm font-semibold" style={{ color: BRAND }}>Bulk Edit · Future sessions only</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="MS Teams Link (applied to all future sessions)">
          <input
            value={teamsLink}
            onChange={(e) => setTeamsLink(e.target.value)}
            className="mt-1.5 w-full cursor-text rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Update Teacher">
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="New Time Slot">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Change Frequency (optional)">
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DAY_LABELS.map((lbl, i) => {
              const v = DAY_INDEX[i];
              const active = days.includes(v);
              return (
                <button
                  key={v}
                  onClick={() => toggleDay(v)}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={
                    active
                      ? { backgroundColor: BRAND, color: "white", borderColor: BRAND }
                      : { backgroundColor: "transparent", color: "var(--foreground)", borderColor: "var(--border)" }
                  }
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <GhostButton onClick={onCancel} className="!px-4 !py-2 text-xs">Cancel</GhostButton>
        <button
          onClick={() => onApply({ teamsLink, teacherId, time, days })}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white shadow-soft transition-opacity hover:opacity-90"
          style={{ backgroundColor: ORANGE }}
        >
          Apply Bulk Changes
        </button>
      </div>
    </div>
  );
}
