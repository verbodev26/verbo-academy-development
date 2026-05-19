import { createFileRoute } from "@tanstack/react-router";
import { MATERIALS } from "@/lib/mock-data";
import { Card, Pill } from "@/components/verbo/ui";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/teacher/materials")({ component: Page });

function Page() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Materials</h1>
      <p className="text-sm text-muted-foreground">View-only core educational resources.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {MATERIALS.map((m) => (
          <Card key={m.id} className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><FileText className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">{m.title}</div>
              <div className="mt-0.5 flex gap-2"><Pill tone="muted">{m.material_type}</Pill><Pill tone="muted">{m.category}</Pill></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
