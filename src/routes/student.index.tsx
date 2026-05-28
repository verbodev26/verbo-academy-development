import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import { LEVELS, QUOTES, userById } from "@/lib/mock-data";
import { loadSessions, persistSessions, subscribeSessions, type ExtSession } from "@/lib/sessions-store";
import { Card as PlainCard, GhostButton, MetricCard, Pill, PrimaryButton, ProgressBar, SectionTitle, SuccessButton } from "@/components/verbo/ui";
import { CalendarClock, Download, Flame, Quote, Video, X } from "lucide-react";
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

/** Soft white card with deep-blue depth shadow + orange hover glow lift. */
function PremiumCard({ children, className = "", hover = false }: { children: React.ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border p-6 verbo-card ${hover ? "verbo-card-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

function StudentDashboard() {
  const { user } = useAuth();

  // Live sessions store (persisted)
  const sessions = useSyncExternalStore(
    subscribeSessions,
    () => loadSessions(),
    () => loadSessions(),
  );

  // Local cancellation count (for the warning copy)
  const [cancelCount, setCancelCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      return Number(localStorage.getItem("verbo:cancel-count") ?? "1");
    } catch { return 1; }
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

  const level = LEVELS.find((l) => l.id === user.current_level);
  const currentUnit = level?.units[1] ?? level?.units[0];
  const levelProgress = 64;

  // Rating popup logic (unchanged)
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

  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);

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

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Welcome back</div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
              {user.name.split(" ")[0]}
            </h1>
            {/* Equipped badge */}
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

      {/* Metrics */}
      <section className="grid gap-4 md:grid-cols-3">
        <PremiumCard hover>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Current Level</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
            {user.current_level ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{level?.title}</div>
        </PremiumCard>
        <PremiumCard hover>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level Progress</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>{levelProgress}%</span>
            <span className="text-xs text-muted-foreground">of {user.current_level}</span>
          </div>
          <div className="mt-4"><ProgressBar value={levelProgress} /></div>
        </PremiumCard>
        <PremiumCard hover>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall Attendance</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight" style={{ color: "#01304a" }}>{user.attendance_percentage}%</span>
            <span className="text-xs text-muted-foreground">last 90 days</span>
          </div>
          <div className="mt-4"><ProgressBar value={user.attendance_percentage ?? 0} /></div>
        </PremiumCard>
      </section>

      {/* Current course */}
      <section>
        <SectionTitle>Current Course</SectionTitle>
        <PremiumCard hover className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Pill tone="muted">{level?.title}</Pill>
            <h3 className="mt-3 text-xl font-semibold tracking-tight" style={{ color: "#01304a" }}>{currentUnit?.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick up exactly where you left off. Video, materials and practice activities included.
            </p>
          </div>
          <PrimaryButton className="verbo-btn-glow">Continue unit</PrimaryButton>
        </PremiumCard>
      </section>

      {/* Upcoming sessions — horizontal grid of cards */}
      <section>
        <SectionTitle>Upcoming Sessions</SectionTitle>
        {upcoming.length === 0 ? (
          <PremiumCard><div className="text-sm text-muted-foreground">No upcoming sessions scheduled.</div></PremiumCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((s) => {
              const teacher = userById(s.teacher_id);
              return (
                <PremiumCard
                  key={s.id}
                  hover
                  className="flex flex-col gap-4 border-l-4"
                >
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
                    <SuccessButton className="flex-1 verbo-btn-glow" onClick={() => window.open(s.teams_link, "_blank")}>
                      <Video className="h-4 w-4" /> Connect
                    </SuccessButton>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
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
                <th className="px-6 py-3 font-medium text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => {
                const teacher = userById(s.teacher_id);
                const tone = s.status === "completed" ? "success"
                  : s.status === "absent" ? "danger"
                  : s.status === "delayed" ? "warning" : "default";
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-foreground">{fmt(s.date_time)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{teacher?.name}</td>
                    <td className="px-6 py-4"><Pill tone={tone as any}>{s.status}</Pill></td>
                    <td className="px-6 py-4 text-muted-foreground">{s.student_rating ? `${s.student_rating}★` : "—"}</td>
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

      {/* Quote */}
      <section>
        <PlainCard className="bg-secondary/40">
          <div className="flex items-start gap-4">
            <Quote className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quote of the Week</div>
              <div className="mt-2 text-base text-foreground">{quote}</div>
            </div>
          </div>
        </PlainCard>
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
            <DialogTitle style={{ color: "#01304a" }}>Cancelación de Sesión</DialogTitle>
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
    </div>
  );
}
