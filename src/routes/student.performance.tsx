import { createFileRoute, Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { ArrowLeft, BookOpen, Ear, Mic, PenLine, Zap, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
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

export const Route = createFileRoute("/student/performance")({
  component: PerformanceView,
});

type BaseKey = keyof PerformanceRating; // fluency | vocabulary | confidence | grammar

interface SubSkill {
  name: string;
  base: BaseKey;
}

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

// Deterministic small offset so sub-skills don't look identical when sharing a base.
function hashOffset(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 13) - 6); // -6..+6
}

function baseAverage(map: PerformanceMap, key: BaseKey): { avg: number; count: number } {
  const vals: number[] = [];
  for (const r of Object.values(map)) {
    const v = r?.[key];
    if (typeof v === "number" && v > 0) vals.push(v);
  }
  if (vals.length === 0) return { avg: 0, count: 0 };
  const sum = vals.reduce((a, b) => a + b, 0);
  return { avg: sum / vals.length, count: vals.length };
}

function skillSlug(macro: string, sub: string) {
  return `${macro}-${sub}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function PerformanceView() {
  const { user } = useAuth();
  const performance = useSyncExternalStore(
    subscribePerformance,
    getPerformanceSnapshot,
    getServerPerformanceSnapshot,
  );
  // Subscribe to sessions so this view stays reactive with the rest of the app.
  useSyncExternalStore(subscribeSessions, getSessionsSnapshot, getServerSessionsSnapshot);

  if (!user) return null;

  const planTier = user.hired_plan ?? "—";

  // Pre-compute base averages once.
  const baseAvgs: Record<BaseKey, { avg: number; count: number }> = {
    fluency: baseAverage(performance, "fluency"),
    vocabulary: baseAverage(performance, "vocabulary"),
    confidence: baseAverage(performance, "confidence"),
    grammar: baseAverage(performance, "grammar"),
  };

  const computedMacros = MACRO_SKILLS.map((m) => {
    const subs = m.subs.map((s) => {
      const { avg, count } = baseAvgs[s.base];
      if (count === 0) return { ...s, value: null as number | null };
      const base = Math.round((avg / 5) * 100);
      const adjusted = Math.max(0, Math.min(100, base + hashOffset(`${m.key}:${s.name}`)));
      return { ...s, value: adjusted };
    });
    const ratedValues = subs.filter((s) => s.value !== null).map((s) => s.value as number);
    const overall =
      ratedValues.length === 0
        ? null
        : Math.round(ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length);
    return { ...m, subs, overall };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <Link
          to="/student"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-[#01304a]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              My Performance
            </div>
            <h1
              className="mt-2 text-3xl font-semibold tracking-tight"
              style={{ color: "#01304a" }}
            >
              Advanced Performance Analytics
            </h1>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm"
            style={{
              borderColor: "rgba(1, 48, 74, 0.12)",
              background: "#ffffff",
              color: "#01304a",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#f38934" }}
            />
            Plan Tier: {planTier}
          </div>
        </div>
      </header>

      {/* Macro skill grid */}
      <section className="grid gap-5 lg:grid-cols-2">
        {computedMacros.map((m) => (
          <MacroCard key={m.key} macro={m} />
        ))}
      </section>
    </div>
  );
}

function BoostButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  return (
    <Link
      to="/student/boost"
      search={{ skill: slug }}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white shadow-sm transition-all hover:brightness-110 ${
        compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
      }`}
      style={{ background: "#f38934" }}
    >
      <Zap className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Boost Skill
    </Link>
  );
}

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
        --
      </span>
    );
  }
  const low = value < 70;
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ring-1"
      style={{
        background: low ? "rgba(243, 137, 52, 0.12)" : "rgba(16, 185, 129, 0.10)",
        color: low ? "#b3590f" : "#047857",
        boxShadow: "inset 0 0 0 1px transparent",
        borderColor: low ? "rgba(243, 137, 52, 0.3)" : "rgba(16, 185, 129, 0.25)",
      }}
    >
      {value}%
    </span>
  );
}

function MacroCard({
  macro,
}: {
  macro: {
    key: string;
    icon: LucideIcon;
    overall: number | null;
    subs: { name: string; value: number | null }[];
  };
}) {
  const Icon = macro.icon;
  const overallLow = macro.overall !== null && macro.overall < 70;
  return (
    <div
      className="flex flex-col gap-5 rounded-2xl border p-6 shadow-sm"
      style={{ background: "#ffffff", borderColor: "rgba(1, 48, 74, 0.08)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(1, 48, 74, 0.06)", color: "#01304a" }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <h2
            className="text-lg font-bold tracking-tight"
            style={{ color: "#01304a" }}
          >
            {macro.key}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Overall
            </div>
            <div
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: macro.overall === null ? "#94a3b8" : "#01304a" }}
            >
              {macro.overall === null ? "--" : `${macro.overall}%`}
            </div>
          </div>
          {overallLow && (
            <BoostButton slug={skillSlug(macro.key, "overall")} />
          )}
        </div>
      </div>

      <div
        className="h-px w-full"
        style={{ background: "rgba(1, 48, 74, 0.08)" }}
      />

      {/* Sub-skill rows */}
      <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(1, 48, 74, 0.06)" }}>
        {macro.subs.map((s) => {
          const low = s.value !== null && s.value < 70;
          return (
            <li
              key={s.name}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="text-sm font-medium" style={{ color: "#01304a" }}>
                {s.name}
              </span>
              <div className="flex items-center gap-2">
                <ScoreBadge value={s.value} />
                {low && (
                  <BoostButton slug={skillSlug(macro.key, s.name)} compact />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
