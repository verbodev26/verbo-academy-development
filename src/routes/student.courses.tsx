import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { LEVELS, type Level, type Unit } from "@/lib/mock-data";
import { Card, Pill, SectionTitle } from "@/components/verbo/ui";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  Lock,
  Play,
  Sparkles,
  X,
  Mic,
  Trophy,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import {
  type Activity,
  EXERCISE_LABELS,
  activitiesForUnit,
  loadAttempts,
  loadCompletion,
  incrementAttempts,
  resetAttempts,
  setUnitCompleted,
  isUnitUnlocked,
} from "@/lib/activities-store";

export const Route = createFileRoute("/student/courses")({ component: Page });

type View =
  | { kind: "levels" }
  | { kind: "units"; level: Level }
  | { kind: "unit"; level: Level; unit: Unit };


function Page() {
  const { user } = useAuth();
  const [view, setView] = useState<View>({ kind: "levels" });
  const [rev, setRev] = useState(0); // bump when completion / attempts change

  if (view.kind === "unit") {
    return <PreUnitView key={rev} level={view.level} unit={view.unit} onBack={() => setView({ kind: "units", level: view.level })} onChange={() => setRev((r) => r + 1)} />;
  }
  if (view.kind === "units") {
    return <UnitsView key={rev} level={view.level} currentLevel={user?.current_level} onBack={() => setView({ kind: "levels" })} onOpen={(unit) => setView({ kind: "unit", level: view.level, unit })} />;
  }
  return <LevelsView key={rev} currentLevel={user?.current_level} onOpen={(level) => setView({ kind: "units", level })} />;
}

/* ---------------- Levels ---------------- */

