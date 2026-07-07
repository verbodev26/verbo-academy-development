import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/verbo/RoleGuard";
import { TopNav } from "@/components/verbo/TopNav";
import { AnnouncementBanner } from "@/components/verbo/AnnouncementBanner";
import { useAuth } from "@/lib/auth";
import { ASSIGNMENTS, USERS } from "@/lib/mock-data";

export const Route = createFileRoute("/teacher")({ component: Layout });

function Layout() {
  const { user } = useAuth();
  const hasVipStudent = !!user && USERS.some((u) => {
    if (u.role !== "student" || u.product !== "vip") return false;
    return ASSIGNMENTS.some((a) => a.teacher_id === user.id && a.student_id === u.id);
  });
  const items = [
    { to: "/teacher", label: "Dashboard" },
    { to: "/teacher/calendar", label: "Calendar" },
    { to: "/teacher/students", label: "My Students" },
    { to: "/teacher/materials", label: "Materials" },
    { to: "/teacher/workshops", label: "Focus Workshops" },
    { to: "/teacher/clubs", label: "Clubs" },
    { to: "/teacher/financial", label: "Financial" },
    ...(hasVipStudent ? [{ to: "/teacher/vip", label: "Course Builder VIP" }] : []),
  ];
  return (
    <RoleGuard allow="teacher">
      <div className="min-h-screen bg-background">
        <TopNav items={items} />
        <AnnouncementBanner />
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </RoleGuard>
  );
}
