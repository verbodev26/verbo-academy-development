import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/verbo/Logo";
import { ArrowLeft, Lock } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Verbo Language Solutions" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      const dest = user.role === "admin" ? "/admin" : user.role === "teacher" ? "/teacher" : "/student";
      navigate({ to: dest });
    }
  }, [user, navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = login(email.trim(), password);
    if (!res.ok) { setError(res.error); return; }
    const dest = res.role === "admin" ? "/admin" : res.role === "teacher" ? "/teacher" : "/student";
    navigate({ to: dest });
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col bg-background px-6 py-8">
        <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        <div className="m-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Enter the credentials provided by your administrator.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
          </form>

          <div className="mt-8 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Lock className="h-3.5 w-3.5" /> Demo credentials
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li><span className="font-medium text-foreground">Student:</span> elena@student.com / student123</li>
              <li><span className="font-medium text-foreground">Teacher:</span> sarah@verbo.com / teacher123</li>
              <li><span className="font-medium text-foreground">Admin:</span> admin@verbo.com / admin123</li>
            </ul>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Verbo Language Solutions · Private platform · No self-registration
        </div>
      </div>

      {/* Visual side */}
      <div className="hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo className="[&_*]:text-primary-foreground [&_div:first-child]:bg-primary-foreground [&_div:first-child]:text-primary" />
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/60">A note from our team</div>
          <p className="mt-4 max-w-md text-2xl font-medium leading-snug tracking-tight text-primary-foreground">
            "Language is not a benefit. It's the operating system of a global organization."
          </p>
          <div className="mt-6 text-sm text-primary-foreground/70">— The Verbo team</div>
        </div>
      </div>
    </div>
  );
}
