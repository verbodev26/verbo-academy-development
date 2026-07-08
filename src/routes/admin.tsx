import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { RoleGuard } from "@/components/verbo/RoleGuard";
import { TopNav } from "@/components/verbo/TopNav";
import { useAuth } from "@/lib/auth";
import {
  hydrateAdminRoles, getAdminType, canAccessAdminPath, defaultAdminLanding,
} from "@/lib/admin-roles";

export const Route = createFileRoute("/admin")({ component: Layout });

type NavItem = { to: string; label: string; exact?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", items: [{ to: "/admin", label: "Dashboard", exact: true }] },
  { label: "Students", items: [
    { to: "/admin/students", label: "Students" },
    { to: "/admin/groups",   label: "Groups" },
    { to: "/admin/sessions", label: "Sessions" },
  ]},
  { label: "Teachers", items: [
    { to: "/admin/teachers", label: "Teachers" },
    { to: "/admin/kpis",     label: "KPIs" },
  ]},
  { label: "Content", items: [
    { to: "/admin/courses",    label: "Performance Sessions" },
    { to: "/admin/workshops",  label: "Focus Workshops" },
    { to: "/admin/challenges", label: "Challenges" },
    { to: "/admin/materials",  label: "Material Complementario" },
  ]},
  { label: "Clubs", items: [{ to: "/admin/clubs", label: "Clubs" }] },
  { label: "Calendar", items: [{ to: "/admin/holidays", label: "Holidays" }] },
  { label: "Financial", items: [
    { to: "/admin/financial/money-lab", label: "The Money Lab" },
  ]},
  { label: "Users", items: [{ to: "/admin/users", label: "User Management" }] },
  { label: "Activity", items: [{ to: "/admin/activity-logs", label: "Activity Logs" }] },
];

const tabCls =
  "inline-flex items-center gap-1 border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-foreground data-[status=active]:text-foreground";

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((it) =>
    it.exact ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/"),
  );
}

function NavTab({ group }: { group: NavGroup }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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

  if (group.items.length === 1) {
    const it = group.items[0];
    return (
      <Link to={it.to} activeOptions={{ exact: !!it.exact }} className={tabCls}>
        {group.label}
      </Link>
    );
  }

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
        className={tabCls}
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
        {group.items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            role="menuitem"
            activeOptions={{ exact: !!it.exact }}
            className="block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:bg-secondary focus:text-foreground focus:outline-none data-[status=active]:bg-secondary data-[status=active]:text-foreground"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Layout() {
  hydrateAdminRoles();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const adminType = getAdminType(user);

  const visibleGroups = useMemo(() => {
    if (!adminType) return [] as NavGroup[];
    return NAV_GROUPS.filter((g) => {
      if (g.label === "Users" || g.label === "Activity") return adminType === "super_admin";
      // A group is visible if any of its items is allowed for this admin type.
      return g.items.some((it) => canAccessAdminPath(adminType, it.to));
    }).map((g) => ({
      ...g,
      items: g.items.filter((it) => canAccessAdminPath(adminType!, it.to)),
    }));
  }, [adminType]);

  // Guard against direct URL access to forbidden sections.
  if (adminType && !canAccessAdminPath(adminType, pathname)) {
    return <Navigate to={defaultAdminLanding(adminType)} />;
  }

  return (
    <RoleGuard allow="admin">
      <div className="min-h-screen bg-background">
        <TopNav items={[{ to: "/admin", label: "Admin Panel" }]} />
        <div className="border-b border-border bg-background">
          <nav aria-label="Admin sections" className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6">
            {visibleGroups.map((g) => <NavTab key={g.label} group={g} />)}
          </nav>
        </div>
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
      </div>
    </RoleGuard>
  );
}
