import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, GhostButton, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { Sparkles, BookOpen, Plus, Pencil, Trash2, UploadCloud, X, Link as LinkIcon, Calendar } from "lucide-react";

export const Route = createFileRoute("/admin/clubs")({ component: Page });

type ClubType = "insight" | "book";
type Status = "upcoming" | "live" | "completed" | "cancelled";

interface Club {
  id: string;
  type: ClubType;
  title: string;
  description: string;
  link: string;
  material?: string;
  date: string; // ISO
  spots_taken: number;
  spots_total: number;
  status: Status;
}

const SEED: Club[] = [
  { id: "c1", type: "insight", title: "Mastering Business Idioms", description: "Live workshop on professional idioms.", link: "https://teams.microsoft.com/l/meetup-1", material: "idioms-guide.pdf", date: "2026-05-28T17:00:00", spots_taken: 12, spots_total: 30, status: "upcoming" },
  { id: "c2", type: "book", title: "The Alchemist — Chapter 3", description: "Discussion circle on themes and vocabulary.", link: "https://teams.microsoft.com/l/meetup-2", material: "alchemist-ch3.pdf", date: "2026-05-25T18:30:00", spots_taken: 4, spots_total: 4, status: "upcoming" },
  { id: "c3", type: "insight", title: "Pronunciation Lab: TH Sounds", description: "Drills and pair practice.", link: "https://teams.microsoft.com/l/meetup-3", date: "2026-05-18T16:00:00", spots_taken: 22, spots_total: 25, status: "completed" },
  { id: "c4", type: "book", title: "Atomic Habits — Intro", description: "Kickoff session for the new club cycle.", link: "https://teams.microsoft.com/l/meetup-4", date: "2026-06-02T17:30:00", spots_taken: 1, spots_total: 4, status: "upcoming" },
];

const STATUS_TONE: Record<Status, "default" | "success" | "warning" | "danger" | "muted"> = {
  upcoming: "default",
  live: "success",
  completed: "muted",
  cancelled: "danger",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const [clubs, setClubs] = useState<Club[]>(SEED);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Club | null>(null);

  const onCreate = () => { setEditing(null); setOpen(true); };
  const onEdit = (c: Club) => { setEditing(c); setOpen(true); };
  const onDelete = (id: string) => setClubs((p) => p.filter((c) => c.id !== id));

  const onSave = (data: Omit<Club, "id" | "spots_taken" | "status">) => {
    if (editing) {
      setClubs((p) => p.map((c) => (c.id === editing.id ? { ...c, ...data } : c)));
    } else {
      setClubs((p) => [
        { id: `c${Date.now()}`, spots_taken: 0, status: "upcoming", ...data },
        ...p,
      ]);
    }
    setOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-slate-50">Manage Clubs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and curate Verbo Insights and Book Clubs that appear on the student calendar.</p>
        </div>
        <PrimaryButton onClick={onCreate}>
          <Plus className="h-4 w-4" /> Create New Club Event
        </PrimaryButton>
      </div>

      <Card className="!p-0">
        <div className="border-b border-border px-6 py-4">
          <SectionTitle>All scheduled events</SectionTitle>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">Scheduled</th>
              <th className="px-6 py-3 font-medium">Spots</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                <td className="px-6 py-4">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.type === "insight" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
                    {c.type === "insight" ? <Sparkles className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-foreground">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.type === "insight" ? "Verbo Insight" : "Book Club"}</div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{formatDate(c.date)}</td>
                <td className="px-6 py-4 text-foreground">{c.spots_taken}/{c.spots_total}</td>
                <td className="px-6 py-4"><Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill></td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => onEdit(c)} aria-label="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDelete(c.id)} aria-label="Delete" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clubs.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">No club events yet. Create your first one.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {open && <ClubFormPanel initial={editing} onClose={() => setOpen(false)} onSave={onSave} />}
    </div>
  );
}

function ClubFormPanel({
  initial,
  onClose,
  onSave,
}: {
  initial: Club | null;
  onClose: () => void;
  onSave: (data: Omit<Club, "id" | "spots_taken" | "status">) => void;
}) {
  const [type, setType] = useState<ClubType>(initial?.type ?? "insight");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [date, setDate] = useState(initial?.date?.slice(0, 16) ?? "");
  const [spotsTotal, setSpotsTotal] = useState(initial?.spots_total ?? (type === "book" ? 4 : 30));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    onSave({
      type, title, description, link,
      material: material || undefined,
      date: new Date(date).toISOString(),
      spots_total: spotsTotal,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-xl flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground text-slate-50">{initial ? "Edit Club Event" : "Create New Club Event"}</h2>
            <p className="text-xs text-muted-foreground">Configure how it appears on the student calendar.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Type toggle */}
          <div>
            <label className="text-xs font-medium text-foreground">Event type</label>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-1">
              {(["insight", "book"] as ClubType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "insight" ? <Sparkles className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  {t === "insight" ? "Verbo Insight" : "Book Club"}
                </button>
              ))}
            </div>
          </div>

          <Field label="Club title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Public Speaking Essentials" className={fieldCls} required />
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What students will learn or discuss." className={`${fieldCls} resize-none`} />
          </Field>

          <Field label="Session link">
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://teams.microsoft.com/..." className={`${fieldCls} pl-9`} />
            </div>
          </Field>

          <Field label="Pre-club material">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
              <UploadCloud className="h-7 w-7 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium text-foreground">{material || "Drop a PDF or image"}</div>
              <div className="mt-1 text-xs text-muted-foreground">Shared with students before the event</div>
              <GhostButton type="button" className="mt-3" onClick={() => setMaterial(material ? "" : "preview-material.pdf")}>
                {material ? "Remove file" : "Choose file"}
              </GhostButton>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date & time">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldCls} pl-9`} required />
              </div>
            </Field>
            <Field label="Capacity">
              <input type="number" min={1} value={spotsTotal} onChange={(e) => setSpotsTotal(parseInt(e.target.value) || 1)} className={fieldCls} />
            </Field>
          </div>
        </form>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostButton onClick={onClose} type="button">Cancel</GhostButton>
          <PrimaryButton onClick={submit as unknown as () => void}>{initial ? "Save changes" : "Publish event"}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

const fieldCls = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
