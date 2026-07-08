import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { USERS, type User, type Role } from "./mock-data";
import { isMemberBlocked } from "./groups-store";
import { hydrateAdminRoles, isUserDeactivated } from "./admin-roles";

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => { ok: true; role: Role } | { ok: false; error: string };
  logout: () => void;
  updateProfile: (
    updates: { name?: string; currentPassword?: string; newPassword?: string },
  ) => { ok: true } | { ok: false; error: string };
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "verbo.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const login: AuthCtx["login"] = (email, password) => {
    const match = USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!match) return { ok: false, error: "Invalid credentials. Contact your administrator." };
    // Group members in Pending Removal or Archived status lose platform access.
    if (match.role === "student" && isMemberBlocked(match.id)) {
      return { ok: false, error: "Access revoked. Contact your administrator." };
    }
    setUser(match);
    localStorage.setItem(KEY, JSON.stringify(match));
    return { ok: true, role: match.role };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(KEY);
  };

  const updateProfile: AuthCtx["updateProfile"] = (updates) => {
    if (!user) return { ok: false, error: "No active session." };

    if (updates.newPassword) {
      if (updates.currentPassword !== user.password) {
        return { ok: false, error: "Current password is incorrect." };
      }
      if (updates.newPassword.length < 4) {
        return { ok: false, error: "New password must be at least 4 characters." };
      }
    }

    const next: User = {
      ...user,
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.newPassword ? { password: updates.newPassword } : {}),
    };

    // Keep the in-memory mock DB in sync so a re-login reflects the change.
    const idx = USERS.findIndex((u) => u.id === user.id);
    if (idx !== -1) USERS[idx] = next;

    setUser(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    return { ok: true };
  };

  return <Ctx.Provider value={{ user, login, logout, updateProfile }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
