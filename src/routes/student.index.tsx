import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { LEVELS, userById } from "@/lib/mock-data";
import { persistSessions, subscribeSessions, getSessionsSnapshot, getServerSessionsSnapshot, type ExtSession } from "@/lib/sessions-store";
import {
  averagePerformance,
  getPerformanceSnapshot,
  getServerPerformanceSnapshot,
  subscribePerformance,
  type PerformanceRating,
} from "@/lib/performance-store";
import { GhostButton, Pill, PrimaryButton, SectionTitle, SuccessButton } from "@/components/verbo/ui";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Download,
  Ear,
  Flame,
  Mic,
  PenLine,
  Sparkles,
  Star,
  Users,
  Video,
  X,
} from "lucide-react";
import { RatingModal } from "@/components/verbo/RatingModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/student/")({
  component: StudentDashboard,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function PremiumCard({ children, className = "", hover = false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-6 verbo-card ${hover ? "verbo-card-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

/** Minimal SVG circular progress ring (right-aligned inside KPI cards). */
function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  label,
}: { value: number; size?: number; stroke?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(1, 48, 74, 0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f38934"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums" style={{ color: "#01304a" }}>
        {label ?? `${Math.round(pct)}%`}
      </div>
    </div>
  );
}

function StudentDashboard() {
  const { user } = useAuth();

  const sessions = useSyncExternalStore(
    subscribeSessions,
    getSessionsSnapshot,
    getServerSessionsSnapshot,
  );
  const performance = useSyncExternalStore(
    subscribePerformance,
    getPerformanceSnapshot,
    getServerPerformanceSnapshot,
  );
  const [perfDetail, setPerfDetail] = useState<{ session: ExtSession; rating: PerformanceRating } | null>(null);

  const [cancelCount, setCancelCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try { return Number(localStorage.getItem("verbo:cancel-count") ?? "1"); } catch { return 1; }
  });

  const [toCancel, setToCancel] = useState<ExtSession | null>(null);

  if (!user) return null;

  const mySessions = sessions.filter((s) => s.student_id === user.id);
  const upcoming = mySessions
    .filter((s) => s.status === "scheduled" || s.status === "rescheduled" || s.status === "ready")
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  const history = mySessions
    .filter((s) => !["scheduled", "rescheduled", "ready"].includes(s.status))
    .sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time));
  const perfAvg = averagePerformance(history.map((s) => s.id), performance);

  const level = LEVELS.find((l) => l.id === user.current_level);
  const currentUnit = level?.units[1] ?? level?.units[0];
  const levelProgress = 64;

  // Map 0-5 perf scale onto 4 macro-skills (kept derivative of existing data).
  const pct = (v: number) => Math.round((v / 5) * 100);
  const macroSkills = [
    { key: "Speaking", icon: Mic, value: pct(perfAvg.fluency || 0) },
    { key: "Writing", icon: PenLine, value: pct(perfAvg.grammar || 0) },
    { key: "Listening", icon: Ear, value: pct(perfAvg.confidence || 0) },
    { key: "Reading", icon: BookOpen, value: pct(perfAvg.vocabulary || 0) },
  ];

  // Pull a few recent feedback items from completed history.
  const recentFeedback = useMemo(() => {
    return history
      .filter((s) => performance[s.id])
      .slice(0, 3)
      .map((s) => ({
        id: s.id,
        teacher: userById(s.teacher_id)?.name ?? "Teacher",
        date: new Date(s.date_time).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        tip:
          performance[s.id].fluency < 3
            ? "Focus on connecting clauses with linking phrases."
            : performance[s.id].vocabulary < 3
              ? "Expand vocabulary on negotiation idioms."
              : performance[s.id].grammar < 3
                ? "Review conditional tenses in professional contexts."
                : "Excellent delivery — keep practicing executive summaries.",
      }));
  }, [history, performance]);

  // Rating popup logic (untouched)
  const [ratingSession, setRatingSession] = useState<ExtSession | null>(null);
  const [handled, setHandled] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("verbo:rated-sessions");
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  const persistHandled = (next: Set<string>) => {
    setHandled(next);
    try { localStorage.setItem("verbo:rated-sessions", JSON.stringify([...next])); } catch { /* noop */ }
  };

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const s of upcoming) {
        if (handled.has(s.id)) continue;
        const start = +new Date(s.date_time);
        const end = start + s.duration_minutes * 60_000;
        const triggerAt = end - 10 * 60_000;
        if (now >= triggerAt && now <= end) { setRatingSession(s); return; }
      }
      setRatingSession(null);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [upcoming, handled]);

  const handleSubmit = (rating: number) => {
    if (!ratingSession) return;
    console.log("Session rating submitted:", ratingSession.id, rating);
    persistHandled(new Set(handled).add(ratingSession.id));
    setRatingSession(null);
  };
  const handleClose = () => {
    if (!ratingSession) return;
    persistHandled(new Set(handled).add(ratingSession.id));
    setRatingSession(null);
  };

  const confirmCancel = () => {
    if (!toCancel) return;
    const next = sessions.filter((s) => s.id !== toCancel.id);
    persistSessions(next);
    const nc = cancelCount + 1;
    setCancelCount(nc);
    try { localStorage.setItem("verbo:cancel-count", String(nc)); } catch { /* noop */ }
    setToCancel(null);
  };

  const ordinal = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    const s = ["th", "st", "nd", "rd"][n % 10] || "th";
    return `${n}${s}`;
  };

  // Status badge tone classes (polished).
  const statusBadge = (status: string) => {
    const base = "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide capitalize";
    switch (status) {
      case "completed":
        return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`;
      case "absent":
        return `${base} bg-rose-50 text-rose-700 ring-1 ring-rose-200`;
      case "delayed":
        return `${base} bg-amber-50 text-amber-800 ring-1 ring-amber-200`;
      case "rescheduled":
      case "rearranged":
        return `${base} bg-sky-50 text-sky-700 ring-1 ring-sky-200`;
      default:
        return `${base} bg-slate-100 text-slate-700 ring-1 ring-slate-200`;
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Welcome back</div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
              {user.name.split(" ")[0]}
            </h1>
            <div
              title="Equipped: On Fire"
              className="flex h-11 w-11 items-center justify-center rounded-full shadow-md verbo-badge-spin"
              style={{ background: "linear-gradient(135deg, #f38934, #ff6a3d)" }}
            >
              <Flame className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </header>

      {/* KPI Metrics with circular SVG progress */}
      <section className="grid gap-4 md:grid-cols-3">
        <PremiumCard hover>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Level</div>
              <div className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
                {user.current_level ?? "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{level?.title}</div>
            </div>
            <ProgressRing value={levelProgress} label={user.current_level ?? "—"} />
          </div>
        </PremiumCard>
        <PremiumCard hover>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level Progress</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>{levelProgress}%</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">of {user.current_level}</div>
            </div>
            <ProgressRing value={levelProgress} />
          </div>
        </PremiumCard>
        <PremiumCard hover>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall Attendance</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>{user.attendance_percentage}%</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">last 90 days</div>
            </div>
            <ProgressRing value={user.attendance_percentage ?? 0} />
          </div>
        </PremiumCard>
      </section>

      {/* Linguistic Asset Performance — replaces Performance Metrics + Quote of the Week */}
      <section>
        <PremiumCard>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold tracking-tight" style={{ color: "#01304a" }}>
              Linguistic Asset Performance
            </h3>
            <Link
              to="/student"
              className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
              style={{ color: "#f38934" }}
            >
              View Detailed Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {macroSkills.map(({ key, icon: Icon, value }) => (
              <div
                key={key}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-white/60 px-4 py-3"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: "rgba(1, 48, 74, 0.06)", color: "#01304a" }}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{key}</div>
                  <div className="text-base font-semibold tabular-nums" style={{ color: "#01304a" }}>
                    {value}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      </section>

      {/* Two-column productivity layout */}
      <section className="grid gap-6 lg:grid-cols-[1.85fr_1fr]">
        {/* LEFT COLUMN ~65% */}
        <div className="space-y-8">
          {/* Current Course */}
          <div>
            <SectionTitle>Current Course</SectionTitle>
            <PremiumCard hover className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <Pill tone="muted">{level?.title}</Pill>
                <h3 className="mt-3 text-xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
                  {currentUnit?.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick up exactly where you left off. Video, materials and practice activities included.
                </p>
              </div>
              <PrimaryButton className="verbo-btn-glow">Continue unit</PrimaryButton>
            </PremiumCard>
          </div>

          {/* Upcoming Sessions */}
          <div>
            <SectionTitle>Upcoming Sessions</SectionTitle>
            {upcoming.length === 0 ? (
              <PremiumCard><div className="text-sm text-muted-foreground">No upcoming sessions scheduled.</div></PremiumCard>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((s) => {
                  const teacher = userById(s.teacher_id);
                  return (
                    <PremiumCard key={s.id} hover className="flex flex-col gap-4 border-l-4">
                      <div
                        className="-m-6 mb-0 rounded-t-2xl p-4"
                        style={{ background: "linear-gradient(135deg, #01304a, #014a6e)" }}
                      >
                        <div className="flex items-center gap-3 text-white">
                          <CalendarClock className="h-5 w-5" />
                          <div>
                            <div className="text-sm font-semibold capitalize">{fmtDay(s.date_time)}</div>
                            <div className="text-xs opacity-80">{fmt(s.date_time)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 pt-2">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Teacher</div>
                        <div className="text-sm font-semibold" style={{ color: "#01304a" }}>{teacher?.name}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{fmtTime(s.date_time)} · {s.duration_minutes} min</span>
                        <Pill tone="muted">{s.status}</Pill>
                      </div>
                      <div className="mt-auto flex items-center gap-2 pt-2">
                        <GhostButton className="flex-1" onClick={() => setToCancel(s)}>
                          <X className="h-3.5 w-3.5" /> Can't attend
                        </GhostButton>
                        <SuccessButton className="flex-1 verbo-btn-glow bg-lime-500" onClick={() => window.open(s.teams_link, "_blank")}>
                          <Video className="h-4 w-4" /> Connect
                        </SuccessButton>
                      </div>
                    </PremiumCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR ~35% */}
        <aside className="space-y-6">
          {/* Verbo Experiences */}
          <PremiumCard hover className="relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{ background: "radial-gradient(circle at top right, #f38934, transparent 65%)" }}
            />
            <div className="relative">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: "rgba(243, 137, 52, 0.12)", color: "#f38934" }}
                >
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold tracking-tight" style={{ color: "#01304a" }}>
                  Verbo Experiences
                </h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Join today's live conversation clubs and immerse yourself with peers across the network.
              </p>
              <PrimaryButton className="verbo-btn-glow mt-4 w-full">
                <Sparkles className="h-3.5 w-3.5" /> View Active Clubs
              </PrimaryButton>
            </div>
          </PremiumCard>

          {/* Quick Review Dock */}
          <PremiumCard>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight" style={{ color: "#01304a" }}>
                Quick Review Dock
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest</span>
            </div>
            {recentFeedback.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Your teacher's notes and vocabulary tips will appear here after your first rated session.
              </p>
            ) : (
              <ul className="space-y-3">
                {recentFeedback.map((f) => (
                  <li key={f.id} className="rounded-lg border border-border/70 bg-white/70 p-3">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{f.teacher}</span>
                      <span>{f.date}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-foreground">{f.tip}</p>
                  </li>
                ))}
              </ul>
            )}
          </PremiumCard>
        </aside>
      </section>

      {/* History */}
      <section>
        <SectionTitle>Session History</SectionTitle>
        <PremiumCard className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Teacher</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Rating</th>
                <th className="px-6 py-3 font-medium">My Performance</th>
                <th className="px-6 py-3 font-medium text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => {
                const teacher = userById(s.teacher_id);
                const rating = performance[s.id];
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-foreground">{fmt(s.date_time)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{teacher?.name}</td>
                    <td className="px-6 py-4">
                      <span className={statusBadge(s.status)}>{s.status}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{s.student_rating ? `${s.student_rating}★` : "—"}</td>
                    <td className="px-6 py-4">
                      <button
                        disabled={!rating}
                        onClick={() => rating && setPerfDetail({ session: s, rating })}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ color: rating ? "#f38934" : undefined }}
                        aria-label="View performance breakdown"
                        title="View performance breakdown"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={!s.report_pdf_url}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Download report"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PremiumCard>
      </section>

      {ratingSession && (
        <RatingModal
          session={ratingSession as any}
          onSubmit={(rating) => handleSubmit(rating)}
          onClose={handleClose}
        />
      )}

      {/* Cancellation Modal */}
      <Dialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "#01304a" }}>Session Cancellation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground">
            We're sorry you can't be there 😢 Remember that consistency is key to mastering your
            professional and corporate English.
          </p>
          <div
            className="rounded-lg border p-3 text-xs leading-relaxed"
            style={{
              backgroundColor: "rgba(243, 137, 52, 0.08)",
              borderColor: "rgba(243, 137, 52, 0.35)",
              color: "#01304a",
            }}
          >
            <strong>WARNING!:</strong> Your membership allows you to cancel or reschedule up to
            15% of your booked sessions without penalty. This action will affect your attendance
            metrics and will be recorded as your {ordinal(cancelCount + 1)} canceled session.
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <GhostButton onClick={confirmCancel}>Confirm Cancelation</GhostButton>
            <PrimaryButton className="verbo-btn-glow" onClick={() => setToCancel(null)}>Return</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Performance Breakdown Modal */}
      <Dialog open={!!perfDetail} onOpenChange={(o) => !o && setPerfDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: "#01304a" }}>Session Performance Breakdown</DialogTitle>
          </DialogHeader>
          {perfDetail && (
            <>
              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                <div className="font-medium text-foreground">{fmt(perfDetail.session.date_time)}</div>
                <div className="mt-0.5 text-muted-foreground">
                  with {userById(perfDetail.session.teacher_id)?.name}
                </div>
              </div>
              <div className="mt-2 space-y-3">
                <PerfStars label="Fluency" value={perfDetail.rating.fluency} />
                <PerfStars label="Vocabulary Range" value={perfDetail.rating.vocabulary} />
                <PerfStars label="Confidence" value={perfDetail.rating.confidence} />
                <PerfStars label="Grammar Accuracy" value={perfDetail.rating.grammar} />
              </div>
            </>
          )}
          <DialogFooter>
            <PrimaryButton className="verbo-btn-glow" onClick={() => setPerfDetail(null)}>Close</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerfStars({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium" style={{ color: "#01304a" }}>{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= value;
          return (
            <Star
              key={n}
              className="h-4 w-4"
              style={{
                color: active ? "#f38934" : "#e5e7eb",
                fill: active ? "#f38934" : "transparent",
              }}
            />
          );
        })}
        <span className="ml-2 text-xs tabular-nums text-muted-foreground">{value}/5</span>
      </div>
    </div>
  );
}
