import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, studentsOfTeacher, userById, type Session, type SessionStatus } from "@/lib/mock-data";
import { Card, GhostButton, MetricCard, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { CalendarClock, FileEdit, X, Lock, Plus, Trash2, Download, CheckCircle2, Star } from "lucide-react";
import { savePerformance, type PerformanceRating } from "@/lib/performance-store";

export const Route = createFileRoute("/teacher/")({ component: TeacherDashboard });

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const REPORT_WINDOW_MS = 24 * 3_600_000;

type LocalSession = Session & { _noReport?: boolean };

function TeacherDashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [sessions, setSessions] = useState<LocalSession[]>(() => SESSIONS.map((s) => ({ ...s })));
  const [evaluating, setEvaluating] = useState<Session | null>(null);
  const [editing, setEditing] = useState<{ session: Session; perf: PerformanceRating } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

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

  const handleSubmit = (sessionId: string, status: SessionStatus, perf: PerformanceRating) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, status, _noReport: false } : s)));
    if (status !== "absent") savePerformance(sessionId, perf);
    setEditing(null);
  };

  return (
    <div className="space-y-10">
      <header>
        <div className="text-sm text-muted-foreground">Good day,</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{user.name}</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Assigned students" value={String(students.length)} />
        <MetricCard label="Upcoming sessions" value={String(upcoming.length)} sub="next 7 days" />
        <MetricCard label="Avg rating" value="4.7★" sub="last 30 days" />
      </section>

      <section>
        <SectionTitle>Active & upcoming classes</SectionTitle>
        <div className="space-y-3">
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
              <Card key={s.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{student?.name} <span className="text-muted-foreground">· {student?.current_level}</span></div>
                    <div className="text-xs text-muted-foreground">{fmt(s.date_time)} · {s.duration_minutes} min</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 md:flex-row md:items-center">
                  {isActive && <Pill tone="success">Live now</Pill>}
                  {showReportControls && !overdue && (
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      Time left to submit: {formatCountdown(msLeft)}
                    </span>
                  )}
                  {showReportControls && (
                    overdue ? (
                      <button
                        disabled
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
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
          onContinue={(perf) => {
            setEditing({ session: evaluating, perf });
            setEvaluating(null);
          }}
        />
      )}
      {editing && (
        <ReportModal
          session={editing.session}
          perf={editing.perf}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
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
interface Entry { id: string; type: EntryType; content: string }
const ENTRY_TYPES: EntryType[] = ["New word", "Pronunciation", "Mistake", "Tip", "Other"];
const MIN_ENTRIES = 6;
const MAX_ENTRIES = 10;

function makeEntry(): Entry {
  return { id: Math.random().toString(36).slice(2), type: "New word", content: "" };
}

function ReportModal({ session, onClose, onSubmit }: { session: Session; onClose: () => void; onSubmit: (id: string, status: SessionStatus) => void }) {
  const student = userById(session.student_id);
  const [status, setStatus] = useState<SessionStatus>("completed");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<Entry[]>(() => Array.from({ length: MIN_ENTRIES }, makeEntry));
  const [submitted, setSubmitted] = useState(false);

  const bgFor = (opt: SessionStatus) => opt === "completed" ? "#22c55e" : opt === "absent" ? "#ef4444" : "#f38934";

  const filledCount = entries.filter((e) => e.content.trim().length > 0).length;
  const isAbsent = status === "absent";
  const canSubmit = isAbsent ? notes.trim().length > 0 : filledCount >= MIN_ENTRIES && filledCount <= MAX_ENTRIES;

  const addEntry = () => setEntries((p) => (p.length >= MAX_ENTRIES ? p : [...p, makeEntry()]));
  const updateEntry = (id: string, patch: Partial<Entry>) =>
    setEntries((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const removeEntry = (id: string) => setEntries((p) => p.filter((e) => e.id !== id));

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    onSubmit(session.id, status === "absent" ? "absent" : "completed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-8 shadow-floating">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{submitted ? "Final report preview" : "Session report"}</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{student?.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{fmt(session.date_time)}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {submitted ? (
          <ReportPreview
            studentName={student?.name ?? ""}
            dateLabel={fmt(session.date_time)}
            status={status}
            notes={notes}
            entries={entries.filter((e) => e.content.trim().length > 0)}
            onClose={onClose}
          />
        ) : (
          <>
            <div className="mt-6">
              <label className="text-xs font-medium text-foreground">Attendance</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["completed", "absent", "delayed"] as SessionStatus[]).map((opt) => {
                  const selected = status === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setStatus(opt)}
                      style={selected ? { backgroundColor: bgFor(opt) } : undefined}
                      className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                        selected ? "border-transparent text-white" : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {opt === "completed" ? "Present" : opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {isAbsent ? (
              <div className="mt-5">
                <label className="text-xs font-medium text-foreground">Teacher's comments <span className="text-muted-foreground">(required)</span></label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Justification, follow-up plan, communication with the student…"
                  className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
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
                    {entries.map((e, idx) => (
                      <div key={e.id} className="flex items-start gap-2">
                        <select
                          value={e.type}
                          onChange={(ev) => updateEntry(e.id, { type: ev.target.value as EntryType })}
                          className="h-[42px] w-[150px] shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          value={e.content}
                          onChange={(ev) => updateEntry(e.id, { content: ev.target.value })}
                          placeholder={`Entry #${idx + 1} — content or notes…`}
                          className="h-[42px] flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
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
                  <label className="text-xs font-medium text-foreground">Class notes <span className="text-muted-foreground">(optional)</span></label>
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
                  ? "Comments required to submit."
                  : filledCount < MIN_ENTRIES
                  ? `Add ${MIN_ENTRIES - filledCount} more entr${MIN_ENTRIES - filledCount === 1 ? "y" : "ies"} to submit.`
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
  studentName: string; dateLabel: string; status: SessionStatus; notes: string; entries: Entry[]; onClose: () => void;
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