function LevelsView({ currentLevel, onOpen }: { currentLevel?: string; onOpen: (l: Level) => void }) {
  const currentIdx = useMemo(() => LEVELS.findIndex((l) => l.id === currentLevel), [currentLevel]);
  const completion = loadCompletion();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your learning path</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Choose a level to explore its units and start your activities.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {LEVELS.map((lvl, idx) => {
          const isCurrent = lvl.id === currentLevel;
          const isLocked = currentIdx !== -1 && idx > currentIdx;
          const done = lvl.units.filter((u) => completion[u.id]).length;
          const pct = Math.round((done / lvl.units.length) * 100);
          return (
            <button
              key={lvl.id}
              onClick={() => !isLocked && onOpen(lvl)}
              disabled={isLocked}
              className={`group relative overflow-hidden rounded-2xl border bg-card p-6 text-left shadow-soft transition-all ${
                isLocked
                  ? "border-border opacity-60 cursor-not-allowed"
                  : "border-border hover:border-accent/40 hover:shadow-elevated"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-base font-semibold tracking-tight ${
                    isCurrent ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"
                  }`}>
                    {lvl.id}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-foreground">{lvl.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{lvl.units.length} units</div>
                  </div>
                </div>
                {isLocked ? <Lock className="h-4 w-4 text-muted-foreground" /> :
                  isCurrent ? <Pill tone="success">Current</Pill> :
                  pct === 100 ? <Pill tone="success">Completed</Pill> :
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />}
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="font-medium text-foreground">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Units ---------------- */

function UnitsView({ level, currentLevel, onBack, onOpen }: { level: Level; currentLevel?: string; onBack: () => void; onOpen: (u: Unit) => void }) {
  const completion = loadCompletion();

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All levels
      </button>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Level {level.id}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{level.title}</h1>
        </div>
        {level.id === currentLevel && <Pill tone="success">Current level</Pill>}
      </div>

      <SectionTitle>Units</SectionTitle>
      <div className="space-y-3">
        {level.units.map((u, idx) => {
          const done = !!completion[u.id];
          const unlocked = isUnitUnlocked(u.id);
          return (
            <button
              key={u.id}
              onClick={() => unlocked && onOpen(u)}
              disabled={!unlocked}
              className={`group flex w-full items-center gap-5 rounded-xl border p-5 text-left shadow-soft transition-all ${
                unlocked ? "border-border bg-card hover:border-accent/40 hover:shadow-elevated" : "border-border bg-card opacity-60 cursor-not-allowed"
              }`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                done ? "bg-success/10 text-success" : unlocked ? "bg-secondary text-foreground" : "bg-secondary text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-5 w-5" /> : !unlocked ? <Lock className="h-4 w-4" /> : String(idx + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{u.title}</div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Play className="h-3 w-3" /> Video</span>
                  <span className="inline-flex items-center gap-1"><BookOpen className="h-3 w-3" /> PDF guide</span>
                  <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Activities</span>
                </div>
              </div>
              <div className="hidden w-40 md:block">
                {done ? <Pill tone="success">Completed</Pill> : !unlocked ? <Pill tone="muted">Locked</Pill> : <Pill tone="muted">Not started</Pill>}
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Pre-unit ---------------- */

function PreUnitView({ level, unit, onBack, onChange }: { level: Level; unit: Unit; onBack: () => void; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const completion = loadCompletion();
  const attempts = loadAttempts()[unit.id] ?? 0;
  const done = !!completion[unit.id];
  const blocked = attempts >= 3 && !done;
  const activities = activitiesForUnit(unit.id);

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {level.id} units
      </button>

      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{level.id} · Pre-unit</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{unit.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Watch the introduction video, review the PDF guide, then start the interactive activities.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Pill tone={done ? "success" : blocked ? "danger" : "muted"}>{done ? "Completed" : blocked ? "Locked" : `Attempts: ${attempts}/3`}</Pill>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-0 overflow-hidden">
          <div className="group relative aspect-video w-full bg-primary">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button aria-label="Play video" className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_10px_30px_-8px_rgba(243,137,52,0.55)] transition-all hover:bg-[#d9731f] hover:scale-105 active:scale-100">
                <Play className="h-8 w-8 translate-x-0.5 fill-current" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[18%] rounded-full bg-accent" />
              </div>
              <span className="text-xs font-medium text-white/80">02:14 / 12:30</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm font-semibold text-foreground">Introduction · {unit.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">HD · English subtitles available</div>
            </div>
            <span className="text-xs font-medium text-muted-foreground">12 min</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground"><BookOpen className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">PDF Guide</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Complete unit reference</div>
              </div>
            </div>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary">
              <Download className="h-4 w-4" /> Download PDF Guide
            </button>
          </Card>

          <Card>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activities in this unit</div>
            <div className="mt-3 text-sm text-foreground">{activities.length} interactive exercises</div>
            <div className="mt-1 text-xs text-muted-foreground">Pass with ≥ 80 to unlock the next unit. 3 failed attempts will lock activities.</div>
          </Card>

          <button
            disabled={blocked || activities.length === 0}
            onClick={() => setOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-6px_rgba(243,137,52,0.5)] transition-all hover:bg-[#d9731f] hover:shadow-[0_10px_28px_-6px_rgba(243,137,52,0.6)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {blocked ? <><Lock className="h-4 w-4" /> Activities locked</> : activities.length === 0 ? "No activities yet" : <>Start Activities <ArrowRight className="h-4 w-4" /></>}
          </button>
          {blocked && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-[11px] text-destructive">
              Maximum attempts reached — please contact your instructor to reset your access.
            </p>
          )}
        </div>
      </div>

      {open && (
        <ActivityRunner
          unit={unit}
          activities={activities}
          onClose={() => { setOpen(false); onChange(); }}
        />
      )}
    </div>
  );
}

/* ---------------- Activity runner (carousel) ---------------- */

type RunnerPhase = "playing" | "passed" | "failed" | "locked";

function ActivityRunner({ unit, activities, onClose }: { unit: Unit; activities: Activity[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<null | { ok: boolean; tip?: string }>(null);
  const [phase, setPhase] = useState<RunnerPhase>("playing");
  const [score, setScore] = useState(0);
  const [attemptCount, setAttemptCount] = useState(loadAttempts()[unit.id] ?? 0);

  const current = activities[index];
  const total = activities.length;
  const progressPct = total === 0 ? 0 : ((index + (feedback ? 1 : 0)) / total) * 100;

  const checkAnswer = () => {
    if (!current) return;
    const ok = evaluate(current, draft[current.id] ?? "");
    setAnswers((a) => ({ ...a, [current.id]: ok }));
    setFeedback({
      ok,
      tip: ok ? "Great work — keep that momentum going!" : "Review the unit guide and try the next one carefully.",
    });
  };

  const next = () => {
    setFeedback(null);
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      return;
    }
    // Final scoring
    const correct = Object.values({ ...answers, [current!.id]: answers[current!.id] }).filter(Boolean).length;
    const final = Math.round((correct / total) * 100);
    setScore(final);
    if (final >= 80) {
      setUnitCompleted(unit.id, true);
      resetAttempts(unit.id);
      setPhase("passed");
    } else {
      const newCount = incrementAttempts(unit.id);
      setAttemptCount(newCount);
      setPhase(newCount >= 3 ? "locked" : "failed");
    }
  };

  const retry = () => {
    setAnswers({});
    setDraft({});
    setFeedback(null);
    setIndex(0);
    setPhase("playing");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-[70vh] max-h-[760px] w-[70vw] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-[#01304a] to-[#024366] px-6 py-4 text-white">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">{unit.title}</div>
            <div className="mt-0.5 text-sm font-semibold">
              {phase === "playing" ? `Exercise ${Math.min(index + 1, total)} of ${total}` : "Results"}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-secondary">
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${phase === "playing" ? progressPct : 100}%` }} />
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto">
          {phase === "playing" && current && (
            <div key={current.id} className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 px-6 py-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{EXERCISE_LABELS[current.type]}</div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{current.name}</h3>
              <div className="mt-6">
                <ExerciseBody activity={current} value={draft[current.id] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [current.id]: v }))} />
              </div>
            </div>
          )}

          {phase === "passed" && (
            <ResultScreen icon={<Trophy className="h-10 w-10" />} tone="success" title="Unit completed!" subtitle={`Final score ${score}/100 · The next unit is now unlocked.`} primary={{ label: "Continue", onClick: onClose }} />
          )}
          {phase === "failed" && (
            <ResultScreen icon={<RotateCcw className="h-10 w-10" />} tone="warning" title="Almost there" subtitle={`Final score ${score}/100 · You need 80 to pass. Attempts used: ${attemptCount}/3.`} primary={{ label: "Try again", onClick: retry }} secondary={{ label: "Close", onClick: onClose }} />
          )}
          {phase === "locked" && (
            <ResultScreen icon={<AlertTriangle className="h-10 w-10" />} tone="danger" title="Maximum attempts reached" subtitle="Booking or viewing activities for this unit is now locked — please contact your instructor to reset your access." primary={{ label: "Close", onClick: onClose }} />
          )}
        </div>

        {/* Footer */}
        {phase === "playing" && (
          <div className="border-t border-border bg-card p-4">
            {!feedback ? (
              <div className="flex justify-end">
                <button
                  onClick={checkAnswer}
                  disabled={!(draft[current?.id ?? ""] ?? "").trim() && current?.type !== "record"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-6px_rgba(243,137,52,0.5)] transition-all hover:bg-[#d9731f] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Check Answer
                </button>
              </div>
            ) : (
              <div className={`flex items-center justify-between gap-4 rounded-xl px-5 py-4 ${feedback.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                <div>
                  <div className="text-sm font-semibold">{feedback.ok ? "Correct!" : "Incorrect"}</div>
                  <div className="text-xs opacity-80">{feedback.tip}</div>
                </div>
                <button
                  onClick={next}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 ${feedback.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                >
                  {index + 1 < total ? "Next Exercise" : "Finish"} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Result screen --- */
function ResultScreen({ icon, tone, title, subtitle, primary, secondary }: {
  icon: React.ReactNode;
  tone: "success" | "warning" | "danger";
  title: string;
  subtitle: string;
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  const toneCls = tone === "success" ? "bg-emerald-500/10 text-emerald-600" : tone === "warning" ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600";
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className={`flex h-20 w-20 items-center justify-center rounded-2xl ${toneCls}`}>{icon}</div>
      <h3 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-8 flex items-center gap-3">
        {secondary && (
          <button onClick={secondary.onClick} className="rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary">{secondary.label}</button>
        )}
        <button onClick={primary.onClick} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-[#d9731f]">{primary.label}</button>
      </div>
    </div>
  );
}

/* --- Per-exercise body --- */
function ExerciseBody({ activity, value, onChange }: { activity: Activity; value: string; onChange: (v: string) => void }) {
  const inputCls = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

  if (activity.type === "fill_gaps" || activity.type === "read_complete") {
    const parts = (activity.paragraph ?? "").split("[blank]");
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-secondary/50 p-5 text-base leading-relaxed text-foreground">
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {i < parts.length - 1 && <span className="mx-1 inline-block min-w-[80px] border-b-2 border-accent" />}
            </span>
          ))}
        </div>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer" className={inputCls} autoFocus />
      </div>
    );
  }

  if (activity.type === "read_select" || activity.type === "listen_select") {
    return (
      <div className="space-y-4">
        {activity.type === "listen_select" ? (
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-4">
            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground"><Play className="h-4 w-4" /></button>
            <div className="flex-1">
              <div className="text-xs font-medium text-muted-foreground">Audio clip</div>
              <div className="text-sm text-foreground">{activity.audioName || "Sample audio"}</div>
            </div>
          </div>
        ) : activity.prompt ? (
          <div className="rounded-xl bg-secondary/50 p-5 text-sm leading-relaxed text-foreground">{activity.prompt}</div>
        ) : null}
        <div className="text-sm font-semibold text-foreground">{activity.question}</div>
        <div className="space-y-2">
          {activity.options?.filter(Boolean).map((opt, i) => (
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${value === String(i) ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"}`}>
              <input type="radio" name={activity.id} checked={value === String(i)} onChange={() => onChange(String(i))} className="h-4 w-4 accent-[#f38934]" />
              <span className="text-xs font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (activity.type === "drag_drop" || activity.type === "match") {
    return <MatchExercise items={activity.items ?? []} value={value} onChange={onChange} />;
  }

  if (activity.type === "record") {
    return <RecordExercise sentence={activity.answer ?? ""} value={value} onChange={onChange} />;
  }

  return null;
}

function MatchExercise({ items, value, onChange }: { items: { text: string; key: string }[]; value: string; onChange: (v: string) => void }) {
  // Mock pairing: render two columns; user types a destination key for each left item.
  const map: Record<string, string> = useMemo(() => {
    try { return value ? JSON.parse(value) : {}; } catch { return {}; }
  }, [value]);
  const update = (text: string, dest: string) => {
    onChange(JSON.stringify({ ...map, [text]: dest }));
  };
  const destinations = Array.from(new Set(items.map((i) => i.key)));
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Pick the correct destination for each item.</div>
      {items.map((it) => (
        <div key={it.text} className="grid grid-cols-[1fr_1fr] items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className="text-sm font-medium text-foreground">{it.text}</div>
          <select value={map[it.text] ?? ""} onChange={(e) => update(it.text, e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
            <option value="">Select destination…</option>
            {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function RecordExercise({ sentence, value, onChange }: { sentence: string; value: string; onChange: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const start = () => {
    // Simulate mic permission prompt
    alert("Microphone access requested — recording will begin.");
    setRecording(true);
    setElapsed(0);
    timer.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stop = () => {
    setRecording(false);
    if (timer.current) window.clearInterval(timer.current);
    onChange("recorded"); // mock recorded marker
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-secondary/50 p-5 text-base leading-relaxed text-foreground">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Say this out loud</span>
        <div className="mt-2 font-medium">"{sentence}"</div>
      </div>
      <div className="flex items-center justify-center gap-4 rounded-xl border border-border bg-background p-6">
        <button
          onClick={recording ? stop : start}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 ${recording ? "animate-pulse bg-rose-600" : "bg-accent"}`}
        >
          <Mic className="h-6 w-6" />
        </button>
        <div className="flex items-end gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className={`w-1.5 rounded-full ${recording ? "bg-accent" : value ? "bg-emerald-500" : "bg-border"}`} style={{ height: `${8 + ((i * 7 + elapsed * 3) % 28)}px` }} />
          ))}
        </div>
        <div className="text-sm font-medium text-foreground">
          {recording ? `Recording… ${elapsed}s` : value ? "Recorded ✓" : "Tap to record"}
        </div>
      </div>
    </div>
  );
}

/* --- Evaluation --- */
function evaluate(activity: Activity, value: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  if (activity.type === "fill_gaps" || activity.type === "read_complete") {
    return norm(value) === norm(activity.answer ?? "");
  }
  if (activity.type === "read_select" || activity.type === "listen_select") {
    return Number(value) === activity.correctIndex;
  }
  if (activity.type === "record") {
    return value === "recorded";
  }
  if (activity.type === "drag_drop" || activity.type === "match") {
    try {
      const map = JSON.parse(value || "{}") as Record<string, string>;
      return (activity.items ?? []).every((it) => norm(map[it.text] ?? "") === norm(it.key));
    } catch { return false; }
  }
  return false;
}
