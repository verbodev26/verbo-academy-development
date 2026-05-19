import { createFileRoute } from "@tanstack/react-router";
import { USERS, SESSIONS } from "@/lib/mock-data";
import { Card, MetricCard, Pill, ProgressBar, SectionTitle } from "@/components/verbo/ui";

export const Route = createFileRoute("/admin/kpis")({ component: Page });

function Page() {
  const teachers = USERS.filter((u) => u.role === "teacher");

  const rows = teachers.map((t) => {
    const mine = SESSIONS.filter((s) => s.teacher_id === t.id);
    const completed = mine.filter((s) => s.status === "completed");
    const reports = completed.filter((s) => s.report_pdf_url).length;
    const ratings = completed.map((s) => s.student_rating ?? 0).filter(Boolean);
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const punctuality = mine.length ? Math.round((completed.length / mine.length) * 100) : 0;
    const reportRate = completed.length ? Math.round((reports / completed.length) * 100) : 0;
    return { t, avg, punctuality, reportRate, total: mine.length };
  });

  const overallAvg = rows.length ? (rows.reduce((a, r) => a + r.avg, 0) / rows.length).toFixed(1) : "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">KPIs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Punctuality, report submission and student ratings across the teaching team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Avg rating (all teachers)" value={`${overallAvg}★`} />
        <MetricCard label="Sessions tracked" value={String(SESSIONS.length)} />
        <MetricCard label="Teachers" value={String(teachers.length)} />
      </div>

      <section>
        <SectionTitle>Teacher performance</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ t, avg, punctuality, reportRate, total }) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{total} sessions</div>
                </div>
                <Pill tone="success">{avg ? `${avg.toFixed(1)}★` : "—"}</Pill>
              </div>
              <div className="mt-5 space-y-4">
                <Bar label="Punctuality" value={punctuality} />
                <Bar label="Report submission rate" value={reportRate} />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <ProgressBar value={value} />
    </div>
  );
}
