// Challenge Badges catalog — admin-editable list of the badges shown in
// Student > Challenges. Follows the same load/persist/subscribe pattern as
// challenges-store.ts. Rules are declarative (metric + optional threshold) so
// admins can edit them without shipping code.
//
// Scope: this store owns ONLY the 8 core Challenge badges. It does NOT
// include the "Lightning Bolt" badge (Verbo Flash-only, rendered separately
// in student.challenges.tsx) nor the dynamic Season badges (owned by
// flash-challenges-store.ts).

export type BadgeIconId =
  | "trophy"
  | "star"
  | "flame"
  | "target"
  | "award"
  | "medal"
  | "crown"
  | "zap"
  | "sparkles";

export const BADGE_ICON_OPTIONS: BadgeIconId[] = [
  "trophy",
  "star",
  "flame",
  "target",
  "award",
  "medal",
  "crown",
  "zap",
  "sparkles",
];

export type BadgeMetric =
  | "completedCount"
  | "longestStreak"
  | "distinctCategories"
  | "hasCompletedPremium";

export const BADGE_METRIC_META: Record<
  BadgeMetric,
  { label: string; numeric: boolean; hint: string }
> = {
  completedCount: {
    label: "Total challenges completed",
    numeric: true,
    hint: "Number of challenges the student has completed in total.",
  },
  longestStreak: {
    label: "Longest streak",
    numeric: true,
    hint: "Longest run of challenges completed in a row.",
  },
  distinctCategories: {
    label: "Distinct categories completed",
    numeric: true,
    hint: "Number of different challenge categories the student has completed.",
  },
  hasCompletedPremium: {
    label: "Completed a Premium challenge",
    numeric: false,
    hint: "On/off — awarded when the student completes any Premium challenge.",
  },
};

export interface BadgeRule {
  metric: BadgeMetric;
  /** Required for numeric metrics; ignored for boolean metrics. */
  threshold?: number;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: BadgeIconId;
  rule: BadgeRule;
}

export interface BadgeContext {
  completedCount: number;
  longestStreak: number;
  distinctCategories: number;
  hasCompletedPremium: boolean;
}

export function isBadgeEarned(badge: BadgeDef, ctx: BadgeContext): boolean {
  const { metric, threshold } = badge.rule;
  if (metric === "hasCompletedPremium") return ctx.hasCompletedPremium;
  const value = ctx[metric] as number;
  const t = typeof threshold === "number" ? threshold : 1;
  return value >= t;
}

/* ---------------- Seed ---------------- */

const BADGES_SEED: BadgeDef[] = [
  { id: "first",       name: "First Challenge",    description: "You completed your first Challenge.",               icon: "star",      rule: { metric: "completedCount", threshold: 1 } },
  { id: "explorer",    name: "Challenge Explorer", description: "You've completed 5 Challenges.",                    icon: "target",    rule: { metric: "completedCount", threshold: 5 } },
  { id: "master",      name: "Challenge Master",   description: "You've completed 15 Challenges.",                   icon: "trophy",    rule: { metric: "completedCount", threshold: 15 } },
  { id: "roll",        name: "On a Roll",          description: "3 Challenges completed in a row.",                  icon: "flame",     rule: { metric: "longestStreak", threshold: 3 } },
  { id: "streak",      name: "Challenge Streak",   description: "5 Challenges completed in a row.",                  icon: "flame",     rule: { metric: "longestStreak", threshold: 5 } },
  { id: "unstoppable", name: "Unstoppable",        description: "10 Challenges completed in a row.",                 icon: "zap",       rule: { metric: "longestStreak", threshold: 10 } },
  { id: "well",        name: "Well-Rounded",       description: "Completed Challenges from 6 different categories.", icon: "medal",     rule: { metric: "distinctCategories", threshold: 6 } },
  { id: "elite",       name: "Elite Challenger",   description: "Completed your first Premium Challenge.",           icon: "crown",     rule: { metric: "hasCompletedPremium" } },
];

/* ---------------- Persistence ---------------- */

export const BADGES_KEY = "verbo:challenge-badges";
export const BADGES_EVENT = "verbo:challenge-badges-updated";

export function loadBadges(): BadgeDef[] {
  if (typeof window === "undefined") return BADGES_SEED.slice();
  try {
    const raw = localStorage.getItem(BADGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BadgeDef[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* noop */ }
  return BADGES_SEED.slice();
}

export function persistBadges(list: BadgeDef[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(BADGES_EVENT));
  } catch { /* noop */ }
}

export function subscribeBadges(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => { if (e.key === BADGES_KEY) cb(); };
  window.addEventListener(BADGES_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(BADGES_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function newBadgeId(existing: BadgeDef[]): string {
  const taken = new Set(existing.map((b) => b.id));
  let i = existing.length + 1;
  while (taken.has(`badge-${i}`)) i++;
  return `badge-${i}`;
}
