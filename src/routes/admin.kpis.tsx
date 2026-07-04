import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { USERS, SESSIONS, type User, type Session } from "@/lib/mock-data";
import { avgRating, pendingReviews } from "@/lib/teacher-model";
import {
  computeTeacherKpis, ratingBand, ratingHistory,
  getBonusThreshold, setBonusThreshold,
} from "@/lib/teacher-kpis";
import { MetricCard, SectionTitle } from "@/components/verbo/ui";
import { Star, AlertTriangle, Trophy, X, TrendingUp, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/admin/kpis")({
  component: Page,
  validateSearch: (s: Record<string, unknown>): { teacher?: string } => ({
    teacher: typeof s.teacher === "string" ? s.teacher : undefined,
  }),
});

// Persistence keys shared with the Teachers view (apply the same overrides so
// KPIs reflect edits made there).
const PROFILE_KEY = "verbo:teacher-profile-overrides";
const REGISTERED_KEY = "verbo:registered-teachers";
const REVIEW_KEY = "verbo:session-review-overrides";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function Page() {
  const { teacher: focusTeacher } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [, forceTick] = useState(0);
  const [threshold, setThreshold] = useState(85);
  const [onlyReview, setOnlyReview] = useState(false);
  const [chartFor, setChartFor] = useState<User | null>(null);


  useEffect(() => {
    // Hydrate teacher profile overrides + registered teachers + review overrides.
    const overrides = read<Record<string, Partial<User>>>(PROFILE_KEY, {});
    USERS.forEach((u) => { if (overrides[u.id]) Object.assign(u, overrides[u.id]); });
    read<User[]>(REGISTERED_KEY, []).forEach((u) => {
      if (!USERS.find((x) => x.id === u.id)) USERS.push(u);
    });
    const reviews = read<Record<string, Partial<Session>>>(REVIEW_KEY, {});
    SESSIONS.forEach((s) => { if (reviews[s.id]) Object.assign(s, reviews[s.id]); });
    setThreshold(getBonusThreshold());
    forceTick((n) => n + 1);
  }, []);

  // Deep-link from the Admin Overview snapshot — open the rating chart.
  useEffect(() => {
    if (focusTeacher) {
      const t = USERS.find((u) => u.id === focusTeacher && u.role === "teacher");
      if (t) setChartFor(t);
      navigate({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTeacher]);

  const teachers = USERS.filter((u) => u.role === "teacher");


  const rows = useMemo(
    () => teachers.map((t) => ({
      t,
      kpis: computeTeacherKpis(t, threshold),
      pending: pendingReviews(t.id).length,
    })),
    [teachers, threshold],
  );

  const visibleRows = onlyReview ? rows.filter((r) => r.pending > 0) : rows;

  const overallAvg = rows.length
    ? (rows.reduce((a, r) => a + (r.kpis.rating ?? 0), 0) / rows.filter((r) => r.kpis.rating != null).length || 0).toFixed(1)
    : "—";
  const avgComposite = rows.length
    ? Math.round(rows.reduce((a, r) => a + r.kpis.composite, 0) / rows.length)
    : 0;

  const updateThreshold = (v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setThreshold(clamped);
    setBonusThreshold(clamped);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">KPIs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Punctuality, reliability and student ratings — with a composite score driving bonus eligibility.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Avg rating (all teachers)" value={`${overallAvg}★`} />
        <MetricCard label="Sessions tracked" value={String(SESSIONS.length)} />
        <MetricCard label="Teachers" value={String(teachers.length)} />
        <MetricCard label="Avg composite score" value={`${avgComposite}%`} />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={onlyReview}
            onChange={(e) => setOnlyReview(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-input accent-[#f38934]"
          />
          Show only teachers needing review
          {onlyReview && <span className="text-xs text-muted-foreground">({visibleRows.length})</span>}
        </label>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Bonus threshold:</span>
          <div className="flex items-center rounded-lg border border-input bg-background">
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => updateThreshold(Number(e.target.value))}
              className="w-16 bg-transparent px-2.5 py-1.5 text-sm text-foreground focus:outline-none"
            />
            <span className="pr-3 text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <section>
        <SectionTitle>Teacher performance</SectionTitle>
        {visibleRows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-sm">
            No teachers to show with the current filter.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleRows.map(({ t, kpis, pending }) => (
              <TeacherKpiCard
                key={t.id}
                teacher={t}
                kpis={kpis}
                pending={pending}
                onOpenChart={() => setChartFor(t)}
              />
            ))}
          </div>
        )}
      </section>

      {chartFor && <RatingChartModal teacher={chartFor} onClose={() => setChartFor(null)} />}
    </div>
  );
}

// ===========================================================================
// TEACHER CARD
// ===========================================================================
function TeacherKpiCard({
  teacher: t, kpis, pending, onOpenChart,
}: {
  teacher: User;
  kpis: ReturnType<typeof computeTeacherKpis>;
  pending: number;
  onOpenChart: () => void;
}) {
  const band = ratingBand(kpis.rating);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-foreground">{t.name}</div>
          <div className="truncate text-xs text-muted-foreground">{t.email}</div>
        </div>
        {pending > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" /> Needs Review ({pending})
          </span>
        )}
      </div>

      {/* Rating + bonus */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onOpenChart}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-transform hover:scale-105"
          style={{ backgroundColor: band.bg, color: band.fg }}
          title="View monthly rating trend"
        >
          <Star className="h-3.5 w-3.5 fill-current" />
          {kpis.rating != null ? kpis.rating.toFixed(1) : "—"} · {band.label}
          <TrendingUp className="h-3.5 w-3.5" />
        </button>
        {kpis.bonusEligible && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <Trophy className="h-3.5 w-3.5" /> Bonus Eligible
          </span>
        )}
      </div>

      {/* Composite score — prominent */}
      <div className="mt-4 flex items-center gap-4 rounded-xl border border-border bg-secondary/30 p-4">
        <CompositeRing value={kpis.composite} />
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Composite score</div>
          <div className="text-3xl font-bold tracking-tight text-foreground">{kpis.composite}%</div>
          <div className="text-[10.5px] text-muted-foreground">avg of 5 weighted signals</div>
        </div>
      </div>

      {/* Metric bars */}
      <div className="mt-4 space-y-3">
        <KpiBar label="Connection punctuality" value={kpis.connectionPunctuality} />
        <KpiBar label="Planning punctuality" value={kpis.planningPunctuality} />
        <KpiBar label="Report punctuality" value={kpis.reportPunctuality} />
        <KpiBar label="Session completion rate" value={kpis.completionRate} />
        <KpiBar label="Teacher-caused absence rate" value={kpis.teacherAbsenceRate} invert />
      </div>
    </div>
  );
}

