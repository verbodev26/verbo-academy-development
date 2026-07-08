import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { ChevronDown, LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ProfileModal } from "./ProfileModal";
import { AdminProfileModal } from "./AdminProfileModal";
import { useAvatar } from "@/lib/avatar-store";

export interface NavItem { to: string; label: string }
export interface NavGroup { label: string; items: NavItem[] }
export type NavEntry = NavItem | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

function isActive(pathname: string, item: NavItem, exact?: boolean): boolean {
  return exact || item.to === "/teacher" || item.to === "/student"
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(item.to + "/");
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((it) => isActive(pathname, it));
}

const tabCls =
  "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ease-out text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const activeTabCls =
  "data-[status=active]:bg-secondary data-[status=active]:text-foreground";

function SingleNav({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: active }}
      data-status={active ? "active" : undefined}
      className={`${tabCls} ${activeTabCls}`}
    >
      {item.label}
    </Link>
  );
}

function NavGroupDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => () => cancelClose(), []);

  const getMenuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
  const focusItem = (index: number) => {
    const items = getMenuItems();
    if (!items.length) return;
    const i = (index + items.length) % items.length;
    items[i]?.focus();
  };
  const onButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(-1));
    }
  };
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = getMenuItems();
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") { e.preventDefault(); focusItem(current + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusItem(current - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusItem(0); }
    else if (e.key === "End") { e.preventDefault(); focusItem(items.length - 1); }
    else if (e.key === "Tab") { setOpen(false); }
  };

  const active = isGroupActive(pathname, group);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKeyDown}
        data-status={active ? "active" : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={`${tabCls} ${activeTabCls}`}
      >
        {group.label}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div
        id={menuId}
        ref={menuRef}
        role="menu"
        aria-label={group.label}
        hidden={!open}
        onKeyDown={onMenuKeyDown}
        className="absolute left-0 top-full z-40 mt-1 min-w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-elevated before:absolute before:-top-2 before:left-0 before:h-2 before:w-full before:content-['']"
      >
        {group.items.map((it) => {
          const itemActive = isActive(pathname, it);
          return (
            <Link
              key={it.to}
              to={it.to}
              role="menuitem"
              data-status={itemActive ? "active" : undefined}
              className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:bg-secondary focus:text-foreground focus:outline-none data-[status=active]:bg-secondary data-[status=active]:text-foreground"
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function TopNav({ items, variant = "light" }: { items: NavEntry[]; variant?: "light" | "dark" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin";
  const canEditProfile = isStudent || isAdmin;
  const avatar = useAvatar(user?.id);
  const isDark = variant === "dark";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header
      className={`sticky top-0 z-40 ${isDark ? "" : "border-b border-border bg-background/85 backdrop-blur-xl"}`}
      style={isDark ? { backgroundColor: "#01304a", borderBottom: "1px solid rgba(255,255,255,0.08)" } : undefined}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo dark={isDark} />
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              if (isGroup(item)) {
                return <NavGroupDropdown key={item.label} group={item} pathname={pathname} />;
              }
              return <SingleNav key={item.to} item={item} pathname={pathname} />;
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className={`text-sm font-medium ${isDark ? "text-white" : "text-foreground"}`}>{user?.name}</div>
            <div className={`text-xs capitalize ${isDark ? "text-[#94a3b8]" : "text-muted-foreground"}`}>{user?.role}</div>
          </div>
          <button
            type="button"
            onClick={() => canEditProfile && setProfileOpen(true)}
            disabled={!canEditProfile}
            className={`flex h-9 w-9 overflow-hidden items-center justify-center rounded-full text-sm font-bold text-white transition-all ${
              isDark
                ? "bg-[#f38934]"
                : "bg-secondary text-foreground"
            } ${canEditProfile ? "cursor-pointer hover:ring-2 hover:ring-[#f38934]/60 hover:shadow-md" : ""}`}
            aria-label="Open profile"
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              user?.name?.[0] ?? "?"
            )}
          </button>
          <button
            onClick={() => { logout(); navigate({ to: "/" }); }}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors ${
              isDark
                ? "text-[#94a3b8] hover:text-[#f38934]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isStudent && <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />}
      {isAdmin && <AdminProfileModal open={profileOpen} onOpenChange={setProfileOpen} />}
    </header>
  );
}
