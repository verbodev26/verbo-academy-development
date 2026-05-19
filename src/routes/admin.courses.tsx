import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LEVELS } from "@/lib/mock-data";
import { Card, GhostButton, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/courses")({ component: Page });

function Page() {
  const [levels, setLevels] = useState(LEVELS);

  const addUnit = (levelId: string) => {
    const title = prompt("Unit title?");
    if (!title) return;
    setLevels((prev) => prev.map((l) => l.id === levelId ? { ...l, units: [...l.units, { id: `${levelId}-U${l.units.length + 1}`, title, video_url: "", pdf_url: "" }] } : l));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Courses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage levels and units.</p>
        </div>
        <PrimaryButton><Plus className="h-4 w-4" /> New level</PrimaryButton>
      </div>

      {levels.map((lvl) => (
        <section key={lvl.id}>
          <SectionTitle action={<GhostButton onClick={() => addUnit(lvl.id)}><Plus className="h-3.5 w-3.5" /> Add unit</GhostButton>}>{lvl.title}</SectionTitle>
          <Card className="!p-0">
            {lvl.units.map((u, i) => (
              <div key={u.id} className={`flex items-center justify-between px-6 py-4 ${i ? "border-t border-border" : ""}`}>
                <div>
                  <div className="text-sm font-medium text-foreground">{u.title}</div>
                  <div className="text-xs text-muted-foreground">{u.id}</div>
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
