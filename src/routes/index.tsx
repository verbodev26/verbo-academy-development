import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/verbo/Logo";
import { ArrowRight, ShieldCheck, Users, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verbo Language Solutions — Corporate English Training" },
      { name: "description", content: "Premium B2B English training for global teams. Private learning platform with live sessions, structured curriculum and measurable progress." },
      { property: "og:title", content: "Verbo Language Solutions" },
      { property: "og:description", content: "Premium B2B English training for global teams." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Logo />
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main>
        <section className="mx-auto max-w-7xl px-6 pt-24 pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Corporate language training, reimagined
            </div>
            <h1 className="mt-8 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
              English fluency, engineered for global teams.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Verbo is a private learning environment for companies who treat language as
              infrastructure. Structured curriculum, live one-to-one sessions, measurable
              progress — all in one elegant platform.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-soft transition-opacity hover:opacity-90"
              >
                Access your account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                How it works
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Access is invitation-only. Credentials are issued by your organization's administrator.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section id="how" className="border-t border-border bg-secondary/40">
          <div className="mx-auto grid max-w-7xl gap-px overflow-hidden border-x border-border bg-border md:grid-cols-3">
            <Pillar icon={<Users className="h-5 w-5" />} title="One-to-one teaching">
              Every learner is paired with a dedicated teacher. Sessions run live on Microsoft Teams and are tracked end-to-end.
            </Pillar>
            <Pillar icon={<BarChart3 className="h-5 w-5" />} title="Measurable progress">
              Attendance, level progression and post-session ratings feed a single source of truth for HR and L&amp;D teams.
            </Pillar>
            <Pillar icon={<ShieldCheck className="h-5 w-5" />} title="Private by design">
              No social logins, no public sign-up. Accounts are provisioned manually, scoped by role, and isolated per tenant.
            </Pillar>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
            <Logo />
            <div>© {new Date().getFullYear()} Verbo Language Solutions. All rights reserved.</div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Pillar({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background p-10">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-foreground">{icon}</div>
      <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
