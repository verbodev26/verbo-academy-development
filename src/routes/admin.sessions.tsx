import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { USERS, SESSIONS, ASSIGNMENTS, userById, type Session } from "@/lib/mock-data";
import { Card, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";

export const Route = createFileRoute("/admin/sessions")({ component: Page });

function Page() {
  const students = USERS.filter((u) => u.role === "student");
  const [sessions, setSessions] = useState<Session[]>(SESSIONS);
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [dateTime, setDateTime] = useState("");
  const [link, setLink] = useState("");

  const assign = () => {
    const teacherAssignment = ASSIGNMENTS.find((a) => a.student_id === studentId);
    if (!teacherAssignment || !dateTime || !link) return;
    const id = `s${Date.now()}`;
    setSessions((p) => [
      { id, student_id: studentId, teacher_id: teacherAssignment.teacher_id, date_time: new Date(dateTime).toISOString(), duration_minutes: 60, teams_link: link, status: "scheduled" },
      ...p,
    ]);
    setDateTime(""); setLink("");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Schedule live classes — automatically pushed to the student's dashboard.</p>
      </div>

      <Card>
        <SectionTitle>Schedule a session</SectionTitle>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Student">
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="select">
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Date & time">
            <input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="select" />
          </Field>
          <Field label="MS Teams link">
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://teams.microsoft.com/…" className="select" />
          </Field>
          <div className="flex items-end">
            <PrimaryButton onClick={assign} className="h-[42px]">Assign</PrimaryButton>
          </div>
        </div>
      </Card>

      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 font-medium">When</th>
              <th className="px-6 py-3 font-medium">Student</th>
              <th className="px-6 py-3 font-medium">Teacher</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time)).map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-6 py-4 text-foreground">{new Date(s.date_time).toLocaleString()}</td>
                <td className="px-6 py-4 text-muted-foreground">{userById(s.student_id)?.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{userById(s.teacher_id)?.name}</td>
                <td className="px-6 py-4"><Pill tone={s.status === "completed" ? "success" : s.status === "absent" ? "danger" : "default"}>{s.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <style>{`.select{ margin-top:.375rem; width:100%; border-radius:.5rem; border:1px solid var(--input); background:var(--background); padding:.625rem .75rem; font-size:.875rem; color:var(--foreground); outline:none; }
      .select:focus{ box-shadow:0 0 0 2px var(--ring); }`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-foreground">{label}</label>{children}</div>;
}
