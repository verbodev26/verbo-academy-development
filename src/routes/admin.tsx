import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { RoleGuard } from "@/components/verbo/RoleGuard";
import { TopNav } from "@/components/verbo/TopNav";

export const Route = createFileRoute("/admin")({ component: Layout });

const TABS = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/courses", label: "Courses" },
  { to: "/admin/students", label: "Students" },
  { to: "/admin/teachers", label: "Teachers" },
  { to: "/admin/sessions", label: "Sessions" },
  { to: "/admin/clubs", label: "Manage Clubs" },
  { to: "/admin/materials", label: "Material Complementario" },
  { to: "/admin/kpis", label: "KPIs" },
];

function Layout() {
  return (
    <RoleGuard allow="admin">
      <div className="min-h-screen bg-background">
        <TopNav items={[{ to: "/admin", label: "Admin Panel" }]} />
        <div className="border-b border-border bg-background">
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: !!t.exact }}
                className="border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-foreground data-[status=active]:text-foreground"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </RoleGuard>
  );
}
