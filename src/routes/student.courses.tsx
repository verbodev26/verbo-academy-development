import { createFileRoute } from "@tanstack/react-router";
import { LEVELS } from "@/lib/mock-data";
import { Card, GhostButton, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { Download, PlayCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/student/courses")({ component: Page });

function Page() {
  const { user } = useAuth();
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Courses</h1>
      {LEVELS.map((lvl) => (
        <section key={lvl.id}>
          <SectionTitle action={lvl.id === user?.current_level ? <Pill tone="success">Current level</Pill> : null}>{lvl.title}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lvl.units.map((u) => (
              <Card key={u.id}>
                <div className="aspect-video rounded-lg bg-secondary flex items-center justify-center">
                  <PlayCircle className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{u.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Unit · Video, PDF, practice</p>
                <div className="mt-4 flex items-center gap-2">
                  <PrimaryButton className="flex-1">Start activities</PrimaryButton>
                  <GhostButton aria-label="Download PDF"><Download className="h-3.5 w-3.5" /></GhostButton>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
