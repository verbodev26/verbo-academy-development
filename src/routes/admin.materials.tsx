import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MATERIALS, type MaterialType } from "@/lib/mock-data";
import { Card, GhostButton, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { UploadCloud } from "lucide-react";

export const Route = createFileRoute("/admin/materials")({ component: Page });

const TYPES: MaterialType[] = ["book", "pdf", "verb-list", "video", "image"];

function Page() {
  const [items, setItems] = useState(MATERIALS);
  const [type, setType] = useState<MaterialType>("pdf");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Grammar");

  const upload = () => {
    if (!title) return;
    setItems((p) => [{ id: `m${Date.now()}`, title, material_type: type, upload_url: "#", category }, ...p]);
    setTitle("");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-slate-50">Material Complementario</h1>
        <p className="mt-1 text-sm text-muted-foreground">Upload supplemental resources — auto-categorized into the Student's Resources page.</p>
      </div>

      <Card>
        <SectionTitle>Upload material</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-foreground">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as MaterialType)} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Resource title" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 p-10 text-center">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium text-foreground">Drop a file or click to browse</div>
          <div className="mt-1 text-xs text-muted-foreground">Available once a type is selected</div>
          <GhostButton className="mt-4">Choose file</GhostButton>
        </div>

        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={upload}>Save material</PrimaryButton>
        </div>
      </Card>

      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-6 py-4 text-foreground">{m.title}</td>
                <td className="px-6 py-4"><Pill tone="muted">{m.material_type}</Pill></td>
                <td className="px-6 py-4 text-muted-foreground">{m.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
