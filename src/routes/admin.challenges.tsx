import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, GhostButton, PrimaryButton, Pill } from "@/components/verbo/ui";
import {
  Plus,
  Trash2,
  X,
  Pencil,
  Compass,
  Briefcase,
  Globe,
  Crown,
  ArrowLeft,
  ChevronRight,
  Wand2,
  Link2,
  Lock,
  Info,
} from "lucide-react";
import {
  type Challenge,
  type ChallengeProductId,
  type DifficultyId,
  PRODUCT_META,
  PRODUCT_ORDER,
  DIFFICULTY_META,
  DIFFICULTY_ORDER,
  CHALLENGES_PER_DIFFICULTY,
  loadChallenges,
  persistChallenges,
  subscribeChallenges,
  challengesFor,
  buildSkeletonChallenges,
  newChallengeId,
  loadCategories,
  persistCategories,
  subscribeCategories,
  categoryColor,
} from "@/lib/challenges-store";

export const Route = createFileRoute("/admin/challenges")({ component: Page });

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
const textareaCls =
  "min-h-[96px] w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

const PRODUCT_ICON: Record<ChallengeProductId, React.ComponentType<{ className?: string }>> = {
  go: Compass,
  enterprise: Briefcase,
  international: Globe,
  vip: Crown,
};

function DifficultyDots({ difficulty, className = "" }: { difficulty: DifficultyId; className?: string }) {
  const { dots } = DIFFICULTY_META[difficulty];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < dots ? "bg-[#f38934]" : "border border-muted-foreground/40 bg-transparent"}`}
        />
      ))}
    </span>
  );
}

function CategoryBadge({ name }: { name: string }) {
  if (!name) return <Pill tone="muted">No category</Pill>;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryColor(name)}`}>
      {name}
    </span>
  );
}

