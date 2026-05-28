import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { ProfileModal } from "./ProfileModal";

interface NavItem { to: string; label: string }

export function TopNav({ items }: { items: NavItem[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to.endsWith("dashboard") }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:bg-secondary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium text-foreground">{user?.name}</div>
            <div className="text-xs capitalize text-muted-foreground">{user?.role}</div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-medium text-foreground">
            {user?.name?.[0] ?? "?"}
          </div>
          <button
            onClick={() => { logout(); navigate({ to: "/" }); }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
