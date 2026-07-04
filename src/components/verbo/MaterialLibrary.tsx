import { useMemo, useState } from "react";
import { Card, GhostButton, Pill, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import type { StoredMaterial } from "@/lib/materials-store";
import type { MaterialType } from "@/lib/mock-data";
import {
  Book,
  FileText,
  ListChecks,
  Video,
  Image as ImageIcon,
  Download,
  Eye,
  ChevronRight,
  ArrowLeft,
  X,
  FolderOpen,
} from "lucide-react";

const TYPE_ICON: Record<MaterialType, typeof Book> = {
  book: Book,
  pdf: FileText,
  "verb-list": ListChecks,
  video: Video,
  image: ImageIcon,
};

const TYPE_TINT: Record<MaterialType, string> = {
  book: "bg-amber-500/15 text-amber-400",
  pdf: "bg-rose-500/15 text-rose-400",
  "verb-list": "bg-emerald-500/15 text-emerald-400",
  video: "bg-sky-500/15 text-sky-400",
  image: "bg-violet-500/15 text-violet-400",
};

function CoverArt({ m, className = "" }: { m: StoredMaterial; className?: string }) {
  const Icon = TYPE_ICON[m.material_type];
  if (m.cover_image) {
    return <img src={m.cover_image} alt={m.title} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center ${TYPE_TINT[m.material_type]} ${className}`}>
      <Icon className="h-10 w-10" />
    </div>
  );
}

function PreviewModal({ m, onClose }: { m: StoredMaterial; onClose: () => void }) {
  const isPdf = m.material_type === "pdf";
  const isVideo = m.material_type === "video";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Pill tone="muted">{m.material_type}</Pill>
            <h3 className="text-sm font-semibold text-foreground">{m.title}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-secondary/30 p-5">
          {isPdf ? (
            <iframe title={m.title} src={m.upload_url} className="h-[60vh] w-full rounded-lg border border-border bg-background" />
          ) : isVideo ? (
            <video src={m.upload_url} controls className="h-[60vh] w-full rounded-lg bg-black">
              Your browser does not support embedded video.
            </video>
          ) : (
            <div className="mx-auto flex max-w-sm flex-col items-center">
              <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-border">
                <CoverArt m={m} />
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">Open or download this resource to view its full contents.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <GhostButton onClick={onClose}>Close</GhostButton>
          <a href={m.upload_url} target="_blank" rel="noreferrer">
            <PrimaryButton>
              <Download className="h-3.5 w-3.5" /> Download
            </PrimaryButton>
          </a>
        </div>
      </div>
    </div>
  );
}

export function MaterialLibrary({ items, title = "Resources" }: { items: StoredMaterial[]; title?: string }) {
  const [category, setCategory] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoredMaterial | null>(null);

  const grouped = useMemo(() => {
    return items.reduce((acc, m) => {
      (acc[m.category] ||= []).push(m);
      return acc;
    }, {} as Record<string, StoredMaterial[]>);
  }, [items]);

  const categories = Object.keys(grouped).sort();
  const active = category ? grouped[category] ?? [] : [];

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={() => setCategory(null)} className={category ? "hover:text-foreground" : "font-medium text-foreground"}>
          {title}
        </button>
        {category && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{category}</span>
          </>
        )}
      </div>

      {!category ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h1>
          {categories.length === 0 ? (
            <Card className="text-sm text-muted-foreground">No materials available yet.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat) => {
                const count = grouped[cat].length;
                return (
                  <button key={cat} onClick={() => setCategory(cat)} className="text-left">
                    <Card className="flex items-center gap-4 transition-all hover:border-primary/50 hover:shadow-md">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-base font-semibold text-foreground">{cat}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {count} {count === 1 ? "resource" : "resources"}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{category}</h1>
            <GhostButton onClick={() => setCategory(null)}>
              <ArrowLeft className="h-3.5 w-3.5" /> All categories
            </GhostButton>
          </div>
          <SectionTitle>
            {active.length} {active.length === 1 ? "resource" : "resources"}
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((m) => (
              <Card key={m.id} className="!p-0 overflow-hidden">
                <div className="aspect-video w-full overflow-hidden border-b border-border">
                  <CoverArt m={m} />
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">{m.title}</div>
                    <div className="mt-1"><Pill tone="muted">{m.material_type}</Pill></div>
                  </div>
                  <div className="flex gap-2">
                    <GhostButton className="flex-1 justify-center" onClick={() => setPreview(m)}>
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </GhostButton>
                    <a href={m.upload_url} target="_blank" rel="noreferrer" className="flex-1">
                      <PrimaryButton className="w-full justify-center">
                        <Download className="h-3.5 w-3.5" /> Download
                      </PrimaryButton>
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {preview && <PreviewModal m={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
