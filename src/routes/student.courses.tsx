import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  RotateCcw,
  Award,
  Info,
  Clock,
  PartyPopper,
} from "lucide-react";
import { Card, Pill } from "@/components/verbo/ui";
import { Confetti } from "@/components/verbo/Confetti";
import { useAuth } from "@/lib/auth";
import {
  type ProductId,
  type ProductCourse,
  type CourseLevel,
  type CourseUnit,
  loadCourses,
  subscribeCourses,
} from "@/lib/product-courses-store";
import {
  type Activity,
  type ActivityCategory,
  EXERCISE_LABELS,
  MANDATORY_CATEGORIES,
  activitiesForUnit,
  bestScoreFor,
  categoryLabel,
  isMandatoryCategory,
  isMilestoneUnit,
  isMilestoneUnlocked,
  loadActivityScores,
  recordActivityScore,
  setUnitCompleted,
  unitCategoryProgress,
  unitNumberOf,
  unitPassed,
} from "@/lib/activities-store";
import {
  loadEvents,
  pushEvent,
  subscribeEvents,
  type LearningPathEvent,
} from "@/lib/learning-path-events";
import { groupsByStudentId } from "@/lib/groups-store";


export const Route = createFileRoute("/student/courses")({ component: Page });

/* -------------------------------------------------------------------------- */
/* Product mapping (student.product may be enterprise/go/international/vip).  */
/* -------------------------------------------------------------------------- */
const PRODUCT_TO_COURSE: Record<string, ProductId> = {
  enterprise: "enterprise",
  go: "go",
  international: "international",
};

/* -------------------------------------------------------------------------- */
/* Level-state computation                                                     */
/* -------------------------------------------------------------------------- */
type LevelStateKind = "completed" | "current" | "reopened" | "locked_progress" | "locked_not_contracted";

interface LevelState {
  kind: LevelStateKind;
  passedUnits: number;
  totalUnits: number;
  readOnly: boolean;
  message?: string;
}

function levelIsComplete(level: CourseLevel, studentId: string): boolean {
  if (level.units.length === 0) return false;
  for (const u of level.units) {
    if (isMilestoneUnit(u.id) && !isMilestoneUnlocked(studentId, u.id)) return false;
    if (!unitPassed(studentId, u.id)) return false;
  }
  return true;
}

function passedUnitCount(level: CourseLevel, studentId: string): number {
  return level.units.filter((u) => unitPassed(studentId, u.id)).length;
}

