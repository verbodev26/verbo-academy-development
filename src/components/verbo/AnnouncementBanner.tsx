// Dismissible announcement banner stack shown at the top of the Student and
// Teacher panels. Reads the shared announcements store (audience = "all" or
// the current role) and lets each user close individual banners.
import { useAuth } from "@/lib/auth";
import { Megaphone, X } from "lucide-react";
import {
  useAnnouncements,
  announcementsForRole,
  dismissAnnouncement,
} from "@/lib/announcements-store";

export function AnnouncementBanner() {
  const { user } = useAuth();
  // Subscribe so the stack re-renders on publish / end / dismiss.
  useAnnouncements();

  if (!user || (user.role !== "student" && user.role !== "teacher")) return null;

  const items = announcementsForRole(user.role);
  if (items.length === 0) return null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 pt-4">
      {items.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-xl border border-[#f38934]/30 bg-[#f38934]/10 px-4 py-3 shadow-sm"
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#f38934]" />
          <p className="flex-1 text-sm text-foreground">{a.message}</p>
          <button
            type="button"
            onClick={() => dismissAnnouncement(a.id)}
            aria-label="Dismiss announcement"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