function barColor(value: number, invert: boolean) {
  const good = invert ? value <= 5 : value >= 85;
  const mid = invert ? value <= 15 : value >= 70;
  if (good) return "#22c55e";
  if (mid) return "#f59e0b";
  return "#ef4444";
}

function KpiBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: barColor(value, invert) }} />
      </div>
    </div>
  );
}

function CompositeRing({ value }: { value: number }) {
  const size = 60;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value >= 85 ? "#22c55e" : value >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
      />
    </svg>
  );
}

// ===========================================================================
// RATING TREND MODAL
// ===========================================================================
function RatingChartModal({ teacher: t, onClose }: { teacher: User; onClose: () => void }) {
  const data = useMemo(() => ratingHistory(t), [t]);
  const band = ratingBand(avgRating(t));

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-floating">
        <div className="flex items-start justify-between border-b border-border px-6 py-5" style={{ background: "linear-gradient(135deg, #01304a 0%, #02466b 100%)" }}>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Rating trend · last 6 months</div>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{t.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-6">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
                  formatter={(v: number) => [`${v}★`, "Avg rating"]}
                />
                <Line type="monotone" dataKey="rating" stroke={band.dot} strokeWidth={2.5} dot={{ r: 4, fill: band.dot }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Current average: <span className="font-semibold" style={{ color: band.fg }}>{avgRating(t)?.toFixed(1) ?? "—"}★ · {band.label}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
