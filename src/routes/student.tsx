import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/verbo/RoleGuard";
import { TopNav, type NavEntry } from "@/components/verbo/TopNav";
import { AnnouncementBanner } from "@/components/verbo/AnnouncementBanner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/student")({
  component: StudentLayout,
});

function StudentLayout() {
  const { user } = useAuth();
  const productType = user?.product_type ?? "performance";
  const isVIP = user?.product === "vip";

  let items: NavEntry[] = [];
  if (productType === "insights") {
    items = [
      { to: "/student", label: "Dashboard" },
      { to: "/student/insights", label: "Insights" },
    ];
  } else if (productType === "workshops") {
    items = [
      { to: "/student", label: "Dashboard" },
      { to: "/student/my-workshop", label: "My Workshop" },
    ];
  } else {
    // performance
    items = [
      { to: "/student", label: "Dashboard" },
      { to: "/student/sessions", label: "Live Sessions" },
      isVIP
        ? { to: "/student/my-course", label: "My Course" }
        : { to: "/student/courses", label: "Courses" },
      { to: "/student/resources", label: "Resources" },
      { to: "/student/challenges", label: "Challenges" },
    ];
  }

  return (
    <RoleGuard allow="student">
      <div className="min-h-screen" style={{ backgroundColor: "#f4f6f8" }}>
        <TopNav variant="dark" items={items} />
        <AnnouncementBanner />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </RoleGuard>
  );
}
