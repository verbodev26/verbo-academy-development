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
  Share2,
  Link2,
  Upload,
  Gift,
  Zap,
} from "lucide-react";
import { Card, Pill, PrimaryButton, GhostButton, SuccessButton } from "@/components/verbo/ui";
import { Confetti } from "@/components/verbo/Confetti";
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
  completeCooldownRemaining,
  hasChosenChallenge,
  hasCompletedChallenge,
  getSharedResult,
  shareChallengeResult,
  subscribeStudents,
  openMysteryBox,
  mysteryBoxCooldownRemaining,
} from "@/lib/students-store";
import {
  type FlashChallenge,
  type FlashProductId,
  type FlashSeason,
  type LightningState,
  loadFlashChallenges,
  loadFlashConfig,
  subscribeFlashChallenges,
  subscribeFlashConfig,
  flashChallengesFor,
  loadLightning,
  subscribeLightning,
  acceptLightning,
  isLightningVisibleForStudents,
  loadSeasons,
  subscribeSeasons,
  fontFamilyFor,
  ensureGoogleFont,
} from "@/lib/flash-challenges-store";
import {
  completeLightningChallenge,
  openSeason,
  seasonCooldownRemaining,
  completeSeasonChallenge,
} from "@/lib/students-store";
import { USERS } from "@/lib/mock-data";
import { groupsByStudentId } from "@/lib/groups-store";

export const Route = createFileRoute("/student/challenges")({ component: Page });

const COOLDOWN_MSG =
  "You've already completed a Challenge in the last 24 hours — come back soon for your next one!";
const MYSTERY_COOLDOWN_MSG =
  "You've already opened today's Mystery Box — come back tomorrow!";

/**
 * Access-level gate shown when a challenge is locked behind Advance tier.
 * For Group members we swap "Upgrade your access level" (which reads as a
 * payment call-to-action) for a neutral note that upgrades happen at the
 * group level via the admin — no billing surface is exposed to the student.
 */
function AccessGateNotice({ accent }: { accent?: string }) {
  const { user } = useAuth();
  const isGroup = !!(user && groupsByStudentId().has(user.id));
  return (
    <>
      <p className="max-w-sm text-sm font-medium text-foreground">
        {isGroup
          ? "This challenge is for Advance tier+. It's not included in your group's plan — contact your admin to expand access."
          : "This challenge is for Advance tier+. Upgrade your access level to access them."}
      </p>
      {!isGroup && (
        <Link
          to="/student/access-levels"
          className="text-xs font-semibold underline underline-offset-4 hover:opacity-80"
          style={accent ? { color: accent } : undefined}
        >
          Learn more
        </Link>
      )}
    </>
  );
}



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
/* Badges catalog — declarative rules stored in badges-store.ts                */
/* -------------------------------------------------------------------------- */
import {
  type BadgeDef,
  type BadgeContext,
  type BadgeIconId,
  loadBadges,
  subscribeBadges,
  isBadgeEarned,
} from "@/lib/badges-store";
import { Star, Flame, Target, Award, Medal, Crown } from "lucide-react";

const BADGE_ICON_MAP: Record<BadgeIconId, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  target: Target,
  award: Award,
  medal: Medal,
  crown: Crown,
  zap: Zap,
  sparkles: Sparkles,
};


