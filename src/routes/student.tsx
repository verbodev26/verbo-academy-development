import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/verbo/RoleGuard";
import { TopNav } from "@/components/verbo/TopNav";
import { AnnouncementBanner } from "@/components/verbo/AnnouncementBanner";

export const Route = createFileRoute("/student")({
  component: StudentLayout,
});

function StudentLayout() {
  return (
    <RoleGuard allow="student">
      <div className="min-h-screen" style={{ backgroundColor: "#f4f6f8" }}>
        <TopNav
          variant="dark"
          items={[
            { to: "/student", label: "Dashboard" },
            { to: "/student/sessions", label: "Live Sessions" },
            { to: "/student/courses", label: "Courses" },
            { to: "/student/resources", label: "Resources" },
          ]}
        />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </RoleGuard>
  );
}
