import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Lock,
  Trophy,
  CheckCircle2,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import { Card, Pill, PrimaryButton, GhostButton, SuccessButton } from "@/components/verbo/ui";
import { useAuth } from "@/lib/auth";
import {
  type Challenge,
  type ChallengeProductId,
  type DifficultyId,
  DIFFICULTY_META,
  DIFFICULTY_ORDER,
  CHALLENGES_PER_DIFFICULTY,
  loadChallenges,
  subscribeChallenges,
  challengesFor,
  categoryColor,
} from "@/lib/challenges-store";
import {
  chooseChallenge,
  completeChallenge,
  hasChosenChallenge,
  hasCompletedChallenge,
  subscribeStudents,
} from "@/lib/students-store";
import { USERS } from "@/lib/mock-data";

export const Route = createFileRoute("/student/challenges")({ component: Page });

/* -------------------------------------------------------------------------- */
/* Style tokens — reused from Learning Path so the visual language matches.   */
/* -------------------------------------------------------------------------- */
const PRODUCT_GRADIENTS: Record<string, string> = {
  enterprise: "from-[#01304a] via-[#024366] to-[#0a5e88]",
  go: "from-[#7c2d12] via-[#c2410c] to-[#f97316]",
  international: "from-[#134e4a] via-[#0f766e] to-[#14b8a6]",
  vip: "from-[#4a044e] via-[#7e22ce] to-[#a855f7]",
};

const PREMIUM_ACCESS: readonly string[] = ["Advance", "Elite"];

/* -------------------------------------------------------------------------- */
/* Reusable atoms                                                              */
/* -------------------------------------------------------------------------- */
function DifficultyDots({ difficulty, className = "" }: { difficulty: DifficultyId; className?: string }) {
  const { dots } = DIFFICULTY_META[difficulty];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < dots ? "bg-white/90" : "border border-white/40 bg-transparent"}`}
        />
      ))}
    </span>
  );
}

function CategoryBadge({ name }: { name: string }) {
  if (!name) return <Pill tone="muted">No category</Pill>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryColor(name)}`}>
      {name}
    </span>
  );
}

function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
      <Lock className="h-3 w-3" /> Premium
    </span>
  );
}

function SkillChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges catalog — pure derivation from completed_challenges + longest_streak */
/* -------------------------------------------------------------------------- */
interface BadgeDef {
  id: string;
  name: string;
  description: string;
  earned: (ctx: BadgeContext) => boolean;
}
interface BadgeContext {
  completedCount: number;
  longestStreak: number;
  distinctCategories: number;
  hasCompletedPremium: boolean;
}