/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */
function Page() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>(loadChallenges);
  const [flashList, setFlashList] = useState<FlashChallenge[]>(loadFlashChallenges);
  const [flashConfig, setFlashConfig] = useState(loadFlashConfig);
  const [tick, setTick] = useState(0); // re-render on student profile mutations
  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [category, setCategory] = useState<string | "all">("all");
  const [open, setOpen] = useState<Challenge | null>(null);
  const [shareFor, setShareFor] = useState<Challenge | null>(null);
  const [mystery, setMystery] = useState<{ opening: boolean; reveal: FlashChallenge | null; blocked: boolean }>({ opening: false, reveal: null, blocked: false });
  const [lightning, setLightning] = useState<LightningState>(loadLightning);
  const [lightningOpen, setLightningOpen] = useState<FlashChallenge | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [seasons, setSeasons] = useState<FlashSeason[]>(loadSeasons);
  const [seasonState, setSeasonState] = useState<
    { season: FlashSeason; opening: boolean; reveal: FlashChallenge | null; blocked: boolean } | null
  >(null);
  const [badges, setBadges] = useState<BadgeDef[]>(loadBadges);

  useEffect(() => {
    setChallenges(loadChallenges());
    setFlashList(loadFlashChallenges());
    setFlashConfig(loadFlashConfig());
    setLightning(loadLightning());
    setSeasons(loadSeasons());
    setBadges(loadBadges());
    const un1 = subscribeChallenges(() => setChallenges(loadChallenges()));
    const un2 = subscribeStudents(() => setTick((t) => t + 1));
    const un3 = subscribeFlashChallenges(() => setFlashList(loadFlashChallenges()));
    const un4 = subscribeFlashConfig(() => setFlashConfig(loadFlashConfig()));
    const un5 = subscribeLightning(() => setLightning(loadLightning()));
    const un6 = subscribeSeasons(() => setSeasons(loadSeasons()));
    const un7 = subscribeBadges(() => setBadges(loadBadges()));
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => { un1(); un2(); un3(); un4(); un5(); un6(); un7(); clearInterval(timer); };
  }, []);


  // Preload Google Fonts for active seasons so their skin renders.
  useEffect(() => {
    seasons.filter((s) => s.active).forEach((s) => ensureGoogleFont(fontFamilyFor(s)));
  }, [seasons]);

  if (!user) return null;
  const student = USERS.find((u) => u.id === user.id) ?? user;
  const productId = (student.product ?? "go") as ChallengeProductId;
  const gradient = PRODUCT_GRADIENTS[productId] ?? PRODUCT_GRADIENTS.enterprise;
  const hasPremiumAccess = PREMIUM_ACCESS.includes(student.access_plan ?? "");

  const productChallenges = useMemo(
    () => challenges.filter((c) => c.product === productId),
    [challenges, productId],
  );

  const countByDifficulty = (d: DifficultyId) =>
    productChallenges.filter((c) => c.difficulty === d).length;

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
              const shared = !!getSharedResult(student.id, c.id);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"
                >
                  <button
                    type="button"
                    onClick={() => setOpen(c)}
                    className="flex flex-1 flex-col gap-3 text-left"
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
                  {done && (
                    <button
                      type="button"
                      onClick={() => setShareFor(c)}
                      className="inline-flex items-center gap-1.5 self-start text-[11px] font-medium text-accent hover:underline"
                    >
                      <Share2 className="h-3 w-3" />
                      {shared ? "Edit shared result" : "Share result"}
                    </button>
                  )}
                </div>
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
            cooldownRemaining={completeCooldownRemaining(student.id)}
            onChoose={() => { chooseChallenge(student.id, open.id); }}
            onComplete={() => {
              const ok = completeChallenge(student.id, open.id);
              if (ok) {
                // Immediately prompt for optional share step.
                const justCompleted = open;
                setOpen(null);
                setShareFor(justCompleted);
              }
            }}
          />
        )}

        {shareFor && (
          <ShareResultModal
            challenge={shareFor}
            initialLink={getSharedResult(student.id, shareFor.id)}
            onClose={() => setShareFor(null)}
            onSave={(link) => {
              shareChallengeResult(student.id, shareFor.id, link);
              setShareFor(null);
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

      {/* ---------------- Verbo Flash ---------------- */}
      {(["enterprise", "go", "international"] as const).includes(productId as FlashProductId) && (
        <VerboFlashSection
          boxArtUrl={flashConfig.box_art_url}
          available={flashChallengesFor(flashList, "mystery_box", productId as FlashProductId).length > 0}
          activeSeasons={seasons.filter((s) => s.active)}
          onOpen={() => {
            const pool = flashChallengesFor(flashList, "mystery_box", productId as FlashProductId);
            if (pool.length === 0) return;
            if (!openMysteryBox(student.id)) {
              setMystery({ opening: false, reveal: null, blocked: true });
              return;
            }
            setMystery({ opening: true, reveal: null, blocked: false });
            // Suspenseful reveal delay — the box animates then the challenge is revealed.
            setTimeout(() => {
              const pick = pool[Math.floor(Math.random() * pool.length)];
              setMystery({ opening: false, reveal: pick, blocked: false });
            }, 900);
          }}
          onOpenSeason={(season) => {
            const pool = flashChallengesFor(flashList, "mystery_box", productId as FlashProductId);
            if (pool.length === 0) return;
            if (!openSeason(student.id, season.id)) {
              setSeasonState({ season, opening: false, reveal: null, blocked: true });
              return;
            }
            setSeasonState({ season, opening: true, reveal: null, blocked: false });
            setTimeout(() => {
              const pick = pool[Math.floor(Math.random() * pool.length)];
              setSeasonState({ season, opening: false, reveal: pick, blocked: false });
            }, 900);
          }}
        />
      )}

      {/* ---------------- Lightning card ---------------- */}
      {(["enterprise", "go", "international"] as const).includes(productId as FlashProductId)
        && isLightningVisibleForStudents(lightning)
        && lightning.product === productId && (() => {
          const ch = flashList.find((c) => c.id === lightning.challenge_id);
          if (!ch) return null;
          const remaining = lightning.expires_at ? +new Date(lightning.expires_at) - nowTick : 0;
          const isLive = lightning.status === "live" && remaining > 0;
          const accepted = lightning.accepted_student_ids.includes(student.id);
          const completed = hasCompletedChallenge(student.id, ch.id);
          return (
            <LightningCard
              challenge={ch}
              isLive={isLive}
              remainingMs={remaining}
              acceptedCount={lightning.accepted_student_ids.length}
              accepted={accepted}
              completed={completed}
              onOpen={() => {
                if (isLive && !accepted) acceptLightning(student.id);
                setLightningOpen(ch);
              }}
            />
          );
        })()}


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
          {/* Lightning Bolt — exclusive Verbo Flash badge, separate from the 8 core badges. */}
          {(() => {
            const earned = (student.lightning_completions ?? 0) >= 1;
            return (
              <div
                className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center shadow-soft transition-opacity ${earned ? "border-yellow-400/70 bg-yellow-400/5" : "border-border bg-card opacity-60"}`}
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-full ${earned ? "bg-yellow-400/20 text-yellow-500 ring-2 ring-yellow-400/50" : "bg-secondary text-muted-foreground"}`}>
                  {earned ? <Zap className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                </span>
                <div className="text-sm font-semibold text-foreground">⚡ Lightning Bolt</div>
                <p className="text-[11px] text-muted-foreground">Completed a Lightning within its live window.</p>
              </div>
            );
          })()}
          {/* Dynamic Season badges — grows as admin creates Seasons. */}
          {seasons.map((s) => {
            const earned = (student.season_completions?.[s.id] ?? 0) >= 1;
            const accent = s.accent_color || "#7e22ce";
            return (
              <div
                key={s.id}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center shadow-soft transition-opacity ${earned ? "bg-card" : "border-border bg-card opacity-60"}`}
                style={earned ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}22` } : undefined}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={
                    earned
                      ? { background: `${accent}22`, color: accent, boxShadow: `0 0 0 2px ${accent}55` }
                      : undefined
                  }
                >
                  {earned ? <Sparkles className="h-6 w-6" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                </span>
                <div
                  className="text-sm font-semibold text-foreground"
                  style={{ fontFamily: `"${fontFamilyFor(s)}", system-ui, sans-serif` }}
                >
                  {s.badge_name}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Completed a challenge during the {s.display_name} Season.
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {lightningOpen && (
        <LightningRevealModal
          challenge={lightningOpen}
          expiresAt={lightning.expires_at}
          nowTick={nowTick}
          isLive={lightning.status === "live"}
          acceptedCount={lightning.accepted_student_ids.length}
          hasPremiumAccess={hasPremiumAccess}
          completed={hasCompletedChallenge(student.id, lightningOpen.id)}
          onComplete={() => {
            const target = lightningOpen;
            if (!target) return;
            const ok = completeLightningChallenge(student.id, target.id);
            if (ok) {
              setLightningOpen(null);
              setShareFor(target as unknown as Challenge);
            }
          }}
          onClose={() => setLightningOpen(null)}
        />
      )}


      {mystery.blocked && (
        <MysteryCooldownModal onClose={() => setMystery({ opening: false, reveal: null, blocked: false })} />
      )}
      {(mystery.opening || mystery.reveal) && (
        <MysteryRevealModal
          opening={mystery.opening}
          challenge={mystery.reveal}
          hasPremiumAccess={hasPremiumAccess}
          chosen={mystery.reveal ? hasChosenChallenge(student.id, mystery.reveal.id) : false}
          completed={mystery.reveal ? hasCompletedChallenge(student.id, mystery.reveal.id) : false}
          cooldownRemaining={completeCooldownRemaining(student.id)}
          onChoose={() => { if (mystery.reveal) chooseChallenge(student.id, mystery.reveal.id); }}
          onComplete={() => {
            if (!mystery.reveal) return;
            const ok = completeChallenge(student.id, mystery.reveal.id);
            if (ok) {
              const c = mystery.reveal;
              setMystery({ opening: false, reveal: null, blocked: false });
              // Reuse the standard share prompt for consistency.
              setShareFor(c as unknown as Challenge);
            }
          }}
          onClose={() => setMystery({ opening: false, reveal: null, blocked: false })}
        />
      )}

      {seasonState?.blocked && (
        <SeasonCooldownModal
          season={seasonState.season}
          onClose={() => setSeasonState(null)}
        />
      )}
      {seasonState && (seasonState.opening || seasonState.reveal) && (
        <SeasonRevealModal
          season={seasonState.season}
          opening={seasonState.opening}
          challenge={seasonState.reveal}
          hasPremiumAccess={hasPremiumAccess}
          chosen={seasonState.reveal ? hasChosenChallenge(student.id, seasonState.reveal.id) : false}
          completed={seasonState.reveal ? hasCompletedChallenge(student.id, seasonState.reveal.id) : false}
          onChoose={() => { if (seasonState.reveal) chooseChallenge(student.id, seasonState.reveal.id); }}
          onComplete={() => {
            if (!seasonState.reveal) return;
            const ok = completeSeasonChallenge(student.id, seasonState.reveal.id, seasonState.season.id);
            if (ok) {
              const c = seasonState.reveal;
              setSeasonState(null);
              setShareFor(c as unknown as Challenge);
            }
          }}
          onClose={() => setSeasonState(null)}
        />
      )}


      {shareFor && (
        <ShareResultModal
          challenge={shareFor}
          initialLink={getSharedResult(student.id, shareFor.id)}
          onClose={() => setShareFor(null)}
          onSave={(link) => {
            shareChallengeResult(student.id, shareFor.id, link);
            setShareFor(null);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Verbo Flash — Mystery Box card + reveal modal                              */
/* -------------------------------------------------------------------------- */
function VerboFlashSection({
  boxArtUrl,
  available,
  activeSeasons,
  onOpen,
  onOpenSeason,
}: {
  boxArtUrl?: string;
  available: boolean;
  activeSeasons: FlashSeason[];
  onOpen: () => void;
  onOpenSeason: (season: FlashSeason) => void;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-[#7e22ce]" /> Verbo Flash
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">Mystery Box{activeSeasons.length > 0 ? " & Seasons" : ""}</h2>
          <p className="mt-1 text-xs text-muted-foreground">A surprise challenge waits inside. One per day, per box.</p>
        </div>
      </div>
      <style>{`
        @keyframes verbo-box-wiggle {
          0%, 92%, 100% { transform: rotate(0deg); }
          94% { transform: rotate(-6deg); }
          96% { transform: rotate(6deg); }
          98% { transform: rotate(-3deg); }
        }
        @media (prefers-reduced-motion: reduce) { .verbo-box-wiggle { animation: none !important; } }
      `}</style>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          disabled={!available}
          onClick={onOpen}
          className={`group relative aspect-square overflow-hidden rounded-2xl border p-6 text-center shadow-soft transition-all ${
            available
              ? "border-[#7e22ce]/30 bg-gradient-to-br from-[#4a044e] via-[#7e22ce] to-[#f59e0b] text-white hover:-translate-y-0.5 hover:shadow-elevated"
              : "cursor-not-allowed border-border bg-secondary/60 text-muted-foreground opacity-70"
          }`}
        >
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div
              className="verbo-box-wiggle flex h-32 w-32 items-center justify-center rounded-2xl bg-white/15 shadow-inner"
              style={{ animation: "verbo-box-wiggle 3.4s ease-in-out infinite", transformOrigin: "50% 90%" }}
            >
              {boxArtUrl ? (
                <img src={boxArtUrl} alt="Mystery Box" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <Gift className="h-16 w-16 drop-shadow-md" />
              )}
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">Mystery Box</div>
              <div className="mt-1 text-xs opacity-90">{available ? "Tap to open" : "Coming soon"}</div>
            </div>
          </div>
        </button>

        {activeSeasons.map((s) => {
          const accent = s.accent_color || "#7e22ce";
          const family = fontFamilyFor(s);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSeason(s)}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-white/20 p-6 text-center text-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              style={{
                background: s.theme_image_url
                  ? `center / cover no-repeat url(${s.theme_image_url})`
                  : `linear-gradient(135deg, ${accent}, #111827)`,
              }}
            >
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative flex h-full flex-col items-center justify-center gap-4">
                <div
                  className="verbo-box-wiggle flex h-32 w-32 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur-sm"
                  style={{ animation: "verbo-box-wiggle 3.4s ease-in-out infinite", transformOrigin: "50% 90%" }}
                >
                  {s.theme_image_url ? (
                    <img src={s.theme_image_url} alt={s.display_name} className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <Sparkles className="h-16 w-16 drop-shadow-md" />
                  )}
                </div>
                <div>
                  <div
                    className="text-lg font-semibold tracking-tight drop-shadow"
                    style={{ fontFamily: `"${family}", system-ui, sans-serif` }}
                  >
                    {s.display_name}
                  </div>
                  <div className="mt-1 text-xs opacity-90">Tap to open</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MysteryCooldownModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card p-6 text-center shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a044e] to-[#7e22ce] text-white">
          <Gift className="h-7 w-7" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">{MYSTERY_COOLDOWN_MSG}</p>
        <div className="mt-4 flex justify-center">
          <GhostButton onClick={onClose}>Got it</GhostButton>
        </div>
      </div>
    </div>
  );
}

function MysteryRevealModal({
  opening,
  challenge,
  hasPremiumAccess,
  chosen,
  completed,
  cooldownRemaining,
  onChoose,
  onComplete,
  onClose,
}: {
  opening: boolean;
  challenge: FlashChallenge | null;
  hasPremiumAccess: boolean;
  chosen: boolean;
  completed: boolean;
  cooldownRemaining: number | null;
  onChoose: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const locked = !!challenge?.premium && !hasPremiumAccess;
  const onCooldown = !completed && chosen && cooldownRemaining !== null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      {challenge && !opening && <Confetti />}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <style>{`
          @keyframes verbo-box-shake {
            0%, 100% { transform: translateX(0) rotate(0); }
            20% { transform: translateX(-6px) rotate(-8deg); }
            40% { transform: translateX(6px) rotate(8deg); }
            60% { transform: translateX(-4px) rotate(-6deg); }
            80% { transform: translateX(4px) rotate(6deg); }
          }
          @media (prefers-reduced-motion: reduce) { .verbo-box-shake { animation: none !important; } }
        `}</style>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#4a044e] via-[#7e22ce] to-[#f59e0b] p-6 text-white">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/80">
              <Zap className="h-3.5 w-3.5" /> Verbo Flash · Mystery Box
            </div>
            {challenge && !opening && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CategoryBadge name={challenge.category} />
                  {challenge.premium && <PremiumBadge />}
                </div>
                <div className="mt-2 text-base font-semibold tracking-tight">{challenge.title}</div>
              </>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {opening || !challenge ? (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div
              className="verbo-box-shake flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4a044e] to-[#7e22ce] text-white shadow-elevated"
              style={{ animation: "verbo-box-shake 0.5s ease-in-out infinite" }}
            >
              <Gift className="h-16 w-16" />
            </div>
            <p className="text-sm text-muted-foreground">Opening your Mystery Box…</p>
          </div>
        ) : (
          <>
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
                {onCooldown && (
                  <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-foreground">
                    {COOLDOWN_MSG}
                  </div>
                )}
              </div>
              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-b-2xl bg-white/70 p-6 text-center backdrop-blur-md">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 ring-2 ring-amber-400/40">
                    <Lock className="h-6 w-6" />
                  </span>
                  <AccessGateNotice accent="#7e22ce" />


                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">
              <GhostButton onClick={onClose}>Close</GhostButton>
              {locked ? null : completed ? (
                <Pill tone="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Pill>
              ) : chosen ? (
                <SuccessButton onClick={onComplete} disabled={onCooldown} title={onCooldown ? COOLDOWN_MSG : undefined}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Completed
                </SuccessButton>
              ) : (
                <PrimaryButton onClick={onChoose}>Let's do it!</PrimaryButton>
              )}
            </div>
          </>
        )}
      </div>
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
  cooldownRemaining,
  onChoose,
  onComplete,
}: {
  challenge: Challenge;
  onClose: () => void;
  hasPremiumAccess: boolean;
  chosen: boolean;
  completed: boolean;
  cooldownRemaining: number | null;
  onChoose: () => void;
  onComplete: () => void;
}) {
  const locked = !!challenge.premium && !hasPremiumAccess;
  const onCooldown = !completed && chosen && cooldownRemaining !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
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
            {onCooldown && (
              <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-foreground">
                {COOLDOWN_MSG}
              </div>
            )}
          </div>

          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-b-2xl bg-white/70 p-6 text-center backdrop-blur-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 ring-2 ring-amber-400/40">
                <Lock className="h-6 w-6" />
              </span>
              <AccessGateNotice accent="#f38934" />

            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">
          <GhostButton onClick={onClose}>Close</GhostButton>
          {locked ? null : completed ? (
            <Pill tone="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Pill>
          ) : chosen ? (
            <SuccessButton onClick={onComplete} disabled={onCooldown} title={onCooldown ? COOLDOWN_MSG : undefined}>
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

/* -------------------------------------------------------------------------- */
/* Share Result modal — optional URL + locked "Upload File" (Coming soon).    */
/* -------------------------------------------------------------------------- */
function ShareResultModal({
  challenge,
  initialLink,
  onClose,
  onSave,
}: {
  challenge: Challenge;
  initialLink: string;
  onClose: () => void;
  onSave: (link: string) => void;
}) {
  const [source, setSource] = useState<"url" | "upload">("url");
  const [link, setLink] = useState(initialLink);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Want to share your result? (optional)
            </div>
            <h3 className="mt-1 text-sm font-semibold text-foreground">{challenge.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSource("url")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${source === "url" ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
            >
              <Link2 className="h-4 w-4" /> Video URL
            </button>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground opacity-70"
            >
              <Lock className="h-4 w-4" /> Upload File
            </button>
          </div>

          {source === "url" ? (
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Paste a link (video, doc, portfolio, etc.)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
              <Upload className="h-4 w-4" /> Coming soon — file uploads (pdf / video / image, max 10MB) will be available soon.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">
          <GhostButton onClick={onClose}>Skip</GhostButton>
          <PrimaryButton onClick={() => onSave(link)} disabled={source !== "url"}>
            Save
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Verbo Flash — Lightning card + reveal modal                                */
/* -------------------------------------------------------------------------- */
function formatHMS(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function LightningCard({
  challenge,
  isLive,
  remainingMs,
  acceptedCount,
  accepted,
  completed,
  onOpen,
}: {
  challenge: FlashChallenge;
  isLive: boolean;
  remainingMs: number;
  acceptedCount: number;
  accepted: boolean;
  completed: boolean;
  onOpen: () => void;
}) {
  const urgent = isLive && remainingMs > 0 && remainingMs < 60 * 60 * 1000;
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-[#facc15]" /> Verbo Flash · Lightning
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">Reto Relámpago</h2>
        </div>
      </div>
      <style>{`
        @keyframes verbo-lightning-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.55), 0 0 30px 4px rgba(14, 165, 233, 0.35); }
          50% { box-shadow: 0 0 0 6px rgba(250, 204, 21, 0.0), 0 0 40px 10px rgba(14, 165, 233, 0.6); }
        }
        @keyframes verbo-lightning-urgent {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.65), 0 0 30px 4px rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.0), 0 0 40px 12px rgba(239, 68, 68, 0.8); }
        }
        @media (prefers-reduced-motion: reduce) {
          .verbo-lightning-live { animation: none !important; }
        }
      `}</style>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLive ? (
          <button
            type="button"
            onClick={onOpen}
            className="verbo-lightning-live group relative overflow-hidden rounded-2xl border border-[#facc15]/50 bg-gradient-to-br from-[#1e3a8a] via-[#0284c7] to-[#facc15] p-6 text-left text-white transition-transform hover:-translate-y-0.5"
            style={{ animation: urgent ? "verbo-lightning-urgent 0.9s ease-in-out infinite" : "verbo-lightning-glow 1.8s ease-in-out infinite" }}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                🔥 Live now
              </span>
              <span className={`rounded-full px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${urgent ? "bg-red-500 text-white" : "bg-white/20"}`}>
                {formatHMS(remainingMs)}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Zap className="h-10 w-10 shrink-0 text-yellow-300 drop-shadow" />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{challenge.title || "Lightning Challenge"}</div>
                <div className="mt-0.5 text-xs opacity-90">⚡ {acceptedCount} student{acceptedCount === 1 ? "" : "s"} accepted this</div>
              </div>
            </div>
            <div className="mt-5">
              {completed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#0f172a]">
                  {accepted ? "Continue the challenge →" : "Accept the Challenge ⚡"}
                </span>
              )}
            </div>
          </button>
        ) : (
          // Expired — dramatic transition for students who didn't complete on time.
          <div className={`relative overflow-hidden rounded-2xl border border-border bg-secondary/60 p-6 text-left ${completed ? "opacity-90" : "opacity-80"}`}>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                ⚡ {completed ? "Completed" : "Expired — you missed this one"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Zap className="h-10 w-10 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-foreground">{challenge.title || "Lightning Challenge"}</div>
                {!completed && (
                  <p className="mt-0.5 text-xs text-muted-foreground">This Lightning has passed. The next one could strike anytime — stay ready.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function LightningRevealModal({
  challenge,
  expiresAt,
  nowTick,
  isLive,
  acceptedCount,
  hasPremiumAccess,
  completed,
  onComplete,
  onClose,
}: {
  challenge: FlashChallenge;
  expiresAt: string | null;
  nowTick: number;
  isLive: boolean;
  acceptedCount: number;
  hasPremiumAccess: boolean;
  completed: boolean;
  onComplete: () => void;
  onClose: () => void;
}) {
  const remaining = expiresAt ? +new Date(expiresAt) - nowTick : 0;
  const locked = !!challenge.premium && !hasPremiumAccess;
  const canComplete = isLive && remaining > 0 && !completed && !locked;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      {completed && <Confetti theme="lightning" />}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#1e3a8a] via-[#0284c7] to-[#facc15] p-6 text-white">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/80">
              <Zap className="h-3.5 w-3.5" /> Verbo Flash · Lightning
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CategoryBadge name={challenge.category} />
              {challenge.premium && <PremiumBadge />}
              {isLive && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums">
                  {formatHMS(remaining)}
                </span>
              )}
            </div>
            <div className="mt-2 text-base font-semibold tracking-tight">{challenge.title}</div>
            <div className="mt-1 text-xs text-white/80">⚡ {acceptedCount} student{acceptedCount === 1 ? "" : "s"} accepted this</div>
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
            {!isLive && !completed && (
              <div className="mt-4 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                This Lightning has passed. The next one could strike anytime — stay ready.
              </div>
            )}
          </div>
          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-b-2xl bg-white/70 p-6 text-center backdrop-blur-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 ring-2 ring-amber-400/40">
                <Lock className="h-6 w-6" />
              </span>
              <AccessGateNotice accent="#0284c7" />

            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">
          <GhostButton onClick={onClose}>Close</GhostButton>
          {completed ? (
            <Pill tone="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed</Pill>
          ) : canComplete ? (
            <SuccessButton onClick={onComplete}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Completed
            </SuccessButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Season — cooldown + reveal modals (skinned per Season)                     */
/* -------------------------------------------------------------------------- */
function SeasonCooldownModal({ season, onClose }: { season: FlashSeason; onClose: () => void }) {
  const accent = season.accent_color || "#7e22ce";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card p-6 text-center shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white"
          style={{ background: `linear-gradient(135deg, ${accent}, #111)` }}
        >
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">
          You've already opened this Season's challenge today — come back tomorrow!
        </p>
        <div className="mt-4 flex justify-center">
          <GhostButton onClick={onClose}>Got it</GhostButton>
        </div>
      </div>
    </div>
  );
}

function SeasonRevealModal({
  season,
  opening,
  challenge,
  hasPremiumAccess,
  chosen,
  completed,
  onChoose,
  onComplete,
  onClose,
}: {
  season: FlashSeason;
  opening: boolean;
  challenge: FlashChallenge | null;
  hasPremiumAccess: boolean;
  chosen: boolean;
  completed: boolean;
  onChoose: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const locked = !!challenge?.premium && !hasPremiumAccess;
  const accent = season.accent_color || "#7e22ce";
  const family = fontFamilyFor(season);
  const headerBg = season.theme_image_url
    ? `center / cover no-repeat url(${season.theme_image_url}), linear-gradient(135deg, ${accent}, #111)`
    : `linear-gradient(135deg, ${accent}, #111827)`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      {challenge && !opening && <Confetti />}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <style>{`
          @keyframes verbo-box-shake {
            0%, 100% { transform: translateX(0) rotate(0); }
            20% { transform: translateX(-6px) rotate(-8deg); }
            40% { transform: translateX(6px) rotate(8deg); }
            60% { transform: translateX(-4px) rotate(-6deg); }
            80% { transform: translateX(4px) rotate(6deg); }
          }
          @media (prefers-reduced-motion: reduce) { .verbo-box-shake { animation: none !important; } }
        `}</style>
        <div className="relative flex items-start justify-between gap-4 p-6 text-white" style={{ background: headerBg }}>
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/90">
              <Sparkles className="h-3.5 w-3.5" /> Verbo Flash · {season.display_name}
            </div>
            {challenge && !opening && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CategoryBadge name={challenge.category} />
                  {challenge.premium && <PremiumBadge />}
                </div>
                <div
                  className="mt-2 text-base font-semibold tracking-tight drop-shadow"
                  style={{ fontFamily: `"${family}", system-ui, sans-serif` }}
                >
                  {challenge.title}
                </div>
              </>
            )}
          </div>
          <button onClick={onClose} className="relative rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {opening || !challenge ? (
          <div className="flex flex-col items-center justify-center gap-4 p-10">
            <div
              className="verbo-box-shake flex h-32 w-32 items-center justify-center rounded-2xl text-white shadow-elevated"
              style={{ animation: "verbo-box-shake 0.5s ease-in-out infinite", background: `linear-gradient(135deg, ${accent}, #111)` }}
            >
              <Sparkles className="h-16 w-16" />
            </div>
            <p className="text-sm text-muted-foreground">Opening your {season.display_name} challenge…</p>
          </div>
        ) : (
          <>
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
                  <AccessGateNotice accent={accent} />

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
          </>
        )}
      </div>
    </div>
  );
}

