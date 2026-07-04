import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/verbo/RoleGuard";
import { TopNav } from "@/components/verbo/TopNav";
import { AnnouncementBanner } from "@/components/verbo/AnnouncementBanner";

export const Route = createFileRoute("/teacher")({ component: Layout });

function Layout() {
  return (
    <RoleGuard allow="teacher">
      <div className="min-h-screen bg-background">
        <TopNav
          items={[
            { to: "/teacher", label: "Dashboard" },
            { to: "/teacher/calendar", label: "Calendar" },
            { to: "/teacher/materials", label: "Materials" },
          ]}
        />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </RoleGuard>
  );
}
