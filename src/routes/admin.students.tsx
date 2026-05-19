import { createFileRoute } from "@tanstack/react-router";
import { USERS } from "@/lib/mock-data";
import { Card, GhostButton, Pill, PrimaryButton } from "@/components/verbo/ui";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/admin/students")({ component: Page });

function Page() {
  const students = USERS.filter((u) => u.role === "student");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register, list and suspend students.</p>
        </div>
        <PrimaryButton><Plus className="h-4 w-4" /> Register student</PrimaryButton>
      </div>

      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Level</th>
              <th className="px-6 py-3 font-medium">Attendance</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-6 py-4 text-foreground">{s.name}</td>
                <td className="px-6 py-4 text-muted-foreground">{s.email}</td>
                <td className="px-6 py-4"><Pill tone="muted">{s.current_level}</Pill></td>
                <td className="px-6 py-4 text-muted-foreground">{s.attendance_percentage}%</td>
                <td className="px-6 py-4 text-right"><GhostButton>Suspend</GhostButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
