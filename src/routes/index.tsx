import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/verbo/Logo";
import { Preloader } from "@/components/verbo/Preloader";
import { ArrowRight, ShieldCheck, Users, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verbo Language Solutions — The Language of Global Growth" },
      { name: "description", content: "Premium B2B English training for global teams. Private platform with live sessions, structured curriculum and measurable progress." },
      { property: "og:title", content: "Verbo Language Solutions" },
      { property: "og:description", content: "The Language of Global Growth." },
    ],
  }),
  component: Landing,
});

const TYPE_TARGETS = [
  "engineered for global teams.",
  "built for executive leadership.",
  "designed for market expansion.",
];

function useTypewriter(targets: string[]) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = targets[idx];
    const speed = deleting ? 35 : 65;
    if (!deleting && text === current) {
      const hold = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(hold);
    }
    if (deleting && text === "") {
      setDeleting(false);
      setIdx((i) => (i + 1) % targets.length);
      return;
    }
    const t = setTimeout(() => {
      setText((prev) =>
        deleting ? current.slice(0, prev.length - 1) : current.slice(0, prev.length + 1),
      );
    }, speed);
    return () => clearTimeout(t);
  }, [text, deleting, idx, targets]);

  return text;
}

function Landing() {
  const typed = useTypewriter(TYPE_TARGETS);

  return (
    <>
      <Preloader />
      <div className="min-h-screen bg-background">
        {/* Nav */}
        <header className="absolute left-0 right-0 top-0 z-20">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="text-white">
              <Logo />
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <main>
          {/* HERO — dark mode */}
          <section
            className="relative overflow-hidden"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, rgba(243,137,52,0.05), transparent 55%), linear-gradient(180deg, #050a10 0%, #0a1420 60%, #01304a 100%)",
            }}
          >
            <div className="verbo-tech-grid absolute inset-0 opacity-60" />
            {/* radial orange ambient */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(600px circle at 50% 30%, rgba(243,137,52,0.10), transparent 60%)",
              }}
            />

            <div className="relative mx-auto max-w-5xl px-6 pt-40 pb-32 text-center">
              {/* Secure badge */}
              <div className="verbo-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.15em] text-white/80 backdrop-blur-sm">
                <span className="verbo-status-dot inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                System Status: Secure Enterprise Gateway
              </div>

              <h1
                className="verbo-fade-up mt-8 text-5xl font-semibold tracking-tight text-white md:text-6xl"
                style={{ animationDelay: "120ms" }}
              >
                English fluency,{" "}
                <span className="font-normal text-white/90">
                  {typed}
                  <span
                    className="verbo-cursor ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[2px] bg-[#f38934]"
                    aria-hidden
                  />
                </span>
              </h1>

              <p
                className="verbo-fade-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70"
                style={{ animationDelay: "260ms" }}
              >
                Forget memorizing passive grammar rules to fill out a book. Verbo transforms
                language learning into a practical corporate asset, enabling decisive professional
                minds to achieve fluent, natural, and functional bilingual communication from day
                one.
              </p>

              <div
                className="verbo-fade-up mt-10 flex flex-wrap items-center justify-center gap-3"
                style={{ animationDelay: "400ms" }}
              >
                <Link
                  to="/login"
                  className="verbo-cta-shimmer group inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1"
                  style={{
                    backgroundColor: "#f38934",
                    boxShadow: "0 6px 18px -6px rgba(243,137,52,0.5)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 10px 25px -5px rgba(243,137,52,0.55)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 6px 18px -6px rgba(243,137,52,0.5)")
                  }
                >
                  Access your account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-transparent px-6 py-3 text-sm font-medium text-white transition-all duration-300 hover:bg-white hover:text-[#01304a]"
                >
                  How it works
                </a>
              </div>

              <p
                className="verbo-fade-up mt-6 text-xs text-white/50"
                style={{ animationDelay: "520ms" }}
              >
                Access is invitation-only. Credentials are issued by your organization's administrator.
              </p>
            </div>
          </section>

          {/* Pillars */}
          <section id="how" style={{ backgroundColor: "#f4f6f8" }}>
            <div className="mx-auto max-w-7xl px-6 py-24">
              <div className="mx-auto mb-14 max-w-2xl text-center">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  How it works
                </div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground text-slate-50 md:text-4xl">
                  A complete platform engineered for measurable outcomes.
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                <Pillar
                  icon={<Users className="h-5 w-5" />}
                  title="One-to-one teaching"
                  delay="120ms"
                >
                  Every learner is paired with a dedicated teacher. Sessions run live on Microsoft
                  Teams and are tracked end-to-end.
                </Pillar>
                <Pillar
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="Measurable progress"
                  delay="240ms"
                >
                  Attendance, level progression and post-session ratings feed a single source of
                  truth for HR and L&amp;D teams.
                </Pillar>
                <Pillar
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Private by design"
                  delay="360ms"
                >
                  No social logins, no public sign-up. Accounts are provisioned manually, scoped by
                  role, and isolated per tenant.
                </Pillar>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-border bg-background">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
              <Logo />
              <div>© {new Date().getFullYear()} Verbo Language Solutions. All rights reserved.</div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}

function Pillar({
  icon,
  title,
  children,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: string;
}) {
  return (
    <div
      className="verbo-feature-card verbo-fade-up rounded-2xl p-8"
      style={{ animationDelay: delay }}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#01304a] text-white">
        {icon}
      </div>
      <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
