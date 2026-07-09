import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, GhostButton, PrimaryButton, Pill } from "@/components/verbo/ui";
import { ComingSoon } from "@/components/verbo/ComingSoon";
import { Plus, Trash2, X, Pencil, Link2, Lock, Zap, Package, Gift } from "lucide-react";
import {
  type FlashChallenge,
  type FlashProductId,
  type FlashFormat,
  type LightningState,
  FLASH_PRODUCT_ORDER,
  FLASH_PRODUCT_LABEL,
  LIGHTNING_DEFAULT_HOURS,
  loadFlashChallenges,
  persistFlashChallenges,
  subscribeFlashChallenges,
  flashChallengesFor,
  newFlashChallengeId,
  loadFlashConfig,
  persistFlashConfig,
  subscribeFlashConfig,
  loadLightning,
  subscribeLightning,
  activateLightning,
  endLightningEarly,
} from "@/lib/flash-challenges-store";
import {
  loadCategories,
  persistCategories,
  subscribeCategories,
  categoryColor,
} from "@/lib/challenges-store";

export const Route = createFileRoute("/admin/flash")({ component: Page });

const inputCls =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
const textareaCls =
  "min-h-[96px] w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

type SubTab = "mystery_box" | "lightning" | "season";

function Page() {
  const [tab, setTab] = useState<SubTab>("mystery_box");
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Verbo Flash
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Verbo Flash</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Surprise-style complementary challenges. Separate from the weekly Challenges bank.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {[
          { id: "mystery_box" as SubTab, label: "Mystery Box" },
          { id: "lightning" as SubTab, label: "Lightning" },
          { id: "season" as SubTab, label: "Season" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mystery_box" ? (
        <MysteryBoxTab />
      ) : tab === "lightning" ? (
        <LightningTab />
      ) : (
        <ComingSoon title="Season" />
      )}
    </div>
  );
}

/* -------------------- Mystery Box tab -------------------- */

