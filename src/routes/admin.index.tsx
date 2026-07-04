import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { USERS, SESSIONS, LEVELS, type User, type Session } from "@/lib/mock-data";
import { MetricCard, Card, PrimaryButton, GhostButton } from "@/components/verbo/ui";
import { hydrateStudents } from "@/lib/students-store";
import { nextPaymentDate, daysUntil, MAX_INSIGHT_STRIKES, getProduct } from "@/lib/student-model";
import { computeTeacherKpis } from "@/lib/teacher-kpis";
import { pendingReviews } from "@/lib/teacher-model";
import { CLUB_SEED, upcomingCreatedClubs } from "@/lib/clubs-store";
import {
  useAnnouncements, activeAnnouncements, publishAnnouncement, endAnnouncement,
  ANNOUNCEMENT_MAX, type Audience,
} from "@/lib/announcements-store";
import {
  UserPlus, CalendarPlus, Sparkles, BarChart3, X, CreditCard, Lock,
  Star, TrendingDown, Users2, Megaphone, ChevronRight, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Overview });

// Composite-score early-warning threshold (distinct from the 85% bonus gate).
const ALERT_COMPOSITE = 70;

// Persistence keys — hydrate teacher overrides the same way KPIs/Teachers do.
const T_PROFILE_KEY = "verbo:teacher-profile-overrides";
const T_REGISTERED_KEY = "verbo:registered-teachers";
const T_REVIEW_KEY = "verbo:session-review-overrides";
function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function computeNextPayment(u: User): Date | null {
  if (u.next_payment) return new Date(u.next_payment);
  if (!u.payment_day) return null;
  return nextPaymentDate(u.payment_day, new Date(u.cycle_start || Date.now()));
}