function computeLevelStates(
  levels: CourseLevel[],
  contracted: string[],
  reopened: string[],
  studentId: string,
  isGroupMember: boolean = false,
): LevelState[] {

  const contractedSet = new Set(contracted);
  const reopenedSet = new Set(reopened);
  const completion: boolean[] = levels.map((l) => levelIsComplete(l, studentId));

  // The "current" level is the first contracted level that isn't completed.
  let currentIndex = -1;
  for (let i = 0; i < levels.length; i++) {
    if (!contractedSet.has(levels[i].name)) continue;
    if (!completion[i]) { currentIndex = i; break; }
  }

  return levels.map((level, i) => {
    const passed = passedUnitCount(level, studentId);
    const base = { passedUnits: passed, totalUnits: level.units.length };
    if (!contractedSet.has(level.name)) {
      return {
        ...base,
        kind: "locked_not_contracted",
        readOnly: false,
        message: isGroupMember
          ? "Not included in your group's plan — contact your admin to expand access"
          : "Not included in your current plan — contact your advisor to upgrade",

      };
    }
    if (completion[i]) {
      if (reopenedSet.has(level.name)) {
        return { ...base, kind: "reopened", readOnly: true };
      }
      return { ...base, kind: "completed", readOnly: false };
    }
    if (i === currentIndex) return { ...base, kind: "current", readOnly: false };
    const prev = levels[i - 1];
    return {
      ...base,
      kind: "locked_progress",
      readOnly: false,
      message: prev ? `Complete ${prev.name} to unlock` : "Locked",
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Unit-state (for the units-in-level screen)                                  */
/* -------------------------------------------------------------------------- */
type UnitStateKind = "passed" | "current" | "locked" | "milestone_locked" | "milestone_ready";

function computeUnitStates(level: CourseLevel, studentId: string, readOnly: boolean): UnitStateKind[] {
  const states: UnitStateKind[] = [];
  let previousPassed = true; // first unit is always unlockable
  for (const u of level.units) {
    const passed = unitPassed(studentId, u.id);
    if (isMilestoneUnit(u.id)) {
      if (passed) { states.push("passed"); previousPassed = true; continue; }
      if (!previousPassed) { states.push("locked"); previousPassed = false; continue; }
      // Milestone teacher-lock
      if (isMilestoneUnlocked(studentId, u.id)) {
        states.push("milestone_ready");
      } else {
        states.push("milestone_locked");
        previousPassed = false; // hard stop
        continue;
      }
      previousPassed = false;
      continue;
    }
    if (passed) { states.push("passed"); previousPassed = true; continue; }
    if (previousPassed) {
      states.push(readOnly ? "locked" : "current");
    } else {
      states.push("locked");
    }
    previousPassed = false;
  }
  return states;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */
type View =
  | { kind: "levels" }
  | { kind: "units"; levelId: string; readOnly: boolean }
  | { kind: "unit"; levelId: string; unitId: string; readOnly: boolean };

function Page() {
  const { user } = useAuth();
  const [rev, setRev] = useState(0);
  const [view, setView] = useState<View>({ kind: "levels" });
  const [courses, setCourses] = useState<ProductCourse[]>(() => loadCourses());
  const [completionModal, setCompletionModal] = useState<CourseLevel | null>(null);

  useEffect(() => {
    setCourses(loadCourses());
    return subscribeCourses(() => { setCourses(loadCourses()); setRev((r) => r + 1); });
  }, []);
  useEffect(() => subscribeEvents(() => setRev((r) => r + 1)), []);

  const productId = user?.product ? PRODUCT_TO_COURSE[user.product] : undefined;
  if (!productId) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Learning Path unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your product does not include the self-study Learning Path. Head to your dedicated section instead.</p>
      </div>
    );
  }

  const product = courses.find((c) => c.product === productId) ?? null;
  const levels = product?.levels ?? [];
  const contracted = user?.contracted_levels ?? [];
  const reopened = user?.reopened_levels ?? [];
  const isGroupMember = !!(user && groupsByStudentId().has(user.id));
  const states = useMemo(
    () => computeLevelStates(levels, contracted, reopened, user?.id ?? "", isGroupMember),
    [levels, contracted, reopened, user?.id, rev, isGroupMember],
  );


  const onUnitCompleted = (levelId: string, unitId: string) => {
    // Record milestone events + potential level completion when unit passes.
    if (!user) return;
    if (unitPassed(user.id, unitId)) {
      pushEvent(user.id, { kind: "unit_completed", ref: unitId, label: `Completed Unit ${unitNumberOf(unitId)}` });
      const level = levels.find((l) => l.id === levelId);
      if (level && levelIsComplete(level, user.id)) {
        pushEvent(user.id, { kind: "level_completed", ref: level.name, label: `Completed ${level.name}` });
        setCompletionModal(level);
      }
    }
    setRev((r) => r + 1);
  };

  if (view.kind === "unit") {
    const level = levels.find((l) => l.id === view.levelId);
    const unit = level?.units.find((u) => u.id === view.unitId);
    if (!level || !unit) return null;
    return (
      <UnitDetail
        level={level}
        unit={unit}
        studentId={user?.id ?? ""}
        readOnly={view.readOnly}
        onBack={() => setView({ kind: "units", levelId: level.id, readOnly: view.readOnly })}
        onChange={() => onUnitCompleted(level.id, unit.id)}
      />
    );
  }

  if (view.kind === "units") {
    const level = levels.find((l) => l.id === view.levelId);
    if (!level) { setView({ kind: "levels" }); return null; }
    return (
      <UnitsView
        key={rev}
        level={level}
        readOnly={view.readOnly}
        studentId={user?.id ?? ""}
        onBack={() => setView({ kind: "levels" })}
        onOpenUnit={(unit) => setView({ kind: "unit", levelId: level.id, unitId: unit.id, readOnly: view.readOnly })}
      />
    );
  }

  const events = user ? loadEvents(user.id) : [];
  return (
    <>
      <LevelsView
        key={rev}
        studentId={user?.id ?? ""}
        productLabel={user?.product ?? ""}
        levels={levels}
        states={states}
        contracted={contracted}
        events={events}
        onOpen={(level, state) => {
          if (state.kind === "locked_progress" || state.kind === "locked_not_contracted" || state.kind === "completed") return;
          setView({ kind: "units", levelId: level.id, readOnly: state.readOnly });
        }}
      />
      {completionModal && (
        <LevelCompletionModal level={completionModal} studentName={user?.name ?? "Student"} onClose={() => setCompletionModal(null)} />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Levels view                                                                 */
/* -------------------------------------------------------------------------- */
const PRODUCT_GRADIENTS: Record<string, string> = {
  enterprise: "from-[#01304a] via-[#024366] to-[#0a5e88]",
  go: "from-[#7c2d12] via-[#c2410c] to-[#f97316]",
  international: "from-[#134e4a] via-[#0f766e] to-[#14b8a6]",
  vip: "from-[#4a044e] via-[#7e22ce] to-[#a855f7]",
};

function LevelsView({
  productLabel, levels, states, contracted, events, studentId, onOpen,
}: {
  productLabel: string;
  levels: CourseLevel[];
  states: LevelState[];
  contracted: string[];
  events: LearningPathEvent[];
  studentId: string;
  onOpen: (level: CourseLevel, state: LevelState) => void;
}) {
  const contractedSet = new Set(contracted);
  const contractedLevels = levels.filter((l) => contractedSet.has(l.name));
  const totalUnits = contractedLevels.reduce((s, l) => s + l.units.length, 0);
  const passedUnits = contractedLevels.reduce((s, l) => s + passedUnitCount(l, studentId), 0);
  const pct = totalUnits === 0 ? 0 : Math.round((passedUnits / totalUnits) * 100);

  // Upcoming milestone banner: within 3 non-milestone units of the next locked milestone
  // inside the current level.
  const currentLevelIdx = states.findIndex((s) => s.kind === "current");
  const currentLevel = currentLevelIdx >= 0 ? levels[currentLevelIdx] : null;
  let milestoneRemaining: number | null = null;
  if (currentLevel) {
    for (let i = 0; i < currentLevel.units.length; i++) {
      const u = currentLevel.units[i];
      if (isMilestoneUnit(u.id) && !unitPassed(studentId, u.id)) {
        // Count non-passed non-milestone units before this milestone.
        let remaining = 0;
        for (let j = 0; j < i; j++) {
          const v = currentLevel.units[j];
          if (!isMilestoneUnit(v.id) && !unitPassed(studentId, v.id)) remaining++;
        }
        if (remaining <= 3) milestoneRemaining = remaining;
        break;
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Your learning path</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Progress through your program level by level. Complete each unit's mandatory Vocabulary, Grammar, and Practice activities to move on.</p>
      </div>

      {/* Global progress */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overall progress</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {passedUnits} of {totalUnits} units completed — {pct}%
            </div>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-xs text-muted-foreground">Contracted levels</div>
            <div className="mt-0.5 text-sm font-medium text-foreground">{contractedLevels.length} of {levels.length}</div>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {milestoneRemaining !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          <Award className="h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Your Milestone Check is coming up in {milestoneRemaining} {milestoneRemaining === 1 ? "unit" : "units"}!</span>
            <span className="ml-2 text-amber-800/80 dark:text-amber-200/80">Your teacher will unlock it when you're ready.</span>
          </div>
        </div>
      )}

      {/* Level cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {levels.map((lvl, idx) => {
          const st = states[idx];
          return <LevelCard key={lvl.id} level={lvl} state={st} product={productLabel} onOpen={() => onOpen(lvl, st)} />;
        })}
      </div>

      {/* Achievement timeline */}
      <AchievementTimeline events={events} />
    </div>
  );
}

function LevelCard({
  level, state, product, onOpen,
}: {
  level: CourseLevel;
  state: LevelState;
  product: string;
  onOpen: () => void;
}) {
  const gradient = PRODUCT_GRADIENTS[product] ?? PRODUCT_GRADIENTS.enterprise;
  const isLocked = state.kind === "locked_progress" || state.kind === "locked_not_contracted";
  const isCompleted = state.kind === "completed";
  const isReopened = state.kind === "reopened";
  const pct = state.totalUnits === 0 ? 0 : Math.round((state.passedUnits / state.totalUnits) * 100);

  const clickable = !isLocked && !isCompleted;

  return (
    <button
      type="button"
      onClick={clickable ? onOpen : undefined}
      disabled={!clickable}
      title={state.message}
      className={`group relative overflow-hidden rounded-2xl border text-left shadow-soft transition-all ${
        isLocked
          ? "border-border cursor-not-allowed"
          : isCompleted
          ? "border-border cursor-default"
          : "border-border hover:-translate-y-0.5 hover:shadow-elevated"
      }`}
    >
      {/* Cover slot */}
      <div className={`relative aspect-[16/7] w-full bg-gradient-to-br ${gradient} ${isLocked ? "opacity-40 saturate-50" : ""}`}>
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.25), transparent 45%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">{level.id}</div>
          <div className="mt-0.5 text-lg font-semibold text-white">{level.name}</div>
        </div>
        <div className="absolute right-3 top-3">
          {isLocked && <Lock className="h-4 w-4 text-white/80" />}
          {isCompleted && !isReopened && <Pill tone="success">Completed</Pill>}
          {isReopened && <Pill tone="warning">Reopened for Review</Pill>}
          {state.kind === "current" && <Pill tone="success">Current</Pill>}
        </div>
      </div>

      <div className="bg-card p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{state.totalUnits} units</span>
          <span className="font-medium text-foreground">{state.passedUnits} / {state.totalUnits} · {pct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div className={`h-full rounded-full transition-all ${isLocked ? "bg-muted-foreground/40" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
        {state.message && (
          <div className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}
        {clickable && (
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">
            {isReopened ? "Review level" : "Continue"} <ChevronRight className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </button>
  );
}

function AchievementTimeline({ events }: { events: LearningPathEvent[] }) {
  const shown = events.slice(0, 15);
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Achievement Timeline</h2>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your milestones will appear here as you progress.</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((e, i) => (
            <li key={`${e.ts}-${i}`} className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                e.kind === "level_completed" ? "bg-accent/15 text-accent" : e.kind === "unit_completed" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
              }`}>
                {e.kind === "level_completed" ? <Trophy className="h-3.5 w-3.5" /> : e.kind === "unit_completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1">
                <div className="text-sm text-foreground">{e.label ?? e.ref}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(e.ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Units view                                                                  */
/* -------------------------------------------------------------------------- */
function UnitsView({
  level, readOnly, studentId, onBack, onOpenUnit,
}: {
  level: CourseLevel;
  readOnly: boolean;
  studentId: string;
  onBack: () => void;
  onOpenUnit: (u: CourseUnit) => void;
}) {
  const states = computeUnitStates(level, studentId, readOnly);
  const blocks: { start: number; end: number }[] = [
    { start: 0, end: 9 },
    { start: 10, end: 19 },
    { start: 20, end: 29 },
  ];
  const unitAt = (n: number) => level.units.find((u) => unitNumberOf(u.id) === n);

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All levels
      </button>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{level.id}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{level.name}</h1>
        </div>
        {readOnly && <Pill tone="warning">Reopened for Review</Pill>}
      </div>

      <div className="space-y-8">
        {blocks.map((block, bi) => (
          <section key={bi}>
            <div className="mb-3 flex items-center gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Block {bi + 1}</div>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10">
              {Array.from({ length: 10 }).map((_, k) => {
                const n = block.start + k + 1;
                const u = unitAt(n);
                if (!u) {
                  return <div key={n} className="aspect-square rounded-lg border border-dashed border-border bg-secondary/30" />;
                }
                const idx = level.units.indexOf(u);
                const st = states[idx];
                const milestone = isMilestoneUnit(u.id);
                return (
                  <UnitStone
                    key={u.id}
                    unit={u}
                    number={n}
                    state={st}
                    milestone={milestone}
                    onOpen={() => onOpenUnit(u)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function UnitStone({
  unit, number, state, milestone, onOpen,
}: {
  unit: CourseUnit;
  number: number;
  state: UnitStateKind;
  milestone: boolean;
  onOpen: () => void;
}) {
  const disabled = state === "locked" || state === "milestone_locked";
  const cls = milestone
    ? state === "passed"
      ? "border-amber-500 bg-gradient-to-br from-amber-100 to-amber-200 text-amber-900"
      : state === "milestone_ready"
      ? "border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-900"
      : "border-amber-500/40 bg-amber-50/60 text-amber-900/60"
    : state === "passed"
    ? "border-success/40 bg-success/10 text-success"
    : state === "current"
    ? "border-accent bg-accent/10 text-foreground"
    : "border-border bg-secondary/40 text-muted-foreground";

  const tooltip = milestone && state === "milestone_locked"
    ? "Your teacher will unlock this Milestone Check"
    : milestone
    ? "Milestone Check"
    : state === "locked"
    ? "Complete the previous unit first"
    : undefined;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onOpen}
      disabled={disabled}
      title={tooltip}
      className={`group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center shadow-sm transition-all ${cls} ${disabled ? "cursor-not-allowed opacity-70" : "hover:-translate-y-0.5"}`}
    >
      {milestone ? (
        <Trophy className="h-5 w-5" />
      ) : state === "passed" ? (
        <CheckCircle2 className="h-5 w-5" />
      ) : state === "locked" ? (
        <Lock className="h-4 w-4" />
      ) : (
        <span className="text-sm font-semibold">{number}</span>
      )}
      <div className="text-[10px] font-medium leading-tight line-clamp-2">
        {milestone ? "Milestone Check" : unit.title}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Unit detail (video + PDF + activities)                                      */
/* -------------------------------------------------------------------------- */
function getYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
  } catch { /* noop */ }
  return null;
}
function isVimeo(url: string): boolean {
  try { return new URL(url).hostname.includes("vimeo.com"); } catch { return false; }
}
function UnitVideoPlayer({ url }: { url: string }) {
  const yt = getYouTubeEmbed(url);
  if (yt) return <iframe src={yt} title="Lesson video" allowFullScreen className="absolute inset-0 h-full w-full border-0" />;
  if (isVimeo(url)) return <iframe src={url.replace("vimeo.com", "player.vimeo.com/video")} title="Lesson video" allowFullScreen className="absolute inset-0 h-full w-full border-0" />;
  return <video src={url} controls className="absolute inset-0 h-full w-full object-cover" />;
}

function UnitDetail({
  level, unit, studentId, readOnly, onBack, onChange,
}: {
  level: CourseLevel;
  unit: CourseUnit;
  studentId: string;
  readOnly: boolean;
  onBack: () => void;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activities = activitiesForUnit(unit.id);
  const catProgress = unitCategoryProgress(studentId, unit.id);
  const passed = unitPassed(studentId, unit.id);
  const milestone = isMilestoneUnit(unit.id);

  return (
    <div className="space-y-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {level.name}
      </button>

      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {level.name} · {milestone ? "Milestone Check" : `Unit ${unitNumberOf(unit.id)}`}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{unit.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Watch the video, review the PDF guide, then complete Vocabulary, Grammar and Practice with a score of at least 60 in each to pass this unit.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {passed && <Pill tone="success">Passed</Pill>}
          {readOnly && <Pill tone="warning">Review mode</Pill>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden !p-0">
          <div className="relative aspect-video w-full bg-primary">
            {unit.video_url ? (
              <UnitVideoPlayer url={unit.video_url} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary via-primary to-black/40 text-white/60">
                <Play className="h-8 w-8" />
                <span className="text-xs">No video assigned yet</span>
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="text-sm font-semibold text-foreground">Introduction · {unit.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{unit.video_url ? "HD · English subtitles available" : "Video not available yet"}</div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground"><BookOpen className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">PDF Guide</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{unit.pdf_url ? "Complete unit reference" : "Guide not uploaded yet"}</div>
              </div>
            </div>
            {unit.pdf_url ? (
              <a href={unit.pdf_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-secondary">
                <Download className="h-4 w-4" /> Download PDF Guide
              </a>
            ) : (
              <button disabled className="mt-4 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm opacity-50">
                <Download className="h-4 w-4" /> Download PDF Guide
              </button>
            )}
          </Card>

          {((unit.vocabulary && unit.vocabulary.length > 0) || unit.grammar_point) && (
            <Card>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What you'll learn</div>
              {unit.vocabulary && unit.vocabulary.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {unit.vocabulary.map((w) => (
                    <span key={w} className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs font-medium text-foreground">{w}</span>
                  ))}
                </div>
              )}
              {unit.grammar_point && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Grammar focus: </span>{unit.grammar_point}
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mandatory Categories</div>
            <ul className="mt-3 space-y-2">
              {MANDATORY_CATEGORIES.map((c) => {
                const row = catProgress.find((r) => r.category === c);
                const best = row?.best ?? 0;
                const ok = best >= 60;
                return (
                  <li key={c} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{categoryLabel(c)}</span>
                    <span className={`text-xs font-semibold ${row ? (ok ? "text-success" : "text-muted-foreground") : "text-destructive"}`}>
                      {row ? `${best}/100` : "No activity yet"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {catProgress.some((r) => !r.mandatory) && (
              <div className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
                Optional practice: {catProgress.filter((r) => !r.mandatory).map((r) => categoryLabel(r.category)).join(", ")}. Doesn't affect progression.
              </div>
            )}
          </Card>

          <button
            disabled={activities.length === 0}
            onClick={() => setOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-6px_rgba(243,137,52,0.5)] transition-all hover:bg-[#d9731f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {activities.length === 0 ? "No activities yet" : readOnly ? <>Review activities <ArrowRight className="h-4 w-4" /></> : <>Start activities <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>

      {open && (
        <ActivityRunner
          unit={unit}
          activities={activities}
          studentId={studentId}
          readOnly={readOnly}
          onClose={() => { setOpen(false); onChange(); }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity runner                                                             */
/* -------------------------------------------------------------------------- */
function ActivityRunner({
  unit, activities, studentId, readOnly, onClose,
}: {
  unit: CourseUnit;
  activities: Activity[];
  studentId: string;
  readOnly: boolean;
  onClose: () => void;
}) {
  const orderedCats = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => set.add(a.category ?? "uncategorized"));
    return [
      ...MANDATORY_CATEGORIES.filter((c) => set.has(c)),
      ...Array.from(set).filter((c) => !(MANDATORY_CATEGORIES as readonly string[]).includes(c)),
    ];
  }, [activities]);

  const [activeCat, setActiveCat] = useState<string>(orderedCats[0] ?? "uncategorized");
  const list = activities.filter((a) => (a.category ?? "uncategorized") === activeCat);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<null | { ok: boolean; score: number }>(null);

  useEffect(() => { setIndex(0); setFeedback(null); }, [activeCat]);

  const current = list[index];

  const check = () => {
    if (!current) return;
    const ok = evaluate(current, draft[current.id] ?? "");
    const score = ok ? 100 : 0;
    if (!readOnly) recordActivityScore(studentId, current.id, score);
    // Auto-complete unit when the mandatory rule is satisfied.
    if (!readOnly && unitPassed(studentId, unit.id)) setUnitCompleted(studentId, unit.id, true);
    setFeedback({ ok, score });
  };

  const next = () => {
    setFeedback(null);
    if (index + 1 < list.length) setIndex((i) => i + 1);
    else {
      // Try to advance to the next category tab, otherwise close.
      const nextIdx = orderedCats.indexOf(activeCat) + 1;
      if (nextIdx < orderedCats.length) setActiveCat(orderedCats[nextIdx]);
      else onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[78vh] max-h-[820px] w-[76vw] max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 bg-gradient-to-br from-[#01304a] to-[#024366] px-6 py-4 text-white">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">{unit.title}</div>
            <div className="mt-0.5 text-sm font-semibold">{readOnly ? "Review · " : ""}Exercise {Math.min(index + 1, Math.max(1, list.length))} of {list.length}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border bg-secondary/40 px-6 py-3">
          {orderedCats.map((c) => {
            const active = c === activeCat;
            const mandatory = isMandatoryCategory(c);
            const best = activities.filter((a) => (a.category ?? "uncategorized") === c).reduce((m, a) => Math.max(m, bestScoreFor(studentId, a.id)), 0);
            const ok = mandatory && best >= 60;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"
                }`}
              >
                <span>{categoryLabel(c)}</span>
                {mandatory ? (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{best}/100</span>
                ) : (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Optional</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 overflow-y-auto">
          {current ? (
            <div key={current.id} className="mx-auto max-w-2xl px-6 py-8">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{EXERCISE_LABELS[current.type]}</div>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{current.name}</h3>
              {readOnly && (
                <div className="mt-2 rounded-lg bg-secondary/50 p-2 text-[11px] text-muted-foreground">
                  Best score: <span className="font-semibold text-foreground">{bestScoreFor(studentId, current.id)}/100</span> — review only.
                </div>
              )}
              <div className="mt-6">
                <ExerciseBody activity={current} value={draft[current.id] ?? ""} onChange={(v) => setDraft((d) => ({ ...d, [current.id]: v }))} disabled={readOnly} />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"><Sparkles className="h-8 w-8" /></div>
              <p className="mt-4 text-sm text-muted-foreground">No activities in this category yet.</p>
            </div>
          )}
        </div>

        {current && (
          <div className="border-t border-border bg-card p-4">
            {!feedback ? (
              <div className="flex justify-end">
                <button
                  onClick={readOnly ? next : check}
                  disabled={!readOnly && !(draft[current.id] ?? "").trim() && current.type !== "record"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-6px_rgba(243,137,52,0.5)] transition-all hover:bg-[#d9731f] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {readOnly ? "Next" : "Check Answer"}
                </button>
              </div>
            ) : (
              <div className={`flex items-center justify-between gap-4 rounded-xl px-5 py-4 ${feedback.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}>
                <div>
                  <div className="text-sm font-semibold">{feedback.ok ? "Correct!" : "Not quite"}</div>
                  <div className="text-xs opacity-80">{feedback.ok ? "Nice work — moving on." : "Try again next round — your best score is kept."}</div>
                </div>
                <button
                  onClick={next}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 ${feedback.ok ? "bg-emerald-600" : "bg-rose-600"}`}
                >
                  {index + 1 < list.length ? "Next Exercise" : "Finish"} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Exercise bodies + evaluators (preserved from previous implementation)       */
/* -------------------------------------------------------------------------- */
function ExerciseBody({ activity, value, onChange, disabled }: { activity: Activity; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const inputCls = "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60";

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
        <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder="Type your answer" className={inputCls} autoFocus />
      </div>
    );
  }

  if (activity.type === "read_select" || activity.type === "listen_select") {
    return (
      <div className="space-y-4">
        {activity.type === "listen_select" ? (
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-4">
            <button type="button" onClick={() => alert("Audio playback is mocked in this demo.")} aria-label="Play audio clip" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105"><Play className="h-4 w-4" /></button>
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
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${value === String(i) ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"} ${disabled ? "opacity-70" : ""}`}>
              <input type="radio" name={activity.id} checked={value === String(i)} onChange={() => onChange(String(i))} disabled={disabled} className="h-4 w-4 accent-[#f38934]" />
              <span className="text-xs font-semibold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (activity.type === "drag_drop" || activity.type === "match") {
    return <MatchExercise items={activity.items ?? []} value={value} onChange={onChange} disabled={disabled} />;
  }

  if (activity.type === "record") {
    return <RecordExercise sentence={activity.answer ?? ""} value={value} onChange={onChange} disabled={disabled} />;
  }

  return null;
}

function MatchExercise({ items, value, onChange, disabled }: { items: { text: string; key: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const map: Record<string, string> = useMemo(() => {
    try { return value ? JSON.parse(value) : {}; } catch { return {}; }
  }, [value]);
  const update = (text: string, dest: string) => onChange(JSON.stringify({ ...map, [text]: dest }));
  const destinations = Array.from(new Set(items.map((i) => i.key)));
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Pick the correct destination for each item.</div>
      {items.map((it) => (
        <div key={it.text} className="grid grid-cols-[1fr_1fr] items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className="text-sm font-medium text-foreground">{it.text}</div>
          <select value={map[it.text] ?? ""} onChange={(e) => update(it.text, e.target.value)} disabled={disabled} className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60">
            <option value="">Select destination…</option>
            {destinations.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function RecordExercise({ sentence, value, onChange, disabled }: { sentence: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const start = () => {
    alert("Microphone access requested — recording will begin.");
    setRecording(true);
    setElapsed(0);
    timer.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stop = () => {
    setRecording(false);
    if (timer.current) window.clearInterval(timer.current);
    onChange("recorded");
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
          disabled={disabled}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60 ${recording ? "animate-pulse bg-rose-600" : "bg-accent"}`}
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

function evaluate(activity: Activity, value: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  if (activity.type === "fill_gaps" || activity.type === "read_complete") return norm(value) === norm(activity.answer ?? "");
  if (activity.type === "read_select" || activity.type === "listen_select") return Number(value) === activity.correctIndex;
  if (activity.type === "record") return value === "recorded" || !!value;
  if (activity.type === "drag_drop" || activity.type === "match") {
    try {
      const map = JSON.parse(value || "{}") as Record<string, string>;
      return (activity.items ?? []).every((it) => norm(map[it.text] ?? "") === norm(it.key));
    } catch { return false; }
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/* Level completion modal (confetti + certificate download)                    */
/* -------------------------------------------------------------------------- */
function LevelCompletionModal({ level, studentName, onClose }: { level: CourseLevel; studentName: string; onClose: () => void }) {
  const downloadCertificate = () => {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#01304a"/>
      <stop offset="100%" stop-color="#024366"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="680" fill="none" stroke="#f38934" stroke-width="4"/>
  <text x="600" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="#ffffff" letter-spacing="6">CERTIFICATE OF COMPLETION</text>
  <text x="600" y="330" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#f8fafc">This certifies that</text>
  <text x="600" y="410" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#ffffff" font-weight="bold">${studentName}</text>
  <text x="600" y="480" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#f8fafc">has successfully completed the level</text>
  <text x="600" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#f38934">${level.name}</text>
  <text x="600" y="680" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#cbd5e1">${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</text>
</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-${level.name.replace(/\s+/g, "-").toLowerCase()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <Confetti />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <div className="bg-gradient-to-br from-[#01304a] to-[#024366] p-6 text-center text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <PartyPopper className="h-8 w-8" />
          </div>
          <div className="mt-4 text-lg font-semibold">Congratulations!</div>
          <div className="mt-1 text-sm text-white/80">You completed <span className="font-semibold text-white">{level.name}</span>.</div>
        </div>
        <div className="space-y-4 p-6 text-center">
          <p className="text-sm text-muted-foreground">Every unit and Milestone Check in this level is now behind you. Download your certificate as a keepsake and keep going.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={downloadCertificate} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary">
              <Download className="h-4 w-4" /> Download Certificate
            </button>
            <button onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-[#d9731f]">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* dev-only: ensure imports pretend-used, avoids unused-var churn for TS */
export const __unused__ = { loadActivityScores };
