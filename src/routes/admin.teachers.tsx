import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { USERS, ASSIGNMENTS, userById } from "@/lib/mock-data";
import { Card, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";

export const Route = createFileRoute("/admin/teachers")({ component: Page });

function Page() {
  const teachers = USERS.filter((u) => u.role === "teacher");
  const students = USERS.filter((u) => u.role === "student");
  const [assignments, setAssignments] = useState(ASSIGNMENTS);
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");

  const assign = () => {
    if (!teacherId || !studentId) return;
    if (assignments.some((a) => a.teacher_id === teacherId && a.student_id === studentId)) return;
    setAssignments((p) => [...p, { teacher_id: teacherId, student_id: studentId }]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Teachers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Roster and student assignments.</p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-6 py-3 font-medium">Teacher</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Assigned students</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const assigned = assignments.filter((a) => a.teacher_id === t.id).map((a) => userById(a.student_id)?.name).filter(Boolean);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-foreground">{t.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{t.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {assigned.length ? assigned.map((n) => <Pill key={n} tone="muted">{n}</Pill>) : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionTitle>Assign student</SectionTitle>
          <div className="space-y-3">
            <Select label="Teacher" value={teacherId} onChange={setTeacherId} options={teachers.map((t) => ({ value: t.id, label: t.name }))} />
            <Select label="Student" value={studentId} onChange={setStudentId} options={students.map((s) => ({ value: s.id, label: s.name }))} />
            <PrimaryButton className="w-full" onClick={assign}>Assign</PrimaryButton>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
