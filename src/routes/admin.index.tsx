import { createFileRoute } from "@tanstack/react-router";
import { USERS, SESSIONS, LEVELS } from "@/lib/mock-data";
import { MetricCard } from "@/components/verbo/ui";

export const Route = createFileRoute("/admin/")({ component: Overview });

function Overview() {
  const students = USERS.filter((u) => u.role === "student").length;
  const teachers = USERS.filter((u) => u.role === "teacher").length;
  const scheduled = SESSIONS.filter((s) => s.status === "scheduled").length;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground text-slate-50">Admin overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational snapshot across the platform.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Students" value={String(students)} />
        <MetricCard label="Teachers" value={String(teachers)} />
        <MetricCard label="Sessions scheduled" value={String(scheduled)} />
        <MetricCard label="Active levels" value={String(LEVELS.length)} />
      </div>
    </div>
  );
}