function Page() {
  const [challenges, setChallenges] = useState<Challenge[]>(loadChallenges);
  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [productId, setProductId] = useState<ChallengeProductId | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyId | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; challenge?: Challenge } | null>(null);

  useEffect(() => {
    setChallenges(loadChallenges());
    setCategories(loadCategories());
    const un1 = subscribeChallenges(() => setChallenges(loadChallenges()));
    const un2 = subscribeCategories(() => setCategories(loadCategories()));
    return () => { un1(); un2(); };
  }, []);

  const countFor = (p: ChallengeProductId, d: DifficultyId) =>
    challenges.filter((c) => c.product === p && c.difficulty === d).length;

  const list = useMemo(
    () => (productId && difficulty ? challengesFor(challenges, productId, difficulty) : []),
    [challenges, productId, difficulty],
  );

  const saveChallenge = (c: Challenge) => {
    setChallenges((prev) => {
      const next = [...prev.filter((x) => x.id !== c.id), c];
      persistChallenges(next);
      return next;
    });
  };

  const deleteChallenge = (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    setChallenges((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistChallenges(next);
      return next;
    });
  };

  const addCategory = (name: string) => {
    setCategories((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      persistCategories(next);
      return next;
    });
  };

  const generateSkeleton = () => {
    if (!productId || !difficulty) return;
    const existing = challengesFor(challenges, productId, difficulty);
    const generated = buildSkeletonChallenges(productId, difficulty, existing);
    setChallenges((prev) => {
      const next = [...prev, ...generated];
      persistChallenges(next);
      return next;
    });
  };

  /* ---------------- Screen 1: Product selection ---------------- */
  if (!productId) {
    return (
      <div className="space-y-8">
        <Header title="Challenges" subtitle="Complementary weekly challenges. Select a product to manage its difficulties." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCT_ORDER.map((pid) => {
            const Icon = PRODUCT_ICON[pid];
            const total = DIFFICULTY_ORDER.reduce((s, d) => s + countFor(pid, d), 0);
            return (
              <button
                key={pid}
                onClick={() => { setProductId(pid); setDifficulty(null); }}
                className="group flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#01304a] to-[#024366] text-white">
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <div className="text-lg font-semibold tracking-tight text-foreground">{PRODUCT_META[pid].label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{PRODUCT_META[pid].description}</div>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                  <Pill tone={total ? "success" : "muted"}>{total} challenges</Pill>
                  <ChevronRight className="ml-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------- Screen 2: Difficulty selection ---------------- */
  if (!difficulty) {
    return (
      <div className="space-y-8">
        <div className="space-y-3">
          <GhostButton onClick={() => setProductId(null)}><ArrowLeft className="h-3.5 w-3.5" /> All products</GhostButton>
          <Header title={`${PRODUCT_META[productId].label} — Difficulties`} subtitle="Choose a difficulty to manage its challenges." />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFICULTY_ORDER.map((d) => {
            const count = countFor(productId, d);
            const target = CHALLENGES_PER_DIFFICULTY[d];
            return (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-elevated"
              >
                <DifficultyDots difficulty={d} className="text-base" />
                <div className="text-lg font-semibold tracking-tight text-foreground">{DIFFICULTY_META[d].label}</div>
                <div className="mt-2 flex items-center justify-between">
                  <Pill tone={count >= target ? "success" : "muted"}>
                    {count}/{target} challenges
                  </Pill>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------------- Screen 3: Challenge list ---------------- */
  const target = CHALLENGES_PER_DIFFICULTY[difficulty];
  const missing = target - list.length;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <GhostButton onClick={() => setDifficulty(null)}><ArrowLeft className="h-3.5 w-3.5" /> {PRODUCT_META[productId].label} difficulties</GhostButton>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button className="hover:text-foreground" onClick={() => setProductId(null)}>{PRODUCT_META[productId].label}</button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{DIFFICULTY_META[difficulty].label}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{DIFFICULTY_META[difficulty].label}</h1>
            <DifficultyDots difficulty={difficulty} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{list.length}/{target} challenges created · complementary, not counted in metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          {missing > 0 && (
            <PrimaryButton onClick={generateSkeleton}>
              <Wand2 className="h-3.5 w-3.5" /> Generate Difficulty Skeleton
            </PrimaryButton>
          )}
          <GhostButton onClick={() => setModal({ mode: "create" })}>
            <Plus className="h-3.5 w-3.5" /> Add Challenge
          </GhostButton>
        </div>
      </div>

      {missing > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          This difficulty has {missing} of {target} challenges missing. Use “Generate Difficulty Skeleton” to create the remaining empty challenges at once — they’re filled in and released gradually, week by week.
        </div>
      )}

      {list.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm text-muted-foreground">No challenges yet for this difficulty.</div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge name={c.category} />
                  {c.premium && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                      Premium
                    </span>
                  )}
                </div>
                <DifficultyDots difficulty={c.difficulty} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{c.title || "Untitled challenge"}</div>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{c.description || "No description yet."}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">{c.video_url ? "🎬 Video attached" : "No attachment"}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModal({ mode: "edit", challenge: c })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-[#f38934]"
                    aria-label="Edit challenge"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteChallenge(c.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    aria-label="Delete challenge"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ChallengeModal
          product={productId}
          difficulty={difficulty}
          categories={categories}
          existing={challenges}
          editing={modal.mode === "edit" ? modal.challenge : undefined}
          onAddCategory={addCategory}
          onClose={() => setModal(null)}
          onSave={(c) => { saveChallenge(c); setModal(null); }}
        />
      )}
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/* ---------------- Challenge Modal ---------------- */

function ChallengeModal({
  product,
  difficulty,
  categories,
  existing,
  editing,
  onAddCategory,
  onClose,
  onSave,
}: {
  product: ChallengeProductId;
  difficulty: DifficultyId;
  categories: string[];
  existing: Challenge[];
  editing?: Challenge;
  onAddCategory: (name: string) => void;
  onClose: () => void;
  onSave: (c: Challenge) => void;
}) {
  const isEdit = !!editing;
  const [category, setCategory] = useState(editing?.category ?? "");
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [diff, setDiff] = useState<DifficultyId>(editing?.difficulty ?? difficulty);
  const [videoSource, setVideoSource] = useState<"url" | "upload">("url");
  const [videoUrl, setVideoUrl] = useState(editing?.video_url ?? "");
  const [premium, setPremium] = useState<boolean>(editing?.premium ?? false);

  const onPickCategory = (v: string) => {
    if (v === "__new__") { setCreatingCat(true); return; }
    setCategory(v);
  };

  const commitNewCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    onAddCategory(trimmed);
    setCategory(trimmed);
    setCreatingCat(false);
    setNewCat("");
  };

  const handleSave = () => {
    const id = editing?.id ?? newChallengeId(product, diff, existing);
    onSave({
      id,
      product,
      difficulty: diff,
      category: category.trim(),
      title: title.trim(),
      description: description.trim(),
      video_url: videoUrl.trim(),
      premium,
      skill_tags: editing?.skill_tags ?? [],
    });
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Challenge" : "New Challenge"}
      subtitle={`${PRODUCT_META[product].label} · ${DIFFICULTY_META[difficulty].label}`}
      onClose={onClose}
    >
      <div className="space-y-4 p-6">
        <Field label="Category">
          {creatingCat ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitNewCategory(); } }}
                className={inputCls}
                placeholder="New category name"
              />
              <PrimaryButton disabled={!newCat.trim()} onClick={commitNewCategory}>Add</PrimaryButton>
              <GhostButton onClick={() => { setCreatingCat(false); setNewCat(""); }}>Cancel</GhostButton>
            </div>
          ) : (
            <select value={category} onChange={(e) => onPickCategory(e.target.value)} className={inputCls}>
              <option value="">— No category —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Create new category</option>
            </select>
          )}
        </Field>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Pitch your idea in 60 seconds" />
        </Field>

        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaCls} placeholder="Brief description of the challenge…" />
        </Field>

        <Field label="Difficulty" hint="Preselected from the screen you're in — change it to move this challenge to another difficulty.">
          <select value={diff} onChange={(e) => setDiff(e.target.value as DifficultyId)} className={inputCls}>
            {DIFFICULTY_ORDER.map((d) => (
              <option key={d} value={d}>{DIFFICULTY_META[d].label}</option>
            ))}
          </select>
        </Field>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={premium}
            onChange={(e) => setPremium(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-[#f38934] focus:ring-[#f38934]"
          />
          <span className="flex-1">
            <span className="block text-xs font-semibold text-foreground">Premium (Advance / Elite only)</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">Restricts this challenge to students on Advance or Elite access plans.</span>
          </span>
        </label>


        <Field label="Attachment (optional)" hint="If left empty, no video is shown on the student's challenge card.">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVideoSource("url")}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${videoSource === "url" ? "border-accent bg-accent/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-secondary"}`}
            >
              <Link2 className="h-4 w-4" /> Video URL
            </button>
            <button
              type="button"
              disabled
              title="Available after the Supabase migration"
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground opacity-70"
            >
              <Lock className="h-4 w-4" /> Upload Video
            </button>
          </div>
          {videoSource === "url" ? (
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={`${inputCls} mt-2`} placeholder="e.g., https://youtube.com/watch?v=... or vimeo link" />
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">
              Available after the Supabase migration.
            </div>
          )}
        </Field>
      </div>
      <ModalFooter>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <PrimaryButton disabled={!title.trim()} onClick={handleSave}>{isEdit ? "Save Changes" : "Create Challenge"}</PrimaryButton>
      </ModalFooter>
    </ModalShell>
  );
}

/* ---------------- Modal primitives ---------------- */

function ModalShell({ title, subtitle, onClose, children, width = "max-w-xl" }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${width} overflow-hidden rounded-2xl border border-border bg-card shadow-elevated`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-[#01304a] to-[#024366] p-6 text-white">
          <div>
            <div className="text-base font-semibold tracking-tight">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-white/70">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </label>
  );
}
