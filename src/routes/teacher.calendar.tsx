import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { SESSIONS, userById } from "@/lib/mock-data";
import { Card, Pill } from "@/components/verbo/ui";

export const Route = createFileRoute("/teacher/calendar")({ component: Page });

function Page() {
  const { user } = useAuth();
  const mine = SESSIONS.filter((s) => s.teacher_id === user?.id).sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Calendar</h1>
      <p className="text-sm text-muted-foreground">View-only schedule of all your sessions.</p>
      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Student</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-6 py-4 text-foreground">{new Date(s.date_time).toLocaleString()}</td>
                <td className="px-6 py-4 text-muted-foreground">{userById(s.student_id)?.name}</td>
                <td className="px-6 py-4"><Pill tone={s.status === "completed" ? "success" : s.status === "absent" ? "danger" : "default"}>{s.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
