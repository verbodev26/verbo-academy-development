import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/mock-data";
import type { ReactNode } from "react";

export function RoleGuard({ allow, children }: { allow: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== allow) {
    const dest = user.role === "admin" ? "/admin" : user.role === "teacher" ? "/teacher" : "/student";
    return <Navigate to={dest} />;
  }
  return <>{children}</>;
}
