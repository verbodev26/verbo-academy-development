import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, studentsOfTeacher, userById, type Session, type SessionStatus, type Level } from "@/lib/mock-data";
import { Card, GhostButton, MetricCard, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { CalendarClock, FileEdit, X, Lock, Plus, Trash2, Download, CheckCircle2, Mic, PenLine, Ear, BookOpen, ChevronRight, Video, type LucideIcon } from "lucide-react";
import { savePerformance, type PerformanceRating } from "@/lib/performance-store";
import { MACRO_SKILLS as SHARED_MACRO_SKILLS, skillKey as sharedSkillKey, type BaseKey as SharedBaseKey } from "@/lib/skills-taxonomy";
import { submitSessionReport, updateSession } from "@/lib/sessions-store";
import { PlanModal } from "@/components/verbo/PlanModal";
import { loadLevels, subscribeLevels } from "@/lib/courses-store";
import { loadLessonPlans, saveLessonPlan, subscribeLessonPlans, getLessonPlan, type LessonPlan } from "@/lib/lesson-plans-store";
import type { ExtSession } from "@/lib/sessions-store";
import { markVipUnitDone, clearVipUnitDoneForSession } from "@/lib/vip-courses-store";

export const Route = createFileRoute("/teacher/")({
  // Optional deep-link from the Calendar page → auto-open the Session Report
  // for a given session id. `report` maps to a session in `sessions`.
  validateSearch: (search: Record<string, unknown>) => ({
    report: typeof search.report === "string" ? (search.report as string) : undefined,
  }),
  component: TeacherDashboard,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const REPORT_WINDOW_MS = 24 * 3_600_000;

type LocalSession = Session & { _noReport?: boolean };

function TeacherDashboard() {
  const { user } = useAuth();
  const { report: reportId } = useSearch({ from: "/teacher/" });
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [sessions, setSessions] = useState<LocalSession[]>(() => SESSIONS.map((s) => ({ ...s })));
  const [evaluating, setEvaluating] = useState<Session | null>(null);
  const [editing, setEditing] = useState<{ session: Session; perf: PerformanceRating; subskills: Record<string, number> } | null>(null);
  const [planning, setPlanning] = useState<Session | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [plans, setPlans] = useState<Record<string, LessonPlan>>({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  // Hydrate levels + lesson plans on the client only (avoids SSR mismatch)
  useEffect(() => {
    setLevels(loadLevels());
    setPlans(loadLessonPlans());
    const u1 = subscribeLevels(() => setLevels(loadLevels()));
    const u2 = subscribeLessonPlans(() => setPlans(loadLessonPlans()));
    return () => { u1(); u2(); };
  }, []);

  // If we arrived with ?report=<id>, auto-open Step 1 for that session
  // (or Step 2 if we've already been through Step 1). We clear the search
  // so refresh doesn't re-open the modal after cancel.
  useEffect(() => {
    if (!reportId) return;
    const s = sessions.find((x) => x.id === reportId);
    if (s && !evaluating && !editing) setEvaluating(s);
    navigate({ to: "/teacher", search: {} as never, replace: true });
  }, [reportId, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-lock overdue sessions: flip to completed-without-report
  useEffect(() => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.status !== "scheduled") return s;
        const end = +new Date(s.date_time) + s.duration_minutes * 60_000;
        if (now > end + REPORT_WINDOW_MS) {
          return { ...s, status: "completed", _noReport: true };
        }
        return s;
      }),
    );
  }, [now]);

  if (!user) return null;
  const students = studentsOfTeacher(user.id);
  const mySessions = sessions.filter((s) => s.teacher_id === user.id);
  const upcoming = mySessions.filter((s) => s.status === "scheduled").sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  const recent = mySessions.filter((s) => s.status !== "scheduled").slice(0, 5);
  const toPlan = upcoming.slice(0, 3);

  const handleSubmit = (
    sessionId: string,
    attendance: "present" | "delayed" | "absent",
    perf: PerformanceRating,
    subskills: Record<string, number>,
    absentCause?: "student" | "teacher",
  ) => {
    if (!user) return;
    const session = sessions.find((s) => s.id === sessionId);
    // 1. Local dashboard mirror (Session interface only stores 4 statuses).
    setSessions((prev) => prev.map((s) => {
      if (s.id !== sessionId) return s;
      const status: SessionStatus = attendance === "absent" ? "absent" : "completed";
      return { ...s, status, _noReport: false };
    }));
    // 2. Canonical shared sessions-store: status + attendance metadata +
    //    real subskill scores + coverage-note auto-clear (all inside helper).
    submitSessionReport({
      sessionId,
      teacherId: user.id,
      studentId: session?.student_id ?? "",
      attendance,
      absentCause,
      subskills,
    });
    // 2b. VIP unit unlock: if this session's plan links a VIP unit and the
    //     session is now Completed, mark that unit done. Otherwise clear any
    //     prior completion (e.g. Absent report on a session that had closed
    //     a unit before via a re-tag) so unlock state stays truthful.
    const plan = getLessonPlan(sessionId);
    if (plan?.vip_unit_id) {
      if (attendance !== "absent") markVipUnitDone(plan.vip_unit_id, sessionId);
      else clearVipUnitDoneForSession(sessionId);
    }
    // 3. Legacy back-compat: some seed sessions never touched sessions-store
    //    yet; savePerformance keeps the 4-base map warm for them.
    if (attendance !== "absent") savePerformance(sessionId, perf);
    setEditing(null);
  };

  const handleSavePlan = (plan: LessonPlan) => {
    saveLessonPlan(plan);
    // Promote the shared session record to Ready so both the teacher and
    // student calendars reflect the plan being locked in.
    updateSession(plan.session_id, { status: "ready" as any });
    setPlans((prev) => ({ ...prev, [plan.session_id]: plan }));
    setPlanning(null);
  };

  return (
    <div className="space-y-10">
      <header>
        <div className="text-sm text-muted-foreground">Good day,</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-black">{user.name}</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Assigned students" value={String(students.length)} />
        <MetricCard label="Upcoming sessions" value={String(upcoming.length)} sub="next 7 days" />
        <MetricCard label="Avg rating" value="4.7★" sub="last 30 days" />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {/* Left — Plan your upcoming Sessions */}
        <div>
          <SectionTitle>Plan your upcoming Sessions</SectionTitle>
          <div className="space-y-3">
            {toPlan.length === 0 && (
              <Card><p className="text-sm text-muted-foreground">No sessions to plan right now.</p></Card>
            )}
            {toPlan.map((s) => {
              const student = userById(s.student_id);
              const planned = Boolean(plans[s.id]);
              return (
                <Card key={s.id} className="flex items-center justify-between gap-3 !p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary"><CalendarClock className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{student?.name} <span className="text-muted-foreground">· {student?.current_level}</span></div>
                      <div className="text-xs text-muted-foreground">{fmt(s.date_time)}</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {planned && <Pill tone="success">Planned</Pill>}
                    <GhostButton onClick={() => setPlanning(s)}>{planned ? "Review" : "Plan"}</GhostButton>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right — Complete your sessions */}
        <div>
          <SectionTitle>Complete your sessions</SectionTitle>
          <div className="space-y-3">
            {upcoming.length === 0 && (
              <Card><p className="text-sm text-muted-foreground">No sessions awaiting completion.</p></Card>
            )}
            {upcoming.map((s) => {
              const student = userById(s.student_id);
              const start = +new Date(s.date_time);
              const end = start + s.duration_minutes * 60_000;
              const isActive = now >= start && now <= end;
              const sessionPassed = now >= start;
              const deadline = end + REPORT_WINDOW_MS;
              const msLeft = deadline - now;
              const overdue = sessionPassed && msLeft <= 0;
              const showReportControls = sessionPassed;

              return (
                <Card key={s.id} className="flex flex-col gap-3 !p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary"><CalendarClock className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{student?.name} <span className="text-muted-foreground">· {student?.current_level}</span></div>
                      <div className="text-xs text-muted-foreground">{fmt(s.date_time)} · {s.duration_minutes} min</div>
                    </div>
                    {isActive && <Pill tone="success">Live now</Pill>}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {showReportControls && !overdue && (
                      <span className="mr-auto text-xs font-medium text-muted-foreground tabular-nums">
                        Time left: {formatCountdown(msLeft)}
                      </span>
                    )}
                    {isActive && s.teams_link && (
                      <a
                        href={s.teams_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "#16a34a" }}
                      >
                        <Video className="h-4 w-4" /> Join Live Session
                      </a>
                    )}
                    {showReportControls && (
                      overdue ? (
                        <button
                          disabled
                          className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                        >
                          <Lock className="h-4 w-4" /> Overdue (Locked)
                        </button>
                      ) : (
                        <PrimaryButton onClick={() => setEvaluating(s)}>
                          <FileEdit className="h-4 w-4" /> Fill session report
                        </PrimaryButton>
                      )
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>Recent activity</SectionTitle>
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-6 py-3 font-medium">Student</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => {
                const student = userById(s.student_id);
                const tone = s._noReport ? "warning" : s.status === "completed" ? "success" : s.status === "absent" ? "danger" : s.status === "delayed" ? "warning" : "default";
                const label = s._noReport ? "Completed without report" : s.status;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-foreground">{student?.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(s.date_time)}</td>
                    <td className="px-6 py-4"><Pill tone={tone as any}>{label}</Pill></td>
                    <td className="px-6 py-4 text-muted-foreground">{s.student_rating ? `${s.student_rating}★` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {evaluating && (
        <PerformanceEvaluationModal
          session={evaluating}
          onClose={() => setEvaluating(null)}
          onContinue={(perf, subskills) => {
            setEditing({ session: evaluating, perf, subskills });
            setEvaluating(null);
          }}
        />
      )}
      {editing && (
        <ReportModal
          session={editing.session}
          perf={editing.perf}
          subskills={editing.subskills}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      )}
      {planning && (
        <PlanModal
          session={planning as ExtSession}
          existing={plans[planning.id]}
          levels={levels}
          onClose={() => setPlanning(null)}
          onSave={handleSavePlan}
        />
      )}
    </div>
  );
}

function formatCountdown(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

type EntryType = "New word" | "Pronunciation" | "Mistake" | "Tip" | "Other";
interface Entry { id: string; type: EntryType; term: string; explanation: string }
const ENTRY_TYPES: EntryType[] = ["New word", "Pronunciation", "Mistake", "Tip", "Other"];
const MIN_ENTRIES = 6;
const MAX_ENTRIES = 10;

const ENTRY_PLACEHOLDERS: Record<EntryType, { term: string; explanation: string }> = {
  "New word": { term: "New word…", explanation: "Definition or example of use…" },
  "Mistake": { term: "Student's mistake…", explanation: "Correct form…" },
  "Pronunciation": { term: "Target word/phrase…", explanation: "Phonetic guide or sound correction…" },
  "Tip": { term: "Focus area…", explanation: "Practical advice…" },
  "Other": { term: "Topic/Concept…", explanation: "Additional notes…" },
};

function makeEntry(): Entry {
  return { id: Math.random().toString(36).slice(2), type: "New word", term: "", explanation: "" };
}

type Attendance = "present" | "delayed" | "absent";
function ReportModal({ session, perf, subskills, onClose, onSubmit }: {
  session: Session;
  perf: PerformanceRating;
  subskills: Record<string, number>;
  onClose: () => void;
  onSubmit: (id: string, attendance: Attendance, perf: PerformanceRating, subskills: Record<string, number>, absentCause?: "student" | "teacher") => void;
}) {
  const student = userById(session.student_id);
  const [attendance, setAttendance] = useState<Attendance>("present");
  // Only meaningful when attendance is "absent" — reused from the Admin
  // Sessions engine's canonical absent_cause selector.
  const [absentCause, setAbsentCause] = useState<"student" | "teacher">("student");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => Array.from({ length: MIN_ENTRIES }, makeEntry));
  const [submitted, setSubmitted] = useState(false);

  const bgFor = (opt: Attendance) => opt === "present" ? "#22c55e" : opt === "absent" ? "#ef4444" : "#f38934";

  const filledCount = entries.filter((e) => e.term.trim().length > 0 && e.explanation.trim().length > 0).length;
  const isAbsent = attendance === "absent";
  const notesFilled = notes.trim().length > 0;
  const canSubmit = isAbsent
    ? notesFilled
    : filledCount >= MIN_ENTRIES && filledCount <= MAX_ENTRIES && notesFilled;

  const addEntry = () => setEntries((p) => (p.length >= MAX_ENTRIES ? p : [...p, makeEntry()]));
  const updateEntry = (id: string, patch: Partial<Entry>) =>
    setEntries((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeEntry = (id: string) => setEntries((p) => p.filter((e) => e.id !== id));

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    onSubmit(session.id, attendance, perf, subskills, isAbsent ? absentCause : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="report-modal-scroll w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-8 shadow-floating">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{submitted ? "Final report preview" : "Session report"}</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground text-gray-950">{student?.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{fmt(session.date_time)}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {submitted ? (
          <ReportPreview
            studentName={student?.name ?? ""}
            dateLabel={fmt(session.date_time)}
            status={attendance === "absent" ? "absent" : attendance === "delayed" ? "delayed" : "completed"}
            notes={notes}
            entries={entries
              .filter((e) => e.term.trim().length > 0 && e.explanation.trim().length > 0)
              .map((e) => ({ id: e.id, type: e.type, content: `${e.term.trim()} — ${e.explanation.trim()}` }))}
            onClose={onClose}
          />
        ) : (
          <>
            <div className="mt-6">
              <label className="text-xs font-medium text-foreground">Attendance</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["present", "absent", "delayed"] as Attendance[]).map((opt) => {
                  const selected = attendance === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAttendance(opt)}
                      style={selected ? { backgroundColor: bgFor(opt) } : undefined}
                      className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                        selected ? "border-transparent text-white" : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {opt === "present" ? "Present" : opt === "delayed" ? "Delayed" : "Absent"}
                    </button>
                  );
                })}
              </div>
              {attendance === "delayed" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  "Delayed" is not a session status: the session still ends as <strong>Completed</strong>
                  with a late-attendance marker used for KPIs.
                </p>
              )}
            </div>

            {isAbsent ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground">Absent cause <span className="text-red-600">*</span></label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["student", "teacher"] as const).map((cause) => (
                      <button
                        key={cause}
                        onClick={() => setAbsentCause(cause)}
                        className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                          absentCause === cause
                            ? "border-transparent bg-[#01304a] text-white"
                            : "border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        {cause}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Reuses the same sub-cause from Admin &gt; Sessions. Only absences with Student cause
                    penalize the student's attendance.
                  </p>
                </div>
                <div>
                <label className="text-xs font-medium text-foreground">Teacher's comments <span className="text-muted-foreground">(required)</span></label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Justification, follow-up plan, communication with the student…"
                  className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Pedagogical entries</label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {filledCount} / {MIN_ENTRIES}–{MAX_ENTRIES} filled
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {entries.map((e) => (
                      <div key={e.id} className="flex items-start gap-2">
                        <select
                          value={e.type}
                          onChange={(ev) => updateEntry(e.id, { type: ev.target.value as EntryType })}
                          className="h-[42px] w-[150px] shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <div className="flex flex-1 gap-2">
                          <input
                            value={e.term}
                            onChange={(ev) => updateEntry(e.id, { term: ev.target.value })}
                            placeholder={ENTRY_PLACEHOLDERS[e.type].term}
                            className="h-[42px] min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <input
                            value={e.explanation}
                            onChange={(ev) => updateEntry(e.id, { explanation: ev.target.value })}
                            placeholder={ENTRY_PLACEHOLDERS[e.type].explanation}
                            className="h-[42px] min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <button
                          onClick={() => removeEntry(e.id)}
                          disabled={entries.length <= 1}
                          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addEntry}
                    disabled={entries.length >= MAX_ENTRIES}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" /> Add new entry
                  </button>
                </div>

                <div className="mt-5">
                  <label className="text-xs font-medium text-foreground">Class notes <span className="text-red-600">*</span> <span className="text-muted-foreground">(required)</span></label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Topics covered, student performance, homework…"
                    className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {isAbsent
                  ? (notesFilled ? "Ready to submit." : "Comments required to submit.")
                  : filledCount < MIN_ENTRIES
                  ? `Add ${MIN_ENTRIES - filledCount} more entr${MIN_ENTRIES - filledCount === 1 ? "y" : "ies"} to submit.`
                  : !notesFilled
                  ? "Class notes are required to submit."
                  : "Ready to submit."}
              </p>
              <div className="flex gap-2">
                <GhostButton onClick={onClose}>Cancel</GhostButton>
                <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>Submit report</PrimaryButton>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReportPreview({ studentName, dateLabel, status, notes, entries, onClose }: {
  studentName: string; dateLabel: string; status: SessionStatus; notes: string; entries: { id: string; type: EntryType; content: string }[]; onClose: () => void;
}) {
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <span>Report successfully compiled and dispatched to the student's registered email!</span>
      </div>

      <div className="rounded-xl border border-border bg-background p-6">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#01304a" }}>Verbo Language Solutions</div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">Final Session Report</h3>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{dateLabel}</div>
            <div className="mt-0.5 capitalize">Status: <span className="font-medium text-foreground">{status === "completed" ? "Completed" : status}</span></div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Student</div>
            <div className="mt-0.5 font-medium text-foreground">{studentName}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Entries</div>
            <div className="mt-0.5 font-medium text-foreground">{entries.length}</div>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-[140px]">Type</th>
                  <th className="px-3 py-2 font-medium">Content</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#f3893420", color: "#01304a" }}>{e.type}</span>
                    </td>
                    <td className="px-3 py-2 text-foreground">{e.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {notes.trim().length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Teacher's comments</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{notes}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <GhostButton onClick={onClose}>Close</GhostButton>
        <PrimaryButton onClick={() => alert("Mock download: Verbo_Session_Report.pdf")}>
          <Download className="h-4 w-4" /> Download PDF (Mock Download)
        </PrimaryButton>
      </div>
    </div>
  );
}


// ============================================================
// New two-tier Performance Evaluation system
// ============================================================

type BaseKey = SharedBaseKey;

interface SubSkillDef { name: string; base: BaseKey }
interface MacroSkillDef {
  key: "Speaking" | "Writing" | "Listening" | "Reading";
  icon: LucideIcon;
  subs: SubSkillDef[];
}

// Sourced from the shared taxonomy so the Session Report, the student
// dashboard "Linguistic Asset Performance" widget, and the teacher
// "Overall Skills" summary all stay perfectly in sync.
const MACRO_SKILLS: MacroSkillDef[] = SHARED_MACRO_SKILLS as unknown as MacroSkillDef[];

// Scores keyed by `${macroKey}::${subName}` → 0-100 number or null (skipped).
type ScoresMap = Record<string, number | null>;

function subKey(macro: string, sub: string) {
  return `${macro}::${sub}`;
}

function scoreColorClasses(value: number) {
  if (value < 50) return "text-red-600 bg-red-50 border-red-200";
  if (value < 60) return "text-orange-600 bg-orange-50 border-orange-200";
  if (value < 70) return "text-amber-600 bg-amber-50 border-amber-200";
  if (value < 80) return "text-lime-600 bg-lime-50 border-lime-200";
  if (value < 90) return "text-emerald-500 bg-emerald-50 border-emerald-200";
  return "text-emerald-700 bg-emerald-100 border-emerald-300";
}

function sliderAccent(value: number) {
  if (value < 50) return "#dc2626";
  if (value < 60) return "#ea580c";
  if (value < 70) return "#d97706";
  if (value < 80) return "#65a30d";
  if (value < 90) return "#10b981";
  return "#047857";
}

function macroOverall(macro: MacroSkillDef, scores: ScoresMap): number | null {
  const vals: number[] = [];
  for (const s of macro.subs) {
    const v = scores[subKey(macro.key, s.name)];
    if (typeof v === "number") vals.push(v);
  }
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function macroRatedCount(macro: MacroSkillDef, scores: ScoresMap): number {
  return macro.subs.reduce((acc, s) => acc + (typeof scores[subKey(macro.key, s.name)] === "number" ? 1 : 0), 0);
}

/** Map 0-100 sub-skill scores → legacy PerformanceRating (0-5 per base dim, avg of evaluated). */
function buildPerformanceRating(scores: ScoresMap): PerformanceRating {
  const buckets: Record<BaseKey, number[]> = { fluency: [], vocabulary: [], confidence: [], grammar: [] };
  for (const m of MACRO_SKILLS) {
    for (const s of m.subs) {
      const v = scores[subKey(m.key, s.name)];
      if (typeof v === "number") buckets[s.base].push(v);
    }
  }
  const toStars = (arr: number[]) => arr.length === 0 ? 0 : Math.max(0, Math.min(5, (arr.reduce((a, b) => a + b, 0) / arr.length) / 20));
  return {
    fluency: toStars(buckets.fluency),
    vocabulary: toStars(buckets.vocabulary),
    confidence: toStars(buckets.confidence),
    grammar: toStars(buckets.grammar),
  };
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
        --
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tabular-nums ${scoreColorClasses(value)}`}>
      {value}%
    </span>
  );
}

function PerformanceEvaluationModal({
  session,
  onClose,
  onContinue,
}: {
  session: Session;
  onClose: () => void;
  onContinue: (perf: PerformanceRating, subskills: Record<string, number>) => void;
}) {
  const student = userById(session.student_id);
  const [scores, setScores] = useState<ScoresMap>({});
  const [activeMacro, setActiveMacro] = useState<MacroSkillDef | null>(null);

  const handleContinue = () => {
    // Raw per-subskill map (0-100) — this is the record that gets written
    // to performance-store via saveSubskillEvaluation, feeding the exact
    // same data source consumed by the student's "Linguistic Asset
    // Performance" widget and the teacher's "Overall Skills" summary.
    const rawSubskills: Record<string, number> = {};
    for (const m of MACRO_SKILLS) {
      for (const s of m.subs) {
        const v = scores[subKey(m.key, s.name)];
        if (typeof v === "number") {
          rawSubskills[sharedSkillKey(m.key as any, s.name)] = v;
        }
      }
    }
    onContinue(buildPerformanceRating(scores), rawSubskills);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-floating"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Step 1 of 2</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
              Student Performance Evaluation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Student</div>
              <div className="mt-0.5 font-medium text-foreground">{student?.name}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Session Details</div>
              <div className="mt-0.5 font-medium text-foreground">{fmt(session.date_time)}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {MACRO_SKILLS.map((m) => {
            const rated = macroRatedCount(m, scores);
            const overall = macroOverall(m, scores);
            const Icon = m.icon;
            const statusLabel = rated === 0 ? "Skipped" : `${rated} of ${m.subs.length} rated`;
            return (
              <button
                key={m.key}
                onClick={() => setActiveMacro(m)}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-[#01304a]/30 hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(1, 48, 74, 0.06)", color: "#01304a" }}>
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "#01304a" }}>{m.key}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-medium ${rated === 0 ? "text-slate-400" : "text-muted-foreground"}`}>
                    {statusLabel}
                  </span>
                  <ScoreBadge value={overall} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-end gap-3">
          <button
            onClick={handleContinue}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#f38934" }}
          >
            Confirm & Continue
          </button>
        </div>
      </div>

      {activeMacro && (
        <SubSkillModal
          macro={activeMacro}
          scores={scores}
          onChange={setScores}
          onClose={() => setActiveMacro(null)}
        />
      )}
    </div>
  );
}

function SubSkillModal({
  macro,
  scores,
  onChange,
  onClose,
}: {
  macro: MacroSkillDef;
  scores: ScoresMap;
  onChange: (next: ScoresMap) => void;
  onClose: () => void;
}) {
  const Icon = macro.icon;

  const setSub = (name: string, value: number | null) => {
    const next = { ...scores };
    const k = subKey(macro.key, name);
    if (value === null) delete next[k];
    else next[k] = value;
    onChange(next);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-8 shadow-floating"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(1, 48, 74, 0.06)", color: "#01304a" }}>
              <Icon className="h-5 w-5" strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Tier 2 evaluation</div>
              <h3 className="text-lg font-semibold tracking-tight" style={{ color: "#01304a" }}>
                {macro.key} Session Evaluation
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {macro.subs.map((s) => {
            const v = scores[subKey(macro.key, s.name)];
            const active = typeof v === "number";
            const accent = active ? sliderAccent(v as number) : "#cbd5e1";
            return (
              <div key={s.name} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold" style={{ color: active ? "#01304a" : "#94a3b8" }}>
                    {s.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {active ? (
                      <>
                        <ScoreBadge value={v as number} />
                        <button
                          onClick={() => setSub(s.name, null)}
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Reset ${s.name}`}
                          title="Reset to Skipped"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                        Skipped
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={active ? (v as number) : 0}
                  onChange={(e) => setSub(s.name, Number(e.currentTarget.value))}
                  onClick={(e) => {
                    if (!active) setSub(s.name, Number((e.currentTarget as HTMLInputElement).value));
                  }}
                  className="mt-3 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    height: 6,
                    background: active
                      ? `linear-gradient(to right, ${accent} 0%, ${accent} ${v as number}%, #e2e8f0 ${v as number}%, #e2e8f0 100%)`
                      : "#e2e8f0",
                    accentColor: accent,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-end">
          <button
            onClick={onClose}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#01304a" }}
          >
            Ready
          </button>
        </div>
      </div>
    </div>
  );
}

