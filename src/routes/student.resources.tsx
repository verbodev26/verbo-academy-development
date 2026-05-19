import { createFileRoute } from "@tanstack/react-router";
import { MATERIALS } from "@/lib/mock-data";
import { Card, GhostButton, Pill, SectionTitle } from "@/components/verbo/ui";
import { Book, FileText, ListChecks, Video, Image as ImageIcon, Download } from "lucide-react";

export const Route = createFileRoute("/student/resources")({ component: Page });

const ICONS = {
  book: Book, pdf: FileText, "verb-list": ListChecks, video: Video, image: ImageIcon,
} as const;

function Page() {
  const grouped = MATERIALS.reduce((acc, m) => {
    (acc[m.category] ||= []).push(m);
    return acc;
  }, {} as Record<string, typeof MATERIALS>);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Resources</h1>
      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat}>
          <SectionTitle>{cat}</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((m) => {
              const Icon = ICONS[m.material_type];
              return (
                <Card key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary"><Icon className="h-4 w-4" /></div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{m.title}</div>
                      <div className="mt-0.5"><Pill tone="muted">{m.material_type}</Pill></div>
                    </div>
                  </div>
                  <GhostButton><Download className="h-3.5 w-3.5" /> Download</GhostButton>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
