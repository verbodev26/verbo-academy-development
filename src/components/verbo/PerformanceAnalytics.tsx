// Shared "Advanced Performance Analytics" panel.
//
// Used by BOTH:
//   - /student/performance (the student's dedicated route)
//   - Teacher > Mis Alumnos detail modal (opened from the compact 4-tile
//     summary on each student card)
//
// This is intentionally the single source of truth so any tweak to the
// analytics presentation lands in both surfaces at once. The previous
// "Boost Skill" affordance has been removed on purpose — it does not
// belong on the teacher-facing view, and per product decision it should
// no longer live on the student view either.

import { useSyncExternalStore } from "react";
import { BookOpen, Ear, Mic, PenLine, type LucideIcon } from "lucide-react";
import {
  getPerformanceSnapshot,
  getServerPerformanceSnapshot,
  subscribePerformance,
  type PerformanceMap,
  type PerformanceRating,
} from "@/lib/performance-store";
import {
  getSessionsSnapshot,
  getServerSessionsSnapshot,
  subscribeSessions,
} from "@/lib/sessions-store";

type BaseKey = keyof PerformanceRating;

interface SubSkill { name: string; base: BaseKey }

interface MacroSkill {
  key: "Speaking" | "Writing" | "Listening" | "Reading";
  icon: LucideIcon;
  subs: SubSkill[];
}

const MACRO_SKILLS: MacroSkill[] = [
  {
    key: "Speaking",
    icon: Mic,
    subs: [
      { name: "Fluency", base: "fluency" },
      { name: "Confidence", base: "confidence" },
      { name: "Range", base: "vocabulary" },
      { name: "Accuracy", base: "grammar" },
      { name: "Pace", base: "fluency" },
      { name: "Tone", base: "confidence" },
    ],
  },
  {
    key: "Writing",
    icon: PenLine,
    subs: [
      { name: "Organization", base: "grammar" },
      { name: "Accuracy", base: "grammar" },
      { name: "Vocabulary Range", base: "vocabulary" },
      { name: "Task Achievement", base: "grammar" },
      { name: "Cohesion", base: "grammar" },
      { name: "Professional Tone", base: "vocabulary" },
    ],
  },
  {
    key: "Listening",
    icon: Ear,
    subs: [
      { name: "Comprehension", base: "confidence" },
      { name: "Inference", base: "confidence" },
      { name: "Response Accuracy", base: "grammar" },
      { name: "Speed of Processing", base: "fluency" },
      { name: "Confidence", base: "confidence" },
    ],
  },
  {
    key: "Reading",
    icon: BookOpen,
    subs: [
      { name: "Comprehension", base: "vocabulary" },
      { name: "Inference", base: "vocabulary" },
      { name: "Vocabulary Recognition", base: "vocabulary" },
      { name: "Critical Understanding", base: "grammar" },
    ],
  },
];

function hashOffset(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (Math.abs(h) % 13) - 6;
}

function baseAverage(map: PerformanceMap, key: BaseKey) {
  const vals: number[] = [];
  for (const r of Object.values(map)) {
    const v = r?.[key];
    if (typeof v === "number" && v > 0) vals.push(v);
  }
  if (vals.length === 0) return { avg: 0, count: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
}

export interface ComputedMacro {
  key: string;
  icon: LucideIcon;
  overall: number | null;
  subs: { name: string; value: number | null }[];
}

function computeMacros(performance: PerformanceMap): ComputedMacro[] {
  const baseAvgs: Record<BaseKey, { avg: number; count: number }> = {
    fluency: baseAverage(performance, "fluency"),
    vocabulary: baseAverage(performance, "vocabulary"),
    confidence: baseAverage(performance, "confidence"),
    grammar: baseAverage(performance, "grammar"),
  };
  return MACRO_SKILLS.map((m) => {
    const subs = m.subs.map((s) => {
      const { avg, count } = baseAvgs[s.base];
      if (count === 0) return { name: s.name, value: null as number | null };
      const base = Math.round((avg / 5) * 100);
      const adjusted = Math.max(0, Math.min(100, base + hashOffset(`${m.key}:${s.name}`)));
      return { name: s.name, value: adjusted };
    });
    const rated = subs.map((s) => s.value).filter((v): v is number => typeof v === "number");
    const overall = rated.length === 0 ? null : Math.round(rated.reduce((a, b) => a + b, 0) / rated.length);
    return { key: m.key, icon: m.icon, overall, subs };
  });
}

/** Public: current computed macros, live-subscribed. */
export function useComputedMacros(): ComputedMacro[] {
  const performance = useSyncExternalStore(
    subscribePerformance,
    getPerformanceSnapshot,
    getServerPerformanceSnapshot,
  );
  useSyncExternalStore(subscribeSessions, getSessionsSnapshot, getServerSessionsSnapshot);
  return computeMacros(performance);
}

/** Small chip identical to the one shown in the student route header. */
export function PlanTierBadge({ tier }: { tier: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm"
      style={{
        borderColor: "rgba(1, 48, 74, 0.12)",
        background: "#ffffff",
        color: "#01304a",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#f38934" }} />
      Plan Tier: {tier}
    </div>
  );
}

/** The 2-column macro-skill grid. Reused by every consumer. */
export function PerformanceAnalyticsGrid() {
  const macros = useComputedMacros();
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      {macros.map((m) => <MacroCard key={m.key} macro={m} />)}
    </section>
  );
}

function scoreClasses(value: number) {
  if (value < 50) return "text-red-600 bg-red-50 border-red-200";
  if (value < 60) return "text-orange-600 bg-orange-50 border-orange-200";
  if (value < 70) return "text-amber-600 bg-amber-50 border-amber-200";
  if (value < 80) return "text-lime-600 bg-lime-50 border-lime-200";
  if (value < 90) return "text-emerald-500 bg-emerald-50 border-emerald-200";
  return "text-emerald-700 bg-emerald-100 border-emerald-300";
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
        --
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${scoreClasses(value)}`}>
      {value}%
    </span>
  );
}

function MacroCard({ macro }: { macro: ComputedMacro }) {
  const Icon = macro.icon;
  return (
    <div
      className="flex flex-col gap-5 rounded-2xl border p-6 shadow-sm"
      style={{ background: "#ffffff", borderColor: "rgba(1, 48, 74, 0.08)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(1, 48, 74, 0.06)", color: "#01304a" }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: "#01304a" }}>
            {macro.key}
          </h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Overall</div>
          <div
            className="text-2xl font-bold tabular-nums leading-none"
            style={{ color: macro.overall === null ? "#94a3b8" : "#01304a" }}
          >
            {macro.overall === null ? "--" : `${macro.overall}%`}
          </div>
        </div>
      </div>

      <div className="h-px w-full" style={{ background: "rgba(1, 48, 74, 0.08)" }} />

      <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(1, 48, 74, 0.06)" }}>
        {macro.subs.map((s) => (
          <li key={s.name} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm font-medium" style={{ color: "#01304a" }}>{s.name}</span>
            <ScoreBadge value={s.value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Modal wrapper used by Teacher > Mis Alumnos. Reuses the same grid so
 *  changes to the visualization propagate everywhere automatically. */
export function PerformanceAnalyticsModal({
  planTier,
  onClose,
}: {
  planTier: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card p-8 shadow-floating">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Advanced Performance Analytics
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "#01304a" }}>
              Skill breakdown
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <PlanTierBadge tier={planTier} />
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <PerformanceAnalyticsGrid />
      </div>
    </div>
  );
}