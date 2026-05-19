import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, studentsOfTeacher, userById, type Session, type SessionStatus } from "@/lib/mock-data";
import { Card, GhostButton, MetricCard, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { CalendarClock, FileEdit, X } from "lucide-react";

export const Route = createFileRoute("/teacher/")({ component: TeacherDashboard });

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TeacherDashboard() {
  const { user } = useAuth();
  if (!user) return null;
  const students = studentsOfTeacher(user.id);
  const mySessions = SESSIONS.filter((s) => s.teacher_id === user.id);
  const upcoming = mySessions.filter((s) => s.status === "scheduled").sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  const recent = mySessions.filter((s) => s.status !== "scheduled").slice(0, 5);

  const [editing, setEditing] = useState<Session | null>(null);

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
            const now = Date.now();
            const start = +new Date(s.date_time);
            const end = start + s.duration_minutes * 60_000;
            const isActive = now >= start && now <= end;
            const canFillReport = now >= start && now <= end + 12 * 3_600_000;
            return (
              <Card key={s.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><CalendarClock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{student?.name} <span className="text-muted-foreground">· {student?.current_level}</span></div>
                    <div className="text-xs text-muted-foreground">{fmt(s.date_time)} · {s.duration_minutes} min</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isActive && <Pill tone="success">Live now</Pill>}
                  <PrimaryButton disabled={!canFillReport} onClick={() => setEditing(s)}>
                    <FileEdit className="h-4 w-4" /> Fill session report
                  </PrimaryButton>
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
                const tone = s.status === "completed" ? "success" : s.status === "absent" ? "danger" : s.status === "delayed" ? "warning" : "default";
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-foreground">{student?.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(s.date_time)}</td>
                    <td className="px-6 py-4"><Pill tone={tone as any}>{s.status}</Pill></td>
                    <td className="px-6 py-4 text-muted-foreground">{s.student_rating ? `${s.student_rating}★` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {editing && <ReportModal session={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ReportModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const student = userById(session.student_id);
  const [status, setStatus] = useState<SessionStatus>("completed");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-floating">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Session report</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{student?.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{fmt(session.date_time)}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-foreground">Attendance</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["completed", "absent", "delayed"] as SessionStatus[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setStatus(opt)}
                className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                  status === opt ? "border-accent bg-accent text-accent-foreground" : "border-border text-foreground hover:bg-secondary"
                }`}
              >
                {opt === "completed" ? "Present" : opt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs font-medium text-foreground">Class notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Topics covered, student performance, homework…"
            className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={onClose}>Submit report</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