const BADGES: BadgeDef[] = [
  { id: "first",       name: "First Challenge",     description: "You completed your first Challenge.",             earned: (c) => c.completedCount >= 1 },
  { id: "explorer",    name: "Challenge Explorer",  description: "You've completed 5 Challenges.",                  earned: (c) => c.completedCount >= 5 },
  { id: "master",      name: "Challenge Master",    description: "You've completed 15 Challenges.",                 earned: (c) => c.completedCount >= 15 },
  { id: "roll",        name: "On a Roll",           description: "3 Challenges completed in a row.",                earned: (c) => c.longestStreak >= 3 },
  { id: "streak",      name: "Challenge Streak",    description: "5 Challenges completed in a row.",                earned: (c) => c.longestStreak >= 5 },
  { id: "unstoppable", name: "Unstoppable",         description: "10 Challenges completed in a row.",               earned: (c) => c.longestStreak >= 10 },
  { id: "well",        name: "Well-Rounded",        description: "Completed Challenges from 6 different categories.", earned: (c) => c.distinctCategories >= 6 },
  { id: "elite",       name: "Elite Challenger",    description: "Completed your first Premium Challenge.",         earned: (c) => c.hasCompletedPremium },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */
function Page() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>(loadChallenges);
  const [tick, setTick] = useState(0); // re-render on student profile mutations
  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [category, setCategory] = useState<string | "all">("all");
  const [open, setOpen] = useState<Challenge | null>(null);

  useEffect(() => {
    setChallenges(loadChallenges());
    const un1 = subscribeChallenges(() => setChallenges(loadChallenges()));
    const un2 = subscribeStudents(() => setTick((t) => t + 1));
    return () => { un1(); un2(); };
  }, []);

  if (!user) return null;
  const student = USERS.find((u) => u.id === user.id) ?? user;
  const productId = (student.product ?? "go") as ChallengeProductId;
  const gradient = PRODUCT_GRADIENTS[productId] ?? PRODUCT_GRADIENTS.enterprise;
  const hasPremiumAccess = PREMIUM_ACCESS.includes(student.access_plan ?? "");

  // All challenges available to this student's product (all difficulties).
  const productChallenges = useMemo(
    () => challenges.filter((c) => c.product === productId),
    [challenges, productId],
  );

  const countByDifficulty = (d: DifficultyId) =>
    productChallenges.filter((c) => c.difficulty === d).length;

  // Badge context — derived live, never persisted.
  const badgeCtx: BadgeContext = useMemo(() => {
    void tick;
    const done = student.completed_challenges ?? [];
    const map = new Map(challenges.map((c) => [c.id, c]));
    const cats = new Set<string>();
    let premiumDone = false;
    for (const entry of done) {
      const ch = map.get(entry.challenge_id);
      if (!ch) continue;
      if (ch.category) cats.add(ch.category);
      if (ch.premium) premiumDone = true;
    }
    return {
      completedCount: done.length,
      longestStreak: student.longest_streak ?? 0,
      distinctCategories: cats.size,
      hasCompletedPremium: premiumDone,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenges, student.completed_challenges, student.longest_streak, tick]);

  /* ---------------- Screen 2: challenge list ---------------- */
  if (difficulty) {
    const list = challengesFor(challenges, productId, difficulty);
    const availableCategories = Array.from(
      new Set(list.map((c) => c.category).filter((c): c is string => !!c)),
    );
    const filtered = category === "all" ? list : list.filter((c) => c.category === category);

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <GhostButton onClick={() => { setDifficulty(null); setCategory("all"); }}>
            <ArrowLeft className="h-3.5 w-3.5" /> All difficulties
          </GhostButton>
          <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-soft`}>
            <div className="flex items-center gap-3">
              <DifficultyDots difficulty={difficulty} />
              <span className="text-xs uppercase tracking-[0.18em] text-white/70">
                {DIFFICULTY_META[difficulty].label}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {DIFFICULTY_META[difficulty].label} Challenges
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {list.length} challenge{list.length === 1 ? "" : "s"} available for your product.
            </p>
          </div>
        </div>

        {availableCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategory("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${category === "all" ? "border-[#f38934] bg-[#f38934]/10 text-[#f38934]" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
            >
              All categories
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${categoryColor(cat)} ${category === cat ? "ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <Card>
            <div className="py-10 text-center text-sm text-muted-foreground">
              No challenges yet in this difficulty.
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const locked = !!c.premium && !hasPremiumAccess;
              const chosen = hasChosenChallenge(student.id, c.id);
              const done = hasCompletedChallenge(student.id, c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpen(c)}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CategoryBadge name={c.category} />
                      {locked && <PremiumBadge />}
                    </div>
                    {done ? (
                      <Pill tone="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Pill>
                    ) : chosen ? (
                      <Pill tone="warning">In progress</Pill>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{c.description || "Tap to see the details."}</p>
                  </div>
                  {c.skill_tags && c.skill_tags.length > 0 && (
                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                      {c.skill_tags.map((s) => <SkillChip key={s} label={s} />)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {open && (
          <ChallengeDetail
            challenge={open}
            onClose={() => setOpen(null)}
            hasPremiumAccess={hasPremiumAccess}
            chosen={hasChosenChallenge(student.id, open.id)}
            completed={hasCompletedChallenge(student.id, open.id)}
            onChoose={() => {
              if (chooseChallenge(student.id, open.id)) {
                // Notification is derived automatically via buildNotifications().
              }
            }}
            onComplete={() => {
              completeChallenge(student.id, open.id);
            }}
          />
        )}
      </div>
    );
  }

  /* ---------------- Screen 1: difficulty picker + badges ---------------- */
  return (
    <div className="space-y-8">
      <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-soft`}>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/70">
          <Sparkles className="h-3.5 w-3.5" /> Weekly Challenges
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pick a difficulty to explore</h1>
        <p className="mt-1 text-sm text-white/80">
          Complementary practice — completing challenges keeps your streak alive and unlocks badges.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
            🔥 Current streak: {student.current_streak ?? 0}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
            🏆 Longest: {student.longest_streak ?? 0}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 font-medium">
            ✅ Completed: {student.completed_challenges?.length ?? 0}
          </span>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {DIFFICULTY_ORDER.map((d) => {
          const count = countByDifficulty(d);
          const target = CHALLENGES_PER_DIFFICULTY[d];
          const empty = count === 0;
          return (
            <button
              key={d}
              disabled={empty}
              onClick={() => { setDifficulty(d); setCategory("all"); }}
              className={`group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-soft transition-all ${empty ? "cursor-not-allowed opacity-50" : "hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"}`}
            >
              <span className={`inline-flex items-center gap-1`} aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full ${i < DIFFICULTY_META[d].dots ? "bg-[#f38934]" : "border border-muted-foreground/40 bg-transparent"}`}
                  />
                ))}
              </span>
              <div className="text-lg font-semibold tracking-tight text-foreground">
                {DIFFICULTY_META[d].label}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <Pill tone={count > 0 ? "success" : "muted"}>
                  {count}/{target} challenges
                </Pill>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* -------------------- Badges section -------------------- */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Badges</h2>
            <p className="mt-1 text-xs text-muted-foreground">Earn badges automatically by completing challenges and building streaks.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BADGES.map((b) => {
            const earned = b.earned(badgeCtx);
            return (
              <div
                key={b.id}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center shadow-soft transition-opacity ${earned ? "border-amber-400/60 bg-amber-500/5" : "border-border bg-card opacity-60"}`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-full ${earned ? "bg-amber-500/15 text-amber-600 ring-2 ring-amber-400/40" : "bg-secondary text-muted-foreground"}`}>
                  {earned ? <Trophy className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                </span>
                <div className="text-sm font-semibold text-foreground">{b.name}</div>
                <p className="text-[11px] text-muted-foreground">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail modal                                                                */
/* -------------------------------------------------------------------------- */
function ChallengeDetail({
  challenge,
  onClose,
  hasPremiumAccess,
  chosen,
  completed,
  onChoose,
  onComplete,
}: {
  challenge: Challenge;
  onClose: () => void;
  hasPremiumAccess: boolean;
  chosen: boolean;
  completed: boolean;
  onChoose: () => void;
  onComplete: () => void;
}) {
  const locked = !!challenge.premium && !hasPremiumAccess;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#01304a] to-[#024366] p-6 text-white">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge name={challenge.category} />
              {challenge.premium && <PremiumBadge />}
            </div>
            <div className="mt-2 text-base font-semibold tracking-tight">{challenge.title}</div>
            {challenge.skill_tags && challenge.skill_tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {challenge.skill_tags.map((s) => <SkillChip key={s} label={s} />)}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative p-6">
          <div className={locked ? "pointer-events-none select-none blur-sm" : ""}>
            <p className="text-sm leading-relaxed text-foreground">
              {challenge.description || "No description available."}
            </p>
            {challenge.video_url && (
              <a
                href={challenge.video_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
              >
                <Play className="h-3.5 w-3.5" /> Watch reference video
              </a>
            )}
          </div>

          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-b-2xl bg-white/70 p-6 text-center backdrop-blur-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 ring-2 ring-amber-400/40">
                <Lock className="h-6 w-6" />
              </span>
              <p className="max-w-sm text-sm font-medium text-foreground">
                This challenge is for Advance tier+. Upgrade your access level to access them.
              </p>
              <Link
                to="/student/access-levels"
                className="text-xs font-semibold text-[#f38934] underline underline-offset-4 hover:opacity-80"
              >
                Learn more
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">
          <GhostButton onClick={onClose}>Close</GhostButton>
          {locked ? null : completed ? (
            <Pill tone="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Pill>
          ) : chosen ? (
            <SuccessButton onClick={onComplete}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Completed
            </SuccessButton>
          ) : (
            <PrimaryButton onClick={onChoose}>Let's do it!</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}
