// ============================================================================
// Teacher KPI monthly history — single source of truth for the "6-month bonus
// streak" logic. There is NO real per-month persistence of the composite score
// yet, so past months are generated with deterministic mock values seeded by
// teacher.id + month key (stable across renders). The CURRENT (in-progress)
// month always uses the real composite value passed in by the caller.
// ============================================================================
import { type User } from "./mock-data";
import { getBonusThreshold } from "./teacher-kpis-threshold";

// ----- Month-key helpers ----------------------------------------------------
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function addMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ----- Deterministic pseudo-random helpers ----------------------------------
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mock composite for a past month — stable per teacher+month. Range 65–99.
export function mockCompositeFor(teacherId: string, monthKey: string): number {
  const rng = mulberry32(hashSeed(`${teacherId}:composite:${monthKey}`));
  return Math.round(65 + rng() * 34);
}

// Composite for any month: real when it's the current month, mock otherwise.
export function monthlyComposite(
  teacher: User,
  monthKey: string,
  currentMonthComposite: number,
): number {
  const nowKey = monthKeyOf(new Date());
  if (monthKey === nowKey) return currentMonthComposite;
  return mockCompositeFor(teacher.id, monthKey);
}

// ----- Bonus streak status --------------------------------------------------
// Business rules (see PROMPT):
//   - Bonus eligibility requires 6 consecutive calendar months (including the
//     current in-progress month) with composite ≥ threshold.
//   - A teacher's tracking window starts on the FIRST FULL calendar month
//     AFTER their hire month (the hire month itself does not count).
//   - Before that first tracked month, the teacher is "not-tracking" and no
//     streak / bonus is shown.
export const BONUS_STREAK_REQUIRED = 6;

export type BonusStatus =
  | { kind: "not-tracking"; trackingStartLabel: string; trackingStartKey: string }
  | { kind: "streak"; streak: number; needed: number; threshold: number }
  | { kind: "eligible"; streak: number; threshold: number };

export function bonusStatus(
  teacher: User,
  currentMonthComposite: number,
  threshold = getBonusThreshold(),
): BonusStatus {
  const nowKey = monthKeyOf(new Date());
  const hire = teacher.hire_date ? new Date(teacher.hire_date) : null;
  // With no hire_date on record we behave as if tracking started long ago,
  // so the mock history alone drives the streak — matches the pre-change flow.
  const hireKey = hire && !isNaN(hire.getTime()) ? monthKeyOf(hire) : null;
  const trackingStartKey = hireKey ? addMonthKey(hireKey, 1) : addMonthKey(nowKey, -BONUS_STREAK_REQUIRED);

  if (trackingStartKey > nowKey) {
    return { kind: "not-tracking", trackingStartLabel: monthLabel(trackingStartKey), trackingStartKey };
  }

  // Collect the up-to-6 month window ending at the current month, clipped to
  // trackingStartKey so freshly-tracked teachers can only accumulate real
  // eligible months.
  const window: string[] = [];
  for (let i = BONUS_STREAK_REQUIRED - 1; i >= 0; i--) {
    const k = addMonthKey(nowKey, -i);
    if (k >= trackingStartKey) window.push(k);
  }

  // Streak: consecutive months meeting the threshold, counted backwards from
  // the current month. Breaks the moment one month falls below.
  let streak = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    const key = window[i];
    const composite = key === nowKey ? currentMonthComposite : mockCompositeFor(teacher.id, key);
    if (composite >= threshold) streak++;
    else break;
  }

  if (window.length === BONUS_STREAK_REQUIRED && streak === BONUS_STREAK_REQUIRED) {
    return { kind: "eligible", streak, threshold };
  }
  return { kind: "streak", streak: Math.min(streak, BONUS_STREAK_REQUIRED), needed: BONUS_STREAK_REQUIRED, threshold };
}
