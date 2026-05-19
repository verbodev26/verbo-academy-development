import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { USERS, type User, type Role } from "./mock-data";

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => { ok: true; role: Role } | { ok: false; error: string };
  logout: () => void;
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
    setUser(match);
    localStorage.setItem(KEY, JSON.stringify(match));
    return { ok: true, role: match.role };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(KEY);
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
