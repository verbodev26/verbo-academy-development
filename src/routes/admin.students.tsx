import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { USERS } from "@/lib/mock-data";
import { Card, GhostButton, Pill } from "@/components/verbo/ui";
import { Plus, Lock, Unlock } from "lucide-react";

export const Route = createFileRoute("/admin/students")({ component: Page });

const CANCEL_LIMIT = 3;
const STORAGE_KEY = "verbo:club-cancels-v2";

function readCancels(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCancels(map: Record<string, number>) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }
}

function Page() {
  const students = USERS.filter((u) => u.role === "student");
  const [cancels, setCancels] = useState<Record<string, number>>(readCancels);

  useEffect(() => {
    setCancels(readCancels());
  }, []);

  const resetStudent = (studentId: string) => {
    const next = { ...cancels, [studentId]: 0 };
    setCancels(next);
    writeCancels(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register, list and suspend students.</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-soft transition-opacity hover:opacity-90 disabled:opacity-40 shadow-sm">
          <Plus className="h-4 w-4" /> Register student
        </button>
      </div>

      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Level</th>
              <th className="px-6 py-3 font-medium">Attendance</th>
              <th className="px-6 py-3 font-medium">Club Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const count = cancels[s.id] ?? 0;
              const blocked = count >= CANCEL_LIMIT;
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4 text-foreground">{s.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{s.email}</td>
                  <td className="px-6 py-4"><Pill tone="muted">{s.current_level}</Pill></td>
                  <td className="px-6 py-4 text-muted-foreground">{s.attendance_percentage}%</td>
                  <td className="px-6 py-4">
                    {blocked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                        <Lock className="h-3 w-3" />
                        Cancellations: {count}/{CANCEL_LIMIT} — BLOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                        <Unlock className="h-3 w-3" />
                        {count}/{CANCEL_LIMIT} — Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {blocked && (
                        <button
                          onClick={() => resetStudent(s.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
                          style={{ backgroundColor: "#f38934" }}
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Unlock Clubs
                        </button>
                      )}
                      <GhostButton className="!py-1.5 !text-xs">Suspend</GhostButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

