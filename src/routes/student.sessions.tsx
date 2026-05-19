import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { SESSIONS, userById } from "@/lib/mock-data";
import { Card, Pill, SectionTitle, SuccessButton } from "@/components/verbo/ui";
import { CalendarClock, Video } from "lucide-react";

export const Route = createFileRoute("/student/sessions")({ component: Page });

function Page() {
  const { user } = useAuth();
  const sessions = SESSIONS.filter((s) => s.student_id === user?.id).sort((a, b) => +new Date(a.date_time) - +new Date(b.date_time));
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Live Sessions</h1>
      <SectionTitle>All sessions</SectionTitle>
      <div className="space-y-3">
        {sessions.map((s) => {
          const t = userById(s.teacher_id);
          return (
            <Card key={s.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary"><CalendarClock className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-medium text-foreground">{new Date(s.date_time).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">with {t?.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone={s.status === "completed" ? "success" : s.status === "scheduled" ? "default" : "danger"}>{s.status}</Pill>
                {s.status === "scheduled" && <SuccessButton><Video className="h-4 w-4" /> Connect</SuccessButton>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