function MysteryBoxTab() {
  const [list, setList] = useState<FlashChallenge[]>(loadFlashChallenges);
  const [config, setConfig] = useState(loadFlashConfig);
  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [product, setProduct] = useState<FlashProductId>("enterprise");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; challenge?: FlashChallenge } | null>(null);
  const [boxArtDraft, setBoxArtDraft] = useState(config.box_art_url ?? "");

  useEffect(() => {
    setList(loadFlashChallenges());
    setCategories(loadCategories());
    setConfig(loadFlashConfig());
    const un1 = subscribeFlashChallenges(() => setList(loadFlashChallenges()));
    const un2 = subscribeCategories(() => setCategories(loadCategories()));
    const un3 = subscribeFlashConfig(() => {
      const next = loadFlashConfig();
      setConfig(next);
      setBoxArtDraft(next.box_art_url ?? "");
    });
    return () => { un1(); un2(); un3(); };
  }, []);

  const filtered = useMemo(
    () => flashChallengesFor(list, "mystery_box", product),
    [list, product],
  );

  const save = (c: FlashChallenge) => {
    setList((prev) => {
      const next = [...prev.filter((x) => x.id !== c.id), c];
      persistFlashChallenges(next);
      return next;
    });
  };
  const del = (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    setList((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistFlashChallenges(next);
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
  const saveBoxArt = () => {
    persistFlashConfig({ ...config, box_art_url: boxArtDraft.trim() || undefined });
  };

  return (
    <div className="space-y-6">
      {/* Box art config */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-[#4a044e] via-[#7e22ce] to-[#a855f7] text-white shadow-sm">
            {config.box_art_url ? (
              <img src={config.box_art_url} alt="Mystery Box" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <Gift className="h-14 w-14 opacity-90" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Mystery Box artwork</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for the Mystery Box card on the student side. Paste an image or GIF URL.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={boxArtDraft}
                onChange={(e) => setBoxArtDraft(e.target.value)}
                placeholder="https://... (image or .gif)"
                className={inputCls}
              />
              <PrimaryButton onClick={saveBoxArt}>Save</PrimaryButton>
            </div>
          </div>
        </div>
      </Card>

      {/* Product selector */}
      <div className="flex flex-wrap gap-2">
        {FLASH_PRODUCT_ORDER.map((p) => (
          <button
            key={p}
            onClick={() => setProduct(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              product === p
                ? "border-[#7e22ce] bg-[#7e22ce]/10 text-[#7e22ce]"
                : "border-border bg-background text-muted-foreground hover:bg-secondary"
            }`}
          >
            {FLASH_PRODUCT_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {filtered.length} Mystery Box challenge{filtered.length === 1 ? "" : "s"} for {FLASH_PRODUCT_LABEL[product]}
        </div>
        <GhostButton onClick={() => setModal({ mode: "create" })}>
          <Plus className="h-3.5 w-3.5" /> Add Challenge
        </GhostButton>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 text-muted-foreground/60" />
            No Mystery Box challenges yet for this product.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {c.category ? (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryColor(c.category)}`}>
                      {c.category}
                    </span>
                  ) : (
                    <Pill tone="muted">No category</Pill>
                  )}
                  {c.premium && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                      Premium
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{c.title || "Untitled"}</div>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{c.description || "No description yet."}</p>
              </div>
              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">{c.video_url ? "🎬 Video attached" : "No attachment"}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModal({ mode: "edit", challenge: c })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-[#7e22ce]"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del(c.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    aria-label="Delete"
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
        <FlashModal
          format="mystery_box"
          product={product}
          categories={categories}
          existing={list}
          editing={modal.mode === "edit" ? modal.challenge : undefined}
          onAddCategory={addCategory}
          onClose={() => setModal(null)}
          onSave={(c) => { save(c); setModal(null); }}
        />
      )}
    </div>
  );
}

/* -------------------- Modal (mirrors ChallengeModal) -------------------- */

function FlashModal({
  format,
  product,
  categories,
  existing,
  editing,
  onAddCategory,
  onClose,
  onSave,
}: {
  format: FlashFormat;
  product: FlashProductId;
  categories: string[];
  existing: FlashChallenge[];
  editing?: FlashChallenge;
  onAddCategory: (name: string) => void;
  onClose: () => void;
  onSave: (c: FlashChallenge) => void;
}) {
  const isEdit = !!editing;
  const [category, setCategory] = useState(editing?.category ?? "");
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(editing?.video_url ?? "");
  const [premium, setPremium] = useState<boolean>(editing?.premium ?? false);
  const [videoSource, setVideoSource] = useState<"url" | "upload">("url");

  const commitNewCategory = () => {
    const t = newCat.trim();
    if (!t) return;
    onAddCategory(t);
    setCategory(t);
    setCreatingCat(false);
    setNewCat("");
  };

  const handleSave = () => {
    const id = editing?.id ?? newFlashChallengeId(format, product, existing);
    onSave({
      id,
      format,
      product,
      category: category.trim(),
      title: title.trim(),
      description: description.trim(),
      video_url: videoUrl.trim() || undefined,
      premium,
      skill_tags: editing?.skill_tags ?? [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-start justify-between gap-4 p-6 text-white ${format === "lightning" ? "bg-gradient-to-br from-[#1e3a8a] via-[#0284c7] to-[#facc15]" : "bg-gradient-to-br from-[#4a044e] via-[#7e22ce] to-[#a855f7]"}`}>
          <div>
            <div className="text-base font-semibold tracking-tight">{isEdit ? `Edit ${format === "lightning" ? "Lightning" : "Mystery Box"} Challenge` : `New ${format === "lightning" ? "Lightning" : "Mystery Box"} Challenge`}</div>
            <div className="mt-0.5 text-xs text-white/70">{FLASH_PRODUCT_LABEL[product]}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
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
              <select
                value={category}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") setCreatingCat(true);
                  else setCategory(v);
                }}
                className={inputCls}
              >
                <option value="">— No category —</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Create new category</option>
              </select>
            )}
          </Field>

          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Improvise a 30-second story" />
          </Field>

          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={textareaCls} placeholder="Describe the challenge…" />
          </Field>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={premium}
              onChange={(e) => setPremium(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-[#7e22ce] focus:ring-[#7e22ce]"
            />
            <span className="flex-1">
              <span className="block text-xs font-semibold text-foreground">Premium (Advance / Elite only)</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">Restricts this challenge to students on Advance or Elite access plans.</span>
            </span>
          </label>

          <Field label="Attachment (optional)">
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
                title="Coming soon"
                className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground opacity-70"
              >
                <Lock className="h-4 w-4" /> Upload File
              </button>
            </div>
            {videoSource === "url" ? (
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={`${inputCls} mt-2`} placeholder="https://youtube.com/watch?v=..." />
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-3 text-xs text-muted-foreground">Coming soon</div>
            )}
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/30 p-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton disabled={!title.trim()} onClick={handleSave}>{isEdit ? "Save Changes" : "Create Challenge"}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-foreground">{label}</div>
      {children}
    </label>
  );
}
