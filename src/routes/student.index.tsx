import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SESSIONS, LEVELS, QUOTES, userById } from "@/lib/mock-data";
import { Card, GhostButton, MetricCard, Pill, PrimaryButton, ProgressBar, SectionTitle, SuccessButton } from "@/components/verbo/ui";
import { CalendarClock, Download, Quote, Video, X } from "lucide-react";
import { RatingModal } from "@/components/verbo/RatingModal";

export const Route = createFileRoute("/student/")({
  component: StudentDashboard,
});

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StudentDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  const mySessions = SESSIONS.filter((s) => s.student_id === user.id);
  const upcoming = mySessions
    .filter((s) => s.status === "scheduled")
    .sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  const history = mySessions
    .filter((s) => s.status !== "scheduled")
    .sort((a, b) => +new Date(b.date_time) - +new Date(a.date_time));

  const level = LEVELS.find((l) => l.id === user.current_level);
  const currentUnit = level?.units[1] ?? level?.units[0];
  const levelProgress = 64; // mock

  // Time-based rating popup: trigger when we are within (duration - 10) and end of session
  const [ratingSession, setRatingSession] = useState<typeof SESSIONS[number] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const s of upcoming) {
        if (dismissed.has(s.id)) continue;
        const start = +new Date(s.date_time);
        const end = start + s.duration_minutes * 60_000;
        const triggerAt = end - 10 * 60_000;
        if (now >= triggerAt && now <= end) {
          setRatingSession(s);
          return;
        }
      }
      setRatingSession(null);
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, [upcoming, dismissed]);

  const quote = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);

  return (
    <div className="space-y-10">
      <header>
        <div className="text-sm text-muted-foreground">Welcome back</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{user.name.split(" ")[0]}</h1>
      </header>

      {/* Metrics */}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Current Level" value={user.current_level ?? "—"} sub={level?.title} />
        <Card>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Level Progress</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">{levelProgress}%</span>
            <span className="text-xs text-muted-foreground">of {user.current_level}</span>
          </div>
          <div className="mt-4"><ProgressBar value={levelProgress} /></div>
        </Card>
        <Card>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall Attendance</div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">{user.attendance_percentage}%</span>
            <span className="text-xs text-muted-foreground">last 90 days</span>
          </div>
          <div className="mt-4"><ProgressBar value={user.attendance_percentage ?? 0} /></div>
        </Card>
      </section>

      {/* Current course */}
      <section>
        <SectionTitle>Current Course</SectionTitle>
        <Card className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <Pill tone="muted">{level?.title}</Pill>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">{currentUnit?.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pick up exactly where you left off. Video, materials and practice activities included.</p>
          </div>
          <PrimaryButton>Continue unit</PrimaryButton>
        </Card>
      </section>

      {/* Upcoming sessions */}
      <section>
        <SectionTitle>Upcoming Sessions</SectionTitle>
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <Card><div className="text-sm text-muted-foreground">No upcoming sessions scheduled.</div></Card>
          )}
          {upcoming.map((s) => {
            const teacher = userById(s.teacher_id);
            return (
              <Card key={s.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{fmt(s.date_time)}</div>
                    <div className="text-xs text-muted-foreground">with {teacher?.name} · {s.duration_minutes} min</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <GhostButton><X className="h-3.5 w-3.5" /> Can't attend</GhostButton>
                  <SuccessButton onClick={() => window.open(s.teams_link, "_blank")}>
                    <Video className="h-4 w-4" /> Connect
                  </SuccessButton>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* History */}
      <section>
        <SectionTitle>Session History</SectionTitle>
        <Card className="!p-0">
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
                const tone = s.status === "completed" ? "success" : s.status === "absent" ? "danger" : s.status === "delayed" ? "warning" : "default";
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
        </Card>
      </section>

      {/* Quote */}
      <section>
        <Card className="bg-secondary/40">
          <div className="flex items-start gap-4">
            <Quote className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quote of the Week</div>
              <div className="mt-2 text-base text-foreground">{quote}</div>
            </div>
          </div>
        </Card>
      </section>

      {ratingSession && (
        <RatingModal
          session={ratingSession}
          onSubmit={() => {
            setDismissed((prev) => new Set(prev).add(ratingSession.id));
            setRatingSession(null);
          }}
        />
      )}
    </div>
  );
}
