import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Trophy, AlertTriangle, Star, Sparkles, MessageCircleWarning,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { USERS, userById } from "@/lib/mock-data";
import { loadSessions, subscribeSessions, type ExtSession } from "@/lib/sessions-store";
import { groupById } from "@/lib/groups-store";
import {
  DEFAULT_HOURLY_RATE, avgRating,
} from "@/lib/teacher-model";
import {
  computeTeacherKpis, ratingBand, getBonusThreshold,
} from "@/lib/teacher-kpis";
import { Card, SectionTitle, Pill } from "@/components/verbo/ui";

export const Route = createFileRoute("/teacher/financial")({
  head: () => ({
    meta: [
      { title: "My Balance — Teacher" },
      { name: "description", content: "Your monthly payment summary — sessions, adjustments and bonus." },
    ],
  }),
  component: MyBalancePage,
});

// --- helpers ----------------------------------------------------------------
function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}
function firstOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function labelOf(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function sameMonth(iso: string | undefined, mkey: string) {
  if (!iso) return false;
  const d = new Date(iso); return monthKey(d) === mkey;
}

// KPI signal shape shared with the Performance card + badges.
type KpiSignal = { key: string; label: string; value: number };

const KPI_GOOD = 85;
const KPI_CRITICAL = 70;

function signalTone(v: number): "good" | "mid" | "bad" {
  if (v >= KPI_GOOD) return "good";
  if (v >= KPI_CRITICAL) return "mid";
  return "bad";
}
function signalColor(v: number) {
  const t = signalTone(v);
  return t === "good" ? "#22c55e" : t === "mid" ? "#f59e0b" : "#ef4444";
}

// --- page -------------------------------------------------------------------
function MyBalancePage() {
  const { user } = useAuth();
  const [, force] = useState(0);
  const bump = () => force((n) => n + 1);
  const [viewMonth, setViewMonth] = useState<Date>(() => firstOfMonth(new Date()));
  const [expanded, setExpanded] = useState<Record<"sessions" | "adjustments" | "bonus", boolean>>({
    sessions: false, adjustments: false, bonus: false,
  });

  useEffect(() => subscribeSessions(bump), []);

  // Locate the live teacher record (auth user id).
  const teacher = useMemo(() => {
    if (!user) return null;
    return USERS.find((u) => u.id === user.id && u.role === "teacher") ?? null;
  }, [user]);

  const now = new Date();
  const currentMkey = monthKey(now);
  const mkey = monthKey(viewMonth);
  const isCurrentMonth = mkey === currentMkey;

  const rate = teacher?.hourly_rate ?? DEFAULT_HOURLY_RATE;

  // ----- Sessions taught (this month) -----
  type SessionRow = {
    id: string;
    date: Date;
    name: string;
    isGroup: boolean;
    type: string;
    status: string;
    amount: number;
  };
  const sessionRows: SessionRow[] = useMemo(() => {
    if (!teacher) return [];
    return loadSessions()
      .filter((s) => s.teacher_id === teacher.id && sameMonth(s.date_time, mkey))
      .map((s: ExtSession) => {
        let name = "—";
        let isGroup = false;
        let type = "Individual";
        if (s.origin === "workshop") {
          type = "Workshop";
          name = s.workshop_topic || "Focus Workshop";
        } else if (s.group_id) {
          isGroup = true;
          type = "Group";
          name = groupById(s.group_id)?.name ?? "Group";
        } else {
          name = userById(s.student_id)?.name ?? "—";
        }
        const statusLabel =
          s.status === "completed" ? "Completed"
          : s.status === "absent" ? "Absent"
          : s.status === "delayed" ? "Delayed"
          : s.status === "no_show" ? "No-show"
          : s.status.charAt(0).toUpperCase() + s.status.slice(1);
        const amount = s.status === "completed"
          ? Math.round((s.duration_minutes / 60) * rate)
          : 0;
        return {
          id: s.id, date: new Date(s.date_time), name, isGroup, type,
          status: statusLabel, amount,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [teacher, mkey, rate]);

  // Standard Pay — mirror Money Lab: hours_month * rate for current month, 0 otherwise.
  const stdHours = isCurrentMonth ? (teacher?.hours_month ?? 0) : 0;
  const stdPay = Math.round(stdHours * rate);
  const sessionsCount = sessionRows.filter((r) => r.status === "Completed").length;

  // ----- Adjustments (this month) -----
  const adjustments = (teacher?.adjustments ?? []).filter((a) => sameMonth(a.date, mkey));
  const adjustmentsTotal = adjustments.reduce((s, a) => s + a.amount, 0);

  // ----- KPIs / Bonus -----
  const threshold = getBonusThreshold();
  const kpis = teacher ? computeTeacherKpis(teacher, threshold) : null;
  const rating = teacher ? avgRating(teacher) : null;

  // A single "Bonus" adjustment already logged this month, if any.
  const bonusAdjustment = adjustments.find((a) => /bonus/i.test(a.reason));
  const bonusAmount = bonusAdjustment?.amount ?? 0;

  const totalEarned = stdPay + adjustmentsTotal;

  // ----- KPI signals (5) -----
  const signals: KpiSignal[] = kpis ? [
    { key: "connection", label: "Connection punctuality", value: kpis.connectionPunctuality },
    { key: "planning",   label: "Planning punctuality",   value: kpis.planningPunctuality },
    { key: "report",     label: "Report punctuality",     value: kpis.reportPunctuality },
    { key: "completion", label: "Session completion rate", value: kpis.completionRate },
    { key: "rating",     label: "Student rating",         value: kpis.ratingNormalized },
  ] : [];

  const belowTarget = signals.filter((s) => s.value < KPI_GOOD);
  const anyCritical = signals.some((s) => s.value < KPI_CRITICAL);
  const warningLevel: "none" | "yellow" | "red" =
    belowTarget.length === 0 ? "none"
    : (belowTarget.length >= 2 || anyCritical) ? "red"
    : "yellow";

  const band = ratingBand(rating);

  if (!teacher) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading your balance…
      </div>
    );
  }

  const toggle = (k: "sessions" | "adjustments" | "bonus") =>
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <div className="space-y-6">
      {/* Local styles for the bonus glow animation */}
      <style>{`
        @keyframes verbo-bonus-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45); transform: translateY(0); }
          50%      { box-shadow: 0 0 0 8px rgba(34,197,94,0);   transform: translateY(-1px); }
        }
        .verbo-bonus-glow { animation: verbo-bonus-glow 2.2s ease-in-out infinite; }
      `}</style>

      {/* Header + month selector */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <SectionTitle>My Balance</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">Your payment summary for this period. Read-only.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 shadow-soft">
          <button
            type="button" aria-label="Previous month"
            onClick={() => setViewMonth((d) => addMonths(d, -1))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          ><ChevronLeft className="h-4 w-4" /></button>
          <div className="min-w-[140px] px-2 text-center text-sm font-semibold text-foreground">{labelOf(viewMonth)}</div>
          <button
            type="button" aria-label="Next month"
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          ><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Badges */}
      {(kpis?.bonusEligible || warningLevel !== "none") && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {kpis?.bonusEligible && (
            <span className="verbo-bonus-glow inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success">
              <Trophy className="h-3.5 w-3.5" /> Bonus Eligible
              <Sparkles className="h-3 w-3" />
            </span>
          )}
          {warningLevel === "yellow" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/20 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> 1 KPI Below Target
            </span>
          )}
          {warningLevel === "red" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> {belowTarget.length} KPIs Below Target
            </span>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Sessions Taught"
          value={money(stdPay)}
          sub={`${sessionsCount} session${sessionsCount === 1 ? "" : "s"}`}
          expanded={expanded.sessions}
          onClick={() => toggle("sessions")}
        />
        <SummaryCard
          label="Adjustments"
          value={money(adjustmentsTotal)}
          sub={`${adjustments.length} adjustment${adjustments.length === 1 ? "" : "s"}`}
          expanded={expanded.adjustments}
          onClick={() => toggle("adjustments")}
        />
        <SummaryCard
          label="Bonus"
          value={money(bonusAmount)}
          sub={`Composite Score: ${kpis?.composite ?? 0}% · ${rating != null ? rating.toFixed(1) + "★" : "—"}`}
          expanded={expanded.bonus}
          onClick={() => toggle("bonus")}
        />
        <TotalCard label="Total Earned" value={money(totalEarned)} />
      </div>

      {/* Accordion panels */}
      {expanded.sessions && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Sessions Taught — {labelOf(viewMonth)}</h3>
          {sessionRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No sessions recorded this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Student/Group</th>
                    <th className="px-3 py-2 font-medium">Session Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {r.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          {r.isGroup && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-[10px] font-bold text-accent">G</span>
                          )}
                          {r.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.type}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                        {r.amount ? money(r.amount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {expanded.adjustments && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Adjustments — {labelOf(viewMonth)}</h3>
          {adjustments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No adjustments this month.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{a.reason}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${a.amount < 0 ? "text-destructive" : "text-success"}`}>
                        {a.amount >= 0 ? "+" : "−"}{money(Math.abs(a.amount))}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {expanded.bonus && kpis && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Bonus breakdown</h3>
            <div className="text-xs text-muted-foreground">
              Threshold: <span className="font-semibold text-foreground">{threshold}%</span>
              <span className="mx-2">·</span>
              Composite Score: <span className="font-semibold" style={{ color: signalColor(kpis.composite) }}>{kpis.composite}%</span>
            </div>
          </div>
          <div className="space-y-3">
            {signals.map((s) => <KpiBar key={s.key} label={s.label} value={s.value} />)}
          </div>
          <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
            {kpis.bonusEligible
              ? <>You are <span className="font-semibold text-success">Bonus Eligible</span> — Composite Score {kpis.composite}% ≥ threshold {threshold}%.</>
              : <>Composite Score {kpis.composite}% is below the {threshold}% threshold required for a bonus this month.</>}
          </div>
        </Card>
      )}

      {/* Performance card */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Performance</h3>
          <div className="flex items-center gap-3">
            {rating != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: band.bg, color: band.fg }}>
                <Star className="h-3.5 w-3.5 fill-current" /> {rating.toFixed(1)} · {band.label}
              </span>
            )}
            <div className="text-xs text-muted-foreground">
              Composite Score: <span className="text-base font-bold" style={{ color: kpis ? signalColor(kpis.composite) : undefined }}>{kpis?.composite ?? 0}%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {signals.map((s) => <KpiBar key={s.key} label={s.label} value={s.value} />)}
        </div>
      </Card>

      {/* Report an Issue (visual only) */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-colors hover:bg-secondary"
        >
          <MessageCircleWarning className="h-4 w-4" /> Report an Issue
        </button>
      </div>
    </div>
  );
}

// --- subcomponents ----------------------------------------------------------
function SummaryCard({
  label, value, sub, expanded, onClick,
}: { label: string; value: string; sub: string; expanded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-6 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md ${expanded ? "border-accent bg-accent/5" : "border-border bg-card"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </button>
  );
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-accent/5 p-6 shadow-soft">
      <div className="text-xs font-semibold uppercase tracking-wider text-accent">{label}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">This month</div>
    </div>
  );
}

function KpiBar({ label, value }: { label: string; value: number }) {
  const color = signalColor(value);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: "success" | "warning" | "danger" | "default" =
    status === "Completed" ? "success"
    : status === "Delayed" ? "warning"
    : status === "Absent" || status === "No-show" ? "danger"
    : "default";
  return <Pill tone={tone}>{status}</Pill>;
}