function Overview() {
  const navigate = useNavigate();
  const [, forceTick] = useState(0);
  const [metricsOpen, setMetricsOpen] = useState(false);

  useEffect(() => {
    // Hydrate the SAME overrides the Students/Teachers/KPIs pages use so the
    // snapshots read identical data (no duplicate source of truth).
    hydrateStudents();
    const overrides = readLS<Record<string, Partial<User>>>(T_PROFILE_KEY, {});
    USERS.forEach((u) => { if (overrides[u.id]) Object.assign(u, overrides[u.id]); });
    readLS<User[]>(T_REGISTERED_KEY, []).forEach((u) => {
      if (!USERS.find((x) => x.id === u.id)) USERS.push(u);
    });
    const reviews = readLS<Record<string, Partial<Session>>>(T_REVIEW_KEY, {});
    SESSIONS.forEach((s) => { if (reviews[s.id]) Object.assign(s, reviews[s.id]); });
    forceTick((n) => n + 1);
  }, []);

  const students = USERS.filter((u) => u.role === "student");
  const teachers = USERS.filter((u) => u.role === "teacher");
  const scheduled = SESSIONS.filter((s) => s.status === "scheduled").length;

  const teacherRows = useMemo(
    () => teachers.map((t) => ({ t, kpis: computeTeacherKpis(t), pending: pendingReviews(t.id).length })),
    [teachers],
  );
  const avgComposite = teacherRows.length
    ? Math.round(teacherRows.reduce((a, r) => a + r.kpis.composite, 0) / teacherRows.length)
    : 0;

  // ---- Students snapshot ----------------------------------------------------
  const paymentAlerts = students
    .map((s) => ({ s, next: computeNextPayment(s) }))
    .filter((x) => x.next && daysUntil(x.next) <= 3)
    .sort((a, b) => (a.next && b.next ? daysUntil(a.next) - daysUntil(b.next) : 0));

  const blockedInsights = students.filter((s) => (s.insights_strikes ?? 0) >= MAX_INSIGHT_STRIKES);

  // ---- Teachers snapshot ----------------------------------------------------
  const needsReview = teacherRows.filter((r) => r.pending > 0);
  const lowComposite = teacherRows
    .filter((r) => r.kpis.composite < ALERT_COMPOSITE)
    .sort((a, b) => a.kpis.composite - b.kpis.composite);
  const createdClubs = upcomingCreatedClubs(CLUB_SEED);

  const studentsClean = paymentAlerts.length === 0 && blockedInsights.length === 0;
  const teachersClean = needsReview.length === 0 && lowComposite.length === 0 && createdClubs.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Operational snapshot across the platform.</p>
      </div>

      {/* 1 — Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <PrimaryButton onClick={() => navigate({ to: "/admin/students", search: { new: true } })}>
          <UserPlus className="h-4 w-4" /> Register Student
        </PrimaryButton>
        <PrimaryButton onClick={() => navigate({ to: "/admin/sessions" })}>
          <CalendarPlus className="h-4 w-4" /> Schedule Sessions
        </PrimaryButton>
        <PrimaryButton onClick={() => navigate({ to: "/admin/clubs", search: { new: true } })}>
          <Sparkles className="h-4 w-4" /> Create Club Event
        </PrimaryButton>
        <GhostButton onClick={() => setMetricsOpen(true)}>
          <BarChart3 className="h-4 w-4" /> View Metrics
        </GhostButton>
      </div>

      {/* 2 — Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Students" value={String(students.length)} />
        <MetricCard label="Teachers" value={String(teachers.length)} />
        <MetricCard label="Sessions scheduled" value={String(scheduled)} />
        <MetricCard label="Active levels" value={String(LEVELS.length)} />
        <MetricCard label="Avg composite score" value={`${avgComposite}%`} />
      </div>

      {/* 3 — Snapshots 50/50 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Students snapshot */}
        <Card className="!p-0">
          <div className="border-b border-border px-6 py-4"><h2 className="text-base font-semibold tracking-tight text-foreground">Students snapshot</h2></div>
          <div className="space-y-6 p-6">
            {studentsClean ? (
              <EmptyState />
            ) : (
              <>
                {paymentAlerts.length > 0 && (
                  <SnapshotGroup icon={<CreditCard className="h-4 w-4" />} title="Payment due or overdue" count={paymentAlerts.length}>
                    {paymentAlerts.map(({ s, next }) => {
                      const d = next ? daysUntil(next) : 0;
                      return (
                        <SnapshotRow
                          key={s.id}
                          onClick={() => navigate({ to: "/admin/students", search: { student: s.id } })}
                          title={s.name}
                          meta={next!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          tone={d < 0 ? "danger" : "warning"}
                          badge={d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Today" : `In ${d}d`}
                        />
                      );
                    })}
                  </SnapshotGroup>
                )}
                {blockedInsights.length > 0 && (
                  <SnapshotGroup icon={<Lock className="h-4 w-4" />} title="Insights blocked — awaiting unlock" count={blockedInsights.length}>
                    {blockedInsights.map((s) => (
                      <SnapshotRow
                        key={s.id}
                        onClick={() => navigate({ to: "/admin/students", search: { student: s.id } })}
                        title={s.name}
                        meta={`${s.insights_strikes ?? 0}/${MAX_INSIGHT_STRIKES} strikes`}
                        tone="danger"
                        badge="Blocked"
                      />
                    ))}
                  </SnapshotGroup>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Teachers snapshot */}
        <Card className="!p-0">
          <div className="border-b border-border px-6 py-4"><h2 className="text-base font-semibold tracking-tight text-foreground">Teachers snapshot</h2></div>
          <div className="space-y-6 p-6">
            {teachersClean ? (
              <EmptyState label="All caught up — no pending teacher issues." />
            ) : (
              <>
                {needsReview.length > 0 && (
                  <SnapshotGroup icon={<Star className="h-4 w-4" />} title="Low ratings needing review" count={needsReview.length}>
                    {needsReview.map(({ t, pending }) => (
                      <SnapshotRow
                        key={t.id}
                        onClick={() => navigate({ to: "/admin/teachers", search: { teacher: t.id } })}
                        title={t.name}
                        meta="Flagged reviews"
                        tone="danger"
                        badge={`${pending} pending`}
                      />
                    ))}
                  </SnapshotGroup>
                )}
                {lowComposite.length > 0 && (
                  <SnapshotGroup icon={<TrendingDown className="h-4 w-4" />} title={`Composite below ${ALERT_COMPOSITE}%`} count={lowComposite.length}>
                    {lowComposite.map(({ t, kpis }) => (
                      <SnapshotRow
                        key={t.id}
                        onClick={() => navigate({ to: "/admin/kpis", search: { teacher: t.id } })}
                        title={t.name}
                        meta="Performance alert"
                        tone="warning"
                        badge={`${kpis.composite}%`}
                      />
                    ))}
                  </SnapshotGroup>
                )}
                {createdClubs.length > 0 && (
                  <SnapshotGroup icon={<Users2 className="h-4 w-4" />} title="Clubs without teacher" count={createdClubs.length}>
                    {createdClubs.map((c) => (
                      <SnapshotRow
                        key={c.id}
                        onClick={() => navigate({ to: "/admin/clubs" })}
                        title={c.title}
                        meta={new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        tone="warning"
                        badge="Created"
                      />
                    ))}
                  </SnapshotGroup>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* 5 — Announcements */}
      <AnnouncementsSection />

      {metricsOpen && (
        <MetricsModal students={students} teacherRows={teacherRows} onClose={() => setMetricsOpen(false)} />
      )}
    </div>
  );
}

// ===========================================================================
// Snapshot building blocks
// ===========================================================================
function EmptyState({ label = "All caught up — no pending student issues." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <CheckCircle2 className="mb-2 h-8 w-8 text-success" />
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function SnapshotGroup({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}<span>{title}</span><span className="text-muted-foreground/70">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

const TONE_CLS: Record<string, string> = {
  danger: "bg-destructive/10 text-destructive",
  warning: "bg-warning/20 text-foreground",
  default: "bg-secondary text-secondary-foreground",
};

function SnapshotRow({ onClick, title, meta, badge, tone = "default" }: {
  onClick: () => void; title: string; meta: string; badge: string; tone?: "danger" | "warning" | "default";
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-secondary/50"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{meta}</div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLS[tone]}`}>{badge}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ===========================================================================
// 5 — Announcements section
// ===========================================================================
function AnnouncementsSection() {
  useAnnouncements(); // subscribe for live updates
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [expires, setExpires] = useState("");

  const list = activeAnnouncements();

  const publish = () => {
    if (!message.trim()) return;
    publishAnnouncement(message, audience, expires || undefined);
    setMessage("");
    setAudience("all");
    setExpires("");
  };

  const audienceLabel: Record<Audience, string> = { all: "All", students: "Students only", teachers: "Teachers only" };

  return (
    <section>
      <h2 className="mb-4 text-base font-semibold tracking-tight text-foreground">Announcements</h2>
      <Card className="!p-0">
        {/* Composer */}
        <div className="space-y-4 border-b border-border p-6">
          <div>
            <textarea
              value={message}
              maxLength={ANNOUNCEMENT_MAX}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Write an announcement for your students or teachers…"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">{message.length}/{ANNOUNCEMENT_MAX}</div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap gap-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Audience
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as Audience)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All</option>
                  <option value="students">Students only</option>
                  <option value="teachers">Teachers only</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Expiration (optional)
                <input
                  type="date"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
            <PrimaryButton onClick={publish} disabled={!message.trim()}>
              <Megaphone className="h-4 w-4" /> Publish Announcement
            </PrimaryButton>
          </div>
        </div>

        {/* Active list */}
        <div className="p-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active announcements ({list.length})
          </div>
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No active announcements.</p>
          ) : (
            <div className="space-y-2">
              {list.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{a.message}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">{audienceLabel[a.audience]}</span>
                      <span>Published {new Date(a.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      <span>{a.expires_at ? `Expires ${new Date(a.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No expiration"}</span>
                    </div>
                  </div>
                  <GhostButton className="!px-3 !py-1.5 text-xs" onClick={() => endAnnouncement(a.id)}>
                    <X className="h-3.5 w-3.5" /> End
                  </GhostButton>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

// ===========================================================================
// 4 — Metrics modal
// ===========================================================================
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BRAND = "#f38934";
const NAVY = "#02466b";
const PIE_COLORS = ["#02466b", "#f38934", "#22c55e", "#a855f7"];

function last12Labels(): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(MONTHS[d.getMonth()]);
  }
  return out;
}

// Deterministic mock series generator (stable across renders).
function series(seed: number, min: number, max: number): number[] {
  const labels = last12Labels();
  let a = seed >>> 0;
  return labels.map(() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.round(min + (max - min) * r);
  });
}

function MetricsModal({ students, teacherRows, onClose }: {
  students: User[];
  teacherRows: { t: User; kpis: ReturnType<typeof computeTeacherKpis>; pending: number }[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"students" | "teachers">("students");
  const labels = last12Labels();

  const enrollment = labels.map((m, i) => ({ month: m, value: series(11, 2, 12)[i] }));
  const dropouts = labels.map((m, i) => ({ month: m, value: series(29, 0, 4)[i] }));
  const completions = labels.map((m, i) => ({ month: m, value: series(53, 1, 9)[i] }));
  const logins = labels.map((m, i) => ({ month: m, value: series(97, 40, 180)[i] }));

  const byProduct = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => {
      const key = s.product ?? "unknown";
      map[key] = (map[key] ?? 0) + 1;
    });
    return Object.entries(map).map(([id, value]) => ({
      name: getProduct(id as User["product"])?.name ?? "Unassigned",
      value,
    }));
  }, [students]);

  const avgComposite = teacherRows.length
    ? Math.round(teacherRows.reduce((a, r) => a + r.kpis.composite, 0) / teacherRows.length)
    : 75;
  const activeTeachers = labels.map((m, i) => ({ month: m, value: series(131, 3, teacherRows.length + 2)[i] }));
  const compositeTrend = labels.map((m, i) => ({ month: m, value: Math.max(50, Math.min(100, avgComposite - 8 + series(163, 0, 16)[i])) }));
  const hoursTaught = labels.map((m, i) => ({ month: m, value: series(191, 120, 420)[i] }));
  const teacherLogins = labels.map((m, i) => ({ month: m, value: series(211, 10, 60)[i] }));

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-floating">
        <div className="flex items-center justify-between border-b border-border px-6 py-4" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
          <div className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-lg font-semibold tracking-tight">Platform metrics</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1 border-b border-border px-6 pt-3">
          {(["students", "teachers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid gap-6 overflow-y-auto p-6 sm:grid-cols-2">
          {tab === "students" ? (
            <>
              <ChartCard title="Enrollment trend"><BarSeries data={enrollment} color={NAVY} /></ChartCard>
              <ChartCard title="Dropout trend"><LineSeries data={dropouts} color="#ef4444" /></ChartCard>
              <ChartCard title="Level completions"><BarSeries data={completions} color="#22c55e" /></ChartCard>
              <ChartCard title="Student logins"><LineSeries data={logins} color={BRAND} /></ChartCard>
              <ChartCard title="Students by product">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byProduct} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label>
                      {byProduct.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          ) : (
            <>
              <ChartCard title="Active teachers trend"><LineSeries data={activeTeachers} color={NAVY} /></ChartCard>
              <ChartCard title="Avg composite score trend"><LineSeries data={compositeTrend} color={BRAND} domain={[0, 100]} /></ChartCard>
              <ChartCard title="Hours taught"><BarSeries data={hoursTaught} color="#22c55e" /></ChartCard>
              <ChartCard title="Teacher logins"><LineSeries data={teacherLogins} color="#a855f7" /></ChartCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      <div className="h-48 w-full">{children}</div>
    </div>
  );
}

function LineSeries({ data, color, domain }: { data: { month: string; value: number }[]; color: string; domain?: [number, number] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <YAxis domain={domain} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={{ r: 2.5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarSeries({ data, color }: { data: { month: string; value: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }} cursor={{ fill: "var(--secondary)" }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
