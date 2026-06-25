import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Zap } from "lucide-react";

interface BoostSearch {
  skill?: string;
}

export const Route = createFileRoute("/student/boost")({
  validateSearch: (search: Record<string, unknown>): BoostSearch => ({
    skill: typeof search.skill === "string" ? search.skill : undefined,
  }),
  component: BoostHub,
});

function humanize(slug: string | undefined) {
  if (!slug) return "Selected Skill";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function BoostHub() {
  const { skill } = Route.useSearch();
  const skillLabel = humanize(skill);

  const drills = [
    {
      title: "Targeted Drill",
      description:
        "A 10-minute focused exercise calibrated to reinforce the weak pattern detected in your latest sessions.",
    },
    {
      title: "Adaptive Practice",
      description:
        "Dynamic prompts that escalate in difficulty as you respond, building durable mastery on the compromised area.",
    },
    {
      title: "Coach-Reviewed Challenge",
      description:
        "Submit a recorded or written response — your assigned coach delivers granular feedback within 24 hours.",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4">
        <Link
          to="/student/performance"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-[#01304a]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Performance
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Boost Hub
            </div>
            <h1
              className="mt-2 text-3xl font-semibold tracking-tight"
              style={{ color: "#01304a" }}
            >
              Targeted Skill Reinforcement
            </h1>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
            style={{ background: "#f38934" }}
          >
            <Zap className="h-3.5 w-3.5" />
            Focus: {skillLabel}
          </div>
        </div>
      </header>

      <section
        className="rounded-2xl border p-6 shadow-sm"
        style={{ background: "#ffffff", borderColor: "rgba(1, 48, 74, 0.08)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(243, 137, 52, 0.12)", color: "#f38934" }}
          >
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight" style={{ color: "#01304a" }}>
              Why you're here
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Your performance on{" "}
              <span className="font-semibold" style={{ color: "#01304a" }}>
                {skillLabel}
              </span>{" "}
              is below the 70% threshold. The exercises below are curated to lift this exact metric
              and will be reflected in your next analytics refresh.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {drills.map((d) => (
          <div
            key={d.title}
            className="flex flex-col gap-3 rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: "#ffffff", borderColor: "rgba(1, 48, 74, 0.08)" }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "rgba(1, 48, 74, 0.06)", color: "#01304a" }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold tracking-tight" style={{ color: "#01304a" }}>
              {d.title}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{d.description}</p>
            <button
              className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110"
              style={{ background: "#f38934" }}
            >
              <Zap className="h-3.5 w-3.5" />
              Start exercise
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
