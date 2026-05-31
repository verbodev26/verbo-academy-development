import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/verbo/Logo";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Verbo Language Solutions" }] }),
  component: LoginPage,
});

const EXECUTIVE_PHRASES = [
  "Language is not a benefit. It's the operating system of a global organization.",
  "Global market expansion requires decisive, fluent, and functional professional minds.",
  "Forget passive grammar memorization. Communication is a practical corporate asset.",
  "Bridging executive leadership with native execution across international frontiers.",
  "Engineering high-fidelity linguistic synchronization for elite enterprise teams.",
];

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const phrase = useMemo(
    () => EXECUTIVE_PHRASES[Math.floor(Math.random() * EXECUTIVE_PHRASES.length)],
    [],
  );

  useEffect(() => {
    if (user) {
      const dest = user.role === "admin" ? "/admin" : user.role === "teacher" ? "/teacher" : "/student";
      navigate({ to: dest });
    }
  }, [user, navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setTimeout(() => {
      const res = login(email.trim(), password);
      if (!res.ok) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      const dest = res.role === "admin" ? "/admin" : res.role === "teacher" ? "/teacher" : "/student";
      navigate({ to: dest });
    }, 900);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col bg-white px-6 py-8">
        <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-[#01304a]/60 transition-colors hover:text-[#01304a]">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        <div className="m-auto w-full max-w-sm">
          <Logo className="mb-10 [&_span]:text-[#01304a] [&_span.text-muted-foreground]:text-[#01304a]/70" />
          <h1 className="text-3xl font-semibold tracking-tight text-[#01304a]">Sign in</h1>
          <p className="mt-1.5 text-sm text-[#01304a]/70">Enter the credentials provided by your administrator.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#01304a]">Email</label>
              <input
                type="email"
                required
                disabled={submitting}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="verbo-login-input mt-1.5 w-full rounded-lg border border-[#01304a]/15 bg-white px-3 py-2.5 text-sm text-[#01304a] placeholder:text-[#01304a]/40 focus:outline-none"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#01304a]">Password</label>
              <input
                type="password"
                required
                disabled={submitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="verbo-login-input mt-1.5 w-full rounded-lg border border-[#01304a]/15 bg-white px-3 py-2.5 text-sm text-[#01304a] placeholder:text-[#01304a]/40 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="verbo-cta-shimmer verbo-btn-glow flex w-full items-center justify-center gap-2 rounded-lg bg-[#f38934] px-4 py-3 text-sm font-semibold text-white shadow-soft disabled:opacity-80"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Authenticating...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="verbo-glass-light mt-8 rounded-2xl p-4">
            <div className="inline-flex items-center rounded-md bg-[#01304a]/5 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.15em] text-[#01304a]/70">
              DEVELOPER SANDBOX
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-[#01304a]/75">
              <li><span className="font-semibold text-[#01304a]">Student:</span> elena@student.com / student123</li>
              <li><span className="font-semibold text-[#01304a]">Teacher:</span> sarah@verbo.com / teacher123</li>
              <li><span className="font-semibold text-[#01304a]">Admin:</span> admin@verbo.com / admin123</li>
            </ul>
          </div>
        </div>

        <div className="text-center text-xs text-[#01304a]/50">
          Verbo Language Solutions · Private platform · No self-registration
        </div>
      </div>

      {/* Visual side */}
      <div className="relative hidden overflow-hidden bg-[#01304a] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Tech grid overlay */}
        <div className="verbo-tech-grid pointer-events-none absolute inset-0" style={{ opacity: 0.2 }} />
        {/* Ambient pulse aura */}
        <div className="verbo-ambient-aura pointer-events-none absolute inset-0" />

        <div className="relative z-10">
          <Logo className="[&_span]:text-white [&_span.text-muted-foreground]:text-white/60" />
        </div>
        <div className="relative z-10">
          <div className="verbo-fade-up text-xs font-medium uppercase tracking-[0.25em] text-white/60" style={{ animationDelay: "120ms" }}>
            A note from our team
          </div>
          <p
            className="verbo-fade-up mt-4 max-w-md text-2xl font-medium leading-snug tracking-tight text-white antialiased"
            style={{ animationDelay: "320ms", WebkitFontSmoothing: "antialiased" }}
          >
            "{phrase}"
          </p>
          <div className="verbo-fade-up mt-6 text-sm text-white/70" style={{ animationDelay: "520ms" }}>
            — The Verbo team
          </div>
        </div>
      </div>
    </div>
  );
}
