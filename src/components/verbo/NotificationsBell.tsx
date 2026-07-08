// Bell icon in the top nav — renders a dropdown of internal notifications
// derived from existing stores. Click an item to navigate to its route and
// mark it read. See src/lib/notifications-store.ts for source of truth.
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  useNotifications, markNotificationRead, markAllNotificationsRead,
  type Notification,
} from "@/lib/notifications-store";

const MAX_VISIBLE = 15;

function timeAgo(iso: string): string {
  const diff = Date.now() - +new Date(iso);
  const m = Math.round(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationsBell({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount } = useNotifications(user ?? null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const isDark = variant === "dark";
  const visible = notifications.slice(0, MAX_VISIBLE);
  const hasUnread = unreadCount > 0;

  const onClickItem = (n: Notification) => {
    if (!n.read) markNotificationRead(user.id, n.id);
    setOpen(false);
    navigate({ to: n.to });
  };

  const markAll = () => {
    if (!hasUnread) return;
    markAllNotificationsRead(user.id, notifications.filter((n) => !n.read).map((n) => n.id));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors ${
          isDark
            ? "text-[#94a3b8] hover:text-[#f38934]"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-elevated"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold text-foreground">Notifications</div>
            <button
              type="button"
              onClick={markAll}
              disabled={!hasUnread}
              className="text-xs font-medium text-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {visible.map((n) => (
                <li key={n.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onClickItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                      n.read ? "" : "bg-accent/5"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        n.read ? "bg-transparent" : "bg-accent"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${n.read ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {notifications.length > MAX_VISIBLE && (
            <div className="border-t border-border bg-secondary/30 px-4 py-2 text-center text-[11px] text-muted-foreground">
              Showing the {MAX_VISIBLE} most recent.
            </div>
          )}
        </div>
      )}
      {/* Silence unused import if Link is stripped in dead-code — kept for future in-menu links */}
      <Link to="/teacher" className="hidden" aria-hidden="true" />
    </div>
  );
}
